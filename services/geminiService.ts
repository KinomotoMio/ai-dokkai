
import { GoogleGenAI, Type, Schema, Modality, GenerateContentResponse } from "@google/genai";
import { ArticleData, GenerateRequest, Token, AppSettings, StreamUpdateCallback, Paragraph } from "../types";
import { getSettings, getEffectiveApiKey } from "./settingsManager";

// --- Helpers ---

const TIMEOUT_MS = 120000; // 120 seconds

const timeoutPromise = (ms: number) => new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error(`请求超时 (${Math.round(ms/1000)}秒)。请检查网络连接或 API Key 余额。`)), ms)
);

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([promise, timeoutPromise(TIMEOUT_MS)]);
}

const cleanJsonString = (text: string): string => {
  let clean = text.replace(/```json\n?|```/g, '').trim();
  clean = clean.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const firstOpen = clean.indexOf('{');
  if (firstOpen !== -1) {
    const lastClose = clean.lastIndexOf('}');
    if (lastClose > firstOpen) {
       return clean.substring(firstOpen, lastClose + 1);
    }
    return clean.substring(firstOpen);
  }
  return clean;
};

// --- Minified Data Structures (DTO) ---

interface RawToken {
  w: string;       // surface
  r?: string;      // reading
  tg: boolean;     // isTarget
  d?: boolean;     // isDifficult
  m?: string;      // meaning
  a?: string;      // advice
}

interface RawParagraph {
  ts: RawToken[]; // tokens
}

interface RawArticleData {
  t: string;       // title
  s: string;       // summary
  ps: RawParagraph[]; // paragraphs
}

// Hydrate DTO to App Model
const mapRawParagraphToApp = (raw: RawParagraph): Paragraph => {
  return {
    tokens: raw.ts.map(t => ({
      surface: t.w,
      reading: t.r,
      isTarget: t.tg,
      isDifficult: t.d,
      meaning: t.m,
      advice: t.a
    }))
  };
};

// --- Stream Parser ---

class StreamJsonParser {
  private buffer: string = "";
  private parsedParagraphCount: number = 0;
  private metaParsed: boolean = false;
  private onUpdate: StreamUpdateCallback;

  constructor(onUpdate: StreamUpdateCallback) {
    this.onUpdate = onUpdate;
  }

  push(chunk: string) {
    this.buffer += chunk;
    this.processBuffer();
  }

