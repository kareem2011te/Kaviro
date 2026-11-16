import React, { useState } from 'react';
import { Download, FileSpreadsheet, Package } from 'lucide-react';
import {
  MetricTile,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SurfaceCard,
} from '../design-system/components';
import { getAuthToken } from '../lib/api';
import type { Language } from '../lib/i18n';
import type { AnalyticsPayload } from '../lib/types';

interface AnalyticsViewProps {
  lang: Language;
  analytics: AnalyticsPayload | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ lang, analytics }) => {
  const isAr = lang === 'ar';
  const [actionFilter, setActionFilter] = useState('');

  const handleExportCsv = async () => {
    const res = await fetch('/api/analytics/export.csv', {
      headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
    });
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kaviro-analytics-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!analytics) {
    return <SurfaceCard className="p-8 text-sm text-slate-400">Loading analytics...</SurfaceCard>;
  }

  const taskDistribution = [
    { label: 'Backlog', count: analytics.taskStats.backlog, color: '#64748B' },
    { label: 'In Progress', count: analytics.taskStats.inProgress, color: '#1D7AFC' },
    { label: 'In Review', count: analytics.taskStats.inReview, color: '#00D4FF' },
    { label: 'Done', count: analytics.taskStats.done, color: '#10B981' },
  ];
  const maxTaskCount = Math.max(1, ...taskDistribution.map((d) => d.count));

  const filteredLogs = analytics.auditLogs.filter((l) =>
    !actionFilter
      ? true
      : l.action.toLowerCase().includes(actionFilter.toLowerCase()) ||
        l.actorName.toLowerCase().includes(actionFilter.toLowerCase()) ||
        l.details.toLowerCase().includes(actionFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title={isAr ? 'التقارير والتحليلات وتنزيل الموقع' : 'Reports, Analytics & Downloadable Package'}
        subtitle={
          isAr
            ? 'إحصائيات الأعضاء والمهام والاختبارات، سجل التدقيق، وتصدير التقارير أو تنزيل كود الموقع الكامل.'
            : 'Interactive team metrics, project completion bars, audit trails, CSV exports, and full downloadable KAVIRO web archive.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton size="sm" onClick={handleExportCsv}>
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
            </SecondaryButton>
            <a href="/api/export/project-zip" download="kaviro-platform-web.zip">
              <PrimaryButton size="sm" type="button">
                <Package className="w-3.5 h-3.5" />
                <span>{isAr ? 'تنزيل الموقع (.zip)' : 'Download Full Website (.zip)'}</span>
              </PrimaryButton>
            </a>
          </div>
        }
      />

      {/* Downloadable Website Callout */}
      <SurfaceCard elevated className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            {isAr ? 'ملف الموقع القابل للتنزيل والتشغيل المستقل' : 'Downloadable Full-Stack Website Package'}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {isAr
              ? 'قم بتنزيل الحزمة الكاملة لمنصة KAVIRO (الواجهة الأمامية، الخادم، WebSockets، ونظام التصميم) في ملف ZIP واحد جاهز للتشغيل.'
              : 'Bundle the complete KAVIRO web platform (React, Design System, Express, WebSockets, Gemini AI backend, and logo assets) into a single ZIP file.'}
          </p>
        </div>
        <a href="/api/export/project-zip" download="kaviro-platform-web.zip" className="shrink-0">
          <PrimaryButton size="sm" type="button">
            <Download className="w-3.5 h-3.5" />
            <span>kaviro-platform-web.zip</span>
          </PrimaryButton>
        </a>
      </SurfaceCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile label={isAr ? 'نسبة النجاح بالاختبارات' : 'Avg Assessment Score'} value={`${analytics.assessmentStats.avgScorePct}%`} context={`${analytics.assessmentStats.totalAttempts} attempts`} tone="accent" />
        <MetricTile label={isAr ? 'الأعضاء المعتمدون' : 'Approved Roster'} value={`${analytics.memberStats.approved}/${analytics.memberStats.total}`} context={`${analytics.memberStats.pending} pending review`} tone="success" />
        <MetricTile label={isAr ? 'المهام المكتملة' : 'Tasks Completed'} value={`${analytics.taskStats.done}/${analytics.taskStats.total}`} context="Across active projects" />
        <MetricTile label={isAr ? 'تنبيهات الأمان' : 'Security Alerts'} value={analytics.securityStats.unusualAlerts} context={`${analytics.securityStats.activeSessions} active sessions`} tone={analytics.securityStats.unusualAlerts > 0 ? 'danger' : 'default'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <SurfaceCard className="lg:col-span-6 p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            {isAr ? 'توزيع حالة المهام' : 'Task Completion Breakdown'}
          </h3>
          <div className="space-y-3 pt-2">
            {taskDistribution.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                    {item.count}
                  </span>
                </div>
                <div className="h-3 rounded-md bg-slate-100 dark:bg-[#0e1934] overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all duration-300"
                    style={{
                      width: `${(item.count / maxTaskCount) * 100}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="lg:col-span-6 p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            {isAr ? 'تقدم المشاريع الحالية' : 'Project Delivery Progress'}
          </h3>
          <div className="space-y-4 pt-2">
            {analytics.projectProgress.map((p) => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
                  <span className="font-mono-tabular text-[#1D7AFC] dark:text-[#00D4FF]">
                    {p.progress}% ({p.taskCount} tasks)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-[#0e1934] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1D7AFC] to-[#00D4FF]"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* Audit Logs */}
      <SurfaceCard className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            {isAr ? 'سجل التدقيق والنشاط الأمني' : 'Platform Audit Logs'}
          </h3>
          <input
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder={isAr ? 'تصفية السجلات...' : 'Filter audit logs...'}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-slate-200 dark:border-blue-500/15 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-3 text-start">Actor</th>
                <th className="py-2.5 px-3 text-start">Action</th>
                <th className="py-2.5 px-3 text-start">Details</th>
                <th className="py-2.5 px-3 text-start">IP</th>
                <th className="py-2.5 px-3 text-end">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-blue-500/15">
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{log.actorName}</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-[#1D7AFC] dark:text-[#00D4FF]">{log.action}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{log.details}</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-slate-500">{log.ipAddress}</td>
                  <td className="py-2.5 px-3 text-end font-mono-tabular text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  );
};
