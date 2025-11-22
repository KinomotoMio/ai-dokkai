
import React, { useState, useRef, useEffect } from 'react';
import { ArticleData, GenerateRequest } from './types';
import { generateArticle } from './services/geminiService';
import { saveStory } from './services/historyManager';
import { getSettings, saveSettings } from './services/settingsManager';
import Controls from './components/Controls';
import ArticleDisplay from './components/ArticleDisplay';
import ChatAssistant from './components/ChatAssistant';
import LoadingState from './components/LoadingState';
import SettingsModal from './components/SettingsModal';
import Sidebar from './components/Sidebar';
import { GraduationCap, Settings, Menu, Sun, Moon, Github } from 'lucide-react';

const App: React.FC = () => {
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Easter Egg State
  const [danmakuItems, setDanmakuItems] = useState<{id:number, style: React.CSSProperties}[]>([]);
  
  const currentArticleRef = useRef<ArticleData | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     const settings = getSettings();
     setTheme(settings.theme);
  }, []);

  const toggleTheme = () => {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      const settings = getSettings();
      saveSettings({ ...settings, theme: newTheme });
  };

  const handleTriggerEasterEgg = () => {
      // Stampede: ~30 items
      const items = Array.from({ length: 35 }).map((_, i) => {
          const duration = 3 + Math.random() * 4; // 3s to 7s
          const top = Math.random() * 95; // 0% to 95% height
          const fontSize = 1.5 + Math.random() * 3.5; // 1.5rem to 5rem
          const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f43f5e'];
          const color = colors[Math.floor(Math.random() * colors.length)];
          const delay = Math.random() * 1.5;
          
          return {
              id: Date.now() + i,
              style: {
                  top: `${top}%`,
                  animationDuration: `${duration}s`,
                  fontSize: `${fontSize}rem`,
                  color: color,
                  opacity: 0.7 + Math.random() * 0.3, 
                  animationDelay: `${delay}s`,
                  zIndex: 100
              }
          };
      });
      
      setDanmakuItems(items);
      // Clear after animation finishes (approx 8s max)
      setTimeout(() => setDanmakuItems([]), 8500);
  };

  const handleGenerate = async (request: GenerateRequest) => {
    setIsGenerating(true);
    setError(null);
    const initial: ArticleData = { title: '', summary: '', paragraphs: [] };
    setArticle(initial);
    currentArticleRef.current = initial;
    
    setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    try {
      await generateArticle(request, (type, data) => {
        if (type === 'meta') {
            const updated = { ...currentArticleRef.current!, title: data.title, summary: data.summary };
            currentArticleRef.current = updated;
            setArticle(updated);
        } else if (type === 'paragraph') {
            const updated = { ...currentArticleRef.current!, paragraphs: [...currentArticleRef.current!.paragraphs, data] };
            currentArticleRef.current = updated;
            setArticle(updated);
        } else if (type === 'end') {
            if (currentArticleRef.current && currentArticleRef.current.paragraphs.length > 0) {
                saveStory(currentArticleRef.current);
            }
        }
      });
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "创作中断，请重试。";
      
      if (msg.includes("API Key")) msg = "请在右上角设置中配置有效的 API Key。";
      else if (msg.includes("401")) msg = "API Key 无效或已过期。";
      else if (msg.includes("429")) msg = "请求太频繁，请稍候再试。";
      else if (msg.includes("Failed to fetch")) msg = "网络连接失败，请检查您的网络或代理设置。";
      
      setError(msg);
      setIsGenerating(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateArticle = (updatedArticle: ArticleData) => {
    setArticle(updatedArticle);
    currentArticleRef.current = updatedArticle;
    saveStory(updatedArticle);
  };

  const handleSelectHistory = (data: ArticleData) => {
    setArticle(data);
    currentArticleRef.current = data;
    setIsGenerating(false);
    setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleNewArticle = () => {
    setArticle(null);
    currentArticleRef.current = null;
    setIsGenerating(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showIntro = !article?.title && !isGenerating;
  const showLoadingMeta = isGenerating && (!article?.title);

  return (
    <div className="min-h-screen bg-[#fffbfb] dark:bg-stone-950 text-stone-800 dark:text-stone-100 selection:bg-rose-200 selection:text-rose-900 pb-20 font-sans transition-colors duration-300 overflow-x-hidden">
      
      {danmakuItems.length > 0 && (
          <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
              {danmakuItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="absolute right-0 animate-danmaku font-cute font-bold whitespace-nowrap"
                    style={item.style}
                  >
                     Ciallo～(∠・ω&lt;)⌒★
                  </div>
              ))}
          </div>
      )}

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} onTriggerEasterEgg={handleTriggerEasterEgg} />
      <Sidebar 
         isOpen={showSidebar} 
         onClose={() => setShowSidebar(false)} 
         onSelectArticle={handleSelectHistory}
         onNewArticle={handleNewArticle}
      />

      <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-white/80 dark:bg-stone-900/80 border-b border-rose-100 dark:border-rose-900 shadow-sm print:hidden transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center gap-4">
               <button 
                 onClick={() => setShowSidebar(true)}
                 className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-stone-500 dark:text-stone-400 hover:text-rose-500 transition-colors"
               >
                 <Menu size={24} />
               </button>
               
               <div className="flex items-center gap-2 cursor-pointer" onClick={handleNewArticle}>
                    <div className="bg-rose-400 p-1.5 rounded-lg text-white shadow-sm">
                    <GraduationCap size={24} />
                    </div>
                    <h1 className="font-cute text-xl md:text-2xl font-bold tracking-tight text-stone-800 dark:text-stone-100">
                    ai-dokkai <span className="text-rose-400">愛読解</span>
                    </h1>
               </div>
           </div>

           <div className="flex items-center gap-3">
             <button
               onClick={toggleTheme}
               className="p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950 text-stone-500 dark:text-stone-400 hover:text-rose-500 transition-colors"
               title="切换主题"
             >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
             </button>
             
             <a 
                href="https://github.com/KinomotoMio/ai-dokkai" 
                target="_blank" 
                rel="noreferrer"
                className="p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950 text-stone-500 dark:text-stone-400 hover:text-rose-500 transition-colors"
                title="GitHub 仓库"
             >
                <Github size={20} />
             </a>

             <button 
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950 text-stone-500 dark:text-stone-400 hover:text-rose-500 transition-colors"
                title="API 设置"
             >
                <Settings size={20} />
             </button>
           </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8 md:pt-12">
        {showIntro && (
          <div className="text-center mb-12 space-y-4 animate-fade-in-up">
             <h2 className="text-3xl md:text-4xl font-bold font-jp text-stone-800 dark:text-stone-100 tracking-tight">
               日文阅读，<span className="text-rose-400">量身定制</span>
             </h2>
             <p className="text-stone-500 dark:text-stone-400 text-lg max-w-2xl mx-auto leading-relaxed">
               输入灵感关键词，选择适合您的 JLPT 等级。爱读解将为您编织专属的日语篇章，并附上<span className="text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/50 px-1 rounded">假名标注</span>与<span className="text-sky-500 font-bold bg-sky-50 dark:bg-sky-950/50 px-1 rounded">难词解析</span>。
             </p>
             <div className="pt-4">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-500 dark:text-stone-400">
                  支持 Gemini / OpenAI / DeepSeek / Streaming
                </span>
             </div>
          </div>
        )}

        <Controls onGenerate={handleGenerate} isLoading={isGenerating} />

        <div ref={contentRef} className="transition-all duration-500 ease-in-out min-h-[400px]">
          {showLoadingMeta && (
             <div className="animate-float-out absolute w-full max-w-4xl">
                <LoadingState charCount={0} statusText="正在构思故事架构..." />
             </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm mb-8 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <span className="text-red-600 font-bold">Error:</span>
                   <p className="text-red-700 dark:text-red-400 text-sm md:text-base">{error}</p>
                </div>
                <button onClick={() => setShowSettings(true)} className="text-xs underline text-red-600 dark:text-red-400 hover:text-red-800 whitespace-nowrap ml-4">
                    检查设置
                </button>
              </div>
            </div>
          )}

          {article && article.title && (
            <div className="animate-fade-in-up">
              <ArticleDisplay 
                article={article} 
                isGenerating={isGenerating} 
                onUpdateArticle={handleUpdateArticle} 
              />
              <ChatAssistant 
                article={article} 
                onUpdateArticle={handleUpdateArticle} 
                onSelectArticle={handleSelectHistory}
              />
            </div>
          )}
        </div>
      </main>
      
      <footer className="mt-20 border-t border-rose-100 dark:border-rose-900 py-8 text-center text-stone-400 text-sm print:hidden">
        <p>© {new Date().getFullYear()} ai-dokkai 愛読解.</p>
        <p className="mt-2 flex items-center justify-center gap-1">
          Made with <span className="text-rose-400 animate-pulse">♥</span> for Japanese Learners
        </p>
      </footer>
    </div>
  );
};

export default App;
