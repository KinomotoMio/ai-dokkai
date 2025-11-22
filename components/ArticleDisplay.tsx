
import React, { useState, useRef, useEffect } from 'react';
import { ArticleData } from '../types';
import { generateSpeech, translateText, TTSResult } from '../services/geminiService';
import FuriganaToken from './FuriganaToken';
import { Info, Play, Pause, SkipForward, SkipBack, Volume2, Loader2, RefreshCw, AlertCircle, Languages, Printer, Lock, Unlock, X, Sparkles, PenTool, Save, Check } from 'lucide-react';

interface ArticleDisplayProps {
  article: ArticleData;
  isGenerating: boolean;
  onUpdateArticle?: (article: ArticleData) => void;
}

// --- Audio Helpers ---
const decodeAudio = async (result: TTSResult, ctx: AudioContext): Promise<AudioBuffer | null> => {
  if (result.type === 'browser' || !result.data) return null;
  if (result.type === 'pcm') {
    const pcmData = new Uint8Array(result.data);
    const buffer = pcmData.buffer.slice(pcmData.byteOffset, pcmData.byteOffset + pcmData.byteLength);
    const int16Data = new Int16Array(buffer);
    const frameCount = int16Data.length;
    const audioBuffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) channelData[i] = int16Data[i] / 32768.0;
    return audioBuffer;
  } else if (result.type === 'mp3') {
     const bufferCopy = result.data.slice(0);
     return await ctx.decodeAudioData(bufferCopy);
  }
  return null;
};

const speakBrowserTTS = (text: string, onEnd: () => void): SpeechSynthesisUtterance => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.9;
    u.onend = onEnd;
    u.onerror = (e) => { onEnd(); };
    window.speechSynthesis.speak(u);
    return u;
};

