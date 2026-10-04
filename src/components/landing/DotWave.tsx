import { useEffect, useRef } from 'react';

interface DotWaveProps {
  className?: string;
}

/**
 * A field of dots receding to the horizon with a slow swell, like a road at night.
 * Canvas 2D, no dependencies. Capped at 30fps, paused when off-screen or the tab
 * is hidden, and drawn as a single still frame for reduced-motion users.
 */
export function DotWave({ className }: DotWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const ROWS = 28;
    const NEAR_SPACING_PX = 24;

    let width = 0;
    let height = 0;
    let cols = 0;
    let frame = 0;
    let last = 0;
    let t = 0;
    let onScreen = true;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const horizon = height * 0.08;
      const f = height;
      const camH = (height * 0.98 - horizon) / f;
      const sep = NEAR_SPACING_PX / f;
      const half = (cols - 1) / 2;

      for (let j = ROWS - 1; j >= 0; j--) {
        const z = 1 + j * 0.42;
        const scale = f / z;
        const depth = 1 - j / ROWS;
        for (let i = 0; i < cols; i++) {
          const xi = i - half;
          const x = xi * sep;
          const sx = width / 2 + x * scale;
          if (sx < -4 || sx > width + 4) continue;

          const swell = Math.sin(xi * 0.28 + t * 0.8) * 0.5 + Math.sin(j * 0.55 - t * 0.6) * 0.5;
          const y = swell * 0.035;
          const sy = horizon + (camH - y) * (f / z);
          if (sy > height + 4) continue;

          // Warm "headlight" lane down the middle, cool slate at the edges.
          const center = Math.max(0, 1 - Math.abs(xi) / (half * 0.55));
          const r = Math.round(148 + (251 - 148) * center);
          const g = Math.round(163 + (146 - 163) * center);
          const b = Math.round(184 + (60 - 184) * center);
          const alpha = Math.pow(depth, 1.2) * (0.32 + 0.45 * (swell * 0.5 + 0.5)) * (0.6 + 0.4 * center);
          const size = Math.max(0.7, 2.4 / z);

          ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          if (size > 1.1) {
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(sx - size, sy - size, size * 2, size * 2);
          }
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / NEAR_SPACING_PX) + 6;
      draw();
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (now - last < 33) return; // ~30fps is plenty for a background
      t += Math.min(now - last, 100) / 1000;
      last = now;
      draw();
    };

    const start = () => {
      if (reduce || !onScreen || document.hidden || frame) return;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    visibility.observe(canvas);
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibilityChange);

    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
