import React, { useState } from 'react';
import {
  CalendarCheck,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Share2,
  FileSpreadsheet,
  Trash2,
  Edit3,
  Send,
  Calendar,
  Image as ImageIcon,
  FileCheck2,
  Upload,
  CheckCircle2
} from 'lucide-react';
import { DailyJudgmentFollowUp, FollowUpStatus, CourtAppointmentType } from '../types/appeal';
import { formatThaiDate, getTodayString } from '../utils/dateUtils';
import { appointmentTypeOptions } from './CourtAppointmentModal';
import { getAppointmentLabel, getAppointmentBadgeStyle } from '../utils/appointmentUtils';

interface DailyJudgmentFollowUpViewProps {
  followUps: DailyJudgmentFollowUp[];
  onAddFollowUp: (item: Omit<DailyJudgmentFollowUp, 'id' | 'createdAt'>) => void;
  onUpdateFollowUp: (item: DailyJudgmentFollowUp) => void;
  onDeleteFollowUp: (id: string) => void;
  onTransferToAppealTracker: (item: DailyJudgmentFollowUp) => void;
  onOpenJudgmentRecheck?: (item: DailyJudgmentFollowUp) => void;
  hasSheetConnected: boolean;
}

export const DailyJudgmentFollowUpView: React.FC<DailyJudgmentFollowUpViewProps> = ({
  followUps,
  onAddFollowUp,
  onUpdateFollowUp,
  onDeleteFollowUp,
  onTransferToAppealTracker,
  onOpenJudgmentRecheck,
  hasSheetConnected,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form State
  const [formData, setFormData] = useState({
    followUpDate: getTodayString(),
    caseNumber: '',
    court: '',
    plaintiff: '',
    defendant: '',
    hearingTime: '09:00',
    responsiblePerson: '',
    status: 'pending' as FollowUpStatus,
    judgmentSummary: '',
    appointmentType: 'none' as CourtAppointmentType,
    appointmentTypeName: '',
    appointmentDate: '',
    notes: '',
    judgmentPhotoUrl: '' as string | undefined,
    judgmentPhotoName: '' as string | undefined,
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.caseNumber || !formData.court) {
      alert('กรุณากรอกเลขคดีและศาล');
      return;
    }

    if (formData.appointmentType !== 'none' && !formData.appointmentDate) {
      alert('กรุณาระบุวันที่นัดของศาล');
      return;
    }

    onAddFollowUp({
      followUpDate: formData.followUpDate,
      caseNumber: formData.caseNumber,
      court: formData.court,
      plaintiff: formData.plaintiff,
      defendant: formData.defendant,
      hearingTime: formData.hearingTime,
      responsiblePerson: formData.responsiblePerson || 'นิติกรประจำวัน',
      status: formData.status,
      judgmentSummary: formData.judgmentSummary,
      appointmentType: formData.appointmentType,
      appointmentTypeName: formData.appointmentType === 'other' ? formData.appointmentTypeName.trim() : undefined,
      appointmentDate: formData.appointmentType !== 'none' ? formData.appointmentDate : undefined,
      notes: formData.notes,
      judgmentPhotoUrl: formData.judgmentPhotoUrl || undefined,
      judgmentPhotoName: formData.judgmentPhotoName || undefined,
      transferredToAppealTracker: false,
    });

    // Reset
    setFormData({
      followUpDate: selectedDate,
      caseNumber: '',
      court: '',
      plaintiff: '',
      defendant: '',
      hearingTime: '09:00',
      responsiblePerson: '',
      status: 'pending',
      judgmentSummary: '',
      appointmentType: 'none',
      appointmentTypeName: '',
      appointmentDate: '',
      notes: '',
      judgmentPhotoUrl: undefined,
      judgmentPhotoName: undefined,
    });
    setShowAddForm(false);
  };

  // กรองตามวันที่เลือก และ status
  const itemsForSelectedDate = followUps
    .filter((item) => {
      const matchDate = selectedDate ? item.followUpDate === selectedDate : true;
      const matchStatus = statusFilter === 'all' ? true : item.status === statusFilter;
      return matchDate && matchStatus;
    })
    .sort((a, b) => (a.hearingTime || '').localeCompare(b.hearingTime || ''));

  // รวบรวมวันที่ทั้งหมดที่มีการบันทึกติดตาม
  const allRecordedDates = Array.from(new Set(followUps.map((f) => f.followUpDate))).sort().reverse();
  if (!allRecordedDates.includes(getTodayString())) {
    allRecordedDates.unshift(getTodayString());
  }

  return (
    <div className="space-y-5">
      {/* Top Banner & Date Selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-['Prompt'] text-slate-900">
                  บัญชีติดตามคำพิพากษาประจำวัน
                </h3>
                {hasSheetConnected && (
                  <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <FileSpreadsheet className="w-3 h-3" />
                    เชื่อมชีทติดตามรายวันแล้ว
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                บันทึกคดีที่ต้องตามคำพิพากษาในแต่ละวันลง Google Sheets เมื่อศาลมีคำพิพากษาแล้วสามารถกดส่งไปคุมอุทธรณ์ 1 เดือนได้ทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setFormData((prev) => ({ ...prev, followUpDate: selectedDate }));
                setShowAddForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มคดีตามคำพิพากษา</span>
            </button>
          </div>
        </div>

        {/* Date Filter Strip */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500">เลือกวันที่:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setSelectedDate(getTodayString())}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${
                selectedDate === getTodayString()
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              วันนี้
            </button>

            {/* Quick date badges */}
            <div className="hidden lg:flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
              {allRecordedDates.slice(0, 4).map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`text-[11px] px-2 py-1 rounded transition ${
                    selectedDate === d
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {formatThaiDate(d, { short: true, includeYear: false })}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">สถานะ:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทั้งหมด</option>
              <option value="pending">รอฟังคำพิพากษา</option>
              <option value="delivered">ศาลอ่านคำพิพากษาแล้ว</option>
              <option value="postponed">เลื่อนนัด</option>
              <option value="completed">เสร็จสิ้น</option>
            </select>
          </div>
        </div>
      </div>

      {/* Modal / In-page Form for Adding Follow-Up */}
      {showAddForm && (
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              <h4 className="font-bold text-slate-900 font-['Prompt'] text-sm sm:text-base">
                กรอกข้อมูลคดีที่ต้องตามคำพิพากษารายวัน (บันทึกลง Google Sheets)
              </h4>
            </div>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded"
            >
              ปิด
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  วันที่ต้องตามคำพิพากษา *
                </label>
                <input
                  type="date"
                  required
                  value={formData.followUpDate}
                  onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  เวลานัดฟังคำพิพากษา
                </label>
                <input
                  type="text"
                  placeholder="เช่น 09:00 น. หรือ 13:30 น."
                  value={formData.hearingTime}
                  onChange={(e) => setFormData({ ...formData, hearingTime: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  เลขคดีดำ / คดีแดง *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น อ.456/2569"
                  value={formData.caseNumber}
                  onChange={(e) => setFormData({ ...formData, caseNumber: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ศาล / บัลลังก์ *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ศาลอาญา บัลลังก์ 701"
                  value={formData.court}
                  onChange={(e) => setFormData({ ...formData, court: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">โจทก์</label>
                <input
                  type="text"
                  placeholder="เช่น พนักงานอัยการ"
                  value={formData.plaintiff}
                  onChange={(e) => setFormData({ ...formData, plaintiff: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">จำเลย</label>
                <input
                  type="text"
                  placeholder="เช่น นายเอกชัย สมบูรณ์"
                  value={formData.defendant}
                  onChange={(e) => setFormData({ ...formData, defendant: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  สถานะการติดตาม
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as FollowUpStatus })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="pending">รอฟังคำพิพากษา</option>
                  <option value="delivered">ศาลอ่านคำพิพากษาแล้ว</option>
                  <option value="postponed">เลื่อนนัดอ่านคำพิพากษา</option>
                  <option value="completed">ดำเนินการเสร็จสิ้น</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ผู้รับผิดชอบ</label>
                <input
                  type="text"
                  placeholder="ชื่อนิติกร / ทนายความ"
                  value={formData.responsiblePerson}
                  onChange={(e) => setFormData({ ...formData, responsiblePerson: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Appointment selection */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ขั้นตอนนัดของศาล (นัดคุ้มครองสิทธิ, สืบเสาะ หรืออื่นๆ)
                </label>
                <select
                  value={formData.appointmentType}
                  onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value as CourtAppointmentType })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {appointmentTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.appointmentType === 'other' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ระบุชื่อนัดอื่นๆ *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น นัดชี้สองสถาน"
                    value={formData.appointmentTypeName}
                    onChange={(e) => setFormData({ ...formData, appointmentTypeName: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>
              )}

              {formData.appointmentType !== 'none' && (
                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>วันที่นัดของศาล * (นัดคุ้มครองสิทธิ / สืบเสาะ / อื่นๆ)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                    className="w-full text-xs border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                  />
                  {formData.appointmentDate && (
                    <span className="text-[11px] text-blue-700 block mt-1 font-semibold">
                      ตรงกับ: {formatThaiDate(formData.appointmentDate, { short: false })}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                สรุปผลคำพิพากษา / ผลการติดตาม
              </label>
              <textarea
                rows={2}
                placeholder="เช่น ศาลพิพากษายกฟ้อง, ลงโทษจำคุก 2 ปี ปรับ 20,000 บาท, เลื่อนไปอ่านวันที่..."
                value={formData.judgmentSummary}
                onChange={(e) => setFormData({ ...formData, judgmentSummary: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>บันทึกข้อมูลประจำวัน</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List for the selected date */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-800 text-sm font-['Prompt']">
            รายการตามคำพิพากษา ประจำวันที่ {formatThaiDate(selectedDate, { short: false })}
          </h4>
          <span className="text-xs text-slate-500">
            พบ {itemsForSelectedDate.length} รายการ
          </span>
        </div>

        {itemsForSelectedDate.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
            <CalendarCheck className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium">ไม่มีรายการต้องตามคำพิพากษาในวันที่นี้</p>
            <button
              onClick={() => {
                setFormData((prev) => ({ ...prev, followUpDate: selectedDate }));
                setShowAddForm(true);
              }}
              className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มรายการของวันนี้</span>
            </button>
          </div>
        ) : (
          itemsForSelectedDate.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-3.5"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {item.hearingTime && (
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.hearingTime}
                    </span>
                  )}
                  <span className="font-bold text-slate-900 font-['Prompt'] text-sm">
                    {item.caseNumber}
                  </span>
                  <span className="text-xs text-slate-600">
                    📍 {item.court}
                  </span>

                  {/* Status Badge */}
                  {item.status === 'delivered' ? (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      ศาลอ่านคำพิพากษาแล้ว
                    </span>
                  ) : item.status === 'postponed' ? (
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      เลื่อนนัด
                    </span>
                  ) : item.status === 'completed' ? (
                    <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      เสร็จสิ้น
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      รอฟังคำพิพากษา
                    </span>
                  )}

                  {/* Court Appointment Badge */}
                  {item.appointmentType && item.appointmentType !== 'none' && (
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getAppointmentBadgeStyle(item.appointmentType).bg} ${getAppointmentBadgeStyle(item.appointmentType).text} ${getAppointmentBadgeStyle(item.appointmentType).border}`}
                    >
                      {getAppointmentBadgeStyle(item.appointmentType).icon} {getAppointmentLabel(item.appointmentType, item.appointmentTypeName)}
                      {item.appointmentDate && ` (${formatThaiDate(item.appointmentDate)})`}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-0.5">
                  {item.plaintiff && <div><span className="text-slate-500">โจทก์:</span> {item.plaintiff}</div>}
                  {item.defendant && <div><span className="text-slate-500">จำเลย:</span> {item.defendant}</div>}
                  <div><span className="text-slate-500">ผู้รับผิดชอบ:</span> {item.responsiblePerson}</div>
                </div>

                {item.judgmentSummary && (
                  <div className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <span className="font-semibold text-slate-900">สรุปคำพิพากษา:</span> {item.judgmentSummary}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 md:border-l md:border-slate-200 md:pl-4 flex-shrink-0">
                {/* Transfer to 1-month appeal tracker */}
                {!item.transferredToAppealTracker ? (
                  <button
                    onClick={() => onTransferToAppealTracker(item)}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition shadow-xs"
                    title="ศาลพิพากษาแล้ว นำเข้าสู่ระบบคุมระยะเวลาอุทธรณ์ 1 เดือนทันที"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>ส่งไปคุมอุทธรณ์ 1 เดือน</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    ส่งไปคุมอุทธรณ์แล้ว
                  </span>
                )}

                {/* Quick status toggle */}
                {item.status !== 'delivered' && (
                  <button
                    onClick={() => onUpdateFollowUp({ ...item, status: 'delivered' })}
                    className="bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs py-1.5 px-2.5 rounded-lg transition"
                    title="ทำเครื่องหมายว่าศาลอ่านคำพิพากษาแล้ว"
                  >
                    อ่านพิพากษาแล้ว
                  </button>
                )}

                <button
                  onClick={() => onDeleteFollowUp(item.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="ลบรายการ"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
