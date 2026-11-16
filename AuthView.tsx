import React, { useState } from 'react';
import { Download, Globe, Lock, Mail, Moon, Phone, ShieldCheck, Sun, Upload, User } from 'lucide-react';
import { KAVIRO_LOGO_SRC, PrimaryButton, SecondaryButton, SurfaceCard } from '../design-system/components';
import { apiRequest, downloadProjectZip, setAuthToken } from '../lib/api';
import type { Language } from '../lib/i18n';
import type { UserProfile } from '../lib/types';

interface AuthViewProps {
  lang: Language;
  theme: 'dark' | 'light';
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onAuthenticated: (user: UserProfile, token: string) => void;
}

type AuthMode = 'login' | 'register' | 'verify-email' | 'verify-2fa' | 'forgot' | 'reset';

export const AuthView: React.FC<AuthViewProps> = ({
  lang,
  theme,
  onToggleLang,
  onToggleTheme,
  onAuthenticated,
}) => {
  const isAr = lang === 'ar';
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Login & Recovery state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Registration state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [desiredRole, setDesiredRole] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [skillsText, setSkillsText] = useState('');
  const [interestsText, setInterestsText] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setError(isAr ? 'حجم الصورة يجب أن يكون أقل من 1.5 ميجابايت.' : 'Profile photo must be under 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleLogin = async (loginEmail = email, loginPass = password) => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });
      if (res.requiresTwoFactor) {
        setEmail(res.email);
        setInfo(
          `${isAr ? 'رمز التحقق الثنائي 2FA:' : 'Two-factor verification code:'} ${res.twoFactorCodePreview}`
        );
        setMode('verify-2fa');
        return;
      }
      setAuthToken(res.token);
      onAuthenticated(res.user, res.token);
    } catch (err: any) {
      if (err.payload?.requiresEmailVerification) {
        setEmail(err.payload.email);
        setInfo(
          `${isAr ? 'رمز تأكيد البريد الإلكتروني:' : 'Email verification code:'} ${err.payload.verificationCodePreview}`
        );
        setMode('verify-email');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          phone,
          whatsapp: whatsapp || undefined,
          avatarUrl,
          desiredRole,
          department,
          skills: skillsText.split(',').map((s) => s.trim()).filter(Boolean),
          interests: interestsText.split(',').map((s) => s.trim()).filter(Boolean),
          preferredLanguage: lang,
        }),
      });
      setInfo(
        `${isAr ? 'تم إنشاء الحساب! رمز تفعيل البريد:' : 'Account created! Verification code:'} ${res.verificationCodePreview}`
      );
      setMode('verify-email');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user, res.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/verify-2fa', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user, res.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setInfo(
        res.resetCodePreview
          ? `${isAr ? 'رمز استعادة كلمة المرور:' : 'Recovery code:'} ${res.resetCodePreview}`
          : res.message
      );
      setMode('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      });
      setInfo(isAr ? 'تم تحديث كلمة المرور بنجاح.' : 'Password updated. Sign in with your new password.');
      setMode('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen w-full bg-slate-50 dark:bg-[#040814] flex flex-col"
    >
      {/* Clean top bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-blue-500/15">
        <div className="flex items-center gap-3">
          <div className="h-9 w-16 rounded-lg bg-[#02050d] border border-blue-500/25 p-1 flex items-center justify-center">
            <img
              src={KAVIRO_LOGO_SRC}
              alt="KAVIRO"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="font-display font-bold tracking-wider text-slate-900 dark:text-white">
            KAVIRO
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PrimaryButton
            size="sm"
            type="button"
            onClick={() => downloadProjectZip().catch((e) => setError(e.message))}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? 'تنزيل الموقع (.zip)' : 'Download Site (.zip)'}</span>
          </PrimaryButton>
          <SecondaryButton size="sm" onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{theme === 'dark' ? (isAr ? 'فاتح' : 'Light') : isAr ? 'داكن' : 'Dark'}</span>
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={onToggleLang}>
            <Globe className="w-3.5 h-3.5" />
            <span>{isAr ? 'English' : 'العربية'}</span>
          </SecondaryButton>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Brand Showcase */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl bg-[#02050d] border border-blue-500/25 p-6 shadow-[0_20px_60px_-20px_rgba(29,122,252,0.45)] flex items-center justify-center">
            <img
              src={KAVIRO_LOGO_SRC}
              alt="KAVIRO Official Logo"
              referrerPolicy="no-referrer"
              className="w-full max-w-[280px] h-auto object-contain"
            />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {isAr
                ? 'بيئة العمل الذكية لإدارة الفرق والمواهب'
                : 'Intelligent Team Operations & Talent Intelligence'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {isAr
                ? 'منصة ويب متكاملة تدعم تأهيل الأعضاء، تحليل السيرة الذاتية بالذكاء الاصطناعي، الاختبارات، المراسلات الفورية، ومراقبة الجلسات.'
                : 'Unified web workspace combining member onboarding, Gemini AI CV analysis, human verification, assessments, real-time chat, and security monitoring.'}
            </p>
          </div>

          <SurfaceCard className="p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isAr ? 'حسابات التقييم الفوري (كلمة المرور: Kaviro@2026)' : 'Instant Role Access (Password: Kaviro@2026)'}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SecondaryButton
                size="sm"
                type="button"
                onClick={() => handleLogin('admin@kaviro.ai', 'Kaviro@2026')}
              >
                Admin
              </SecondaryButton>
              <SecondaryButton
                size="sm"
                type="button"
                onClick={() => handleLogin('supervisor@kaviro.ai', 'Kaviro@2026')}
              >
                Supervisor
              </SecondaryButton>
              <SecondaryButton
                size="sm"
                type="button"
                onClick={() => handleLogin('member@kaviro.ai', 'Kaviro@2026')}
              >
                Member
              </SecondaryButton>
            </div>
          </SurfaceCard>
        </div>

        {/* Right Auth Panel */}
        <SurfaceCard className="lg:col-span-7 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-blue-500/15">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {mode === 'login'
                ? isAr
                  ? 'تسجيل الدخول إلى KAVIRO'
                  : 'Sign In to KAVIRO'
                : mode === 'register'
                ? isAr
                  ? 'إنشاء حساب عضو جديد'
                  : 'Create Team Member Account'
                : mode === 'verify-email'
                ? isAr
                  ? 'تأكيد البريد الإلكتروني'
                  : 'Verify Email Address'
                : mode === 'verify-2fa'
                ? isAr
                  ? 'التحقق بخطوتين (2FA)'
                  : 'Two-Factor Verification'
                : isAr
                ? 'استعادة كلمة المرور'
                : 'Recover Password'}
            </h2>
            <div className="flex items-center gap-2 text-xs">
              {mode !== 'login' ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('login');
                  }}
                  className="text-[#1D7AFC] dark:text-[#00D4FF] font-medium hover:underline cursor-pointer"
                >
                  {isAr ? 'العودة للدخول' : 'Back to Sign In'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('register');
                  }}
                  className="text-[#1D7AFC] dark:text-[#00D4FF] font-medium hover:underline cursor-pointer"
                >
                  {isAr ? 'تسجيل عضو جديد' : 'Create Account'}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}
          {info && (
            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-700 dark:text-cyan-300">
              {info}
            </div>
          )}

          {mode === 'login' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full ps-9 pe-3 py-2.5 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white focus:outline-none focus:border-[#00D4FF]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {isAr ? 'كلمة المرور' : 'Password'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs text-[#1D7AFC] dark:text-[#00D4FF] hover:underline cursor-pointer"
                  >
                    {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full ps-9 pe-3 py-2.5 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white focus:outline-none focus:border-[#00D4FF]"
                  />
                </div>
              </div>

              <PrimaryButton type="submit" disabled={loading} className="w-full">
                {loading
                  ? isAr
                    ? 'جاري التحقق...'
                    : 'Signing in...'
                  : isAr
                  ? 'تسجيل الدخول'
                  : 'Sign In'}
              </PrimaryButton>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'الاسم الكامل *' : 'Full Name *'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                    <input
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full ps-9 pe-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'البريد الإلكتروني *' : 'Email Address *'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'كلمة المرور (8 أحرف+) *' : 'Password (8+ chars) *'}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'رقم الهاتف *' : 'Phone Number *'}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                    <input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full ps-9 pe-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'رقم واتساب (اختياري)' : 'WhatsApp Number (Optional)'}
                  </label>
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'الدور المطلوب في الفريق *' : 'Desired Team Role *'}
                  </label>
                  <input
                    required
                    value={desiredRole}
                    onChange={(e) => setDesiredRole(e.target.value)}
                    placeholder={isAr ? 'مطور واجهات / مصمم...' : 'Frontend Engineer / Analyst...'}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'القسم' : 'Department'}
                  </label>
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'الصورة الشخصية (اختياري)' : 'Profile Picture (Optional)'}
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-dashed border-slate-300 dark:border-blue-500/30 text-slate-600 dark:text-slate-300 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{avatarUrl ? (isAr ? 'تم اختيار الصورة' : 'Photo selected') : isAr ? 'رفع صورة' : 'Upload image'}</span>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'المهارات (مفصولة بفاصلة)' : 'Skills (comma-separated)'}
                  </label>
                  <input
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    placeholder="TypeScript, React, Security"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isAr ? 'الاهتمامات (مفصولة بفاصلة)' : 'Interests (comma-separated)'}
                  </label>
                  <input
                    value={interestsText}
                    onChange={(e) => setInterestsText(e.target.value)}
                    placeholder="AI Workflows, Product Design"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <PrimaryButton type="submit" disabled={loading} className="w-full">
                {loading
                  ? isAr
                    ? 'جاري التسجيل...'
                    : 'Creating Account...'
                  : isAr
                  ? 'إنشاء الحساب والمتابعة'
                  : 'Create Account & Verify Email'}
              </PrimaryButton>
            </form>
          )}

          {(mode === 'verify-email' || mode === 'verify-2fa') && (
            <form onSubmit={mode === 'verify-email' ? handleVerifyEmail : handleVerify2FA} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {isAr ? 'أدخل رمز التحقق المكون من 6 أرقام' : 'Enter 6-digit verification code'}
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="w-full ps-9 pe-3 py-2.5 text-sm font-mono-tabular rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <PrimaryButton type="submit" disabled={loading} className="w-full">
                {isAr ? 'تأكيد ومتابعة' : 'Verify & Continue'}
              </PrimaryButton>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {isAr ? 'البريد الإلكتروني المسجل' : 'Registered Email'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                />
              </div>
              <PrimaryButton type="submit" disabled={loading} className="w-full">
                {isAr ? 'إرسال رمز الاستعادة' : 'Issue Recovery Code'}
              </PrimaryButton>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  {isAr ? 'رمز الاستعادة' : 'Recovery Code'}
                </label>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  {isAr ? 'كلمة المرور الجديدة' : 'New Password'}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                />
              </div>
              <PrimaryButton type="submit" disabled={loading} className="w-full">
                {isAr ? 'تحديث كلمة المرور' : 'Reset Password'}
              </PrimaryButton>
            </form>
          )}
        </SurfaceCard>
      </main>
    </div>
  );
};
