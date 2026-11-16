import React, { useState } from 'react';
import { Download, Moon, Sun, Globe } from 'lucide-react';
import {
  KaviroLogo,
  KAVIRO_LOGO_SRC,
  MetricTile,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SurfaceCard,
} from '../design-system/components';
import type { Language } from '../lib/i18n';

interface DesignSystemViewProps {
  lang: Language;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleLang: () => void;
}

export const DesignSystemView: React.FC<DesignSystemViewProps> = ({
  lang,
  theme,
  onToggleTheme,
  onToggleLang,
}) => {
  const isAr = lang === 'ar';
  const [sampleTab, setSampleTab] = useState<'overview' | 'tokens' | 'components'>('overview');

  const palette = [
    { name: 'Midnight Abyss', hex: '#040814', role: 'Primary Dark Canvas (60%)' },
    { name: 'Deep Navy Surface', hex: '#091124', role: 'Card & Sidebar Surface (30%)' },
    { name: 'Elevated Indigo Slate', hex: '#0E1934', role: 'Interactive Panels & Modals' },
    { name: 'Electric Blue', hex: '#1D7AFC', role: 'Primary CTA & Brand Accent (10%)' },
    { name: 'KAVIRO Cyan', hex: '#00D4FF', role: 'Gradient Highlight & Focus Ring' },
    { name: 'Light Canvas', hex: '#F4F7FB', role: 'Light Mode Background' },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader
        title={isAr ? 'نظام تصميم KAVIRO' : 'KAVIRO Design System'}
        subtitle={
          isAr
            ? 'المصدر الموحد للهوية البصرية، الألوان المشتقة من شعار KAVIRO الرسمي، الخطوط ثنائية اللغة، والمكونات القابلة لإعادة الاستخدام.'
            : 'Single source of truth anchored to the official KAVIRO logo, midnight-navy dark surfaces, electric blue gradients, and bilingual RTL/LTR typography.'
        }
        action={
          <div className="flex items-center gap-2">
            <SecondaryButton size="sm" onClick={onToggleTheme}>
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{theme === 'dark' ? (isAr ? 'فاتح' : 'Light') : isAr ? 'داكن' : 'Dark'}</span>
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={onToggleLang}>
              <Globe className="w-3.5 h-3.5" />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </SecondaryButton>
            <a href="/api/export/project-zip" download>
              <PrimaryButton size="sm" type="button">
                <Download className="w-3.5 h-3.5" />
                <span>{isAr ? 'تنزيل الموقع (.zip)' : 'Download Site (.zip)'}</span>
              </PrimaryButton>
            </a>
          </div>
        }
      />

      {/* Segmented filter control */}
      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#091124] border border-slate-300 dark:border-blue-500/20">
        {(['overview', 'tokens', 'components'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSampleTab(tab)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              sampleTab === tab
                ? 'bg-white dark:bg-[#0e1934] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab === 'overview'
              ? isAr
                ? 'الهوية والشعار'
                : 'Brand & Logo'
              : tab === 'tokens'
              ? isAr
                ? 'الألوان والخطوط'
                : 'Colors & Typography'
              : isAr
              ? 'المكونات التفاعلية'
              : 'UI Primitives'}
          </button>
        ))}
      </div>

      {sampleTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <SurfaceCard className="lg:col-span-7 p-6 flex flex-col justify-between gap-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                {isAr ? 'الاستخدام الرسمي لشعار KAVIRO' : 'Official KAVIRO Logo Lockup'}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                {isAr
                  ? 'يُحافظ الشعار على نسبه وألوانه الأصلية دون قص أو تمديد مع مساحة فراغ كافية حوله في الشريط الجانبي وشاشات الدخول والأجهزة المحمولة.'
                  : 'Original proportions and electric-cyan K-orbit geometry are preserved across sidebar, login, loading screen, favicon, and mobile compact headers.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-[#02050d] border border-blue-500/25 flex flex-col items-center justify-center gap-3">
                <img
                  src={KAVIRO_LOGO_SRC}
                  alt="KAVIRO Full Mark"
                  referrerPolicy="no-referrer"
                  className="w-44 h-auto object-contain"
                />
                <span className="text-xs text-slate-400">
                  {isAr ? 'الوضع الداكن الافتراضي' : 'Primary Dark Lockup'}
                </span>
              </div>

              <div className="p-5 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center gap-4">
                <KaviroLogo variant="compact" />
                <span className="text-xs text-slate-600">
                  {isAr ? 'الوضع المضغوط للهاتف والفاتح' : 'Compact Mobile & Light Frame'}
                </span>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="lg:col-span-5 p-6 flex flex-col justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                {isAr ? 'قواعد التخطيط والتجاوب' : 'Responsive & Spatial Rules'}
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="pb-3 border-b border-slate-200 dark:border-blue-500/15">
                  <span className="font-semibold text-slate-900 dark:text-white">60-30-10 Balance</span>
                  <span className="text-slate-500 dark:text-slate-400"> — </span>
                  {isAr
                    ? 'خلفية كحلية داكنة، بطاقات بحدود زرقاء دقيقة، وأزرار تدرج كهربائي.'
                    : 'Midnight navy canvas, bordered dark navy cards, and focused electric-blue CTAs.'}
                </li>
                <li className="pb-3 border-b border-slate-200 dark:border-blue-500/15">
                  <span className="font-semibold text-slate-900 dark:text-white">Single-Elevation Surface</span>
                  <span className="text-slate-500 dark:text-slate-400"> — </span>
                  {isAr
                    ? 'فصل العناصر بالمساحات البيضاء والخطوط الدقيقة بدلاً من تكديس البطاقات.'
                    : 'Flat 1px hairline borders without nested card clutter or heavy drop shadows.'}
                </li>
                <li>
                  <span className="font-semibold text-slate-900 dark:text-white">Web-First Multi-Device</span>
                  <span className="text-slate-500 dark:text-slate-400"> — </span>
                  {isAr
                    ? 'تجاوب كامل من شاشات سطح المكتب 1440px إلى الأجهزة اللوحية والهواتف.'
                    : 'Fluid sidebar layout on 1440px desktop collapsing cleanly to drawer navigation on tablet and mobile.'}
                </li>
              </ul>
            </div>
          </SurfaceCard>
        </div>
      )}

      {sampleTab === 'tokens' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {palette.map((swatch) => (
              <SurfaceCard key={swatch.hex} className="p-4 flex items-center gap-4">
                <div
                  className="h-14 w-14 rounded-lg border border-slate-300 dark:border-blue-500/30 shrink-0"
                  style={{ backgroundColor: swatch.hex }}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">{swatch.name}</div>
                  <div className="font-mono-tabular text-xs text-[#1D7AFC] dark:text-[#00D4FF] mt-0.5">
                    {swatch.hex}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {swatch.role}
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>

          <SurfaceCard className="p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {isAr ? 'التسلسل الهرمي للخطوط ثنائية اللغة' : 'Bilingual Typography Scale'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Display · Plus Jakarta Sans</div>
                <div className="font-display text-3xl font-bold text-slate-900 dark:text-white">
                  Intelligent Team Operations
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 pt-2">Body · DM Sans</div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Unifies onboarding, AI CV analysis, human verification, real-time messaging, and security telemetry.
                </p>
              </div>
              <div className="space-y-3" dir="rtl">
                <div className="text-xs text-slate-500 dark:text-slate-400">العناوين والنصوص · IBM Plex Sans Arabic</div>
                <div className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  إدارة الفرق الذكية بالذكاء الاصطناعي
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  منصة موحدة لتأهيل الأعضاء وتحليل السيرة الذاتية والاختبارات والمراسلات الفورية ومراقبة الجلسات.
                </p>
              </div>
            </div>
          </SurfaceCard>
        </div>
      )}

      {sampleTab === 'components' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricTile label={isAr ? 'إجمالي الأعضاء' : 'Active Seats'} value="128" context="Q4 Roster · +14 this month" tone="accent" />
            <MetricTile label={isAr ? 'معدل النجاح' : 'Assessment Pass'} value="91.4%" context="Verified submissions" tone="success" />
            <MetricTile label={isAr ? 'قيد المراجعة' : 'Pending Review'} value="7" context="Supervisor queue" tone="warning" />
            <MetricTile label={isAr ? 'تنبيهات الأمان' : 'Security Alerts'} value="2" context="Unrecognized devices" tone="danger" />
          </div>

          <SurfaceCard className="p-6 flex flex-wrap items-center gap-4">
            <PrimaryButton>{isAr ? 'زر رئيسي متدرج' : 'Primary Gradient Action'}</PrimaryButton>
            <SecondaryButton>{isAr ? 'زر ثانوي متوازن' : 'Secondary Surface Action'}</SecondaryButton>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span>Engineering</span>
              <span aria-hidden="true">·</span>
              <span>Updated Nov 2026</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">99.98% uptime</span>
            </div>
          </SurfaceCard>
        </div>
      )}
    </div>
  );
};
