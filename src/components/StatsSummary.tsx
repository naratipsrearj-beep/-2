import React from 'react';
import { ShieldAlert, Clock, CheckCircle2, FileText, Calendar, Scale } from 'lucide-react';
import { AppealCase, DailyJudgmentFollowUp } from '../types/appeal';
import { getAppealUrgency, getTodayString } from '../utils/dateUtils';

interface StatsSummaryProps {
  cases: AppealCase[];
  followUps?: DailyJudgmentFollowUp[];
  onSelectFilter?: (filterType: string) => void;
  activeFilter?: string;
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({
  cases,
  followUps = [],
  onSelectFilter,
  activeFilter,
}) => {
  const totalCases = cases.length;
  const urgentCount = cases.filter((c) => {
    if (c.isCompleted) return false;
    const u = getAppealUrgency(c);
    return u === 'overdue' || u === 'critical' || u === 'warning';
  }).length;

  const normalCount = cases.filter((c) => {
    if (c.isCompleted) return false;
    return getAppealUrgency(c) === 'normal';
  }).length;

  const completedCount = cases.filter((c) => c.isCompleted).length;

  const todayStr = getTodayString();
  const todayFiledCount = cases.filter((c) => c.filingDate === todayStr).length;

  const cards = [
    {
      id: 'all',
      title: 'สำนวนคุมอุทธรณ์ทั้งหมด',
      count: totalCases,
      unit: 'สำนวน',
      icon: Scale,
      bgColor: 'bg-white',
      borderColor: activeFilter === 'all' ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200',
      iconColor: 'text-indigo-600 bg-indigo-50',
      badgeColor: 'text-indigo-700 bg-indigo-50',
      desc: 'สำนวนทั้งหมดในระบบ',
    },
    {
      id: 'urgent',
      title: 'ใกล้ครบกำหนดเตือนด่วน (≤ 7 วัน)',
      count: urgentCount,
      unit: 'สำนวน',
      icon: ShieldAlert,
      bgColor: 'bg-white',
      borderColor: activeFilter === 'urgent' ? 'border-rose-600 ring-2 ring-rose-500/20' : urgentCount > 0 ? 'border-rose-300' : 'border-slate-200',
      iconColor: 'text-rose-600 bg-rose-50',
      badgeColor: urgentCount > 0 ? 'text-rose-700 bg-rose-100 font-bold' : 'text-slate-500 bg-slate-100',
      desc: urgentCount > 0 ? 'ต้องรีบดำเนินการก่อนขาดอายุความ' : 'ไม่มีสำนวนวิกฤต',
    },
    {
      id: 'active',
      title: 'อยู่ระหว่างคุมอุทธรณ์ (> 7 วัน)',
      count: normalCount,
      unit: 'สำนวน',
      icon: Clock,
      bgColor: 'bg-white',
      borderColor: activeFilter === 'active' ? 'border-amber-600 ring-2 ring-amber-500/20' : 'border-slate-200',
      iconColor: 'text-amber-600 bg-amber-50',
      badgeColor: 'text-amber-700 bg-amber-50',
      desc: 'นับเวลา 1 เดือนนับแต่พิพากษา',
    },
    {
      id: 'completed',
      title: 'เสร็จสิ้นแล้ว (ไม่แจ้งเตือน)',
      count: completedCount,
      unit: 'สำนวน',
      icon: CheckCircle2,
      bgColor: 'bg-white',
      borderColor: activeFilter === 'completed' ? 'border-emerald-600 ring-2 ring-emerald-500/20' : 'border-slate-200',
      iconColor: 'text-emerald-600 bg-emerald-50',
      badgeColor: 'text-emerald-700 bg-emerald-50',
      desc: 'ยื่นอุทธรณ์/ยุติ/ถึงที่สุด',
    },
    {
      id: 'today_filing',
      title: 'คดีที่ยื่นฟ้องวันนี้',
      count: todayFiledCount,
      unit: 'สำนวน',
      icon: Calendar,
      bgColor: 'bg-white',
      borderColor: activeFilter === 'today_filing' ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200',
      iconColor: 'text-indigo-600 bg-indigo-50',
      badgeColor: 'text-indigo-700 bg-indigo-50',
      desc: 'สำนวนที่ยื่นฟ้องในวันนี้',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            onClick={() => onSelectFilter && onSelectFilter(card.id)}
            className={`${card.bgColor} ${card.borderColor} border rounded-xl p-3.5 sm:p-4 text-left shadow-xs transition hover:shadow-md cursor-pointer flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 line-clamp-1">{card.title}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconColor} flex-shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-['Prompt'] text-slate-900">
                  {card.count}
                </span>
                <span className="text-xs text-slate-500">{card.unit}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">{card.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
