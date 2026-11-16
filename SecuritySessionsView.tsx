import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Laptop,
  LogOut,
  Monitor,
  ShieldAlert,
  Smartphone,
  Tablet,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  MetricTile,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SurfaceCard,
} from '../design-system/components';
import { apiRequest } from '../lib/api';
import type { Language } from '../lib/i18n';
import type {
  AccountStatus,
  SessionRecord,
  SupervisorPermissions,
  UserProfile,
  UserRole,
} from '../lib/types';

interface SecuritySessionsViewProps {
  lang: Language;
  currentUser: UserProfile;
  users: UserProfile[];
  onRefreshUsers: () => Promise<void>;
}

const DEFAULT_SUPERVISOR_PERMS: SupervisorPermissions = {
  canApproveMembers: true,
  canManageAssessments: true,
  canViewSessions: true,
  canRevokeSessions: true,
  canManageTasksAndGroups: true,
  canViewAnalytics: true,
  canManageIntegrations: false,
};

const PERMISSION_LABELS: Array<{
  key: keyof SupervisorPermissions;
  en: string;
  ar: string;
}> = [
  { key: 'canApproveMembers', en: 'Approve / Suspend Members', ar: 'قبول وتعليق حسابات الأعضاء' },
  { key: 'canManageAssessments', en: 'Create & Grade Assessments', ar: 'إنشاء وتصحيح الاختبارات' },
  { key: 'canViewSessions', en: 'View Team Devices & Sessions', ar: 'رؤية الأجهزة والجلسات المسجلة' },
  { key: 'canRevokeSessions', en: 'Force Logout Team Devices', ar: 'إخراج الأجهزة وإنهاء الجلسات عن بُعد' },
  { key: 'canManageTasksAndGroups', en: 'Manage Projects & Groups', ar: 'إدارة المشاريع ومجموعات المحادثة' },
  { key: 'canViewAnalytics', en: 'View Analytics & Audit Logs', ar: 'عرض التقارير وسجلات التدقيق' },
  { key: 'canManageIntegrations', en: 'Configure Google & Zoom', ar: 'إعداد تكامل Google و Zoom' },
];

