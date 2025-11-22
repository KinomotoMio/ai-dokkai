import React, { useState, useRef, useEffect } from 'react';
import { Token } from '../types';
import { explainToken } from '../services/geminiService';
import { Volume2, Loader2 } from 'lucide-react';

interface FuriganaTokenProps {
  token: Token;
  context: string; // Full sentence/paragraph context for better translation
}

const FuriganaToken: React.FC<FuriganaTokenProps> = ({ token, context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  
  // State for dynamically fetched info (for non-target words)
  const [dynamicInfo, setDynamicInfo] = useState<{meaning?: string, reading?: string} | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const displayReading = token.reading || dynamicInfo?.reading;
  const displayMeaning = token.meaning || dynamicInfo?.meaning;

  const handleMouseEnter = () => {
    if ((!token.isTarget && !token.isDifficult) && !dynamicInfo) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (token.isTarget || token.isDifficult) {
      setIsOpen(!isOpen);
      return;
    }

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    if (dynamicInfo) {
      setIsOpen(true);
      return;
    }

    setIsLoadingInfo(true);
    setIsOpen(true); 
    
    try {
      const info = await explainToken(token.surface, context);
      setDynamicInfo({
        reading: info.reading,
        meaning: info.meaning
      });
    } catch (err) {
      console.error("Failed to explain token", err);
      setIsOpen(false);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleTooltipMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    setIsOpen(false);
  };

  const playWordAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    const u = new SpeechSynthesisUtterance(token.surface);
    u.lang = 'ja-JP';
    u.rate = 0.8; 
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  // Styling Logic
  const baseClasses = "relative inline-block mx-0.5 px-0.5 rounded transition-colors duration-200";
  let stateClasses = "";
  
  if (token.isTarget) {
    // Target Words: Sakura Pink Background
    stateClasses = "cursor-help hover:bg-rose-100 border-b-2 border-rose-300 hover:border-rose-400";
  } else if (token.isDifficult) {
    // Difficult Words: Cyan/Sky Blue Underline or Subtle Background
    stateClasses = "cursor-help hover:bg-sky-50 border-b-2 border-sky-300 hover:border-sky-400";
  } else {
    // Normal Words
    stateClasses = "cursor-pointer hover:bg-stone-100 border-b-2 border-transparent hover:border-stone-200";
    if (isOpen) stateClasses += " bg-stone-100 border-stone-200";
  }

  return (
    <span 
      className={`${baseClasses} ${stateClasses}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <ruby className="font-jp text-lg md:text-xl leading-loose select-none">
        {token.surface}
        {displayReading && (
          <rt className={`text-xs font-normal select-none ${token.isTarget ? 'text-rose-500' : token.isDifficult ? 'text-sky-600' : 'text-stone-500'}`}>
            {displayReading}
          </rt>
        )}
      </ruby>
      
      {/* Tooltip */}
      {isOpen && (
        <div 
          className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-4 bg-stone-800/95 backdrop-blur text-white text-sm rounded-xl shadow-2xl z-50 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 print:hidden`}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          onClick={(e) => e.stopPropagation()} 
        >
          {/* Triangle pointer */}
          <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-stone-800/95"></span>
          
          {isLoadingInfo ? (
             <div className="flex items-center justify-center py-4 text-stone-300 gap-2">
                <Loader2 className="animate-spin w-4 h-4" />
                <span>AI 查询中...</span>
             </div>
          ) : (
            <>
              <div className="flex justify-between items-center border-b border-stone-600 pb-2">
                 <div className="flex flex-col">
                   <span className={`font-bold text-lg leading-none ${token.isTarget ? 'text-rose-300' : token.isDifficult ? 'text-sky-300' : 'text-stone-200'}`}>
                     {token.surface}
                   </span>
                   {displayReading && <span className="text-stone-400 text-xs mt-1">{displayReading}</span>}
                 </div>
                 <button 
                    onClick={playWordAudio}
                    className="p-2 rounded-full bg-stone-700 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                    title="朗读单词"
                    type="button"
                 >
                   <Volume2 size={16} />
                 </button>
              </div>
              
              <div>
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">释义</span>
                <p className="text-stone-100 font-medium mt-1">{displayMeaning || "暂无释义"}</p>
              </div>

              {token.advice && (
                <div className="bg-stone-700 rounded p-2 mt-1">
                   <span className="flex items-center gap-1 text-xs font-bold text-yellow-400 uppercase tracking-wider mb-1">
                     💡 备考建议
                   </span>
                   <p className="text-stone-300 text-xs leading-relaxed">{token.advice}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </span>
  );
};

export default FuriganaToken;