const ArticleDisplay: React.FC<ArticleDisplayProps> = ({ article, isGenerating, onUpdateArticle }) => {
  // Audio State
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isUsingBrowserTTS, setIsUsingBrowserTTS] = useState(false);
  
  // UI State
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [failedAudioParagraphs, setFailedAudioParagraphs] = useState<Set<number>>(new Set());

  // Translation State
  const [showTranslation, setShowTranslation] = useState(false);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [loadingTranslations, setLoadingTranslations] = useState<Set<number>>(new Set());
  const [failedTranslations, setFailedTranslations] = useState<Set<number>>(new Set());
  const [editingTranslationIndex, setEditingTranslationIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const browserUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const startTimeRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const playbackSessionIdRef = useRef<number>(0);
  
  const audioCacheRef = useRef<Map<number, AudioBuffer>>(new Map());
  const fetchPromisesRef = useRef<Map<number, Promise<AudioBuffer | null>>>(new Map());
  const translationPromisesRef = useRef<Map<number, Promise<string>>>(new Map());
  
  const paragraphRefs = useRef<(HTMLDivElement | null)[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sync translations from article prop (history loading)
  useEffect(() => {
    if (article.userTranslations) {
      setTranslations(article.userTranslations);
    } else {
      // Reset translations only if switching articles
      // If just re-rendering, we might want to keep local state?
      // Actually, article prop change should trigger this.
      setTranslations({});
    }
  }, [article.title]); // Only reset on title change to avoid overwriting edits on minor updates

  // Reset audio on new article title
  useEffect(() => {
    if (article.paragraphs.length === 0) {
        stopAudio(true);
        audioCacheRef.current.clear();
        fetchPromisesRef.current.clear();
        translationPromisesRef.current.clear();
        setActiveParagraphIndex(null);
        setAudioError(null);
        setFailedAudioParagraphs(new Set());
        setFailedTranslations(new Set());
        setIsPlayerVisible(false);
        playbackSessionIdRef.current = 0;
        setIsUsingBrowserTTS(false);
        setShowTranslation(false);
    }
  }, [article.title]);

  // Auto scroll to bottom while generating
  useEffect(() => {
      if (isGenerating && bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
  }, [article.paragraphs.length, isGenerating]);

  useEffect(() => {
    if (showTranslation) {
        article.paragraphs.forEach((_, index) => {
            if (!translations[index]) loadTranslation(index);
        });
    }
  }, [showTranslation, article.paragraphs.length]);

  // --- Audio Engine Methods ---
  const initAudioContext = async () => {
    if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
    return audioContextRef.current;
  };

  const getParagraphAudioBuffer = async (index: number): Promise<AudioBuffer | null> => {
    if (audioCacheRef.current.has(index)) return audioCacheRef.current.get(index)!;
    if (fetchPromisesRef.current.has(index)) return fetchPromisesRef.current.get(index)!;

    const fetchTask = (async () => {
      try {
        const paragraphText = article.paragraphs[index].tokens.map(t => t.surface).join('');
        const result = await generateSpeech(paragraphText);
        if (result.type === 'browser') return null;
        const ctx = await initAudioContext();
        const audioBuffer = await decodeAudio(result, ctx);
        if (audioBuffer) {
             audioCacheRef.current.set(index, audioBuffer);
             setFailedAudioParagraphs(prev => { const next = new Set(prev); next.delete(index); return next; });
        }
        return audioBuffer;
      } catch (err) {
        setFailedAudioParagraphs(prev => new Set(prev).add(index));
        return null;
      } finally {
        fetchPromisesRef.current.delete(index);
      }
    })();
    fetchPromisesRef.current.set(index, fetchTask);
    return fetchTask;
  };

  const updateProgress = () => {
    if (isUsingBrowserTTS) return;
    if (!audioContextRef.current || !sourceNodeRef.current || !isPlaying) return;
    const currentTime = audioContextRef.current.currentTime - startTimeRef.current + startOffsetRef.current;
    const duration = sourceNodeRef.current.buffer?.duration || 1;
    const progress = Math.min((currentTime / duration) * 100, 100);
    setPlaybackProgress(progress);
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const playParagraph = async (index: number, offset: number = 0) => {
    setIsPlayerVisible(true);
    const currentSessionId = ++playbackSessionIdRef.current;
    stopAudioInternal();
    setActiveParagraphIndex(index);
    setIsLoadingAudio(true);
    setAudioError(null);
    setIsPlaying(false);
    setPlaybackProgress(0);
    startOffsetRef.current = offset;

    try {
      if (index >= article.paragraphs.length) { stopAudio(true); return; }
      const buffer = await getParagraphAudioBuffer(index);
      if (playbackSessionIdRef.current !== currentSessionId) return;
      setIsLoadingAudio(false);

      if (!buffer) {
         setIsUsingBrowserTTS(true);
         setIsPlaying(true);
         const text = article.paragraphs[index].tokens.map(t => t.surface).join('');
         browserUtteranceRef.current = speakBrowserTTS(text, () => {
            if (playbackSessionIdRef.current === currentSessionId) playParagraph(index + 1);
         });
         if (offset === 0 && paragraphRefs.current[index]) paragraphRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
         return;
      }

      setIsUsingBrowserTTS(false);
      const ctx = await initAudioContext();
      const duration = buffer.duration;
      if (offset >= duration) { playParagraph(index + 1); return; }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
         if (playbackSessionIdRef.current === currentSessionId) setTimeout(() => playParagraph(index + 1), 100);
      };
      sourceNodeRef.current = source;
      startTimeRef.current = ctx.currentTime;
      source.start(0, offset);
      setIsPlaying(true);
      setPlaybackProgress((offset / duration) * 100);
      updateProgress();
      if (offset === 0 && paragraphRefs.current[index]) paragraphRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (err) {
      if (playbackSessionIdRef.current === currentSessionId) {
        setAudioError("无法播放音频");
        setIsLoadingAudio(false);
      }
    }
  };

  const stopAudioInternal = () => {
      if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch(e) {} sourceNodeRef.current = null; }
      if (browserUtteranceRef.current) { window.speechSynthesis.cancel(); browserUtteranceRef.current = null; }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const stopAudio = (fullReset = false) => {
    stopAudioInternal();
    setIsPlaying(false);
    if (fullReset) { setActiveParagraphIndex(null); setPlaybackProgress(0); setIsPlayerVisible(false); }
  };

  const pauseAudio = () => {
    if (isUsingBrowserTTS) { window.speechSynthesis.pause(); setIsPlaying(false); return; }
    if (!audioContextRef.current || !sourceNodeRef.current) return;
    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    startOffsetRef.current = startOffsetRef.current + elapsed;
    stopAudioInternal();
    setIsPlaying(false);
  };

  const resumeAudio = () => {
    if (isUsingBrowserTTS) { window.speechSynthesis.resume(); setIsPlaying(true); return; }
    if (activeParagraphIndex !== null) playParagraph(activeParagraphIndex, startOffsetRef.current);
  };
  
  const togglePlayAll = () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      if (activeParagraphIndex !== null) {
        resumeAudio();
      } else {
        playParagraph(0);
      }
    }
  };

  const seekAudio = (percentage: number) => {
      if (activeParagraphIndex === null || isUsingBrowserTTS) return;
      const buffer = audioCacheRef.current.get(activeParagraphIndex);
      if (!buffer) return;
      const duration = buffer.duration;
      const newOffset = duration * (percentage / 100);
      playParagraph(activeParagraphIndex, newOffset);
  };

  // --- Translation ---

  const updateTranslationsAndNotify = (index: number, text: string) => {
      // Critical fix: Use functional update to ensure we don't lose other translations
      setTranslations(prev => {
          const updated = { ...prev, [index]: text };
          
          // Notify parent with the LATEST state, not the stale one
          if (onUpdateArticle) {
            // We need to ensure we aren't just passing the current 'article' prop if it's stale
            // But for this callback, passing the updated parts is usually enough if parent handles it right.
            // However, to be safe, we merge with the prop.
            onUpdateArticle({ ...article, userTranslations: updated });
          }
          return updated;
      });
  };

  const loadTranslation = async (index: number, retry = false) => {
      // Check local state OR prop state to prevent re-fetching
      if (!retry && (translations[index] || translationPromisesRef.current.has(index))) return;
      
      const paragraphText = article.paragraphs[index].tokens.map(t => t.surface).join('');
      setLoadingTranslations(prev => new Set(prev).add(index));
      setFailedTranslations(prev => { const next = new Set(prev); next.delete(index); return next; });
      
      const promise = translateText(paragraphText);
      translationPromisesRef.current.set(index, promise);
      
      try {
          const result = await promise;
          if (result === "翻译失败" || !result) throw new Error("Translation failed");
          updateTranslationsAndNotify(index, result);
      } catch (e) {
          setFailedTranslations(prev => new Set(prev).add(index));
      } finally {
          setLoadingTranslations(prev => { const next = new Set(prev); next.delete(index); return next; });
          translationPromisesRef.current.delete(index);
      }
  };

  const startEditingTranslation = (index: number) => {
      setEditingText(translations[index] || "");
      setEditingTranslationIndex(index);
  };

  const saveEditingTranslation = (index: number) => {
      if (editingText.trim() !== "") {
          updateTranslationsAndNotify(index, editingText);
      }
      setEditingTranslationIndex(null);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || isUsingBrowserTTS) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
      seekAudio(percentage);
  };
  
  const isDesktopExpanded = isPinned || isHovered;

  return (
    <>
        <style>{`
            @media print {
                body * { visibility: hidden; }
                #article-content, #article-content * { visibility: visible; }
                #article-content { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
                .no-print { display: none !important; }
            }
        `}</style>

        <div id="article-content" className="space-y-8 pb-32 md:pb-40 relative">
        {/* Article Info Card */}
        {article.title && (
            <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl shadow-rose-100/50 dark:shadow-rose-900/20 p-8 border border-rose-50 dark:border-rose-950/50 relative overflow-hidden group animate-slide-in transition-colors duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-100 to-transparent dark:from-rose-900/30 opacity-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-700 no-print"></div>
                <div className="relative z-10">
                <h1 className="text-3xl md:text-4xl font-bold text-stone-800 dark:text-stone-100 mb-4 font-jp leading-relaxed tracking-wide">{article.title}</h1>
                
                <div className="flex flex-col md:flex-row gap-6 text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800/50 rounded-xl p-5 border border-stone-100 dark:border-stone-800">
                    <div className="flex-1">
                    <h3 className="text-sm font-bold text-stone-400 uppercase mb-2 flex items-center gap-2"><Info size={14} /> 摘要</h3>
                    <p className="text-base leading-relaxed font-medium">{article.summary || "正在生成摘要..."}</p>
                    </div>
                    <div className="flex gap-2 md:flex-col justify-center md:border-l border-stone-200 dark:border-stone-700 md:pl-6 no-print">
                        <button onClick={togglePlayAll} disabled={article.paragraphs.length === 0} className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-rose-200 dark:shadow-none disabled:opacity-50 disabled:shadow-none">
                            {isPlaying ? <Pause fill="currentColor" size={18}/> : <Play fill="currentColor" size={18}/>}
                            <span>聆听全篇</span>
                        </button>
                        <div className="flex gap-2">
                            <button onClick={() => setShowTranslation(!showTranslation)} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all border-2 ${showTranslation ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800' : 'bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-rose-300 hover:text-rose-500'}`}>
                                <Languages size={18} />
                                <span>{showTranslation ? '隐藏翻译' : '双语对照'}</span>
                            </button>
                            <button onClick={() => window.print()} className="px-4 py-3 rounded-xl font-bold transition-all border-2 bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-rose-300 hover:text-rose-500">
                                <Printer size={18} />
                            </button>
                        </div>
                    </div>
                </div>
                </div>
            </div>
        )}

        {/* Paragraphs */}
        <div className="space-y-8">
            {article.paragraphs.map((paragraph, pIndex) => (
            <div 
                key={pIndex} 
                ref={(el) => { paragraphRefs.current[pIndex] = el; }}
                className={`rounded-2xl p-6 md:p-8 transition-all duration-500 border-2 relative group animate-slide-in ${activeParagraphIndex === pIndex ? 'bg-white dark:bg-stone-900 border-rose-300 dark:border-rose-700 shadow-lg shadow-rose-100 dark:shadow-none scale-[1.01] z-10 ring-4 ring-rose-50 dark:ring-rose-900/30' : 'bg-white dark:bg-stone-900 border-transparent hover:border-stone-100 dark:hover:border-stone-800 hover:shadow-md'}`}
                onClick={() => { 
                  if (window.getSelection()?.toString()) return; 
                  if (editingTranslationIndex === pIndex) return;
                  if (activeParagraphIndex !== pIndex) playParagraph(pIndex); 
                  else if (isPlaying) pauseAudio(); 
                  else resumeAudio(); 
                }}
            >
                <div className="text-xl md:text-2xl leading-loose font-jp text-stone-800 dark:text-stone-100 tracking-wide">
                {paragraph.tokens.map((token, tIndex) => (
                    <FuriganaToken key={`${pIndex}-${tIndex}`} token={token} context={paragraph.tokens.map(t => t.surface).join('')} />
                ))}
                </div>

                {showTranslation && (
                    <div className="mt-6 pt-4 border-t border-dashed border-stone-200 dark:border-stone-700 animate-in fade-in slide-in-from-top-2 duration-300">
                        {loadingTranslations.has(pIndex) ? (
                            <div className="flex items-center gap-2 text-stone-400 text-sm"><Loader2 className="animate-spin w-4 h-4" />正在翻译...</div>
                        ) : failedTranslations.has(pIndex) ? (
                            <div className="flex items-center gap-2 text-rose-400 text-sm cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); loadTranslation(pIndex, true); }}><AlertCircle className="w-4 h-4" />翻译失败，点击重试</div>
                        ) : (
                           <div className="group/trans relative">
                              {editingTranslationIndex === pIndex ? (
                                 <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                                    <textarea 
                                      value={editingText} 
                                      onChange={(e) => setEditingText(e.target.value)}
                                      className="w-full p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border-2 border-rose-200 dark:border-rose-900 focus:border-rose-400 focus:ring-0 text-stone-700 dark:text-stone-200 text-base leading-relaxed"
                                      rows={3}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setEditingTranslationIndex(null)} className="px-3 py-1.5 text-sm font-bold text-stone-400 hover:text-stone-600">取消</button>
                                        <button onClick={() => saveEditingTranslation(pIndex)} className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 shadow-sm">
                                          <Check size={14} /> 保存
                                        </button>
                                    </div>
                                 </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                    <p className="text-stone-500 dark:text-stone-400 leading-relaxed text-base font-medium flex-1">{translations[pIndex]}</p>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); startEditingTranslation(pIndex); }}
                                      className="opacity-0 group-hover/trans:opacity-100 p-1.5 text-stone-300 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/50 rounded-lg transition-all"
                                      title="编辑翻译"
                                    >
                                      <PenTool size={14} />
                                    </button>
                                </div>
                              )}
                           </div>
                        )}
                    </div>
                )}

                <div className="absolute bottom-3 right-3 flex gap-2 no-print">
                   {activeParagraphIndex === pIndex && (
                       <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all ${isLoadingAudio ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-500 dark:bg-rose-950 dark:text-rose-400'}`}>
                           {isLoadingAudio ? <><Loader2 className="animate-spin w-3 h-3" />加载中</> : <><Volume2 className={`w-3 h-3 ${isPlaying ? 'animate-pulse' : ''}`} />{isPlaying ? '聆听中' : '暂停'}</>}
                       </div>
                   )}
                </div>
            </div>
            ))}
        </div>

        {/* Magic Loader for Next Paragraph */}
        {isGenerating && (
            <div ref={bottomRef} className="flex flex-col items-center justify-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="relative">
                    <Sparkles className="w-8 h-8 text-rose-400 animate-spin" style={{ animationDuration: '3s' }} />
                    <div className="absolute inset-0 bg-rose-200 rounded-full opacity-20 animate-ping"></div>
                </div>
                <p className="mt-4 text-stone-400 text-sm font-bold tracking-widest uppercase animate-pulse">正在编织下一段落...</p>
            </div>
        )}

        {/* Persistent Audio Player */}
        <div className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out no-print ${!isPlayerVisible ? 'translate-y-full' : 'translate-y-0'}`} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <div className={`hidden md:block absolute bottom-0 left-0 right-0 h-4 w-full cursor-pointer group z-40 ${isDesktopExpanded ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-rose-100/50 dark:bg-rose-900/30 group-hover:h-2 transition-all duration-200">
                     <div className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" style={{ width: `${playbackProgress}%` }} />
                </div>
            </div>
            <div className={`bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-t border-rose-100 dark:border-rose-900 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col ${!isDesktopExpanded ? 'md:translate-y-full md:opacity-0' : 'md:translate-y-0 md:opacity-100'}`}>
                <div ref={progressBarRef} className={`h-2 bg-stone-100 dark:bg-stone-800 relative group ${isUsingBrowserTTS ? 'cursor-default' : 'cursor-pointer'}`} onClick={handleProgressBarClick}>
                    <div className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-100 ease-linear group-hover:brightness-110" style={{ width: `${playbackProgress}%` }}>
                        {!isUsingBrowserTTS && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />}
                    </div>
                </div>
                <div className="max-w-4xl mx-auto w-full px-4 py-3 flex items-center justify-between gap-4 text-stone-800 dark:text-stone-100">
                    <div className="flex-1 min-w-0 hidden sm:flex flex-col justify-center">
                        <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">正在聆听 {isUsingBrowserTTS && '(浏览器)'}</span>
                        <span className="text-sm text-stone-700 dark:text-stone-300 font-medium truncate">段落 {activeParagraphIndex !== null ? activeParagraphIndex + 1 : '-'} / {article.paragraphs.length}</span>
                    </div>
                    <div className="flex items-center justify-center gap-4 md:gap-6 flex-1">
                        <button onClick={() => playParagraph(Math.max(0, (activeParagraphIndex || 0) - 1))} disabled={activeParagraphIndex === 0} className="text-stone-400 hover:text-rose-500 disabled:opacity-30"><SkipBack className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" /></button>
                        <button onClick={togglePlayAll} className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-rose-500 text-white shadow-lg hover:bg-rose-600 hover:scale-105 active:scale-95 transition-all">
                            {isLoadingAudio ? <Loader2 className="w-6 h-6 animate-spin" /> : isPlaying ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6 ml-1" fill="currentColor" />}
                        </button>
                        <button onClick={() => playParagraph(Math.min(article.paragraphs.length - 1, (activeParagraphIndex || 0) + 1))} disabled={activeParagraphIndex === article.paragraphs.length - 1} className="text-stone-400 hover:text-rose-500 disabled:opacity-30"><SkipForward className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" /></button>
                    </div>
                    <div className="flex-1 flex items-center justify-end gap-2">
                        <div className="hidden md:flex items-center gap-2 border-r border-stone-200 dark:border-stone-700 pr-3 mr-1">
                            <button onClick={() => setIsPinned(!isPinned)} className={`p-2 rounded-lg transition-colors ${isPinned ? 'bg-rose-50 dark:bg-rose-950 text-rose-500' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}>
                                {isPinned ? <Lock size={18} /> : <Unlock size={18} />}
                            </button>
                        </div>
                        <button onClick={() => { stopAudio(true); setIsPlayerVisible(false); }} className="p-2 rounded-lg text-stone-400 hover:text-rose-500 transition-colors"><X size={18} /></button>
                    </div>
                </div>
            </div>
        </div>
        
    </div>
    </>
  );
};

export default ArticleDisplay;
