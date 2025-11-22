
import { AppSettings, DEFAULT_SETTINGS } from '../types';

const STORAGE_KEY = 'ai-dokkai-settings-v1';

export const applyTheme = (theme: 'light' | 'dark') => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const getSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    
    const parsed = JSON.parse(stored);
    const settings = { ...DEFAULT_SETTINGS, ...parsed };
    
    // Apply theme side-effect on load
    applyTheme(settings.theme);
    
    return settings;
  } catch (e) {
    console.error("Failed to load settings", e);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: AppSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applyTheme(settings.theme);
  } catch (e) {
    console.error("Failed to save settings", e);
  }
};

// Helper to get the effective API key (User provided > Env > Error)
export const getEffectiveApiKey = (settings: AppSettings): string => {
  if (settings.apiKey && settings.apiKey.trim() !== '') {
    return settings.apiKey;
  }
  
  // Fallback for Gemini if using default provider and env is present
  if (settings.llmProvider === 'gemini' && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  
  return '';
};