  private processBuffer() {
    // 1. Try to parse Meta (Title 't' and Summary 's') if not yet done
    if (!this.metaParsed) {
      const psIndex = this.buffer.indexOf('"ps":');
      if (psIndex !== -1) {
        const metaPart = this.buffer.substring(0, psIndex).trim();
        let jsonCandidate = metaPart;
        if (jsonCandidate.endsWith(',')) jsonCandidate = jsonCandidate.slice(0, -1);
        jsonCandidate += '}'; 
        
        try {
          jsonCandidate = cleanJsonString(jsonCandidate);
          const meta = JSON.parse(jsonCandidate);
          if (meta.t && meta.s) {
            this.onUpdate('meta', { title: meta.t, summary: meta.s });
            this.metaParsed = true;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    // 2. Try to extract paragraphs from "ps": [ ... ]
    const psStart = this.buffer.indexOf('"ps":');
    if (psStart !== -1) {
      const arrayStart = this.buffer.indexOf('[', psStart);
      if (arrayStart !== -1) {
        let braceDepth = 0;
        let inString = false;
        let currentObjStart = -1;
        let objectsFound = 0;

        for (let i = arrayStart + 1; i < this.buffer.length; i++) {
          const char = this.buffer[i];
          const prevChar = this.buffer[i - 1];

          if (char === '"' && prevChar !== '\\') {
            inString = !inString;
          }

          if (!inString) {
            if (char === '{') {
              if (braceDepth === 0) currentObjStart = i;
              braceDepth++;
            } else if (char === '}') {
              braceDepth--;
              if (braceDepth === 0 && currentObjStart !== -1) {
                objectsFound++;
                if (objectsFound > this.parsedParagraphCount) {
                  const rawJson = this.buffer.substring(currentObjStart, i + 1);
                  try {
                    const rawPara = JSON.parse(rawJson) as RawParagraph;
                    const appPara = mapRawParagraphToApp(rawPara);
                    this.onUpdate('paragraph', appPara);
                    this.parsedParagraphCount++;
                  } catch (e) {
                    console.warn("Failed to parse paragraph chunk", e);
                  }
                }
                currentObjStart = -1;
              }
            }
          }
        }
      }
    }
  }
}

// --- System Prompt ---

const getSystemPrompt = (request: GenerateRequest) => `
Role: Professional JLPT Exam Setter (日本語能力試験出題者).
Task: Create a reading comprehension passage (Dokkai / 読解) for JLPT Level ${request.level}.
Topic: ${request.topic}
Genre: ${request.genre}

Structure:
1. Title (Japanese)
2. Summary (Chinese, max 100 chars)
3. Paragraphs (Introduction -> Body -> Conclusion)

Output Format: **Minified JSON** (Strictly follow keys to save tokens).
Keys:
- t: Title
- s: Summary
- ps: Paragraphs Array
  - ts: Tokens Array
    - w: Word/Surface
    - r: Reading (only if Kanji, else null/omit)
    - tg: isTarget (boolean, mark 10-15 key words for ${request.level})
    - m: Meaning (Chinese, ONLY for target words)
    - a: Advice (Exam tip, ONLY for target words)

Example:
{
  "t": "夏休みの思い出",
  "s": "讲述了暑假去海边的经历...",
  "ps": [
    { "ts": [ { "w": "私", "tg": false }, { "w": "は", "tg": false } ] },
    { "ts": [ { "w": "海", "r": "うみ", "tg": true, "m": "大海", "a": "基础名词" } ] }
  ]
}

Requirements:
- Article Length: **1000+ characters** (Create a rich, full-length story).
- Grammar: Strictly JLPT ${request.level}.
- Order: You MUST output 't' then 's' then 'ps'.
- **NO MARKDOWN**. START DIRECTLY WITH '{'.
`;

// --- Main Service Functions ---

export const generateArticle = async (
  request: GenerateRequest, 
  onUpdate: StreamUpdateCallback
): Promise<void> => {
  const settings = getSettings();
  const apiKey = getEffectiveApiKey(settings);
  
  if (!apiKey) throw new Error("请在设置中配置 API Key");

  const parser = new StreamJsonParser(onUpdate);

  if (settings.llmProvider === 'gemini') {
    await generateArticleGemini(request, apiKey, settings.model, parser);
  } else {
    await generateArticleOpenAICompatible(request, apiKey, settings, parser);
  }
  
  onUpdate('end', null);
};

const generateArticleGemini = async (
  request: GenerateRequest, 
  apiKey: string, 
  model: string,
  parser: StreamJsonParser
): Promise<void> => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = getSystemPrompt(request); 

  try {
    const result = await ai.models.generateContentStream({
      model: model || 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7, 
      }
    });

    for await (const chunk of result) {
        const chunkText = chunk.text;
        if (chunkText) {
            parser.push(chunkText);
        }
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(`Gemini Error: ${error.message}`);
  }
};

const generateArticleOpenAICompatible = async (
  request: GenerateRequest, 
  apiKey: string, 
  settings: AppSettings,
  parser: StreamJsonParser
): Promise<void> => {
  const prompt = getSystemPrompt(request);

  try {
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: "system", content: prompt },
        ],
        stream: true, 
        response_format: { type: "json_object" }, 
        temperature: 0.7,
        max_tokens: 8192 
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Provider Error: ${response.status} - ${errText}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || ""; 

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") continue;
          try {
            const json = JSON.parse(dataStr);
            const delta = json.choices?.[0]?.delta?.content || "";
            if (delta) {
                parser.push(delta);
            }
          } catch (e) { /* Ignore partial lines */ }
        }
      }
    }
  } catch (error: any) {
    console.error("OpenAI/Custom API Error:", error);
    throw error;
  }
};

export const explainToken = async (word: string, context: string): Promise<Partial<Token>> => {
  const settings = getSettings();
  const apiKey = getEffectiveApiKey(settings);
  const promptText = `Role: Japanese-Chinese Dictionary. Context: "${context}". Target: "${word}". 
  Return JSON: { "reading": "...", "meaning": "..." }.
  
  CRITICAL RULES:
  1. "meaning" MUST be in Simplified Chinese (简体中文). DO NOT USE ENGLISH.
  2. Even if the word is Katakana (e.g., コンピュータ), explain it in Chinese (e.g., 电脑).
  3. "reading" should be Hiragana.
  `;

  try {
    let resultText = "";
    if (settings.llmProvider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const res = await withTimeout(ai.models.generateContent({
        model: settings.model || 'gemini-2.5-flash',
        contents: promptText,
        config: { responseMimeType: "application/json" }
      })) as GenerateContentResponse;
      resultText = res.text || "{}";
    } else {
      const res = await withTimeout(fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: "system", content: promptText }],
          response_format: { type: "json_object" },
          max_tokens: 500
        })
      }));
      const data = await res.json();
      resultText = data.choices?.[0]?.message?.content || "{}";
    }
    return JSON.parse(cleanJsonString(resultText));
  } catch (e) {
    return { meaning: "查询失败" };
  }
};

