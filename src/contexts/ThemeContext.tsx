import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { tenant } = useAuth();
  const [theme, setThemeState] = useState<Theme>('light');
  const [initialized, setInitialized] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    // Priority 1: Check localStorage
    const savedTheme = localStorage.getItem('dealer-copilot-theme');

    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
      setInitialized(true);
      return;
    }

    // Priority 2: Check OS preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme: Theme = prefersDark ? 'dark' : 'light';
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setInitialized(true);
  }, []);

  // Sync with database when tenant loads
  useEffect(() => {
    if (!initialized || !tenant) return;

    // If tenant has a saved preference, use it
    if (tenant.dark_mode_enabled !== null) {
      const dbTheme: Theme = tenant.dark_mode_enabled ? 'dark' : 'light';

      // Only update if different from current
      if (dbTheme !== theme) {
        setThemeState(dbTheme);
        applyTheme(dbTheme);
        localStorage.setItem('dealer-copilot-theme', dbTheme);
      }
    }
  }, [tenant, initialized]);

  const applyTheme = (newTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('dealer-copilot-theme', newTheme);

    // Async DB update (don't block UI)
    if (tenant?.id) {
      supabase
        .from('tenants')
        .update({ dark_mode_enabled: newTheme === 'dark' })
        .eq('id', tenant.id)
        .then(({ error }) => {
          if (error) console.error('Failed to save theme preference:', error);
        });
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
