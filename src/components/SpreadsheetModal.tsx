import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  Plus,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { SheetConfig } from '../types/appeal';
import { createTrackerSpreadsheet, searchUserSheets } from '../services/sheetsService';

interface SpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  currentConfig: SheetConfig | null;
  onConnectSpreadsheet: (config: SheetConfig) => void;
  onDisconnectSpreadsheet: () => void;
  onLoginPrompt: () => void;
}

export const SpreadsheetModal: React.FC<SpreadsheetModalProps> = ({
  isOpen,
  onClose,
  token,
  currentConfig,
  onConnectSpreadsheet,
  onDisconnectSpreadsheet,
  onLoginPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'existing' | 'manual'>('create');
  const [newTitle, setNewTitle] = useState(`ระบบคุมระยะเวลาอุทธรณ์และติดตามคำพิพากษา_${new Date().getFullYear() + 543}`);
  const [manualIdOrUrl, setManualIdOrUrl] = useState('');
  const [existingSheets, setExistingSheets] = useState<Array<{ id: string; name: string; modifiedTime: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && token && activeTab === 'existing') {
      loadExistingSheets();
    }
  }, [isOpen, token, activeTab]);

  if (!isOpen) return null;

  const loadExistingSheets = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const sheets = await searchUserSheets(token);
      setExistingSheets(sheets);
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถค้นหา Google Sheets ได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = async () => {
    if (!token) {
      onLoginPrompt();
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await createTrackerSpreadsheet(token, newTitle);
      onConnectSpreadsheet({
        spreadsheetId: result.id,
        spreadsheetTitle: result.title,
        spreadsheetUrl: result.url,
        lastSyncedAt: new Date().toISOString(),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการสร้าง Google Sheet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectExisting = (sheet: { id: string; name: string }) => {
    const url = `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`;
    onConnectSpreadsheet({
      spreadsheetId: sheet.id,
      spreadsheetTitle: sheet.name,
      spreadsheetUrl: url,
      lastSyncedAt: new Date().toISOString(),
    });
    onClose();
  };

  const handleConnectManual = () => {
    if (!manualIdOrUrl.trim()) return;

    let id = manualIdOrUrl.trim();
    // ถ้าใส่เป็น URL เต็ม ให้ดึง ID ออกมา
    const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      id = match[1];
    }

    const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
    onConnectSpreadsheet({
      spreadsheetId: id,
      spreadsheetTitle: 'Google Sheets สำนวนคดี',
      spreadsheetUrl: url,
      lastSyncedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt']">
                เชื่อมต่อกับ Google Sheets
              </h3>
              <p className="text-xs text-slate-300">
                ซิงค์ข้อมูลสำนวนคุมอุทธรณ์และบัญชีติดตามคำพิพากษารายวัน
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Current Connection */}
          {currentConfig && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-950 truncate">
                    กำลังเชื่อมต่อกับ: {currentConfig.spreadsheetTitle}
                  </div>
                  <a
                    href={currentConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-700 hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>เปิดสเปรดชีตนี้ใน Google Sheets</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <button
                onClick={onDisconnectSpreadsheet}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 hover:bg-rose-50 rounded transition ml-2 flex-shrink-0"
              >
                ยกเลิกการเชื่อมต่อ
              </button>
            </div>
          )}

          {!token ? (
            <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-3">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto" />
              <div>
                <h4 className="font-bold text-slate-800 text-sm font-['Prompt']">
                  ต้องเข้าสู่ระบบ Google เพื่อเชื่อมต่อ Google Sheets
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  ระบบต้องการสิทธิ์เข้าถึง Google Sheets และ Drive เพื่อบันทึกข้อมูลสำนวนคดีและวันที่ต้องตามคำพิพากษา
                </p>
              </div>
              <button
                onClick={onLoginPrompt}
                className="inline-flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 font-semibold px-4 py-2 rounded-xl text-xs shadow-xs transition"
              >
                <span>เข้าสู่ระบบ Google ทันที</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Tab selector */}
              <div className="flex border-b border-slate-200 text-xs font-medium mb-4">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`py-2 px-3 border-b-2 transition ${
                    activeTab === 'create'
                      ? 'border-emerald-600 text-emerald-700 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  สร้างไฟล์ชีทใหม่ (แนะนำ)
                </button>
                <button
                  onClick={() => setActiveTab('existing')}
                  className={`py-2 px-3 border-b-2 transition ${
                    activeTab === 'existing'
                      ? 'border-emerald-600 text-emerald-700 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  เลือกจาก Google Drive
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`py-2 px-3 border-b-2 transition ${
                    activeTab === 'manual'
                      ? 'border-emerald-600 text-emerald-700 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ระบุ URL หรือ ID ชีท
                </button>
              </div>

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Tab 1: Create New */}
              {activeTab === 'create' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <p className="font-semibold text-slate-800 mb-1">
                      ระบบจะสร้าง Google Spreadsheet ใหม่ใน Google Drive ของคุณ:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                      <li>
                        <strong>แผ่นงานที่ 1: "คุมระยะเวลาอุทธรณ์"</strong> - บันทึกเลขคดี วันที่ฟ้อง วันพิพากษา และวันครบกำหนด 1 เดือน
                      </li>
                      <li>
                        <strong>แผ่นงานที่ 2: "ติดตามคำพิพากษารายวัน"</strong> - บันทึกรายการคดีที่ต้องตามคำพิพากษาในแต่ละวัน
                      </li>
                    </ul>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อไฟล์สเปรดชีต
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleCreateNew}
                    disabled={isLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>กำลังสร้าง Google Spreadsheet...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>สร้างและเชื่อมต่อ Google Sheets ทันที</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Tab 2: Existing Sheets */}
              {activeTab === 'existing' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>เลือกไฟล์ Google Sheets ใน Drive ของคุณ:</span>
                    <button
                      onClick={loadExistingSheets}
                      className="text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>รีเฟรช</span>
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                      <span>กำลังโหลดรายการ Google Sheets...</span>
                    </div>
                  ) : existingSheets.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                      ไม่พบไฟล์ Google Sheets หรือยังไม่ได้ให้สิทธิ์เข้าถึง
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {existingSheets.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectExisting(s)}
                          className="p-3 hover:bg-emerald-50/60 cursor-pointer flex items-center justify-between transition group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="text-xs text-slate-800 font-medium truncate group-hover:text-emerald-800">
                              {s.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition">
                            เลือกไฟล์นี้
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Manual ID */}
              {activeTab === 'manual' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    วาง Google Sheets URL หรือ Spreadsheet ID
                  </label>
                  <input
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                    value={manualIdOrUrl}
                    onChange={(e) => setManualIdOrUrl(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">
                    เปิด Google Sheet ของคุณ แล้วคัดลอก URL ในแถบที่อยู่มาวางที่นี่
                  </p>

                  <button
                    onClick={handleConnectManual}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow-xs"
                  >
                    เชื่อมต่อ Google Sheet นี้
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
