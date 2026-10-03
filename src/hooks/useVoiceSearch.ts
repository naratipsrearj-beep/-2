import { useState, useEffect, useCallback, useRef } from 'react';

// Declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: {
      new (): SpeechRecognitionInstance;
    };
    webkitSpeechRecognition?: {
      new (): SpeechRecognitionInstance;
    };
  }
}

export interface VoiceSearchResult {
  rawTranscript: string;
  parsedCaseNo?: string;
  parsedCaseType?: 'black' | 'red' | 'any';
  parsedFilingDate?: string;
  targetCategory?: 'case_no' | 'filing_date' | 'general';
}

export function useVoiceSearch(onResult?: (result: VoiceSearchResult) => void) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'th-TH'; // ภาษาไทยเป็นหลักสำหรับการค้นหาคดีความ

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMessage('เบราว์เซอร์ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน โปรดเปิดการอนุญาตไมโครโฟน');
        } else if (event.error === 'no-speech') {
          setErrorMessage('ไม่พบเสียงพูด โปรดลองพูดใหม่อีกครั้ง');
        } else {
          setErrorMessage(`เกิดข้อผิดพลาดในการฟังเสียง: ${event.error}`);
        }
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);

        // เมื่อพูดจบประโยคสุดท้าย (isFinal)
        const isFinal = event.results[event.results.length - 1].isFinal;
        if (isFinal && currentTranscript.trim()) {
          const parsed = parseVoiceLegalQuery(currentTranscript.trim());
          if (onResult) {
            onResult(parsed);
          }
        }
      };

      recognitionRef.current = recognition;
    } catch (e: any) {
      setIsSupported(false);
      setErrorMessage(e.message);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onResult]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setErrorMessage('เบราว์เซอร์ของคุณยังไม่รองรับระบบสั่งการด้วยเสียง Web Speech API');
      return;
    }
    setTranscript('');
    setErrorMessage(null);
    try {
      recognitionRef.current.start();
    } catch (err: any) {
      console.warn('Recognition start warning:', err);
      // If already started, try aborting then start
      try {
        recognitionRef.current.abort();
        setTimeout(() => recognitionRef.current?.start(), 100);
      } catch (e) {
        console.error('Failed to restart speech recognition', e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    errorMessage,
    startListening,
    stopListening,
  };
}

/**
 * วิเคราะห์คำพูดภาษาไทยเกี่ยวกับคดีความและวันที่ฟ้อง
 */
export function parseVoiceLegalQuery(speech: string): VoiceSearchResult {
  const clean = speech.trim();
  const lower = clean.toLowerCase();

  let parsedCaseType: 'black' | 'red' | 'any' = 'any';
  let targetCategory: 'case_no' | 'filing_date' | 'general' = 'general';
  let parsedCaseNo: string | undefined = undefined;
  let parsedFilingDate: string | undefined = undefined;

  // 1. ตรวจสอบว่าพูดถึง "คดีดำ" หรือ "คดีแดง" หรือไม่
  if (lower.includes('คดีดำ') || lower.includes('ดำ')) {
    parsedCaseType = 'black';
    targetCategory = 'case_no';
  } else if (lower.includes('คดีแดง') || lower.includes('แดง')) {
    parsedCaseType = 'red';
    targetCategory = 'case_no';
  }

  // 2. ตรวจสอบว่าพูดถึง "ฟ้องวันที่" หรือ "วันฟ้อง" หรือไม่
  if (
    lower.includes('ฟ้องวัน') ||
    lower.includes('วันที่ฟ้อง') ||
    lower.includes('ยื่นฟ้อง') ||
    lower.includes('ฟ้องเมื่อ')
  ) {
    targetCategory = 'filing_date';
  }

  // แปลงคำพูดตัวเลขไทย/คำว่า "ทับ" เป็นเครื่องหมาย "/"
  const normalizedText = clean
    .replace(/ทับ/g, '/')
    .replace(/ศูนย์/g, '0')
    .replace(/หนึ่ง/g, '1')
    .replace(/สอง/g, '2')
    .replace(/สาม/g, '3')
    .replace(/สี่/g, '4')
    .replace(/ห้า/g, '5')
    .replace(/หก/g, '6')
    .replace(/เจ็ด/g, '7')
    .replace(/แปด/g, '8')
    .replace(/เก้า/g, '9')
    .replace(/สิบ/g, '10');

  return {
    rawTranscript: clean,
    parsedCaseNo,
    parsedCaseType,
    parsedFilingDate,
    targetCategory,
  };
}
