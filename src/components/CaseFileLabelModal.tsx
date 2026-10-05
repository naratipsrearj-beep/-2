import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  X,
  QrCode,
  FileText,
  Copy,
  Check,
  Scale,
  Calendar,
  AlertTriangle,
  Download,
  Share2
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';
import { copyTextToClipboard, formatCaseForOfficeTsv } from '../utils/copyCaseUtils';

interface CaseFileLabelModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

export const CaseFileLabelModal: React.FC<CaseFileLabelModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'label' | 'sheet'>('label');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedTsv, setCopiedTsv] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Generate QR code when caseItem changes
  useEffect(() => {
    if (!caseItem || !isOpen) return;

    // QR Code data: Direct app search URL + case essentials
    const appUrl = `${window.location.origin}?q=${encodeURIComponent(caseItem.blackCaseNo)}`;
    const qrPayload = `${appUrl}\nดำ:${caseItem.blackCaseNo}\nแดง:${caseItem.redCaseNo || '-'}\nศาล:${caseItem.court}\nจำเลย:${caseItem.defendant}\nครบอุทธรณ์:${caseItem.extendedDeadline || caseItem.appealDeadline || '-'}`;

    QRCode.toDataURL(qrPayload, {
      width: 256,
      margin: 1,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [caseItem, isOpen]);

  if (!isOpen || !caseItem) return null;

  const effectiveDeadline = caseItem.extendedDeadline || caseItem.appealDeadline;

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Copy TSV row for Office System
  const handleCopyTsv = async () => {
    const tsv = formatCaseForOfficeTsv(caseItem);
    const ok = await copyTextToClipboard(tsv);
    if (ok) {
      setCopiedTsv(true);
      if (onToast) onToast(`คัดลอกแถวสำหรับวางลง Excel / โปรแกรมสารบบ (${caseItem.blackCaseNo}) เรียบร้อยแล้ว`);
      setTimeout(() => setCopiedTsv(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      {/* Print Specific CSS to only print the document */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-case-label, #printable-case-label * {
              visibility: visible;
            }
            #printable-case-label {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 15px;
              background: white !important;
              color: black !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 no-print">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt']">
                ป้ายติดหน้าแฟ้ม & ใบปะหน้าสำนวน (ระบบสำนักงาน)
              </h3>
              <p className="text-xs text-slate-300">
                ดำ {caseItem.blackCaseNo} {caseItem.redCaseNo ? `/ แดง ${caseItem.redCaseNo}` : ''} ({caseItem.court})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="bg-slate-50 px-6 pt-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('label')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer border-t border-x ${
                activeTab === 'label'
                  ? 'bg-white text-slate-900 border-slate-200 -mb-px shadow-xs'
                  : 'bg-transparent text-slate-500 border-transparent hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-amber-600" />
              <span>ป้ายสติกเกอร์หน้าซองแฟ้ม (Folder Label)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sheet')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer border-t border-x ${
                activeTab === 'sheet'
                  ? 'bg-white text-slate-900 border-slate-200 -mb-px shadow-xs'
                  : 'bg-transparent text-slate-500 border-transparent hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>ใบปะหน้าสำนวนคุมอุทธรณ์ A4 (Cover Sheet)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyTsv}
            className="mb-2 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
            title="คัดลอกแถวข้อมูลสำนวนนี้ไป Paste ลงใน Excel หรือโปรแกรมสารบบของสำนักงาน"
          >
            {copiedTsv ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedTsv ? 'คัดลอกแถวแล้ว!' : 'คัดลอกวางลงสารบบ/Excel'}</span>
          </button>
        </div>

        {/* Modal Body Preview Area */}
        <div className="p-6 bg-slate-100/60 max-h-[68vh] overflow-y-auto">
          {/* Printable Container */}
          <div
            id="printable-case-label"
            ref={printRef}
            className="bg-white mx-auto shadow-md rounded-xl p-6 border border-slate-200 text-slate-900 font-['Sarabun',sans-serif]"
          >
            {activeTab === 'label' ? (
              /* TAB 1: Folder Label Card (ขนาดเหมาะสำหรับตัดติดหน้าแฟ้มหรือซองสำนวนคดี) */
              <div className="border-2 border-slate-800 rounded-xl p-4 bg-white space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-400 flex items-center justify-center font-bold text-slate-800 text-xs">
                      อัยการ
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 font-['Prompt']">
                        สำนักงานอัยการจังหวัดเพชรบุรี
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        {caseItem.court || 'ศาลจังหวัดเพชรบุรี'} • แฟ้มคุมระยะเวลาอุทธรณ์
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      ประเภทคดี
                    </span>
                    <span className="text-xs font-bold text-slate-900">{caseItem.caseType || 'อาญา'}</span>
                  </div>
                </div>

                {/* Case Numbers Highlight */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-300">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">คดีหมายเลขดำที่</span>
                    <strong className="text-base font-bold text-slate-900 font-['Prompt'] block">
                      {caseItem.blackCaseNo}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">คดีหมายเลขแดงที่</span>
                    <strong className="text-base font-bold text-rose-800 font-['Prompt'] block">
                      {caseItem.redCaseNo || '-'}
                    </strong>
                  </div>
                </div>

                {/* Sub Registry Numbers (ส.1 / ส.4) */}
                {(caseItem.receivedNumberS1 || caseItem.filingNumberS4) && (
                  <div className="flex items-center justify-between text-xs px-1 text-slate-700 font-medium">
                    <span>เลขรับ ส.1: <strong>{caseItem.receivedNumberS1 || '-'}</strong></span>
                    <span>เลขฟ้อง ส.4: <strong>{caseItem.filingNumberS4 || '-'}</strong></span>
                  </div>
                )}

                {/* Parties */}
                <div className="text-xs space-y-1 py-1 border-y border-dashed border-slate-300">
                  <div className="flex">
                    <span className="w-16 font-semibold text-slate-500 shrink-0">โจทก์:</span>
                    <span className="font-medium text-slate-900">{caseItem.plaintiff || 'พนักงานอัยการ'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-16 font-semibold text-slate-500 shrink-0">จำเลย:</span>
                    <span className="font-bold text-slate-900">{caseItem.defendant || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-16 font-semibold text-slate-500 shrink-0">วันยื่นฟ้อง:</span>
                    <span>{formatThaiDate(caseItem.filingDate)}</span>
                  </div>
                </div>

                {/* Critical Deadline Section */}
                <div className="bg-rose-50 border border-rose-300 rounded-lg p-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
                      ครบกำหนดระยะเวลาอุทธรณ์ 1 เดือน
                    </span>
                    <div className="text-sm font-bold text-rose-700 font-['Prompt']">
                      {effectiveDeadline ? formatThaiDate(effectiveDeadline, { short: false }) : 'ยังไม่ระบุวันพิพากษา'}
                    </div>
                    {caseItem.extendedDeadline && (
                      <span className="text-[10px] text-amber-800 font-semibold block mt-0.5">
                        ⚡ มีการขอขยายระยะเวลาอุทธรณ์ (ครั้งที่ {caseItem.extensionCount || 1})
                      </span>
                    )}
                  </div>
                  {caseItem.judgmentDate && (
                    <div className="text-right text-[11px] text-slate-600">
                      <span>วันตัดสิน:</span>
                      <div className="font-medium">{formatThaiDate(caseItem.judgmentDate)}</div>
                    </div>
                  )}
                </div>

                {/* Footer with Duty Prosecutor & QR Code */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs space-y-0.5">
                    <div className="text-[11px] text-slate-600">
                      เวรชี้ / เจ้าของสำนวน: <strong>{caseItem.prosecutorName || caseItem.responsiblePerson}</strong>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      พิมพ์เมื่อ {formatThaiDate(new Date().toISOString().slice(0, 10))} • ระบบคุมสำนวนอุทธรณ์
                    </div>
                  </div>

                  {qrDataUrl && (
                    <div className="text-center shrink-0">
                      <img src={qrDataUrl} alt="QR Code ประจำสำนวน" className="w-14 h-14 border border-slate-300 rounded p-0.5 bg-white mx-auto" />
                      <span className="text-[9px] text-slate-500 font-medium block">สแกนดูคดี</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* TAB 2: Full A4 Cover Sheet (ใบปะหน้าสำนวนคุมอุทธรณ์และบันทึกข้อความ) */
              <div className="space-y-4 text-xs text-slate-800 leading-relaxed">
                <div className="text-center border-b pb-3">
                  <h3 className="font-bold text-base text-slate-900 font-['Prompt']">
                    ใบปะหน้าสำนวนคุมระยะเวลาอุทธรณ์
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    สำนักงานอัยการจังหวัดเพชรบุรี • ศาลจังหวัดเพชรบุรี
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <p><strong>คดีหมายเลขดำที่:</strong> {caseItem.blackCaseNo}</p>
                    <p><strong>คดีหมายเลขแดงที่:</strong> {caseItem.redCaseNo || '-'}</p>
                    <p><strong>เลขรับ ส.1:</strong> {caseItem.receivedNumberS1 || '-'}</p>
                    <p><strong>เลขฟ้อง ส.4:</strong> {caseItem.filingNumberS4 || '-'}</p>
                  </div>
                  <div>
                    <p><strong>ศาล:</strong> {caseItem.court}</p>
                    <p><strong>วันที่ยื่นฟ้อง:</strong> {formatThaiDate(caseItem.filingDate, { short: false })}</p>
                    <p><strong>ประเภทคดี:</strong> {caseItem.caseType}</p>
                    <p><strong>พนักงานอัยการเวรชี้/เจ้าของสำนวน:</strong> {caseItem.prosecutorName || caseItem.responsiblePerson}</p>
                  </div>
                </div>

                <div>
                  <p><strong>โจทก์:</strong> {caseItem.plaintiff}</p>
                  <p><strong>จำเลย:</strong> {caseItem.defendant}</p>
                </div>

                {/* Judgment & Appeals Section */}
                <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <h5 className="font-bold text-slate-900 border-b pb-1">ข้อมูลคำพิพากษาและการอุทธรณ์</h5>
                  <p>
                    <strong>วันที่ศาลอ่านคำพิพากษา:</strong>{' '}
                    {caseItem.judgmentDate ? formatThaiDate(caseItem.judgmentDate, { short: false }) : 'ยังไม่มีคำพิพากษา'}
                  </p>
                  <p>
                    <strong>ผลคำพิพากษาโดยย่อ:</strong> {caseItem.judgmentOutcome || '-'}
                  </p>
                  <div className="bg-amber-50 p-2 rounded border border-amber-200 font-semibold text-rose-900">
                    ครบกำหนดระยะเวลาอุทธรณ์ 1 เดือน: {effectiveDeadline ? formatThaiDate(effectiveDeadline, { short: false }) : '-'}
                    {caseItem.extendedDeadline && (
                      <span className="text-amber-800 block font-normal text-[11px] mt-0.5">
                        (ขอขยายระยะเวลาอุทธรณ์ ครั้งที่ {caseItem.extensionCount || 1} ถึงวันที่ {formatThaiDate(caseItem.extendedDeadline)})
                      </span>
                    )}
                  </div>
                  {caseItem.notes && (
                    <p><strong>หมายเหตุ/คำสั่งศาล:</strong> {caseItem.notes}</p>
                  )}
                </div>

                {/* Signature Lines */}
                <div className="grid grid-cols-2 gap-6 pt-8 text-center text-xs">
                  <div className="space-y-1">
                    <p>ลงชื่อ .............................................................. ผู้จัดทำ</p>
                    <p className="text-slate-500">(..............................................................)</p>
                    <p className="text-slate-500">เจ้าหน้าที่คุมระยะเวลาอุทธรณ์</p>
                    <p className="text-slate-400">วันที่ ......../......../............</p>
                  </div>
                  <div className="space-y-1">
                    <p>ลงชื่อ .............................................................. ผู้ตรวจ</p>
                    <p className="text-slate-500">( {caseItem.prosecutorName || caseItem.responsiblePerson || '..............................................................'} )</p>
                    <p className="text-slate-500">พนักงานอัยการผู้รับผิดชอบสำนวน</p>
                    <p className="text-slate-400">วันที่ ......../......../............</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-white px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span>💡 นำป้ายที่พิมพ์ไปตัดติดหน้าซองสำนวนคดี หรือแปะแฟ้ม ส.1 ส.4 เพื่อสแกนติดตามคดีได้ทันที</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              ปิด
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>พิมพ์ป้าย / ใบปะหน้า (Print)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
