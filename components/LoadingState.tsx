import React from 'react';

interface LoadingStateProps {
  charCount?: number;
  statusText?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ charCount = 0, statusText = "正在为您编织文字..." }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-12 flex flex-col items-center justify-center min-h-[400px] text-center border border-rose-50 animate-fade-in">
       <div className="relative w-24 h-24 mb-8">
         {/* Animated Torii Gate / Sun concept */}
         <div className="absolute inset-0 border-4 border-t-rose-400 border-r-rose-200 border-b-pink-100 border-l-rose-300 rounded-full animate-spin"></div>
         <div className="absolute inset-3 border-4 border-t-rose-300 border-r-transparent border-b-rose-200 border-l-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
         <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl font-jp text-rose-500 animate-pulse">
            文
         </div>
       </div>
       
       <h3 className="text-xl font-bold text-stone-700 mb-2">{statusText}</h3>
       <p className="text-stone-500 max-w-md">
         愛読解正在捕捉灵感，斟酌字句，为您呈现一段专属的日语时光。
       </p>
       
       {charCount > 0 && (
         <div className="mt-6 font-mono text-xs text-rose-400 bg-rose-50 px-3 py-1 rounded-full border border-rose-100 animate-in fade-in">
            已接收 {charCount} 字节灵感
         </div>
       )}
       
       <div className="mt-6 flex gap-2">
         <span className="w-2 h-2 bg-rose-300 rounded-full animate-bounce" style={{ animationDelay: '0ms'}}></span>
         <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms'}}></span>
         <span className="w-2 h-2 bg-rose-300 rounded-full animate-bounce" style={{ animationDelay: '300ms'}}></span>
       </div>
    </div>
  );
};

export default LoadingState;
