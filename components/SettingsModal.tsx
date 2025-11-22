
import React, { useState, useEffect } from 'react';
import { X, Save, Settings2, Cpu, Volume2, Key, Globe, Server, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS, LLMProvider, TTSProvider } from '../types';
import { getSettings, saveSettings } from '../services/settingsManager';
import { generateSpeech, translateText, TTSResult, playCialloAudio } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerEasterEgg?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onTriggerEasterEgg }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'llm' | 'tts'>('llm');
  
  // Test States
  const [llmTestStatus, setLlmTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ttsTestStatus, setTtsTestStatus] = useState<'idle' | 'loading' | 'playing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
      setLlmTestStatus('idle');
      setTtsTestStatus('idle');
    }
  }, [isOpen]);

  const handleChange = (field: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveSettings(settings);
    onClose();
  };

  const handleTestLLM = async () => {
    saveSettings(settings); // Save temporarily for service to use
    setLlmTestStatus('loading');
    try {
      const res = await translateText("Hello");
      if (res && res !== "翻译失败" && !res.includes("Error")) {
        setLlmTestStatus('success');
      } else {
        setLlmTestStatus('error');
      }
    } catch (e) {
      setLlmTestStatus('error');
    }
  };

  const handleTestTTS = async () => {
    saveSettings(settings); // Save for service
    setTtsTestStatus('loading');
    try {
      // Easter Egg Trigger: Ciallo Logic
      setTtsTestStatus('playing');
      playCialloAudio();
      
      if (onTriggerEasterEgg) onTriggerEasterEgg();
      
      // Wait a bit to simulate playback "success" since we fired and forgot the audio
      setTimeout(() => {
         setTtsTestStatus('success');
      }, 1000);

    } catch (e) {
      setTtsTestStatus('error');
    }
  };

  const applyPreset = (provider: LLMProvider) => {
    if (provider === 'openai') {
      setSettings(prev => ({
        ...prev,
        llmProvider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        ttsProvider: 'openai',
        ttsModel: 'tts-1',
        ttsVoice: 'alloy'
      }));
    } else if (provider === 'custom') {
      setSettings(prev => ({
        ...prev,
        llmProvider: 'custom',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        ttsProvider: 'browser'
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        llmProvider: 'gemini',
        model: 'gemini-2.5-flash',
        ttsProvider: 'gemini'
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/50 dark:border-stone-800 flex flex-col max-h-[90vh] transition-colors">
        
        {/* Header */}
        <div className="bg-stone-50 dark:bg-stone-950 px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-stone-800 dark:text-stone-100">
            <Settings2 className="w-5 h-5 text-rose-400" />
            <h2 className="text-lg font-bold">API 设置</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100 dark:border-stone-800">
            <button 
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'llm' ? 'text-rose-500 border-b-2 border-rose-500 bg-rose-50/50 dark:bg-rose-950/30' : 'text-stone-400 hover:text-stone-600'}`}
                onClick={() => setActiveTab('llm')}
            >
                <Cpu className="w-4 h-4" /> 模型服务 (LLM)
            </button>
            <button 
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'tts' ? 'text-rose-500 border-b-2 border-rose-500 bg-rose-50/50 dark:bg-rose-950/30' : 'text-stone-400 hover:text-stone-600'}`}
                onClick={() => setActiveTab('tts')}
            >
                <Volume2 className="w-4 h-4" /> 语音合成 (TTS)
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-stone-800 dark:text-stone-200">
          
          {activeTab === 'llm' && (
            <div className="space-y-6">
               {/* Provider Selector */}
               <div className="grid grid-cols-3 gap-3">
                  {(['gemini', 'openai', 'custom'] as LLMProvider[]).map(p => (
                    <button
                      key={p}
                      onClick={() => applyPreset(p)}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        settings.llmProvider === p 
                        ? 'border-rose-400 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400' 
                        : 'border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-500 hover:border-rose-200'
                      }`}
                    >
                      {p === 'gemini' ? 'Google Gemini' : p === 'openai' ? 'OpenAI' : '自定义 / DeepSeek'}
                    </button>
                  ))}
               </div>

               <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase">
                        <Server className="w-3 h-3" /> 接口地址 (Base URL)
                    </label>
                    <input 
                        type="text" 
                        value={settings.baseUrl}
                        onChange={(e) => handleChange('baseUrl', e.target.value)}
                        disabled={settings.llmProvider === 'gemini'}
                        className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 disabled:opacity-50"
                        placeholder="https://api.openai.com/v1"
                    />
                    {settings.llmProvider === 'custom' && <p className="text-xs text-stone-400">DeepSeek 示例: https://api.deepseek.com</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase">
                        <Key className="w-3 h-3" /> API Key
                    </label>
                    <input 
                        type="password" 
                        value={settings.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                        className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm focus:border-rose-400 focus:ring-0"
                        placeholder="sk-..."
                    />
                    <p className="text-xs text-stone-400">Key 仅存储在本地浏览器中，不会上传服务器。</p>
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase">
                        <Globe className="w-3 h-3" /> 模型名称 (Model Name)
                    </label>
                    <input 
                        type="text" 
                        value={settings.model}
                        onChange={(e) => handleChange('model', e.target.value)}
                        className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm focus:border-rose-400 focus:ring-0"
                        placeholder="gpt-4o, gemini-2.5-flash, deepseek-chat"
                    />
                  </div>

                  {/* Connection Test */}
                  <div className="pt-2">
                      <button 
                         onClick={handleTestLLM}
                         disabled={llmTestStatus === 'loading'}
                         className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-all ${
                             llmTestStatus === 'success' ? 'bg-green-50 text-green-600 border-green-200' : 
                             llmTestStatus === 'error' ? 'bg-red-50 text-red-600 border-red-200' :
                             'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200'
                         }`}
                      >
                          {llmTestStatus === 'loading' && <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                          {llmTestStatus === 'success' && <CheckCircle2 className="w-4 h-4" />}
                          {llmTestStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                          <span>
                              {llmTestStatus === 'idle' ? '测试连接' : 
                               llmTestStatus === 'loading' ? '测试中...' : 
                               llmTestStatus === 'success' ? '连接成功' : '连接失败'}
                          </span>
                      </button>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'tts' && (
            <div className="space-y-6">
                <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 p-4 rounded-xl text-sm leading-relaxed border border-amber-100 dark:border-amber-800/50">
                    <p>提示：并非所有模型都支持 TTS。如果选择自定义模型（如 DeepSeek），建议将 TTS 设为“浏览器自带”或另外配置 OpenAI 格式的语音 API。</p>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase">TTS 服务商</label>
                    <select
                        value={settings.ttsProvider}
                        onChange={(e) => handleChange('ttsProvider', e.target.value)}
                        className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm focus:border-rose-400 focus:ring-0"
                    >
                        <option value="gemini">Google Gemini (高质量/免费)</option>
                        <option value="openai">OpenAI API (高质量/付费)</option>
                        <option value="browser">浏览器自带 (免费/离线)</option>
                    </select>
                </div>

                {settings.ttsProvider !== 'browser' && (
                    <>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-stone-500 uppercase">TTS 模型</label>
                            <input 
                                type="text" 
                                value={settings.ttsModel}
                                onChange={(e) => handleChange('ttsModel', e.target.value)}
                                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm focus:border-rose-400 focus:ring-0"
                                placeholder="tts-1 or gemini-2.5-flash-preview-tts"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-stone-500 uppercase">语音音色 (Voice)</label>
                            <input 
                                type="text" 
                                value={settings.ttsVoice}
                                onChange={(e) => handleChange('ttsVoice', e.target.value)}
                                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm focus:border-rose-400 focus:ring-0"
                                placeholder="alloy, shimmer, or Kore"
                            />
                        </div>
                    </>
                )}

                 {/* TTS Test */}
                 <div className="pt-2">
                      <button 
                         onClick={handleTestTTS}
                         disabled={ttsTestStatus === 'loading' || ttsTestStatus === 'playing'}
                         className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-all ${
                             ttsTestStatus === 'success' ? 'bg-green-50 text-green-600 border-green-200' : 
                             ttsTestStatus === 'error' ? 'bg-red-50 text-red-600 border-red-200' :
                             ttsTestStatus === 'playing' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                             'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200'
                         }`}
                      >
                          {(ttsTestStatus === 'loading' || ttsTestStatus === 'playing') && <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                          {ttsTestStatus === 'success' && <CheckCircle2 className="w-4 h-4" />}
                          {ttsTestStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                          {ttsTestStatus === 'idle' && <PlayCircle className="w-4 h-4" />}
                          <span>
                              {/* Revert text to standard "Test Voice" as per request to hide surprise */}
                              {ttsTestStatus === 'idle' ? '测试语音' : 
                               ttsTestStatus === 'loading' ? '测试中...' : 
                               ttsTestStatus === 'playing' ? '正在播放...' :
                               ttsTestStatus === 'success' ? '播放成功' : '播放失败'}
                          </span>
                      </button>
                  </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-stone-50 dark:bg-stone-950 p-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
           <button 
             onClick={handleSave}
             className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-2 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-rose-200 dark:shadow-none"
           >
             <Save className="w-4 h-4" /> 保存设置
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
