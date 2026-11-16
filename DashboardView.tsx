import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  EmptyState,
  MetricTile,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SurfaceCard,
} from '../design-system/components';
import type { Language, NavTab } from '../lib/i18n';
import { translations } from '../lib/i18n';
import type { AnalyticsPayload, UserProfile } from '../lib/types';

interface DashboardViewProps {
  lang: Language;
  currentUser: UserProfile;
  users: UserProfile[];
  analytics: AnalyticsPayload | null;
  onNavigate: (tab: NavTab) => void;
  onApproveUser: (userId: string, status: 'approved' | 'rejected') => Promise<void>;
  onSubmitApplication: () => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  lang,
  currentUser,
  users,
  analytics,
  onNavigate,
  onApproveUser,
  onSubmitApplication,
}) => {
  const isAr = lang === 'ar';
  const t = translations[lang].dashboard;
  const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'supervisor';
  const pendingUsers = users.filter((u) => u.status === 'pending');

  const onboarding = currentUser.onboarding || {
    profileCompleted: true,
    cvCompleted: false,
    humanVerified: Boolean(currentUser.humanVerified),
    assessmentCompleted: false,
    applicationSubmitted: false,
  };

  const stepsDone = [
    onboarding.profileCompleted,
    onboarding.cvCompleted,
    onboarding.humanVerified,
    onboarding.assessmentCompleted,
    onboarding.applicationSubmitted,
  ];
  const completedCount = stepsDone.filter(Boolean).length;

  const stepRoutes: NavTab[] = ['profile', 'cv-builder', 'assessments', 'assessments', 'dashboard'];

  return (
    <div className="space-y-8">
      <SectionHeader
        title={`${t.welcome}${isPrivileged ? '' : ` · ${currentUser.fullName}`}`}
        subtitle={t.subtitle}
        action={
          <div className="flex items-center gap-2.5">
            <SecondaryButton size="sm" onClick={() => onNavigate('design-system')}>
              <span>{isAr ? 'نظام التصميم' : 'Design System'}</span>
            </SecondaryButton>
            <PrimaryButton
              size="sm"
              onClick={() => onNavigate(isPrivileged ? 'analytics' : 'cv-builder')}
            >
              <span>{isPrivileged ? (isAr ? 'التقارير والتصدير' : 'Reports & Export') : isAr ? 'منشئ السيرة الذاتية' : 'Open CV Builder'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </PrimaryButton>
          </div>
        }
      />

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricTile
          label={t.totalMembers}
          value={analytics?.memberStats.total ?? users.length}
          context={`${analytics?.memberStats.humanVerified ?? 0} ${isAr ? 'تم التحقق البشري' : 'human-verified'}`}
          tone="accent"
        />
        <MetricTile
          label={t.activeMembers}
          value={analytics?.memberStats.approved ?? users.filter((u) => u.status === 'approved').length}
          context={`${analytics?.taskStats.done ?? 0}/${analytics?.taskStats.total ?? 0} ${isAr ? 'مهام منجزة' : 'tasks completed'}`}
          tone="success"
        />
        <MetricTile
          label={t.pendingApps}
          value={pendingUsers.length}
          context={`${analytics?.assessmentStats.pendingReviews ?? 0} ${isAr ? 'اختبارات بانتظار التقييم' : 'tests awaiting grading'}`}
          tone={pendingUsers.length > 0 ? 'warning' : 'default'}
        />
        <MetricTile
          label={t.securityAlerts}
          value={analytics?.securityStats.unusualAlerts ?? 0}
          context={`${analytics?.securityStats.activeSessions ?? 0} ${isAr ? 'جلسة نشطة حالياً' : 'active sessions'}`}
          tone={(analytics?.securityStats.unusualAlerts ?? 0) > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Onboarding Pipeline for Members & Candidates */}
      <SurfaceCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-blue-500/15">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {t.onboardingTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {completedCount}/5 {isAr ? 'مراحل مكتملة' : 'steps completed'} ·{' '}
              {isAr ? `حالة الحساب: ${currentUser.status}` : `Account status: ${currentUser.status}`}
            </p>
          </div>
          {!onboarding.applicationSubmitted ? (
            <PrimaryButton
              size="sm"
              disabled={completedCount < 4}
              onClick={onSubmitApplication}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{t.submitApplication}</span>
            </PrimaryButton>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>{t.applicationSubmitted}</span>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {t.onboardingSteps.map((label, idx) => {
            const done = stepsDone[idx];
            return (
              <button
                key={label}
                type="button"
                onClick={() => onNavigate(stepRoutes[idx])}
                className={`text-start p-3.5 rounded-lg border transition-colors cursor-pointer ${
                  done
                    ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-900 dark:text-white'
                    : 'bg-slate-50 dark:bg-[#0e1934] border-slate-200 dark:border-blue-500/20 text-slate-700 dark:text-slate-300 hover:border-[#1D7AFC]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                    0{idx + 1}
                  </span>
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </div>
                <div className="mt-2 text-xs font-semibold leading-snug">{label}</div>
              </button>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Main Split: Pending Applications (Privileged) / Quick Workspace Actions + Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <SurfaceCard className="lg:col-span-7 p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-blue-500/15">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {isPrivileged
                ? t.pendingQueue
                : isAr
                ? 'تقدم المشاريع والمهام'
                : 'Active Project Progress'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate(isPrivileged ? 'security' : 'tasks')}
              className="text-xs font-medium text-[#1D7AFC] dark:text-[#00D4FF] hover:underline cursor-pointer"
            >
              {isAr ? 'عرض الكل' : 'View all'}
            </button>
          </div>

          {isPrivileged ? (
            pendingUsers.length === 0 ? (
              <EmptyState
                title={isAr ? 'لا توجد طلبات معلقة' : 'All Applications Reviewed'}
                description={
                  isAr
                    ? 'تمت مراجعة جميع طلبات الانضمام الجديدة في الوقت الحالي.'
                    : 'Every registered team candidate has been reviewed.'
                }
              />
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-blue-500/15">
                {pendingUsers.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {candidate.fullName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {candidate.desiredRole} · {candidate.email} ·{' '}
                        {candidate.humanVerified
                          ? isAr
                            ? 'تم التحقق البشري'
                            : 'Human Verified'
                          : isAr
                          ? 'بانتظار التحقق'
                          : 'Unverified'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PrimaryButton
                        size="sm"
                        onClick={() => onApproveUser(candidate.id, 'approved')}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{translations[lang].actions.approve}</span>
                      </PrimaryButton>
                      <SecondaryButton
                        size="sm"
                        onClick={() => onApproveUser(candidate.id, 'rejected')}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{translations[lang].actions.reject}</span>
                      </SecondaryButton>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-blue-500/15">
              {(analytics?.projectProgress || []).map((proj) => (
                <div key={proj.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-900 dark:text-white">{proj.name}</span>
                    <span className="font-mono-tabular text-xs text-[#1D7AFC] dark:text-[#00D4FF]">
                      {proj.progress}% · {proj.taskCount} {isAr ? 'مهام' : 'tasks'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-[#0e1934] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#1D7AFC] to-[#00D4FF]"
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-4 flex flex-wrap gap-3">
                <SecondaryButton size="sm" onClick={() => onNavigate('cv-builder')}>
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تحليل السيرة الذاتية' : 'Analyze My CV'}</span>
                </SecondaryButton>
                <SecondaryButton size="sm" onClick={() => onNavigate('assessments')}>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{isAr ? 'بدء الاختبار' : 'Take Assessment'}</span>
                </SecondaryButton>
              </div>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard className="lg:col-span-5 p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-blue-500/15">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {t.recentActivity}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-xs font-medium text-[#1D7AFC] dark:text-[#00D4FF] hover:underline cursor-pointer"
            >
              {isAr ? 'السجل الكامل' : 'Full log'}
            </button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-blue-500/15 max-h-96 overflow-y-auto">
            {(analytics?.auditLogs || []).slice(0, 7).map((log) => (
              <div key={log.id} className="py-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white truncate">
                    {log.actorName}
                  </span>
                  <span className="font-mono-tabular text-slate-500 dark:text-slate-400 shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {log.details}
                </p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
