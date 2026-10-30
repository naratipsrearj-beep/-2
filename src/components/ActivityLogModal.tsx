import React, { useState, useMemo } from 'react';
import {
  History,
  X,
  Search,
  Filter,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  UserX,
  KeyRound,
  FileEdit,
  Trash2,
  Send,
  Gavel,
  PlusCircle,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Tag,
  User,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ActivityLog, ActivityActionType } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ActivityLog[];
  initialCaseFilter?: string; // Optional blackCaseNo or case ID to pre-filter
  onSelectCase?: (caseNumber: string) => void;
  onRefresh?: () => void;
}

type ActionCategory = 'all' | 'completion' | 'extension' | 'permission' | 'duty' | 'case_edit';
type DateFilter = 'all' | 'today' | '7days' | '30days';

export const ActivityLogModal: React.FC<ActivityLogModalProps> = ({
  isOpen,
  onClose,
  logs,
  initialCaseFilter,
  onSelectCase,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialCaseFilter || '');
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilter>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Update searchQuery when initialCaseFilter changes
  React.useEffect(() => {
    if (initialCaseFilter) {
      setSearchQuery(initialCaseFilter);
    }
  }, [initialCaseFilter]);

  // Filter categorization mapping
  const matchesCategory = (log: ActivityLog, cat: ActionCategory): boolean => {
    if (cat === 'all') return true;
    if (cat === 'completion') {
      return log.actionType === 'case_completed' || log.actionType === 'case_completion_undone';
    }
    if (cat === 'extension') {
      return log.actionType === 'deadline_extended' || log.actionType === 'deadline_reverted';
    }
    if (cat === 'permission') {
      return (
        log.actionType === 'permission_changed' ||
        log.actionType === 'permission_approved' ||
        log.actionType === 'permission_rejected' ||
        log.actionType === 'admin_pin_changed'
      );
    }
    if (cat === 'duty') {
      return log.actionType === 'duty_submitted' || log.actionType === 'duty_cancelled';
    }
    if (cat === 'case_edit') {
      return (
        log.actionType === 'case_created' ||
        log.actionType === 'case_updated' ||
        log.actionType === 'case_deleted' ||
        log.actionType === 'judgment_recorded' ||
        log.actionType === 'judgment_verified'
      );
    }
    return true;
  };

  // Date filtering
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const matchesDate = (timestamp: string, dateFilter: DateFilter): boolean => {
    if (dateFilter === 'all') return true;
    const logDate = new Date(timestamp);
    if (isNaN(logDate.getTime())) return true;

    if (dateFilter === 'today') {
      return timestamp.slice(0, 10) === todayStr;
    }
    if (dateFilter === '7days') {
      return logDate >= sevenDaysAgo;
    }
    if (dateFilter === '30days') {
      return logDate >= thirtyDaysAgo;
    }
    return true;
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return logs.filter((log) => {
      // Category filter
      if (!matchesCategory(log, selectedCategory)) return false;

      // Date filter
      if (!matchesDate(log.timestamp, selectedDateFilter)) return false;

      // Role filter
      if (selectedRoleFilter !== 'all' && log.actorRole !== selectedRoleFilter) return false;

      // Search query filter
      if (q) {
        const matchTitle = (log.targetTitle || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        const matchActor = (log.actorName || '').toLowerCase().includes(q);
        const matchLabel = (log.actionLabel || '').toLowerCase().includes(q);
        const matchBlack = (log.metadata?.blackCaseNo || '').toLowerCase().includes(q);
        const matchRed = (log.metadata?.redCaseNo || '').toLowerCase().includes(q);
        const matchPros = (log.metadata?.prosecutorName || '').toLowerCase().includes(q);
        const matchReason = (log.metadata?.reason || '').toLowerCase().includes(q);
        return (
          matchTitle ||
          matchDetails ||
          matchActor ||
          matchLabel ||
          matchBlack ||
          matchRed ||
          matchPros ||
          matchReason
        );
      }

      return true;
    });
  }, [logs, searchQuery, selectedCategory, selectedDateFilter, selectedRoleFilter]);

  // Statistics
  const stats = useMemo(() => {
    const todayLogs = logs.filter((l) => l.timestamp?.slice(0, 10) === todayStr);
    const completions = logs.filter((l) => l.actionType === 'case_completed');
    const extensions = logs.filter((l) => l.actionType === 'deadline_extended');
    const permissions = logs.filter(
      (l) =>
        l.actionType === 'permission_changed' ||
        l.actionType === 'permission_approved' ||
        l.actionType === 'admin_pin_changed'
    );
    return {
      total: logs.length,
      today: todayLogs.length,
      completions: completions.length,
      extensions: extensions.length,
      permissions: permissions.length,
    };
  }, [logs, todayStr]);

  // Format timestamp nicely
  const formatLogTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const datePart = formatThaiDate(isoString.slice(0, 10));
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${datePart} เวลา ${hours}:${minutes} น.`;
    } catch {
      return isoString;
    }
  };

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const diffMs = now.getTime() - d.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return 'เมื่อสักครู่';
      if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
      if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
      if (diffDays === 1) return 'เมื่อวานนี้';
      if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
      return '';
    } catch {
      return '';
    }
  };

  // Action badge info (icon, colors, label)
  const getActionBadge = (type: ActivityActionType) => {
    switch (type) {
      case 'case_completed':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          dot: 'bg-emerald-400',
          title: 'เสร็จสิ้นสำนวน',
        };
      case 'case_completion_undone':
        return {
          icon: <RotateCcw className="w-4 h-4 text-amber-400" />,
          bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          dot: 'bg-amber-400',
          title: 'ยกเลิกเสร็จสิ้น',
        };
      case 'deadline_extended':
        return {
          icon: <Clock className="w-4 h-4 text-amber-400" />,
          bg: 'bg-amber-500/20 border-amber-500/40 text-amber-200',
          dot: 'bg-amber-400',
          title: 'ขยายเวลาอุทธรณ์',
        };
      case 'deadline_reverted':
        return {
          icon: <RotateCcw className="w-4 h-4 text-slate-400" />,
          bg: 'bg-slate-700/40 border-slate-600 text-slate-300',
          dot: 'bg-slate-400',
          title: 'ยกเลิกการขยายเวลา',
        };
      case 'permission_changed':
      case 'permission_approved':
        return {
          icon: <ShieldCheck className="w-4 h-4 text-indigo-400" />,
          bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
          dot: 'bg-indigo-400',
          title: 'จัดการสิทธิ์ผู้ใช้',
        };
      case 'permission_rejected':
        return {
          icon: <UserX className="w-4 h-4 text-rose-400" />,
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
          dot: 'bg-rose-400',
          title: 'ปฏิเสธคำขอสิทธิ์',
        };
      case 'admin_pin_changed':
        return {
          icon: <KeyRound className="w-4 h-4 text-purple-400" />,
          bg: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
          dot: 'bg-purple-400',
          title: 'เปลี่ยนรหัส PIN',
        };
      case 'duty_submitted':
        return {
          icon: <Send className="w-4 h-4 text-violet-400" />,
          bg: 'bg-violet-500/15 border-violet-500/30 text-violet-300',
          dot: 'bg-violet-400',
          title: 'เสนอเวรชี้',
        };
      case 'duty_cancelled':
        return {
          icon: <RotateCcw className="w-4 h-4 text-slate-400" />,
          bg: 'bg-slate-800 border-slate-700 text-slate-300',
          dot: 'bg-slate-400',
          title: 'ยกเลิกเสนอเวรชี้',
        };
      case 'judgment_recorded':
      case 'judgment_verified':
        return {
          icon: <Gavel className="w-4 h-4 text-teal-400" />,
          bg: 'bg-teal-500/15 border-teal-500/30 text-teal-300',
          dot: 'bg-teal-400',
          title: 'คำพิพากษา',
        };
      case 'case_created':
        return {
          icon: <PlusCircle className="w-4 h-4 text-blue-400" />,
          bg: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
          dot: 'bg-blue-400',
          title: 'เพิ่มสำนวนใหม่',
        };
      case 'case_updated':
        return {
          icon: <FileEdit className="w-4 h-4 text-sky-400" />,
          bg: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
          dot: 'bg-sky-400',
          title: 'แก้ไขสำนวน',
        };
      case 'case_deleted':
        return {
          icon: <Trash2 className="w-4 h-4 text-rose-400" />,
          bg: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
          dot: 'bg-rose-400',
          title: 'ลบสำนวน',
        };
      case 'roster_uploaded':
        return {
          icon: <Calendar className="w-4 h-4 text-indigo-400" />,
          bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
          dot: 'bg-indigo-400',
          title: 'ตารางเวรชี้',
        };
      default:
        return {
          icon: <History className="w-4 h-4 text-slate-400" />,
          bg: 'bg-slate-800 border-slate-700 text-slate-300',
          dot: 'bg-slate-400',
          title: 'กิจกรรม',
        };
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['วันที่-เวลา', 'ประเภทกิจกรรม', 'หัวข้อการกระทำ', 'ผู้ดำเนินการ', 'บทบาท', 'เป้าหมาย/เลขคดี', 'รายละเอียด'];
    const rows = filteredLogs.map((l) => [
      formatLogTime(l.timestamp),
      l.actionLabel || l.actionType,
      l.actionType,
      l.actorName || '',
      l.actorRole || '',
      l.targetTitle || '',
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_logs_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyDetails = (log: ActivityLog) => {
    const text = `[${formatLogTime(log.timestamp)}] ${log.actionLabel} โดย ${log.actorName} (${log.actorRole})\nเป้าหมาย: ${log.targetTitle || '-'}\nรายละเอียด: ${log.details}`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  บันทึกประวัติการทำงาน (Activity Log & Audit Trail)
                </h2>
                <span className="bg-amber-500/20 text-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  👑 เฉพาะแอดมิน
                </span>
                <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">
                  {stats.total} รายการ
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ติดตามตรวจสอบกิจกรรมสำคัญ การกดเสร็จสิ้น การขยายเวลาอุทธรณ์ และการจัดการสิทธิ์ในระบบ (สำหรับผู้ดูแลระบบ)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                title="รีเฟรชประวัติ"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50"
              title="ดาวน์โหลดเป็นไฟล์ CSV สำหรับเปิดใน Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">ส่งออก CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Summary Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-slate-950/30 border-b border-slate-800/80">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
              ⚡
            </div>
            <div>
              <div className="text-[11px] text-slate-400">กิจกรรมวันนี้</div>
              <div className="text-base font-bold text-white">{stats.today} <span className="text-[10px] text-slate-400 font-normal">รายการ</span></div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
              ✅
            </div>
            <div>
              <div className="text-[11px] text-slate-400">กดเสร็จสิ้นสำนวน</div>
              <div className="text-base font-bold text-emerald-300">{stats.completions} <span className="text-[10px] text-slate-400 font-normal">ครั้ง</span></div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
              ⏳
            </div>
            <div>
              <div className="text-[11px] text-slate-400">ขยายเวลาอุทธรณ์</div>
              <div className="text-base font-bold text-amber-300">{stats.extensions} <span className="text-[10px] text-slate-400 font-normal">ครั้ง</span></div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
              🛡️
            </div>
            <div>
              <div className="text-[11px] text-slate-400">จัดการสิทธิ์ผู้ใช้</div>
              <div className="text-base font-bold text-purple-300">{stats.permissions} <span className="text-[10px] text-slate-400 font-normal">ครั้ง</span></div>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 space-y-3 bg-slate-900/90 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาตามเลขคดีดำ (อ...), แดง, ชื่ออัยการ, ผู้ดำเนินการ หรือรายละเอียด..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-700 rounded-xl p-1 text-xs">
              <span className="text-slate-400 px-2 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>ช่วงเวลา:</span>
              </span>
              {(
                [
                  { id: 'all', label: 'ทั้งหมด' },
                  { id: 'today', label: 'วันนี้' },
                  { id: '7days', label: '7 วัน' },
                  { id: '30days', label: '30 วัน' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedDateFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    selectedDateFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Role Filter Selector */}
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="all">บทบาท: ทั้งหมด</option>
              <option value="admin">👑 แอดมิน (Admin)</option>
              <option value="appeal_officer">⚖️ จนท.คุมอุทธรณ์</option>
              <option value="editor">✍️ ผู้ร่วมแก้ไข</option>
              <option value="viewer">👁️ ผู้เข้าชม</option>
            </select>
          </div>

          {/* Action Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-slate-400 text-[11px] whitespace-nowrap mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>ประเภท:</span>
            </span>
            {(
              [
                { id: 'all', label: 'ทั้งหมด', icon: '📋' },
                { id: 'completion', label: 'กดเสร็จสิ้น / ยกเลิก', icon: '✅' },
                { id: 'extension', label: 'ขยายเวลาอุทธรณ์', icon: '⏳' },
                { id: 'permission', label: 'จัดการสิทธิ์ & PIN', icon: '🛡️' },
                { id: 'duty', label: 'เสนอเวรชี้', icon: '🏛️' },
                { id: 'case_edit', label: 'เพิ่ม / แก้ไข / ลบสำนวน', icon: '📝' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition cursor-pointer border ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-xs'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Log Entries List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-16 bg-slate-950/20 border border-dashed border-slate-800 rounded-2xl">
              <History className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-60" />
              <h3 className="text-sm font-semibold text-slate-300">ไม่พบบันทึกกิจกรรมตามเงื่อนไขที่เลือก</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                ลองปรับเปลี่ยนคำค้นหา หรือเปลี่ยนตัวกรองประเภทกิจกรรมและช่วงเวลา
              </p>
              {(searchQuery || selectedCategory !== 'all' || selectedDateFilter !== 'all' || selectedRoleFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedDateFilter('all');
                    setSelectedRoleFilter('all');
                  }}
                  className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const badge = getActionBadge(log.actionType);
              const isExpanded = expandedLogId === log.id;
              const relativeTime = getRelativeTime(log.timestamp);

              return (
                <div
                  key={log.id}
                  className="bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/60 hover:border-slate-600 rounded-xl p-3.5 transition group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    {/* Left: Action Icon, Title, and Details */}
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border ${badge.bg}`}>
                        {badge.icon}
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Action Badge */}
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${badge.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            <span>{log.actionLabel || badge.title}</span>
                          </span>

                          {/* Target Pill */}
                          {log.targetTitle && (
                            <button
                              type="button"
                              onClick={() => {
                                if (log.metadata?.blackCaseNo && onSelectCase) {
                                  onSelectCase(log.metadata.blackCaseNo);
                                  onClose();
                                } else {
                                  setSearchQuery(log.targetTitle || '');
                                }
                              }}
                              className="text-xs font-semibold text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 px-2 py-0.5 rounded-md transition flex items-center gap-1 cursor-pointer"
                              title="คลิกเพื่อกรองหรือดูสำนวนนี้"
                            >
                              <Tag className="w-3 h-3 text-blue-400" />
                              <span>{log.targetTitle}</span>
                            </button>
                          )}

                          {/* Actor Info */}
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <span>โดย</span>
                            <span className="font-semibold text-slate-200 bg-slate-700/50 px-1.5 py-0.5 rounded">
                              {log.actorRole === 'admin'
                                ? '👑 '
                                : log.actorRole === 'appeal_officer'
                                ? '⚖️ '
                                : log.actorRole === 'editor'
                                ? '✍️ '
                                : '👁️ '}
                              {log.actorName}
                            </span>
                          </span>
                        </div>

                        {/* Main Description */}
                        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                          {log.details}
                        </div>

                        {/* Expandable Metadata if available */}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-medium"
                            >
                              <span>{isExpanded ? 'ซ่อนรายละเอียดทางเทคนิค' : 'ดูรายละเอียดเพิ่มเติม'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {isExpanded && (
                              <div className="mt-2 p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1 font-mono text-slate-300 animate-fadeIn">
                                {log.metadata.blackCaseNo && (
                                  <div><span className="text-slate-500">เลขคดีดำ:</span> {log.metadata.blackCaseNo}</div>
                                )}
                                {log.metadata.redCaseNo && (
                                  <div><span className="text-slate-500">เลขคดีแดง:</span> {log.metadata.redCaseNo}</div>
                                )}
                                {log.metadata.court && (
                                  <div><span className="text-slate-500">ศาล:</span> {log.metadata.court}</div>
                                )}
                                {log.metadata.prosecutorName && (
                                  <div><span className="text-slate-500">อัยการเจ้าของสำนวน:</span> {log.metadata.prosecutorName}</div>
                                )}
                                {log.metadata.previousValue && (
                                  <div><span className="text-slate-500">ค่าเดิม:</span> {log.metadata.previousValue}</div>
                                )}
                                {log.metadata.newValue && (
                                  <div><span className="text-slate-500">ค่าใหม่:</span> {log.metadata.newValue}</div>
                                )}
                                {log.metadata.extensionCount !== undefined && (
                                  <div><span className="text-slate-500">ขยายครั้งที่:</span> {log.metadata.extensionCount}</div>
                                )}
                                {log.metadata.reason && (
                                  <div><span className="text-slate-500">เหตุผล:</span> {log.metadata.reason}</div>
                                )}
                                {log.metadata.completionReason && (
                                  <div><span className="text-slate-500">เหตุผลเสร็จสิ้น:</span> {log.metadata.completionReason}</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Timestamp and Copy Action */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 flex-shrink-0 text-right pl-11 sm:pl-0">
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatLogTime(log.timestamp)}</span>
                      </div>
                      {relativeTime && (
                        <div className="text-[10px] text-slate-500">
                          {relativeTime}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyDetails(log)}
                        className="text-[10px] text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-700/50 transition cursor-pointer flex items-center gap-1 mt-0.5"
                        title="คัดลอกข้อความกิจกรรมนี้"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedId === log.id ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span>
              ระบบบันทึกประวัติอัตโนมัติแบบเรียลไทม์ (Real-time Audit Trail) เพื่อความโปร่งใสและตรวจสอบความรับผิดชอบ
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-1.5 rounded-xl border border-slate-700 transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
