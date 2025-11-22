
import React, { useEffect, useState } from 'react';
import { HistoryItem, ArticleData } from '../types';
import { getHistory, deleteStory } from '../services/historyManager';
import { BookOpen, Plus, Trash2, X, Sparkles, Clock, ChevronRight } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArticle: (article: ArticleData) => void;
  onNewArticle: () => void;
  currentArticleId?: string; 
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onSelectArticle, onNewArticle }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setHistory(getHistory());
    }
  }, [isOpen]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteStory(id);
    setHistory(updated);
  };

  const handleSelect = (item: HistoryItem) => {
    onSelectArticle(item.data);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-50 transition-opacity duration-300 animate-in fade-in"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div 
        className={`fixed top-0 left-0 bottom-0 w-80 md:w-96 bg-[#fffbfb] dark:bg-stone-900 shadow-2xl z-50 transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col border-r border-rose-100 dark:border-stone-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-rose-100 dark:border-stone-800 flex justify-between items-center bg-white/50 dark:bg-stone-800/50">
           <div className="flex items-center gap-2 text-stone-800 dark:text-stone-100">
             <span className="bg-rose-400 text-white p-1.5 rounded-lg">
                <BookOpen size={20} />
             </span>
             <h2 className="text-xl font-bold font-jp tracking-wide">书斋 · <span className="text-rose-400 font-cute">Memory</span></h2>
           </div>
           <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700">
             <X size={24} />
           </button>
        </div>

        {/* Actions */}
        <div className="p-4">
           <button 
             onClick={() => { onNewArticle(); onClose(); }}
             className="w-full py-4 px-6 bg-gradient-to-r from-rose-400 to-pink-500 text-white rounded-2xl shadow-lg shadow-rose-200 dark:shadow-none font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.02] hover:shadow-xl active:scale-95 transition-all duration-300 group"
           >
             <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
             <span>开启新的篇章</span>
           </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3 custom-scrollbar">
          <div className="flex items-center gap-2 px-2 mt-4 mb-2 text-xs font-bold text-stone-400 uppercase tracking-widest">
             <Clock size={12} />
             <span>往昔追忆</span>
          </div>
          
          {history.length === 0 ? (
            <div className="text-center py-12 text-stone-300 flex flex-col items-center gap-2">
               <Sparkles size={32} className="opacity-50" />
               <p>暂无藏书</p>
            </div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id}
                onClick={() => handleSelect(item)}
                className="group relative bg-white dark:bg-stone-800 rounded-xl border border-stone-100 dark:border-stone-700 shadow-sm hover:shadow-md hover:border-rose-200 dark:hover:border-rose-800 transition-all duration-300 cursor-pointer overflow-hidden"
              >
                {/* Content Wrapper */}
                <div className="px-5 py-4">
                    {/* Header Row (Always Visible) */}
                    <div className="flex justify-between items-center gap-3 relative z-10">
                        <h3 className="font-bold text-stone-700 dark:text-stone-200 font-jp text-base truncate flex-1 group-hover:text-rose-500 transition-colors">
                            {item.data.title || "无题"}
                        </h3>
                        <span className="text-xs text-stone-400 font-mono shrink-0 whitespace-nowrap">
                              {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                        <button 
                              onClick={(e) => handleDelete(e, item.id)}
                              className="text-stone-300 hover:text-red-400 p-1 -mr-2 transition-colors opacity-0 group-hover:opacity-100"
                              title="删除"
                        >
                              <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Expandable Summary Area */}
                    <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-500 ease-in-out">
                        <div className="overflow-hidden">
                            <div className="pt-3 mt-2 border-t border-dashed border-stone-100 dark:border-stone-700 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-75">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    摘要
                                  </span>
                                </div>
                                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-3">
                                    {item.data.summary || "暂无摘要"}
                                </p>
                                <div className="flex justify-end mt-2">
                                  <span className="text-xs font-bold text-rose-400 flex items-center gap-0.5">
                                    阅读全文 <ChevronRight size={12} />
                                  </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
