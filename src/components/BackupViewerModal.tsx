import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Search,
  Download,
  Copy,
  Check,
  Calendar,
  Users,
  Scale,
  Upload,
  AlertCircle,
  FileCode,
  Shield,
  Clock,
  Eye,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { AppealCase, DailyJudgmentFollowUp, MonthlyDutyRoster } from '../types/appeal';
import { ApplicationBackupData, downloadApplicationJsonBackup } from '../utils/backupUtils';
import { formatThaiDate } from '../utils/dateUtils';

interface BackupViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCases: AppealCase[];
  currentDutyRosters: MonthlyDutyRoster[];
  currentFollowUps: DailyJudgmentFollowUp[];
  userEmail?: string;
  onToast?: (message: string) => void;
}

export const BackupViewerModal: React.FC<BackupViewerModalProps> = ({
  isOpen,
  onClose,
  currentCases,
  currentDutyRosters,
  currentFollowUps,
  userEmail,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'cases' | 'duty' | 'followups' | 'raw'>('cases');
  const [searchQuery, setSearchQuery] = useState('');
  const [customBackupData, setCustomBackupData] = useState<ApplicationBackupData | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Active data to display: either uploaded JSON file or current system data
  const data: ApplicationBackupData = useMemo(() => {
    if (customBackupData) {
      return customBackupData;
    }
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    return {
      metadata: {
        systemName: 'ระบบคุมระยะเวลาอุทธรณ์ 1 เดือน (Appeal Period Tracker)',
        version: '1.0.0',
        exportedAt: now.toISOString(),
        exportedAtThai: `${formatThaiDate(dateStr, { short: false })} (ข้อมูลสดในระบบ)`,
        exportedBy: userEmail || 'Admin',
        description: 'ข้อมูลปัจจุบันสดในระบบพร้อมดาวน์โหลด',
        counts: {
          cases: currentCases.length,
          dutyRosters: currentDutyRosters.length,
          followUps: currentFollowUps.length,
        },
      },
      cases: currentCases,
      dutyRosters: currentDutyRosters,
      followUps: currentFollowUps,
    };
  }, [customBackupData, currentCases, currentDutyRosters, currentFollowUps, userEmail]);

  if (!isOpen) return null;

  // Handle uploading an external backup .json file to view
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Basic schema validation
        if (!parsed.cases && !Array.isArray(parsed.cases)) {
          throw new Error('ไม่พบโครงสร้างข้อมูลสำนวนคดี (cases) ในไฟล์ JSON นี้');
        }

        const validBackup: ApplicationBackupData = {
          metadata: parsed.metadata || {
            systemName: 'ไฟล์สำรองข้อมูลภายนอก',
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            exportedAtThai: 'ไฟล์ที่อัปโหลดเปิดดู',
            description: file.name,
            counts: {
              cases: Array.isArray(parsed.cases) ? parsed.cases.length : 0,
              dutyRosters: Array.isArray(parsed.dutyRosters) ? parsed.dutyRosters.length : 0,
              followUps: Array.isArray(parsed.followUps) ? parsed.followUps.length : 0,
            },
          },
          cases: Array.isArray(parsed.cases) ? parsed.cases : [],
          dutyRosters: Array.isArray(parsed.dutyRosters) ? parsed.dutyRosters : [],
          followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
        };

        setCustomBackupData(validBackup);
        setUploadedFileName(file.name);
        if (onToast) onToast(`โหลดไฟล์สำรอง "${file.name}" เข้าสู่หน้าต่างดูข้อมูลสำเร็จ`);
      } catch (err: any) {
        setUploadError(`ไม่สามารถอ่านไฟล์ JSON ได้: ${err.message || 'รูปแบบไฟล์ไม่ถูกต้อง'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset back to current live data
  const handleResetToCurrent = () => {
    setCustomBackupData(null);
    setUploadedFileName(null);
    setUploadError(null);
  };

  // Filter cases by search term
  const filteredCases = (data.cases || []).filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (c.blackCaseNo && c.blackCaseNo.toLowerCase().includes(q)) ||
      (c.redCaseNo && c.redCaseNo.toLowerCase().includes(q)) ||
      (c.defendant && c.defendant.toLowerCase().includes(q)) ||
      (c.prosecutorName && c.prosecutorName.toLowerCase().includes(q)) ||
      (c.responsiblePerson && c.responsiblePerson.toLowerCase().includes(q)) ||
      (c.court && c.court.toLowerCase().includes(q)) ||
      (c.receivedNumberS1 && c.receivedNumberS1.toLowerCase().includes(q)) ||
      (c.filingNumberS4 && c.filingNumberS4.toLowerCase().includes(q)) ||
      (c.judgmentOutcome && c.judgmentOutcome.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  });

  // Copy raw JSON to clipboard
  const handleCopyJson = async () => {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      if (onToast) onToast('คัดลอกข้อความ JSON ลงคลิปบอร์ดแล้ว');
    } catch {
      // ignore
    }
  };

  // Download this backup
  // Download this backup
  const handleDownload = () => {
    downloadApplicationJsonBackup({
      cases: data.cases,
      dutyRosters: data.dutyRosters,
      followUps: data.followUps,
      userEmail: data.metadata.exportedBy || userEmail,
    });
    if (onToast) onToast('ดาวน์โหลดไฟล์สำรองข้อมูล JSON เรียบร้อยแล้ว');
  };

  // Export cases to CSV for direct viewing and editing in Microsoft Excel / Google Sheets
  const handleExportCsv = () => {
    try {
      if (!data.cases || data.cases.length === 0) {
        if (onToast) onToast('ไม่พบข้อมูลสำนวนคดีสำหรับการส่งออก CSV');
        return;
      }

      const headers = [
        'ลำดับ',
        'วันที่ฟ้อง',
        'หมายเลขคดีดำ',
        'หมายเลขคดีแดง',
        'เลขรับ ส.1',
        'เลขฟ้อง ส.4',
        'จำเลย/ผู้ต้องหา',
        'ศาล',
        'พนักงานอัยการเจ้าของสำนวน',
        'ผลคำพิพากษา/คำสั่ง',
        'วันที่อ่านคำพิพากษา',
        'วันครบกำหนดอุทธรณ์ 1 เดือน',
        'สถานะการดำเนินการ',
        'หมายเหตุ',
      ];

      const csvRows = [headers.join(',')];

      data.cases.forEach((c, idx) => {
        const row = [
          idx + 1,
          `"${(c.filingDate || '').replace(/"/g, '""')}"`,
          `"${(c.blackCaseNo || '').replace(/"/g, '""')}"`,
          `"${(c.redCaseNo && c.redCaseNo !== 'ยังไม่มีเลขแดง' && c.redCaseNo !== '-' ? c.redCaseNo : '').replace(/"/g, '""')}"`,
          `"${(c.receivedNumberS1 || '').replace(/"/g, '""')}"`,
          `"${(c.filingNumberS4 || '').replace(/"/g, '""')}"`,
          `"${(c.defendant || '').replace(/"/g, '""')}"`,
          `"${(c.court || '').replace(/"/g, '""')}"`,
          `"${(c.responsiblePerson || c.prosecutorName || '').replace(/"/g, '""')}"`,
          `"${(c.judgmentOutcome || c.fullJudgmentText || '').replace(/"/g, '""')}"`,
          `"${(c.judgmentDate || '').replace(/"/g, '""')}"`,
          `"${(c.appealDeadline || '').replace(/"/g, '""')}"`,
          `"${(c.isCompleted ? 'เสร็จสิ้น' : 'กำลังดำเนินการ').replace(/"/g, '""')}"`,
          `"${(c.notes || '').replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ข้อมูลสำรองสำนวนคดี_เปิดในExcel_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      if (onToast) onToast('ส่งออกไฟล์ CSV สำหรับเปิดดูใน Microsoft Excel สำเร็จ');
    } catch (err: any) {
      if (onToast) onToast(`ไม่สามารถส่งออก CSV ได้: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center flex-shrink-0 shadow-sm font-bold">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base font-['Prompt'] text-white">
                  เปิดดูข้อมูลสำรอง (JSON Backup Viewer)
                </h3>
                {uploadedFileName ? (
                  <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                    📄 เปิดดูไฟล์: {uploadedFileName}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                    ⚡ ข้อมูลสดปัจจุบันในระบบ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                ดูรายละเอียดสำนวนคดี, ตารางเวรชี้ และรายการติดตาม โดยไม่ต้องเปิดโปรแกรมภายนอก
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {uploadedFileName && (
              <button
                type="button"
                onClick={handleResetToCurrent}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
                title="กลับมาดูข้อมูลสดปัจจุบันในระบบ"
              >
                ดูข้อมูลสดปัจจุบัน
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Summary stats */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Quick counts */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-slate-600">สำนวนคดี:</span>
              <strong className="text-slate-900 font-mono text-sm">{data.cases.length}</strong>
            </div>

            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span className="text-slate-600">ตารางเวรชี้:</span>
              <strong className="text-slate-900 font-mono text-sm">{data.dutyRosters.length} เดือน</strong>
            </div>

            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-slate-600">รายการติดตาม:</span>
              <strong className="text-slate-900 font-mono text-sm">{data.followUps.length}</strong>
            </div>
          </div>

          {/* Action buttons: Download, Copy JSON, Upload File, Export Excel CSV, Help */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
                showGuide
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
              }`}
              title="วิธีเปิดดูข้อมูลไฟล์ .json และโปรแกรมที่รองรับ"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>วิธีดูข้อมูล</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <label className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>เลือกไฟล์ .json มาเปิดดู</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleExportCsv}
              className="bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              title="ส่งออกข้อมูลสำนวนคดีเป็นไฟล์ CSV สำหรับเปิดดูด้วย Microsoft Excel หรือ Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>เปิดใน Excel (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              title="คัดลอกข้อความ JSON ทั้งหมด"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{isCopied ? 'คัดลอกแล้ว' : 'คัดลอก JSON'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              title="ดาวน์โหลดไฟล์สำรองข้อมูล JSON นี้"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลด .json</span>
            </button>
          </div>
        </div>

        {/* Collapsible Guidance Banner: How to view data */}
        {showGuide && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 p-4 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 text-xs">
                <div className="font-bold text-amber-950 font-['Prompt'] text-sm flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-600" />
                  <span>คำแนะนำ: วิธีเปิดดูข้อมูลไฟล์สำรอง .json</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-amber-900 leading-relaxed pt-1">
                  <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                    <strong className="text-amber-950 block mb-1">1. ดูผ่านหน้าต่างนี้ได้ทันที (สะดวกที่สุด)</strong>
                    <p className="text-[11px] text-slate-700">
                      ไม่จำเป็นต้องใช้โปรแกรมอื่น เพียงกดปุ่ม <strong>&quot;เลือกไฟล์ .json มาเปิดดู&quot;</strong> ระบบจะอ่านไฟล์สำรองและแสดงตารางสำนวนคดี, เวรชี้, และรายการติดตาม พร้อมช่องค้นหาทันที
                    </p>
                  </div>

                  <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                    <strong className="text-amber-950 block mb-1">2. เปิดดูใน Microsoft Excel / Google Sheets</strong>
                    <p className="text-[11px] text-slate-700">
                      กดปุ่ม <strong>&quot;เปิดใน Excel (CSV)&quot;</strong> ด้านบนเพื่อดาวน์โหลดไฟล์ตารางที่รองรับภาษาไทย สามารถดับเบิ้ลคลิกเปิดดู แก้ไข หรือสั่งพิมพ์ใน Excel ได้ทันที
                    </p>
                  </div>

                  <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                    <strong className="text-amber-950 block mb-1">3. เปิดดูด้วยโปรแกรมในเครื่องคอมพิวเตอร์</strong>
                    <p className="text-[11px] text-slate-700">
                      - <strong>เว็บเบราว์เซอร์:</strong> ลากไฟล์ <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px]">.json</code> ไปปล่อยในแท็บ Google Chrome หรือ Edge<br />
                      - <strong>Notepad:</strong> คลิกขวาที่ไฟล์ &gt; Open with &gt; Notepad<br />
                      - <strong>VS Code:</strong> เปิดดูโครงสร้าง JSON สวยงาม
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-amber-600 hover:text-amber-900 p-1"
                title="ปิดคำแนะนำ"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Tab navigation & Case Search Bar */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 border-b sm:border-b-0 pb-1 sm:pb-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('cases')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'cases'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>สำนวนคดี ({data.cases.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('duty')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'duty'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>ตารางเวรชี้ ({data.dutyRosters.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('followups')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'followups'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>รายการติดตาม ({data.followUps.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'raw'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>โค้ดดิบ JSON</span>
            </button>
          </div>

          {/* Search box (when in cases or followups) */}
          {(activeTab === 'cases' || activeTab === 'followups') && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเลขดำ, เลขแดง, จำเลย, อัยการ..."
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* TAB 1: CASES */}
          {activeTab === 'cases' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  แสดง {filteredCases.length} จากทั้งหมด {data.cases.length} สำนวน
                </span>
                {searchQuery && (
                  <span>
                    กรองด้วยคำค้น: <strong className="text-blue-700 font-semibold">&quot;{searchQuery}&quot;</strong>
                  </span>
                )}
              </div>

              {filteredCases.length === 0 ? (
                <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-slate-300" />
                  <div className="text-sm font-semibold">ไม่พบสำนวนคดีที่ตรงกับคำค้นหา</div>
                  <div className="text-xs">ลองเปลี่ยนคำค้นหา หรือกดล้างคำค้น</div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-800 text-white font-semibold text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 border-r border-slate-700 w-12 text-center">#</th>
                          <th className="py-2.5 px-3 border-r border-slate-700 whitespace-nowrap">ฟ้องวันที่</th>
                          <th className="py-2.5 px-3 border-r border-slate-700 whitespace-nowrap">เลขดำ / เลขแดง</th>
                          <th className="py-2.5 px-3 border-r border-slate-700 whitespace-nowrap">ส.1 / ส.4</th>
                          <th className="py-2.5 px-3 border-r border-slate-700 whitespace-nowrap">จำเลย / โจทก์</th>
                          <th className="py-2.5 px-3 border-r border-slate-700 whitespace-nowrap">อัยการเจ้าของ</th>
                          <th className="py-2.5 px-3 border-r border-slate-700 whitespace-nowrap">คำพิพากษา / สถานะ</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">ครบอุทธรณ์ 1 เดือน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredCases.map((c, idx) => (
                          <tr key={c.id || idx} className="hover:bg-slate-50 transition">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-slate-700 font-medium">
                              {c.filingDate ? formatThaiDate(c.filingDate, { short: true }) : '-'}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <div className="font-bold text-slate-900 font-['Prompt']">
                                ดำ {c.blackCaseNo}
                              </div>
                              {c.redCaseNo && c.redCaseNo !== 'ยังไม่มีเลขแดง' && c.redCaseNo !== '-' ? (
                                <div className="text-rose-700 font-semibold text-[11px]">
                                  แดง {c.redCaseNo}
                                </div>
                              ) : (
                                <div className="text-slate-400 text-[10px]">ยังไม่มีเลขแดง</div>
                              )}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-[11px]">
                              {c.receivedNumberS1 && (
                                <span className="block text-blue-900 font-medium">ส.1: {c.receivedNumberS1}</span>
                              )}
                              {c.filingNumberS4 && (
                                <span className="block text-emerald-900 font-medium">ส.4: {c.filingNumberS4}</span>
                              )}
                              {!c.receivedNumberS1 && !c.filingNumberS4 && <span className="text-slate-400">-</span>}
                            </td>
                            <td className="py-2 px-3 max-w-[180px]">
                              <div className="font-medium text-slate-900 truncate" title={c.defendant}>
                                {c.defendant}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate" title={c.court}>
                                {c.court}
                              </div>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-slate-800">
                              👔 {c.responsiblePerson || c.prosecutorName || 'รอกำหนด'}
                            </td>
                            <td className="py-2 px-3 max-w-[220px]">
                              {c.judgmentOutcome || c.fullJudgmentText ? (
                                <div className="text-[11px] text-slate-800 line-clamp-2" title={c.fullJudgmentText || c.judgmentOutcome}>
                                  {c.judgmentOutcome || c.fullJudgmentText}
                                </div>
                              ) : c.courtStageStatus === 'confessed' || c.defendantPlea === 'confessed' ? (
                                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  🟡 จำเลยรับสารภาพ
                                </span>
                              ) : c.courtStageStatus === 'rights_protection' || c.defendantPlea === 'denied' ? (
                                <span className="text-[11px] font-bold text-orange-800 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                  🟠 นัดคุ้มครองสิทธิ (ปฏิเสธ)
                                </span>
                              ) : c.isRequisitionCase ? (
                                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  🟢 สำนวนเบิกฟ้อง
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {c.appealDeadline ? (
                                <div className="text-rose-700 font-bold text-[11px]">
                                  {formatThaiDate(c.appealDeadline, { short: true })}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px]">ยังไม่มีกำหนด</span>
                              )}
                              {c.isCompleted && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 mt-0.5">
                                  ✓ เสร็จสิ้น
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DUTY ROSTERS */}
          {activeTab === 'duty' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500">
                ข้อมูลตารางเวรชี้อัยการประจำเดือนทั้งหมด {data.dutyRosters.length} รายการ
              </div>

              {data.dutyRosters.length === 0 ? (
                <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-300" />
                  <div className="text-sm font-semibold">ยังไม่มีข้อมูลตารางเวรชี้ในไฟล์สำรองนี้</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.dutyRosters.map((roster, rIdx) => (
                    <div
                      key={roster.id || rIdx}
                      className="bg-white border border-purple-200 rounded-xl p-4 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                        <div className="font-bold text-sm text-purple-950 font-['Prompt']">
                          📅 {roster.monthNameThai || roster.monthYear}
                        </div>
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                          {(roster.duties || (roster as any).records || []).length} วันทำการ
                        </span>
                      </div>

                      {(roster.duties || (roster as any).records) && (roster.duties || (roster as any).records).length > 0 ? (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 text-xs">
                          {(roster.duties || (roster as any).records || []).map((rec: any, recIdx: number) => (
                            <div
                              key={rec.id || recIdx}
                              className="p-2 bg-purple-50/50 rounded-lg flex items-center justify-between gap-2"
                            >
                              <div className="font-semibold text-slate-800">
                                {formatThaiDate(rec.date, { short: true })}
                              </div>
                              <div className="text-purple-900 font-medium truncate max-w-[200px]">
                                {rec.officers && rec.officers.length > 0
                                  ? rec.officers.map((o: any) => o.name).join(', ')
                                  : 'ไม่ได้ระบุอัยการ'}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">ไม่มีรายการวันทำการ</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FOLLOWUPS */}
          {activeTab === 'followups' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                รายการติดตามคำพิพากษาประจำวันทั้งหมด {data.followUps.length} รายการ
              </div>

              {data.followUps.length === 0 ? (
                <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                  <Scale className="w-8 h-8 mx-auto text-slate-300" />
                  <div className="text-sm font-semibold">ไม่มีรายการติดตามคำพิพากษาในไฟล์สำรองนี้</div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800 text-white font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 border-r border-slate-700 w-12 text-center">#</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">วันที่ติดตาม</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">เลขคดี</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">ศาล / คู่ความ</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">ผู้รับผิดชอบ</th>
                        <th className="py-2.5 px-3">ผลการติดตาม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {data.followUps.map((f, fIdx) => (
                        <tr key={f.id || fIdx} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{fIdx + 1}</td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-700">
                            {formatThaiDate(f.followUpDate, { short: true })}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-900">{f.caseNumber}</td>
                          <td className="py-2 px-3">
                            <div>{f.defendant}</div>
                            <div className="text-[10px] text-slate-400">{f.court}</div>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-700">{f.responsiblePerson}</td>
                          <td className="py-2 px-3 text-slate-700">{f.judgmentSummary || f.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RAW JSON */}
          {activeTab === 'raw' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>โค้ดโครงสร้างไฟล์ JSON ขนาด {Math.round(JSON.stringify(data).length / 1024)} KB</span>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกโค้ดทั้งหมด</span>
                </button>
              </div>

              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-auto max-h-[55vh] leading-relaxed border border-slate-800 shadow-inner select-all">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <span>ข้อมูลเมื่อ: </span>
            <strong className="text-slate-800">{data.metadata?.exportedAtThai || '-'}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
