import { ArticleData, HistoryItem } from '../types';

const HISTORY_KEY = 'ai-dokkai-history-v2';
const MAX_HISTORY = 20;

export const getHistory = (): HistoryItem[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored).sort((a: HistoryItem, b: HistoryItem) => b.timestamp - a.timestamp);
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveStory = (article: ArticleData): HistoryItem => {
  const history = getHistory();
  
  // Create new item
  const newItem: HistoryItem = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    data: article
  };

  // Add to beginning, filter duplicates (by title roughly), and limit size
  const updated = [newItem, ...history.filter(h => h.data.title !== article.title)].slice(0, MAX_HISTORY);
  
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save history", e);
  }
  
  return newItem;
};

export const deleteStory = (id: string) => {
  const history = getHistory();
  const updated = history.filter(h => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
};
