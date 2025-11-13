// =====================================================
// TIMEOUT SIGNAL HELPERS
// =====================================================
// Some runtimes (older Deno Deploy versions) don't support AbortSignal.timeout.
// This helper provides a safe way to create abort signals with a manual fallback.

/**
 * Create an AbortSignal that will fire after the provided timeout.
 * Falls back to a manual AbortController if AbortSignal.timeout is unavailable.
 */
export function createTimeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined') {
      const timeoutFn = (AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal }).timeout;
      if (typeof timeoutFn === 'function') {
        return timeoutFn(ms);
      }
    }
  } catch (_error) {
    // Ignore and fall back to manual controller below
  }

  if (typeof AbortController === 'undefined') {
    return undefined;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  controller.signal.addEventListener('abort', () => clearTimeout(timer));
  return controller.signal;
}