export const SecuritySessionsView: React.FC<SecuritySessionsViewProps> = ({
  lang,
  currentUser,
  users,
  onRefreshUsers,
}) => {
  const isAr = lang === 'ar';
  const isAdmin = currentUser.role === 'admin';
  const canViewAllSessions =
    isAdmin ||
    (currentUser.role === 'supervisor' &&
      (currentUser.supervisorPermissions?.canViewSessions ?? true));
  const canRevokeOthers =
    isAdmin ||
    (currentUser.role === 'supervisor' &&
      (currentUser.supervisorPermissions?.canRevokeSessions ?? true));
  const canApproveMembers =
    isAdmin ||
    (currentUser.role === 'supervisor' &&
      (currentUser.supervisorPermissions?.canApproveMembers ?? true));

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'unusual'>('all');
  const [accountQuery, setAccountQuery] = useState('');
  const [editingSupervisorId, setEditingSupervisorId] = useState<string | null>(null);
  const [permDraft, setPermDraft] = useState<SupervisorPermissions>(DEFAULT_SUPERVISOR_PERMS);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      const res = await apiRequest<{ sessions: SessionRecord[] }>('/api/sessions');
      setSessions(res.sessions);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = async (sessionId: string) => {
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      setNotice(isAr ? 'تم إنهاء الجلسة وإخراج الجهاز فوراً.' : 'Session revoked and device logged out immediately.');
      loadSessions();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRevokeAllForUser = async (userId: string, fullName: string) => {
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ revokedCount: number }>(`/api/sessions/revoke-user/${userId}`, {
        method: 'POST',
      });
      setNotice(
        isAr
          ? `تم إخراج ${res.revokedCount} أجهزة نشطة لحساب ${fullName}.`
          : `Force-logged out ${res.revokedCount} active device(s) for ${fullName}.`
      );
      loadSessions();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setError(null);
    try {
      await apiRequest(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await onRefreshUsers();
      setNotice(isAr ? 'تم تحديث الدور بنجاح.' : 'Account role updated on server.');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleStatusChange = async (userId: string, status: AccountStatus) => {
    setError(null);
    try {
      await apiRequest(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await onRefreshUsers();
      await loadSessions();
      setNotice(isAr ? `تم تحديث حالة الحساب إلى ${status}.` : `Account status updated to ${status}.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteUser = async (userId: string, fullName: string) => {
    setError(null);
    try {
      await apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
      await onRefreshUsers();
      await loadSessions();
      setNotice(isAr ? `تم حذف الحساب (${fullName}).` : `Removed account ${fullName}.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const openPermissionEditor = (user: UserProfile) => {
    setEditingSupervisorId(user.id);
    setPermDraft(user.supervisorPermissions || { ...DEFAULT_SUPERVISOR_PERMS });
  };

  const handleSavePermissions = async () => {
    if (!editingSupervisorId) return;
    setError(null);
    try {
      await apiRequest(`/api/admin/users/${editingSupervisorId}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: permDraft }),
      });
      setEditingSupervisorId(null);
      await onRefreshUsers();
      setNotice(isAr ? 'تم حفظ صلاحيات المشرف المخصصة على الخادم.' : 'Granular supervisor permissions saved.');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const visibleSessions = sessions.filter((s) => {
    if (filter === 'active') return s.status === 'active';
    if (filter === 'unusual') return s.isUnusual;
    return true;
  });

  const activeDevicesCount = sessions.filter((s) => s.status === 'active').length;
  const unusualAlertsCount = sessions.filter((s) => s.isUnusual && s.status === 'active').length;
  const supervisorsCount = users.filter((u) => u.role === 'supervisor' || u.role === 'admin').length;

  const filteredUsers = users.filter(
    (u) =>
      !accountQuery ||
      u.fullName.toLowerCase().includes(accountQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(accountQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(accountQuery.toLowerCase())
  );

  const DeviceIcon = (type: SessionRecord['deviceType']) => {
    if (type === 'Mobile') return <Smartphone className="w-4 h-4 text-[#00D4FF]" />;
    if (type === 'Tablet') return <Tablet className="w-4 h-4 text-[#00D4FF]" />;
    return <Laptop className="w-4 h-4 text-[#1D7AFC] dark:text-[#00D4FF]" />;
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={isAr ? 'مركز الأجهزة والحسابات وصلاحيات المشرفين' : 'Devices, Accounts & Supervisor Control'}
        subtitle={
          canViewAllSessions
            ? isAr
              ? 'مراقبة كل الأجهزة الشغالة والتي دخلت سابقاً، التحكم الكامل بالحسابات، وتعيين مشرفين بصلاحيات محددة.'
              : 'Monitor active & historical devices, control all accounts, promote supervisors, and assign granular server-enforced permissions.'
            : isAr
            ? 'سجل جلساتك والأجهزة المتصلة بحسابك بشفافية تامة.'
            : 'Transparent log of your active sessions and previously used devices.'
        }
      />

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-700 dark:text-cyan-300">
          {notice}
        </div>
      )}

      {/* Telemetry Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          label={isAr ? 'الأجهزة الشغالة الآن' : 'Active Devices Now'}
          value={activeDevicesCount}
          context={isAr ? 'جلسات متصلة حالياً' : 'Live authenticated sessions'}
          tone="accent"
        />
        <MetricTile
          label={isAr ? 'كل الأجهزة المسجلة' : 'Total Device Logins'}
          value={sessions.length}
          context={isAr ? 'الحالية والسابقة' : 'Active + historical history'}
        />
        <MetricTile
          label={isAr ? 'تنبيهات دخول غير معتاد' : 'Unusual Login Alerts'}
          value={unusualAlertsCount}
          context={isAr ? 'أجهزة أو متصفحات جديدة' : 'Unrecognized device/OS'}
          tone={unusualAlertsCount > 0 ? 'danger' : 'default'}
        />
        <MetricTile
          label={isAr ? 'المشرفون والمديرون' : 'Admins & Supervisors'}
          value={supervisorsCount}
          context={`${users.length} ${isAr ? 'إجمالي الحسابات' : 'total accounts'}`}
          tone="success"
        />
      </div>

      {/* Segmented filter for Devices / Sessions */}
      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#091124] border border-slate-300 dark:border-blue-500/20">
        {(['all', 'active', 'unusual'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              filter === tab
                ? 'bg-white dark:bg-[#0e1934] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {tab === 'all'
              ? isAr
                ? 'كل الأجهزة والجلسات'
                : 'All Devices & History'
              : tab === 'active'
              ? isAr
                ? 'الشغالة الآن فقط'
                : 'Active Now Only'
              : isAr
              ? 'تنبيهات غريبة'
              : 'Unusual Alerts'}
          </button>
        ))}
      </div>

      {/* Sessions & Devices Table */}
      <SurfaceCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 dark:bg-[#0e1934] border-b border-slate-200 dark:border-blue-500/15 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4 text-start font-medium">{isAr ? 'الحساب' : 'Account'}</th>
                <th className="py-3 px-4 text-start font-medium">{isAr ? 'الجهاز والنظام' : 'Device & OS'}</th>
                <th className="py-3 px-4 text-start font-medium">{isAr ? 'المتصفح و IP' : 'Browser & IP'}</th>
                <th className="py-3 px-4 text-start font-medium">{isAr ? 'أوقات الدخول والنشاط' : 'Timestamps'}</th>
                <th className="py-3 px-4 text-start font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="py-3 px-4 text-end font-medium">{isAr ? 'التحكم' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-blue-500/15">
              {visibleSessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-[#0e1934]/60">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {s.userName} {s.isCurrent && (isAr ? '(جلسة حالية)' : '(Current)')}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {s.userEmail} · {s.userRole}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      {DeviceIcon(s.deviceType)}
                      <span>
                        {s.deviceType} · {s.os}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 dark:text-slate-200">{s.browser}</div>
                    <div className="font-mono-tabular text-slate-500 dark:text-slate-400">{s.ipAddress}</div>
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-slate-600 dark:text-slate-300">
                    <div>In: {new Date(s.loginAt).toLocaleString()}</div>
                    <div>
                      {s.logoutAt
                        ? `Out: ${new Date(s.logoutAt).toLocaleString()}`
                        : `Active: ${new Date(s.lastActivityAt).toLocaleTimeString()}`}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div
                      className={`font-semibold ${
                        s.status === 'active'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : s.status === 'revoked'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {s.status.toUpperCase()}
                    </div>
                    {s.isUnusual && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{s.alertReason || 'Unusual device'}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-end">
                    {s.status === 'active' && !s.isCurrent && (canRevokeOthers || s.userId === currentUser.id) && (
                      <SecondaryButton size="sm" onClick={() => handleRevoke(s.id)}>
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        <span>{isAr ? 'إنهاء الجلسة' : 'Force Logout'}</span>
                      </SecondaryButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* Full Accounts Control & Supervisor Granular Permissions */}
      {(isAdmin || canApproveMembers) && (
        <SurfaceCard className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-blue-500/15">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[#1D7AFC] dark:text-[#00D4FF]" />
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  {isAr
                    ? 'إدارة الحسابات وتعيين المشرفين وصلاحياتهم'
                    : 'Accounts Control, Role Assignment & Supervisor Permissions'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAdmin
                    ? isAr
                      ? 'بصفتك المدير العام (Admin)، يمكنك تعيين أي عضو كمشرف وتحديد صلاحياته بدقة أو تعليق أي حساب.'
                      : 'As Master Administrator, promote members to Supervisor or Admin, customize exact Supervisor permissions, or revoke all devices.'
                    : isAr
                    ? 'إدارة حالة الحسابات المصرح لك بمراجعتها.'
                    : 'Manage member account statuses within your granted permissions.'}
                </p>
              </div>
            </div>
            <input
              value={accountQuery}
              onChange={(e) => setAccountQuery(e.target.value)}
              placeholder={isAr ? 'ابحث بالاسم أو البريد...' : 'Search accounts...'}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
            />
          </div>

          <div className="divide-y divide-slate-200 dark:divide-blue-500/15">
            {filteredUsers.map((u) => {
              const userActiveSessions = sessions.filter(
                (s) => s.userId === u.id && s.status === 'active'
              ).length;
              return (
                <div key={u.id} className="py-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{u.fullName}</span>
                        {u.id === currentUser.id && (
                          <span className="text-[11px] font-medium text-[#1D7AFC] dark:text-[#00D4FF]">
                            ({isAr ? 'أنت' : 'You'})
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                        {u.email} · {u.desiredRole} ·{' '}
                        <span
                          className={
                            u.status === 'approved'
                              ? 'text-emerald-500 font-semibold'
                              : u.status === 'pending'
                              ? 'text-amber-500 font-semibold'
                              : 'text-rose-500 font-semibold'
                          }
                        >
                          {u.status}
                        </span>{' '}
                        · <span className="font-mono-tabular">{userActiveSessions} active device(s)</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isAdmin && (
                        <select
                          value={u.role}
                          disabled={u.id === currentUser.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
                        >
                          <option value="member">{isAr ? 'عضو (Member)' : 'Member'}</option>
                          <option value="supervisor">{isAr ? 'مشرف (Supervisor)' : 'Supervisor'}</option>
                          <option value="admin">{isAr ? 'مدير عام (Admin)' : 'Administrator'}</option>
                        </select>
                      )}

                      {isAdmin && u.role === 'supervisor' && (
                        <SecondaryButton size="sm" onClick={() => openPermissionEditor(u)}>
                          <ShieldAlert className="w-3.5 h-3.5 text-[#00D4FF]" />
                          <span>{isAr ? 'تحديد الصلاحيات' : 'Permissions'}</span>
                        </SecondaryButton>
                      )}

                      {canApproveMembers && u.id !== currentUser.id && (
                        <>
                          {u.status !== 'approved' && (
                            <SecondaryButton size="sm" onClick={() => handleStatusChange(u.id, 'approved')}>
                              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{isAr ? 'تفعيل' : 'Approve'}</span>
                            </SecondaryButton>
                          )}
                          {u.status !== 'suspended' && (
                            <SecondaryButton size="sm" onClick={() => handleStatusChange(u.id, 'suspended')}>
                              <UserX className="w-3.5 h-3.5 text-amber-500" />
                              <span>{isAr ? 'تعليق' : 'Suspend'}</span>
                            </SecondaryButton>
                          )}
                        </>
                      )}

                      {canRevokeOthers && userActiveSessions > 0 && u.id !== currentUser.id && (
                        <SecondaryButton
                          size="sm"
                          onClick={() => handleRevokeAllForUser(u.id, u.fullName)}
                        >
                          <LogOut className="w-3.5 h-3.5 text-rose-500" />
                          <span>{isAr ? 'إخراج كل الأجهزة' : 'Revoke All Devices'}</span>
                        </SecondaryButton>
                      )}

                      {isAdmin && u.id !== currentUser.id && (
                        <SecondaryButton size="sm" onClick={() => handleDeleteUser(u.id, u.fullName)}>
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </SecondaryButton>
                      )}
                    </div>
                  </div>

                  {/* Granular Supervisor Permissions Drawer */}
                  {isAdmin && editingSupervisorId === u.id && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0e1934] border border-blue-500/30 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {isAr
                            ? `صلاحيات المشرف المخصصة لـ: ${u.fullName}`
                            : `Custom Supervisor Permissions for ${u.fullName}`}
                        </div>
                        <div className="flex gap-2">
                          <SecondaryButton
                            size="sm"
                            type="button"
                            onClick={() => setEditingSupervisorId(null)}
                          >
                            {isAr ? 'إلغاء' : 'Cancel'}
                          </SecondaryButton>
                          <PrimaryButton size="sm" type="button" onClick={handleSavePermissions}>
                            {isAr ? 'حفظ الصلاحيات' : 'Save Permissions'}
                          </PrimaryButton>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {PERMISSION_LABELS.map((item) => (
                          <label
                            key={item.key}
                            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20 text-xs cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={permDraft[item.key]}
                              onChange={(e) =>
                                setPermDraft({ ...permDraft, [item.key]: e.target.checked })
                              }
                              className="accent-[#1D7AFC]"
                            />
                            <span className="text-slate-800 dark:text-slate-200">
                              {isAr ? item.ar : item.en}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
};
