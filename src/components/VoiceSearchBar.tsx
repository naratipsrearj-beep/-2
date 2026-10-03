import React, { useState } from 'react';
import { Mic, MicOff, Search, Sparkles, X, Volume2, Calendar, FileText, ArrowRight } from 'lucide-react';
import { useVoiceSearch, VoiceSearchResult } from '../hooks/useVoiceSearch';

interface VoiceSearchBarProps {
  onSearch: (query: string, searchType?: 'all' | 'black' | 'red' | 'filing_date') => void;
  onSelectFilingDate?: (dateQuery: string) => void;
  currentQuery?: string;
  placeholder?: string;
}

export const VoiceSearchBar: React.FC<VoiceSearchBarProps> = ({
  onSearch,
  onSelectFilingDate,
  currentQuery = '',
  placeholder = 'ค้นหาด้วยเสียง หรือพิมพ์เลขคดีดำ, คดีแดง, วันที่ฟ้อง...',
}) => {
  const [inputValue, setInputValue] = useState(currentQuery);
  const [activeVoicePrompt, setActiveVoicePrompt] = useState<string | null>(null);

  const handleVoiceResult = (result: VoiceSearchResult) => {
    const raw = result.rawTranscript;
    setInputValue(raw);
    setActiveVoicePrompt(raw);

    // ตรวจสอบเจตนา (Intent) จากเสียง
    const lower = raw.toLowerCase();

    // 1. คดีที่ฟ้องตามวันที่
    if (lower.includes('ฟ้อง') || lower.includes('ยื่น')) {
      // ดึงคำค้นหาหลังคำว่าฟ้อง หรือคำค้นวันที่
      onSearch(raw, 'filing_date');
      if (onSelectFilingDate) {
        onSelectFilingDate(raw);
      }
      return;
    }

    // 2. คดีดำ
    if (lower.includes('คดีดำ') || lower.includes('ดำ')) {
      // ดึงตัวเลขหรือข้อความ
      const cleanQuery = raw.replace(/ค้นหา/g, '').replace(/คดีดำ/g, '').trim();
      onSearch(cleanQuery || raw, 'black');
      return;
    }

    // 3. คดีแดง
    if (lower.includes('คดีแดง') || lower.includes('แดง')) {
      const cleanQuery = raw.replace(/ค้นหา/g, '').replace(/คดีแดง/g, '').trim();
      onSearch(cleanQuery || raw, 'red');
      return;
    }

    // 4. ทั่วไป
    onSearch(raw, 'all');
  };

  const {
    isListening,
    transcript,
    isSupported,
    errorMessage,
    startListening,
    stopListening,
  } = useVoiceSearch(handleVoiceResult);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(inputValue, 'all');
  };

  const handleClear = () => {
    setInputValue('');
    setActiveVoicePrompt(null);
    onSearch('', 'all');
  };

  const handleQuickVoiceSample = (sample: string, type: 'all' | 'black' | 'red' | 'filing_date') => {
    setInputValue(sample);
    setActiveVoicePrompt(sample);
    onSearch(sample, type);
    if (type === 'filing_date' && onSelectFilingDate) {
      onSelectFilingDate(sample);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs mb-5">
      {/* Search Input Box with Voice Button */}
      <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={isListening ? transcript || 'กำลังฟังเสียงของคุณ...' : inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              onSearch(e.target.value, 'all');
            }}
            placeholder={placeholder}
            className={`w-full pl-10 pr-20 py-2.5 text-xs sm:text-sm rounded-xl border transition focus:outline-none ${
              isListening
                ? 'border-rose-400 bg-rose-50/40 text-rose-900 ring-2 ring-rose-400/30'
                : 'border-slate-300 bg-slate-50/70 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
            }`}
          />

          {inputValue && !isListening && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
              title="ล้างข้อความค้นหา"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Voice Mic Button inside input */}
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition flex items-center justify-center ${
              isListening
                ? 'bg-rose-600 text-white shadow-md shadow-rose-500/30 animate-pulse'
                : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
            }`}
            title={isListening ? 'กดเพื่อหยุดฟังเสียง' : 'กดเพื่อพูดค้นหา (Voice Search)'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        <button
          type="submit"
          className="bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-xs flex-shrink-0"
        >
          ค้นหา
        </button>
      </form>

      {/* Voice Status & Listening Feedback */}
      {isListening && (
        <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-rose-800">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
            <span className="font-semibold">กำลังฟังเสียง...</span>
            <span className="text-slate-600 italic">
              {transcript ? `"${transcript}"` : 'ลองพูด เช่น "คดีดำ 452", "คดีแดง 891" หรือ "ฟ้องวันที่ 15 มิถุนายน"'}
            </span>
          </div>
          <button
            onClick={stopListening}
            className="text-xs text-rose-700 hover:underline font-semibold"
          >
            เสร็จสิ้น
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mt-2 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Quick Voice / Tag Suggestions */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
        <span className="inline-flex items-center gap-1 text-slate-400 font-medium mr-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>ตัวอย่างคำสั่งเสียง:</span>
        </span>

        <button
          type="button"
          onClick={() => handleQuickVoiceSample('คดีดำ 452', 'black')}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 font-medium"
        >
          <span>🎙️ คดีดำ 452</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickVoiceSample('คดีแดง 891', 'red')}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 font-medium"
        >
          <span>🎙️ คดีแดง 891</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickVoiceSample('ฟ้องวันที่ 15', 'filing_date')}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 font-medium"
        >
          <span>🎙️ ฟ้องวันที่ 15</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickVoiceSample('ศาลอาญา', 'all')}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 font-medium"
        >
          <span>🎙️ ศาลอาญา</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickVoiceSample('ใกล้ครบกำหนด', 'all')}
          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 font-medium"
        >
          <span>🎙️ ใกล้ครบกำหนด</span>
        </button>
      </div>

      {/* Active Search Badge */}
      {activeVoicePrompt && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-amber-600" />
            <span>
              กำลังกรองด้วยคำสั่งเสียง: <strong className="text-slate-900 font-bold">"{activeVoicePrompt}"</strong>
            </span>
          </div>
          <button
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-700 text-[11px] underline"
          >
            ยกเลิกการกรอง
          </button>
        </div>
      )}
    </div>
  );
};
