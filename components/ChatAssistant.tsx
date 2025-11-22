
import React, { useState, useRef, useEffect } from 'react';
import { ArticleData, ChatMessage, HistoryItem } from '../types';
import { chatWithAI } from '../services/geminiService';
import { getHistory } from '../services/historyManager';
import { MessageCircle, Send, X, Loader2, Sparkles, History, ChevronUp, ChevronDown, MessageSquare } from 'lucide-react';

interface ChatAssistantProps {
  article: ArticleData;
  onUpdateArticle?: (updated: ArticleData) => void;
  onSelectArticle?: (article: ArticleData) => void;
}

// --- Markdown Renderer ---
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const parse = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const listContent = line.trim().substring(2);
        return <li key={idx} className="ml-4 list-disc marker:text-rose-400">{parseInline(listContent)}</li>;
      }
      return <div key={idx} className="min-h-[1.2em]">{parseInline(line)}</div>;
    });
  };

  const parseInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-rose-500 dark:text-rose-300">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-stone-100 dark:bg-stone-800 px-1 rounded text-rose-600 dark:text-rose-400 font-mono text-xs">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return <em key={i} className="italic text-stone-600 dark:text-stone-300">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  return <div className="space-y-1">{parse(content)}</div>;
};

const ChatAssistant: React.FC<ChatAssistantProps> = ({ article, onUpdateArticle, onSelectArticle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const INITIAL_WELCOME: ChatMessage = { 
    id: 'init', 
    role: 'ai', 
    content: 'Ciallo～(∠・ω<)⌒★\n你好呀！我是你的日语助教。\n关于这篇课文，有不懂的单词或语法都可以问我哦！(｡♥‿♥｡)' 
  };

  useEffect(() => {
    if (article.chatHistory && article.chatHistory.length > 0) {
      setMessages(article.chatHistory);
    } else {
      setMessages([INITIAL_WELCOME]);
    }
    setShowHistoryList(false);
  }, [article.title]);

  useEffect(() => {
    if (showHistoryList) {
        const allHistory = getHistory();
        setHistoryItems(allHistory);
    }
  }, [showHistoryList]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const updateHistory = (newHistory: ChatMessage[]) => {
     setMessages(newHistory);
     if (onUpdateArticle) {
         onUpdateArticle({ ...article, chatHistory: newHistory });
     }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: input };
    const newHistory = [...messages, userMsg];
    updateHistory(newHistory);
    
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await chatWithAI(userMsg.content, article, newHistory);
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', content: responseText };
      updateHistory([...newHistory, aiMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', content: "网络连接有点问题，请稍后再试 (T_T)" };
      updateHistory([...newHistory, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchSession = (item: HistoryItem) => {
      if (onSelectArticle) {
          onSelectArticle(item.data);
      }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 md:right-10 z-40 bg-rose-500 hover:bg-rose-600 text-white p-4 rounded-full shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center gap-2 print:hidden group"
      >
        <MessageCircle className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        <span className="font-bold hidden md:inline">AI 助教</span>
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 md:right-10 w-[90vw] md:w-96 h-[550px] max-h-[70vh] bg-white dark:bg-stone-800 rounded-2xl shadow-2xl border border-rose-100 dark:border-rose-900 z-40 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300 print:hidden font-cute">
      {/* Header */}
      <div className="bg-rose-500 p-4 flex justify-between items-center text-white shrink-0 z-20 relative">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <div className="flex flex-col">
            <h3 className="font-bold text-lg leading-none">日语助教</h3>
            <span className="text-xs text-rose-100 mt-1 opacity-90 truncate max-w-[150px]">
                {article.title || "新会话"}
            </span>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="hover:bg-rose-600 p-1 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-rose-50/30 dark:bg-stone-900/50">
            {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                    ? 'bg-rose-500 text-white rounded-br-none' 
                    : 'bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-100 border border-stone-100 dark:border-stone-600 rounded-bl-none'
                }`}
                >
                   <MarkdownRenderer content={msg.content} />
                </div>
            </div>
            ))}
            {isLoading && (
            <div className="flex justify-start">
                <div className="bg-white dark:bg-stone-700 border border-stone-100 dark:border-stone-600 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                </div>
            </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* History Drawer (Slide Up Overlay) */}
          <div className={`absolute inset-x-0 bottom-0 bg-white dark:bg-stone-800 border-t border-rose-100 dark:border-stone-700 transition-all duration-300 ease-in-out z-30 flex flex-col overflow-hidden ${showHistoryList ? 'h-[80%]' : 'h-0'}`}>
              <div className="p-3 bg-stone-50 dark:bg-stone-900 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center shrink-0">
                  <span className="text-xs font-bold text-stone-500 uppercase flex items-center gap-2">
                      <History size={14} /> 历史会话
                  </span>
                  <button onClick={() => setShowHistoryList(false)} className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-full">
                      <ChevronDown size={16} className="text-stone-400" />
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {historyItems.map(item => (
                      <button 
                        key={item.id}
                        onClick={() => handleSwitchSession(item)}
                        className={`w-full text-left p-3 rounded-xl transition-colors flex items-start gap-3 ${
                            item.data.title === article.title 
                            ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800' 
                            : 'hover:bg-stone-100 dark:hover:bg-stone-700'
                        }`}
                      >
                          <div className={`mt-1 p-1.5 rounded-full ${item.data.title === article.title ? 'bg-rose-100 text-rose-500' : 'bg-stone-100 text-stone-400'}`}>
                              <MessageSquare size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-stone-700 dark:text-stone-200 truncate">
                                  {item.data.title || "无题"}
                              </div>
                              <div className="text-xs text-stone-400 mt-1 truncate">
                                  {new Date(item.timestamp).toLocaleDateString()} · {item.data.chatHistory ? `${item.data.chatHistory.length} 条记录` : '无对话'}
                              </div>
                          </div>
                      </button>
                  ))}
              </div>
          </div>
      </div>

      {/* Input Area Wrapper */}
      <div className="bg-white dark:bg-stone-800 border-t border-stone-100 dark:border-stone-700 shrink-0 z-20 relative">
          {/* Handle to pull up history */}
          <button 
             onClick={() => setShowHistoryList(!showHistoryList)}
             className="w-full h-5 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors group"
             title="切换会话"
          >
              <div className="w-12 h-1 bg-stone-200 dark:bg-stone-600 rounded-full group-hover:bg-rose-300 transition-colors"></div>
          </button>
          
          <form onSubmit={handleSend} className="p-3 pt-1 flex gap-2">
            <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入问题..."
            className="flex-1 bg-stone-100 dark:bg-stone-900 border-transparent focus:bg-white dark:focus:bg-stone-800 focus:border-rose-300 focus:ring-0 rounded-xl px-4 py-2 text-sm transition-all dark:text-stone-100"
            disabled={isLoading}
            />
            <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-rose-500 text-white rounded-xl hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
            <Send className="w-5 h-5" />
            </button>
          </form>
      </div>
    </div>
  );
};

export default ChatAssistant;