export interface TTSResult { type: 'pcm' | 'mp3' | 'browser'; data?: ArrayBuffer; }

export const generateSpeech = async (text: string): Promise<TTSResult> => {
  const settings = getSettings();
  const apiKey = getEffectiveApiKey(settings);
  if (settings.ttsProvider === 'browser' || !apiKey) return { type: 'browser' };

  try {
    if (settings.ttsProvider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const response: any = await withTimeout(ai.models.generateContent({
        model: settings.ttsModel || "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.ttsVoice || 'Kore' } } } },
      }));
      const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64) throw new Error("No audio");
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { type: 'pcm', data: bytes.buffer };
    }
    if (settings.ttsProvider === 'openai') {
      const res = await withTimeout(fetch(`${settings.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: settings.ttsModel || 'tts-1', input: text, voice: settings.ttsVoice || 'alloy' })
      }));
      if (!res.ok) throw new Error("TTS Failed");
      return { type: 'mp3', data: await res.arrayBuffer() };
    }
  } catch (e) { return { type: 'browser' }; }
  return { type: 'browser' };
};

export const translateText = async (text: string): Promise<string> => {
  const settings = getSettings();
  const apiKey = getEffectiveApiKey(settings);
  const prompt = `Translate to Simplified Chinese: "${text}"`;
  if (!apiKey) return "请配置 API Key";
  try {
    if (settings.llmProvider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const res = await withTimeout(ai.models.generateContent({ model: settings.model, contents: prompt })) as GenerateContentResponse;
      return res.text || "";
    } else {
      const res = await withTimeout(fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: settings.model, messages: [{ role: "user", content: prompt }], max_tokens: 1000 })
      }));
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }
  } catch (e) { return "翻译失败"; }
};

export const chatWithAI = async (message: string, articleContext: ArticleData, history: {role: 'user'|'ai', content: string}[] = []): Promise<string> => {
  const settings = getSettings();
  const apiKey = getEffectiveApiKey(settings);
  if (!apiKey) return "请配置 API Key";
  const contextText = articleContext.paragraphs.map(p => p.tokens.map(t => t.surface).join('')).join('\n');
  
  const historyContext = history.slice(-5).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
  
  const prompt = `Context:\n${contextText}\n\nHistory:\n${historyContext}\n\nUser: ${message}\n
  Role: Japanese Learning Assistant (日本語学習アシスタント).
  Tone: Cute, cheerful, using Kaomoji (like (*^▽^*), (o^ ^o)), but very helpful and clear.
  Task: Answer questions about the article, explain grammar, or meanings in Simplified Chinese.
  Markdown: You CAN use **bold**, *italic*, \`code\`, and lists.
  `;
  
  try {
    if (settings.llmProvider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey });
        const res = await withTimeout(ai.models.generateContent({ model: settings.model, contents: prompt })) as GenerateContentResponse;
        return res.text || "";
    } else {
        const res = await withTimeout(fetch(`${settings.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: settings.model, messages: [{ role: "user", content: prompt }], max_tokens: 1000 })
        }));
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "";
    }
  } catch (e) { return "请求失败"; }
};

// --- Ciallo Audio Logic ---

// A very short beep encoded to ensure something plays if files fail
const FALLBACK_BEEP_BASE64 = "data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"; 

export const playCialloAudio = () => {
  // 1. Try loading from the specific file path the user provided
  const paths = [
      '/assets/ciallo.mp3',
      'assets/ciallo.mp3',
      './assets/ciallo.mp3',
      'ciallo.mp3'
  ];

  let attemptIdx = 0;

  const tryNextPath = () => {
      if (attemptIdx >= paths.length) {
          playSynthFallback();
          return;
      }

      const currentPath = paths[attemptIdx];
      attemptIdx++;

      const audio = new Audio();
      audio.src = currentPath;
      audio.volume = 0.8;

      audio.oncanplaythrough = () => {
          audio.play().catch(e => {
              // Auto-play policy might block it
              console.warn("Auto-play blocked", e);
              tryNextPath();
          });
      };

      audio.onerror = () => {
          tryNextPath();
      };

      // Try to load
      audio.load();
  };

  const playSynthFallback = () => {
      // Synth fallback to mimic "Ciallo~"
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // High pitched cute slide
        const now = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.linearRampToValueAtTime(1800, now + 0.2);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        
        osc.start(now);
        osc.stop(now + 0.4);
      } catch(e) {
        console.error("Audio fallback failed", e);
      }
  };

  tryNextPath();
};
