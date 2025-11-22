
import React, { useState } from 'react';
import { JLPTLevel, Genre, GenerateRequest } from '../types';
import { Sparkles, BookOpen, PenTool } from 'lucide-react';

interface ControlsProps {
  onGenerate: (req: GenerateRequest) => void;
  isLoading: boolean;
}

const Controls: React.FC<ControlsProps> = ({ onGenerate, isLoading }) => {
  const [level, setLevel] = useState<JLPTLevel>(JLPTLevel.N3);
  const [genre, setGenre] = useState<Genre>(Genre.STORY);
  const [topic, setTopic] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onGenerate({ level, genre, topic });
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl shadow-rose-100/50 dark:shadow-rose-900/20 p-6 md:p-8 mb-8 border border-rose-50 dark:border-rose-950/30 print:hidden animate-fade-in-up transition-colors duration-300">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* JLPT Level Selector */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-stone-600 dark:text-stone-400 tracking-wide uppercase">
              <Sparkles className="w-4 h-4 text-rose-400" />
              JLPT 等级
            </label>
            <div className="flex rounded-xl bg-stone-100 dark:bg-stone-800 p-1 shadow-inner">
              {Object.values(JLPTLevel).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                    level === l
                      ? 'bg-white dark:bg-stone-700 text-rose-500 shadow-sm transform scale-[1.02]'
                      : 'text-stone-400 hover:text-rose-400'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Genre Selector */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-stone-600 dark:text-stone-400 tracking-wide uppercase">
              <BookOpen className="w-4 h-4 text-rose-400" />
              文体风格
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value as Genre)}
              className="w-full bg-stone-100 dark:bg-stone-800 border-transparent focus:border-rose-400 focus:bg-white dark:focus:bg-stone-700 focus:ring-0 rounded-xl py-2.5 px-4 text-stone-700 dark:text-stone-200 font-medium shadow-sm transition-colors"
            >
              {Object.values(Genre).map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Topic Input */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-stone-600 dark:text-stone-400 tracking-wide uppercase">
            <PenTool className="w-4 h-4 text-rose-400" />
            创作灵感 / 关键词
          </label>
          <div className="relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：雨夜的咖啡馆、猫的报恩、关于未来的想象..."
              className="w-full bg-stone-100 dark:bg-stone-800 border-2 border-transparent focus:border-rose-400 focus:bg-white dark:focus:bg-stone-700 focus:ring-0 rounded-xl py-3 px-4 text-stone-800 dark:text-stone-100 font-medium shadow-sm transition-all placeholder:text-stone-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !topic.trim()}
              className={`absolute right-2 top-2 bottom-2 px-6 rounded-lg font-bold text-white shadow-md transition-all duration-300 ${
                isLoading || !topic.trim()
                  ? 'bg-stone-300 dark:bg-stone-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-rose-400 to-pink-500 hover:from-rose-500 hover:to-pink-600 hover:shadow-lg active:scale-95'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  执笔中
                </span>
              ) : '开始创作'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Controls;
