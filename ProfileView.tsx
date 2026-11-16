import React, { useState } from 'react';
import { KeyRound, Shield, Upload } from 'lucide-react';
import { PrimaryButton, SecondaryButton, SectionHeader, SurfaceCard } from '../design-system/components';
import { apiRequest } from '../lib/api';
import type { Language } from '../lib/i18n';
import type { UserProfile } from '../lib/types';

interface ProfileViewProps {
  lang: Language;
  currentUser: UserProfile;
  onUserUpdated: (u: UserProfile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ lang, currentUser, onUserUpdated }) => {
  const isAr = lang === 'ar';
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [whatsapp, setWhatsapp] = useState(currentUser.whatsapp || '');
  const [desiredRole, setDesiredRole] = useState(currentUser.desiredRole);
  const [department, setDepartment] = useState(currentUser.department);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [skillsText, setSkillsText] = useState((currentUser.skills || []).join(', '));
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          email,
          phone,
          whatsapp,
          desiredRole,
          department,
          bio,
          avatarUrl,
          skills: skillsText.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      onUserUpdated(res.user);
      setNotice(isAr ? 'تم تحديث الملف الشخصي والبريد الإلكتروني بنجاح.' : 'Profile and email updated successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPass(true);
    setNotice(null);
    setError(null);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setNotice(isAr ? 'تم تغيير كلمة المرور بنجاح.' : 'Password changed successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChangingPass(false);
    }
  };

  const handleToggle2FA = async () => {
    const next = !currentUser.twoFactorEnabled;
    const res = await apiRequest<{ user: UserProfile }>('/api/auth/2fa/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled: next }),
    });
    onUserUpdated(res.user);
    setNotice(
      next
        ? isAr
          ? 'تم تفعيل المصادقة الثنائية (2FA).'
          : 'Two-factor authentication enabled.'
        : isAr
        ? 'تم إيقاف المصادقة الثنائية.'
        : 'Two-factor authentication disabled.'
    );
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 1_500_000) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={isAr ? 'الملف الشخصي وأمان الحساب' : 'Profile & Account Security'}
        subtitle={
          isAr
            ? 'تحديث الاسم والبريد الإلكتروني، تغيير كلمة المرور، وتفعيل المصادقة الثنائية (2FA).'
            : 'Update your name, email, password, skills, and two-factor authentication.'
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <SurfaceCard className="lg:col-span-7 p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-blue-500/15">
              <div className="h-16 w-16 rounded-xl bg-[#0e1934] border border-blue-500/30 overflow-hidden flex items-center justify-center text-xl font-bold text-[#00D4FF]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  fullName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                  {isAr ? `الدور الحالي: ${currentUser.role}` : `Role: ${currentUser.role}`}
                </div>
                <label className="px-3.5 py-2 text-xs rounded-lg bg-slate-100 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 inline-flex items-center gap-2 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تغيير الصورة الشخصية' : 'Upload Avatar'}</span>
                  <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isAr ? 'الاسم الكامل' : 'Full Name'}
                className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAr ? 'البريد الإلكتروني' : 'Email Address'}
                className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                value={desiredRole}
                onChange={(e) => setDesiredRole(e.target.value)}
                placeholder={isAr ? 'الدور الوظيفي' : 'Desired Role'}
                className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={isAr ? 'الهاتف' : 'Phone'}
                className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder={isAr ? 'واتساب (اختياري)' : 'WhatsApp (optional)'}
                className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder={isAr ? 'القسم' : 'Department'}
                className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
              />
            </div>

            <input
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder={isAr ? 'المهارات (مفصولة بفاصلة)' : 'Skills (comma-separated)'}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
            />

            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={isAr ? 'نبذة مختصرة...' : 'Short bio...'}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
            />

            <PrimaryButton type="submit" disabled={saving}>
              {saving ? 'Saving...' : isAr ? 'حفظ التغييرات' : 'Save Profile'}
            </PrimaryButton>
          </form>
        </SurfaceCard>

        <div className="lg:col-span-5 space-y-6">
          <SurfaceCard className="p-6 space-y-4">
            <div className="flex items-center gap-2 font-display text-base font-semibold text-slate-900 dark:text-white">
              <KeyRound className="w-4 h-4 text-[#1D7AFC] dark:text-[#00D4FF]" />
              <span>{isAr ? 'تغيير كلمة المرور' : 'Change Password'}</span>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={isAr ? 'كلمة المرور الحالية' : 'Current Password'}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={isAr ? 'كلمة المرور الجديدة (8+ أحرف)' : 'New Password (8+ chars)'}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
              />
              <SecondaryButton size="sm" type="submit" disabled={changingPass}>
                {changingPass ? 'Updating...' : isAr ? 'تحديث كلمة المرور' : 'Update Password'}
              </SecondaryButton>
            </form>
          </SurfaceCard>

          <SurfaceCard className="p-6 space-y-4">
            <div className="flex items-center gap-2 font-display text-base font-semibold text-slate-900 dark:text-white">
              <Shield className="w-4 h-4 text-[#1D7AFC] dark:text-[#00D4FF]" />
              <span>{isAr ? 'المصادقة الثنائية (2FA)' : 'Two-Factor Authentication'}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {isAr
                ? 'إضافة طبقة تحقق إضافية عبر رمز من 6 أرقام عند كل تسجيل دخول.'
                : 'Require a 6-digit verification challenge on every sign-in attempt.'}
            </p>
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              Status:{' '}
              <span className={currentUser.twoFactorEnabled ? 'text-emerald-500' : 'text-amber-500'}>
                {currentUser.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <SecondaryButton size="sm" onClick={handleToggle2FA}>
              {currentUser.twoFactorEnabled
                ? isAr
                  ? 'إيقاف 2FA'
                  : 'Disable 2FA'
                : isAr
                ? 'تفعيل 2FA'
                : 'Enable 2FA'}
            </SecondaryButton>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
};
