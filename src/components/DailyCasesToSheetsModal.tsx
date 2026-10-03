import React, { useState } from 'react';
import {
  FileSpreadsheet,
  X,
  Copy,
  Check,
  ExternalLink,
  Download,
  Sparkles,
  ArrowRight,
  Layers,
  AlertCircle,
  HelpCircle,
  FolderPlus,
  CalendarCheck
} from 'lucide-react';
import { AppealCase, SheetConfig } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';
import {
  DAILY_EXPORT_HEADERS,
  getDailyExportRows,
  formatDailyCasesTsv,
  downloadDailyCasesCsv
} from '../utils/dailyExportUtils';
import { exportDailyFilingCasesToGoogleSheet } from '../services/sheetsService';

interface DailyCasesToSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  filingDate: string;
  cases: AppealCase[];
  token?: string | null;
  sheetConfig?: SheetConfig | null;
  onToast?: (message: string) => void;
}

export const DailyCasesToSheetsModal: React.FC<DailyCasesToSheetsModalProps> = ({
  isOpen,
  onClose,
  filingDate,
  cases,
  token,
  sheetConfig,
  onToast,
}) => {
  const [conciseProcedure, setConciseProcedure] = useState(false);
  const [includeTitleRow, setIncludeTitleRow] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccessUrl, setExportSuccessUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const rows = getDailyExportRows(cases, conciseProcedure);

  // 1. คัดลอกตารางสำหรับกดวางใน Google Sheets (Ctrl+V)
  const handleCopyForSheets = async () => {
    try {
      const tsvText = formatDailyCasesTsv(filingDate, cases, {
        conciseProcedure,
        includeTitleRow,
      });
      await navigator.clipboard.writeText(tsvText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);

      const msg = `คัดลอกตาราง 7 คอลัมน์ (พร้อมหัวเรื่องวันที่ฟ้อง) ${cases.length} คดีแล้ว! สามารถเปิด Google Sheets แล้วกด Ctrl+V เพื่อวางได้ทันที`;
      if (onToast) onToast(msg);
    } catch {
      if (onToast) onToast('ไม่สามารถคัดลอกได้ โปรดลองอีกครั้ง');
    }
  };

  // 2. ดาวน์โหลดไฟล์ CSV
  const handleDownloadCsv = () => {
    downloadDailyCasesCsv(filingDate, cases, {
      conciseProcedure,
      includeTitleRow,
    });
    if (onToast) {
      onToast(`ดาวน์โหลดไฟล์ CSV คดีวันที่ ${formatThaiDate(filingDate, { short: true })} เรียบร้อยแล้ว`);
    }
  };

  // 3. ส่งออกผ่าน Google Sheets API
  const handleDirectExport = async (toExistingSheet: boolean = false) => {
    if (!token) {
      setExportError('ไม่พบโทเคนการเข้าสู่ระบบ Google หรือเซสชันหมดอายุ แนะนำให้กดปุ่ม "คัดลอกตารางสำหรับวาง (Ctrl+V)" ได้ทันทีครับ');
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportSuccessUrl(null);

    try {
      const targetId = toExistingSheet && sheetConfig?.spreadsheetId ? sheetConfig.spreadsheetId : undefined;
      const result = await exportDailyFilingCasesToGoogleSheet(
        token,
        filingDate,
        cases,
        {
          spreadsheetId: targetId,
          conciseProcedure,
        }
      );

      setExportSuccessUrl(result.url);
      const successMsg = toExistingSheet
        ? `เพิ่มแท็บ "${result.sheetName}" ใน Google Sheet เรียบร้อยแล้ว`
        : `สร้างไฟล์ Google Sheets สำเร็จ (${cases.length} คดี)`;

      if (onToast) onToast(successMsg);
      // เปิดแท็บใหม่ไปยัง Google Sheet ทันที
      window.open(result.url, '_blank');
    } catch (err: any) {
      console.error('Google Sheets Export Error:', err);
      const errTxt = err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets API';
      setExportError(`${errTxt} (คุณสามารถใช้ปุ่ม "คัดลอกตารางสำหรับวางใน Google Sheet" ด้านล่างเพื่อนำข้อมูลไปวางได้โดยตรงทันที)`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between gap-4 flex-shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-300 shadow-inner flex-shrink-0">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                  ส่งออกข้อมูล 7 คอลัมน์
                </span>
                <span className="text-xs text-slate-300">
                  {cases.length} คดี
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-['Prompt'] text-white mt-1">
                นำออกข้อมูลคดีที่ฟ้องประจำวันไปยัง Google Sheets
              </h3>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                หัวข้อมูลประจำวัน: <strong className="text-white font-semibold">วันที่ฟ้อง: {formatThaiDate(filingDate)}</strong> (เรียงลำดับคอลัมน์จากซ้ายไปขวาตามที่กำหนด)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7 Column Order Sequence Visualizer */}
        <div className="bg-emerald-50/70 border-b border-emerald-200/80 px-5 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-emerald-950 font-medium mb-1.5">
            <span className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>ลำดับข้อมูลจากซ้ายไปขวา (7 คอลัมน์):</span>
            </span>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTitleRow}
                  onChange={(e) => setIncludeTitleRow(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>ใส่แถวหัวเรื่อง &quot;วันที่ฟ้อง...&quot; ด้านบนตาราง</span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={conciseProcedure}
                  onChange={(e) => setConciseProcedure(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>ย่อข้อความให้กระชับ</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {DAILY_EXPORT_HEADERS.map((header, idx) => (
              <React.Fragment key={header}>
                <div
                  className={`border rounded-lg px-2.5 py-1 text-slate-800 font-semibold shadow-2xs whitespace-nowrap flex items-center gap-1 ${
                    idx === 6
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-white border-emerald-300/80 text-slate-800'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                      idx === 6 ? 'bg-amber-600' : 'bg-emerald-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span>{header}</span>
                </div>
                {idx < DAILY_EXPORT_HEADERS.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Modal Body / Table Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Notification / Success / Error Alert */}
          {exportSuccessUrl && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-emerald-900 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="font-bold block text-sm">ส่งออกไปยัง Google Sheet สำเร็จแล้ว!</span>
                  <span className="text-slate-600">คุณสามารถเปิดดูและแก้ไขเอกสารบน Google Sheets ได้ทันที</span>
                </div>
              </div>
              <a
                href={exportSuccessUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
              >
                <span>เปิดใน Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {exportError && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">แจ้งเตือนการเชื่อมต่อ:</span>
                <span className="text-amber-800">{exportError}</span>
              </div>
            </div>
          )}

          {/* Table Preview */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            {/* Top Title Banner */}
            <div className="bg-emerald-900 text-white px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-2 font-['Prompt'] text-sm text-emerald-100">
                <CalendarCheck className="w-4 h-4 text-amber-300" />
                <span>วันที่ฟ้อง: {formatThaiDate(filingDate)}</span>
              </span>
              <span className="text-emerald-200 text-[11px]">
                รวม {cases.length} คดี (7 คอลัมน์)
              </span>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-emerald-800 text-white font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-emerald-700 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 border-r border-emerald-700 whitespace-nowrap">1. ส.1 และ ส.4</th>
                    <th className="py-2.5 px-3 border-r border-emerald-700 whitespace-nowrap">2. เลขคดีดำ</th>
                    <th className="py-2.5 px-3 border-r border-emerald-700 whitespace-nowrap">3. เลขคดีแดง</th>
                    <th className="py-2.5 px-3 border-r border-emerald-700 whitespace-nowrap">4. ชื่ออัยการเจ้าของสำนวน</th>
                    <th className="py-2.5 px-3 border-r border-emerald-700 whitespace-nowrap">5. ชื่อผู้ต้องหา</th>
                    <th className="py-2.5 px-3 border-r border-emerald-700 whitespace-nowrap">6. การดำเนินการ</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-850">7. วันที่เสร็จสิ้นสำนวน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.length > 0 ? (
                    rows.map((row, rIdx) => {
                      const procedure = row[5] || '';
                      const isConfessed = procedure.includes('รับสารภาพ');
                      const completedStr = row[6] || '';
                      const isDone = completedStr.includes('เสร็จสิ้น');

                      return (
                        <tr key={rIdx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {rIdx + 1}
                          </td>
                          <td className="py-2 px-3 font-medium text-blue-900 whitespace-nowrap">
                            {row[0]}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {row[1]}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {row[2] !== 'ยังไม่มีเลขแดง' && row[2] !== '-' ? (
                              <span className="font-semibold text-rose-700">{row[2]}</span>
                            ) : (
                              <span className="text-slate-400">{row[2]}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-800 font-medium whitespace-nowrap">
                            ⚖️ {row[3]}
                          </td>
                          <td className="py-2 px-3 text-slate-800">
                            {row[4]}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                isConfessed
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              }`}
                            >
                              <span>{isConfessed ? '⚖️' : '📅'}</span>
                              <span>{procedure}</span>
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                isDone
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              <span>{isDone ? '✓' : '•'}</span>
                              <span>{completedStr}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        ไม่พบคดีในวันที่เลือก
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Tip Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 block">💡 เคล็ดลับการใช้งานที่สะดวกและเร็วที่สุด:</strong>
              <span>
                หากคุณมีไฟล์ Google Sheets หรือ Excel ของสำนักงานเปิดไว้อยู่แล้ว เพียงกดปุ่ม{' '}
                <strong className="text-emerald-700">“คัดลอกตารางสำหรับวาง (Ctrl+V)”</strong>{' '}
                แล้วคลิกช่อง A1 ใน Google Sheet จากนั้นกด <kbd className="bg-white border px-1.5 py-0.5 rounded text-[11px] font-mono shadow-2xs">Ctrl + V</kbd>{' '}
                หัวเรื่องวันที่ฟ้อง และข้อมูลครบทั้ง 7 คอลัมน์จะแยกช่องลงในตารางอย่างสวยงามทันที 100% ครับ
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          {/* Secondary Shortcuts (CSV & Open Blank Sheet) */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-start">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="ดาวน์โหลดเป็นไฟล์ CSV (เปิดได้ทั้ง Google Sheets และ Excel ภาษาไทยไม่เพี้ยน)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>ดาวน์โหลด CSV (7 คอลัมน์)</span>
            </button>

            <a
              href="https://sheets.new"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center gap-1.5 shadow-2xs"
              title="เปิดแท็บ Google Sheets เปล่าใหม่เพื่อรอกดวาง (Ctrl+V)"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>เปิด sheets.new ↗</span>
            </a>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* 1. Quick Copy for Paste in Google Sheets */}
            <button
              type="button"
              onClick={handleCopyForSheets}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                copied
                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-400'
                  : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>คัดลอกตาราง 7 คอลัมน์แล้ว! (พร้อมกด Ctrl+V)</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-emerald-600" />
                  <span>คัดลอกตารางสำหรับวาง (Ctrl+V)</span>
                </>
              )}
            </button>

            {/* 2. Direct Export to Google Drive */}
            {sheetConfig && (
              <button
                type="button"
                onClick={() => handleDirectExport(true)}
                disabled={isExporting || cases.length === 0}
                className="px-3.5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="เพิ่มเป็นแผ่นงานใหม่ใน Google Sheet ที่เชื่อมต่อไว้แล้ว"
              >
                <FolderPlus className="w-4 h-4" />
                <span>เพิ่มแท็บใน Sheet เดิม</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDirectExport(false)}
              disabled={isExporting || cases.length === 0}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-700/20 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>กำลังส่งออก...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>สร้างไฟล์ Google Sheets ใหม่ ↗</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
