import React from 'react';
import { StickyNote } from 'lucide-react';

interface CaseNoteHighlightProps {
  notes: string;
  label?: string;
  compact?: boolean;
  className?: string;
}

/**
 * กรอบแสดง "หมายเหตุ" ของแต่ละสำนวนคดีแบบเรืองแสงเด่นชัด
 * อ่านง่ายบนพื้นหลังทุกสี (ขาว/เหลือง/ส้ม/เขียว/ฟ้า) เพื่อไม่ให้พลาดข้อความสำคัญของสำนวน
 */
export const CaseNoteHighlight: React.FC<CaseNoteHighlightProps> = ({
  notes,
  label = 'หมายเหตุ',
  compact = false,
  className = '',
}) => {
  const trimmed = notes.trim();
  if (!trimmed) return null;

  return (
    <div
      className={`case-note-glow inline-flex items-start gap-2 rounded-xl border border-violet-400 bg-gradient-to-r from-violet-50 via-fuchsia-50/90 to-indigo-50 text-violet-950 max-w-full ${
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      } ${className}`}
      title={`${label}: ${trimmed}`}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-md bg-violet-700 text-white font-bold shrink-0 leading-tight ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
        }`}
      >
        <StickyNote className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
        <span>{label}</span>
      </span>
      <span className="font-semibold text-violet-950 leading-relaxed break-words">
        {trimmed}
      </span>
    </div>
  );
};
