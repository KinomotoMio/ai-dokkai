
export enum JLPTLevel {
  N5 = 'N5',
  N4 = 'N4',
  N3 = 'N3',
  N2 = 'N2',
  N1 = 'N1'
}

export enum Genre {
  STORY = '小说/故事',
  ESSAY = '评论/随笔',
  DIALOGUE = '播客/对话',
  POEM = '诗歌/俳句',
  NEWS = '新闻报道'
}

export interface Token {
  surface: string;       // The displayed text (Kanji or Kana)
  reading?: string;      // Furigana (Hiragana/Katakana), optional if surface is Kana
  isTarget: boolean;     // Is this a target vocabulary word for the requested level?
  isDifficult?: boolean; // Is this a difficult/rare word that needs attention?
  meaning?: string;      // Chinese meaning
  advice?: string;       // Exam advice or usage nuance
}

export interface Paragraph {
  tokens: Token[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

export interface ArticleData {
  title: string;
  summary: string;
  paragraphs: Paragraph[];
  userTranslations?: Record<number, string>; // Persisted translations
  chatHistory?: ChatMessage[]; // Persisted chat history
}

// New Streaming Types
export type StreamEventType = 'meta' | 'paragraph' | 'end';

export interface StreamUpdateCallback {
  (type: StreamEventType, data: any): void;
}

export interface GenerateRequest {
  level: JLPTLevel;
  genre: Genre;
  topic: string;
}

// --- Settings Types ---

export type LLMProvider = 'gemini' | 'openai' | 'custom'; // 'custom' for DeepSeek/Others via OpenAI protocol
export type TTSProvider = 'gemini' | 'openai' | 'browser';

export interface AppSettings {
  // LLM Config
  llmProvider: LLMProvider;
  apiKey: string;
  baseUrl: string; // For OpenAI/Custom
  model: string;   // e.g., "gpt-4o", "deepseek-chat", "gemini-2.5-flash"
  
  // TTS Config
  ttsProvider: TTSProvider;
  ttsModel: string; // e.g. "tts-1", "gemini-..."
  ttsVoice: string; // e.g. "alloy", "shimmer", "Kore"

  // UI Config
  theme: 'light' | 'dark';
}

export const DEFAULT_SETTINGS: AppSettings = {
  llmProvider: 'gemini',
  apiKey: '', // User must provide, or we fallback to env if empty and env exists
  baseUrl: 'https://api.openai.com/v1',
  model: 'gemini-2.5-flash',
  ttsProvider: 'gemini',
  ttsModel: 'gemini-2.5-flash-preview-tts',
  ttsVoice: 'Kore',
  theme: 'light'
};

// --- History Types ---
export interface HistoryItem {
  id: string;
  timestamp: number;
  data: ArticleData;
}
