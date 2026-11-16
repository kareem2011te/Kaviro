import React, { useEffect, useState } from 'react';
import { Check, Download, Eye, FileUp, Plus, Printer, Sparkles, Trash2 } from 'lucide-react';
import { PrimaryButton, SecondaryButton, SectionHeader, SurfaceCard } from '../design-system/components';
import { apiRequest } from '../lib/api';
import type { Language } from '../lib/i18n';
import type { CvAnalysisResult, UserCv, UserProfile } from '../lib/types';

interface CvBuilderViewProps {
  lang: Language;
  currentUser: UserProfile;
  onUserUpdated: (u: UserProfile) => void;
}

export const CvBuilderView: React.FC<CvBuilderViewProps> = ({
  lang,
  currentUser,
  onUserUpdated,
}) => {
  const isAr = lang === 'ar';
  const [cv, setCv] = useState<UserCv>({
    fullName: currentUser.fullName,
    headline: currentUser.desiredRole,
    email: currentUser.email,
    phone: currentUser.phone || '',
    location: '',
    summary: '',
    education: [],
    experience: [],
    projects: [],
    achievements: [],
    technicalSkills: currentUser.skills || [],
    softSkills: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | undefined>(undefined);
  const [analysis, setAnalysis] = useState<CvAnalysisResult | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTechSkill, setNewTechSkill] = useState('');
  const [newSoftSkill, setNewSoftSkill] = useState('');
  const [newAchievement, setNewAchievement] = useState('');

  useEffect(() => {
    apiRequest<{ cv: UserCv | null }>('/api/cv')
      .then((res) => {
        if (res.cv) setCv(res.cv);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ cv: UserCv; onboarding: UserProfile['onboarding'] }>('/api/cv', {
        method: 'POST',
        body: JSON.stringify(cv),
      });
      setCv(res.cv);
      onUserUpdated({ ...currentUser, onboarding: res.onboarding });
      setNotice(isAr ? 'تم حفظ السيرة الذاتية بنجاح.' : 'CV saved to your KAVIRO profile.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const resultStr = String(reader.result || '');
        const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
        const parsed = await apiRequest<{
          fileName: string;
          mimeType: string;
          extractedText: string;
          pdfBase64?: string;
        }>('/api/cv/upload', {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            base64Data: base64,
          }),
        });
        setPdfBase64(parsed.pdfBase64);
        setCv((prev) => ({
          ...prev,
          uploadedFileName: parsed.fileName,
          uploadedFileMime: parsed.mimeType,
          rawExtractedText: parsed.extractedText,
        }));
        setNotice(
          isAr
            ? `تم رفع الملف (${parsed.fileName}) بنجاح. يمكنك الآن تشغيل التحليل الذكي.`
            : `Uploaded ${parsed.fileName}. Run AI CV Analysis to inspect and refine it.`
        );
      } catch (err: any) {
        setError(err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await apiRequest<{ analysis: CvAnalysisResult }>('/api/ai/cv-analyze', {
        method: 'POST',
        body: JSON.stringify({
          cv,
          language: lang,
          pdfBase64,
          extractedText: cv.rawExtractedText,
        }),
      });
      setAnalysis(res.analysis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const applyApprovedDraft = () => {
    if (!analysis) return;
    setCv((prev) => ({
      ...prev,
      headline: analysis.improvedDraft.headline || prev.headline,
      summary: analysis.improvedDraft.summary || prev.summary,
      technicalSkills: analysis.improvedDraft.technicalSkills?.length
        ? analysis.improvedDraft.technicalSkills
        : prev.technicalSkills,
      softSkills: analysis.improvedDraft.softSkills?.length
        ? analysis.improvedDraft.softSkills
        : prev.softSkills,
      projects: prev.projects.map((p) => {
        const sug = analysis.projectSuggestions.find(
          (s) => s.projectName.toLowerCase() === p.name.toLowerCase()
        );
        return sug
          ? { ...p, summary: sug.improvedSummary, impact: sug.improvedImpact }
          : p;
      }),
    }));
    setNotice(
      isAr
        ? 'تم تطبيق المسودة المحسّنة بعد موافقتك. اضغط حفظ لتثبيت التغييرات.'
        : 'Approved AI draft applied to editor. Click Save CV to persist changes.'
    );
    setAnalysis(null);
  };

  const exportCvJson = () => {
    const blob = new Blob([JSON.stringify(cv, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cv.fullName.replace(/\s+/g, '_').toLowerCase()}_cv.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <SurfaceCard className="p-8 text-sm text-slate-400">Loading CV Workspace...</SurfaceCard>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={isAr ? 'منشئ السيرة الذاتية والمساعد الذكي' : 'AI CV Builder & Analyzer'}
        subtitle={
          isAr
            ? 'أنشئ سيرتك الذاتية أو ارفع ملف PDF / DOCX وحلله بالذكاء الاصطناعي دون أي اختلاق للبيانات.'
            : 'Build your CV from scratch or upload PDF/DOCX. Gemini AI refines wording and identifies gaps—never inventing qualifications.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton size="sm" onClick={() => setPreviewMode(!previewMode)}>
              <Eye className="w-3.5 h-3.5" />
              <span>{previewMode ? (isAr ? 'وضع التحرير' : 'Edit Mode') : isAr ? 'معاينة السيرة' : 'Preview CV'}</span>
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" />
              <span>{isAr ? 'طباعة / PDF' : 'Print / PDF'}</span>
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={exportCvJson}>
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </SecondaryButton>
            <PrimaryButton size="sm" onClick={handleSave} disabled={saving}>
              <span>{saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'حفظ السيرة' : 'Save CV'}</span>
            </PrimaryButton>
          </div>
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

      {/* Upload & AI Trigger Bar */}
      <SurfaceCard className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {isAr ? 'استيراد سيرة ذاتية حالية (PDF / DOCX / TXT)' : 'Upload Existing CV (PDF / DOCX / TXT)'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {cv.uploadedFileName
              ? `${isAr ? 'الملف المرفوع:' : 'Attached:'} ${cv.uploadedFileName}`
              : isAr
              ? 'ارفع ملفاً لاستخراج النص وتحليله عبر الذكاء الاصطناعي.'
              : 'Upload a file to extract text or analyze directly with Gemini AI.'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-800 dark:text-slate-200 inline-flex items-center gap-2 cursor-pointer hover:border-[#1D7AFC]">
            <FileUp className="w-3.5 h-3.5" />
            <span>{isAr ? 'اختيار ملف CV' : 'Upload PDF / DOCX'}</span>
            <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileUpload} className="hidden" />
          </label>
          <PrimaryButton size="sm" onClick={handleAnalyze} disabled={analyzing}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {analyzing
                ? isAr
                  ? 'جاري التحليل...'
                  : 'Analyzing...'
                : isAr
                ? 'تحليل واقتراح تحسينات'
                : 'Analyze with KAVIRO AI'}
            </span>
          </PrimaryButton>
        </div>
      </SurfaceCard>

      {/* AI Draft Review Banner (Requires User Approval) */}
      {analysis && (
        <SurfaceCard elevated className="p-6 space-y-5 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-blue-500/20">
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                {isAr ? 'تقرير مساعد السيرة الذاتية (بانتظار موافقتك)' : 'AI CV Review & Draft (Approval Required)'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{analysis.overallReadiness}</p>
            </div>
            <div className="flex items-center gap-2">
              <SecondaryButton size="sm" onClick={() => setAnalysis(null)}>
                {isAr ? 'تجاهل المسودة' : 'Dismiss'}
              </SecondaryButton>
              <PrimaryButton size="sm" onClick={applyApprovedDraft}>
                <Check className="w-3.5 h-3.5" />
                <span>{isAr ? 'الموافقة وتطبيق التحسينات' : 'Approve & Apply Draft'}</span>
              </PrimaryButton>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white">
                {isAr ? 'معلومات مفقودة مقترحة' : 'Missing Information'}
              </div>
              <ul className="list-disc ps-5 space-y-1 text-slate-600 dark:text-slate-300">
                {analysis.missingInformation.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <div className="font-semibold text-slate-900 dark:text-white pt-3">
                {isAr ? 'أسئلة متابعة لتوضيح خبراتك' : 'Follow-Up Questions'}
              </div>
              <ul className="list-disc ps-5 space-y-1 text-slate-600 dark:text-slate-300">
                {analysis.followUpQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white">
                {isAr ? 'تحسين الصياغة والقواعد' : 'Grammar & Phrasing Improvements'}
              </div>
              <ul className="list-disc ps-5 space-y-1 text-slate-600 dark:text-slate-300">
                {analysis.grammarAndWordingFixes.map((fix, i) => (
                  <li key={i}>{fix}</li>
                ))}
              </ul>
              <div className="font-semibold text-slate-900 dark:text-white pt-3">
                {isAr ? 'معاينة الملخص المقترح' : 'Proposed Improved Summary'}
              </div>
              <p className="p-3 rounded-lg bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20 text-slate-700 dark:text-slate-200 leading-relaxed">
                {analysis.improvedDraft.summary}
              </p>
            </div>
          </div>
        </SurfaceCard>
      )}

      {previewMode ? (
        <SurfaceCard className="p-8 max-w-4xl mx-auto space-y-6 bg-white text-slate-900 dark:bg-white dark:text-slate-900">
          <div className="border-b border-slate-200 pb-5">
            <h2 className="font-display text-3xl font-bold text-slate-900">{cv.fullName}</h2>
            <div className="text-base font-medium text-[#1D7AFC] mt-1">{cv.headline}</div>
            <div className="text-xs text-slate-600 mt-2 flex flex-wrap gap-2">
              <span>{cv.email}</span>
              <span>·</span>
              <span>{cv.phone}</span>
              {cv.location && (
                <>
                  <span>·</span>
                  <span>{cv.location}</span>
                </>
              )}
            </div>
          </div>

          {cv.summary && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {isAr ? 'الملخص المهني' : 'Professional Summary'}
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">{cv.summary}</p>
            </div>
          )}

          {cv.experience.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                {isAr ? 'الخبرات العملية' : 'Experience'}
              </h3>
              <div className="space-y-4">
                {cv.experience.map((exp) => (
                  <div key={exp.id}>
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>
                        {exp.title} — {exp.company}
                      </span>
                      <span className="text-xs text-slate-500">{exp.period}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{exp.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cv.projects.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                {isAr ? 'المشاريع' : 'Projects'}
              </h3>
              <div className="space-y-3">
                {cv.projects.map((p) => (
                  <div key={p.id}>
                    <div className="text-sm font-semibold">
                      {p.name} · <span className="font-normal text-slate-600">{p.role}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{p.summary}</p>
                    {p.impact && <p className="text-xs text-[#1D7AFC] mt-0.5">{p.impact}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {cv.education.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {isAr ? 'التعليم' : 'Education'}
              </h3>
              {cv.education.map((edu) => (
                <div key={edu.id} className="text-xs text-slate-700 flex justify-between py-1">
                  <span>
                    <strong>{edu.degree}</strong> in {edu.field} — {edu.institution}
                  </span>
                  <span>
                    {edu.startYear}–{edu.endYear}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 text-xs">
            <div>
              <div className="font-bold text-slate-500 mb-1">Technical Skills</div>
              <div className="text-slate-800">{cv.technicalSkills.join(' · ')}</div>
            </div>
            <div>
              <div className="font-bold text-slate-500 mb-1">Soft Skills</div>
              <div className="text-slate-800">{cv.softSkills.join(' · ')}</div>
            </div>
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Personal & Summary */}
          <SurfaceCard className="lg:col-span-6 p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              {isAr ? 'البيانات الأساسية والملخص' : 'Personal Information & Summary'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={cv.fullName}
                onChange={(e) => setCv({ ...cv, fullName: e.target.value })}
                placeholder={isAr ? 'الاسم الكامل' : 'Full Name'}
                className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
              />
              <input
                value={cv.headline}
                onChange={(e) => setCv({ ...cv, headline: e.target.value })}
                placeholder={isAr ? 'المسمى المهني' : 'Headline / Role'}
                className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
              />
              <input
                value={cv.email}
                onChange={(e) => setCv({ ...cv, email: e.target.value })}
                placeholder="Email"
                className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
              />
              <input
                value={cv.phone}
                onChange={(e) => setCv({ ...cv, phone: e.target.value })}
                placeholder="Phone"
                className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
              />
            </div>
            <input
              value={cv.location}
              onChange={(e) => setCv({ ...cv, location: e.target.value })}
              placeholder={isAr ? 'المدينة / الدولة' : 'City, Country'}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
            />
            <textarea
              rows={4}
              value={cv.summary}
              onChange={(e) => setCv({ ...cv, summary: e.target.value })}
              placeholder={isAr ? 'اكتب ملخصك المهني...' : 'Write your professional summary...'}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
            />

            {/* Skills */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-blue-500/15">
              <div className="flex gap-2">
                <input
                  value={newTechSkill}
                  onChange={(e) => setNewTechSkill(e.target.value)}
                  placeholder={isAr ? 'أضف مهارة تقنية...' : 'Add technical skill...'}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                />
                <SecondaryButton
                  size="sm"
                  type="button"
                  onClick={() => {
                    if (!newTechSkill.trim()) return;
                    setCv({ ...cv, technicalSkills: [...cv.technicalSkills, newTechSkill.trim()] });
                    setNewTechSkill('');
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </SecondaryButton>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-2">
                {cv.technicalSkills.map((s, idx) => (
                  <button
                    key={`${s}-${idx}`}
                    type="button"
                    onClick={() =>
                      setCv({ ...cv, technicalSkills: cv.technicalSkills.filter((_, i) => i !== idx) })
                    }
                    className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20 hover:border-rose-500/50 cursor-pointer"
                  >
                    {s} ×
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  value={newSoftSkill}
                  onChange={(e) => setNewSoftSkill(e.target.value)}
                  placeholder={isAr ? 'أضف مهارة شخصية...' : 'Add soft skill...'}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                />
                <SecondaryButton
                  size="sm"
                  type="button"
                  onClick={() => {
                    if (!newSoftSkill.trim()) return;
                    setCv({ ...cv, softSkills: [...cv.softSkills, newSoftSkill.trim()] });
                    setNewSoftSkill('');
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </SecondaryButton>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-2">
                {cv.softSkills.map((s, idx) => (
                  <button
                    key={`${s}-${idx}`}
                    type="button"
                    onClick={() =>
                      setCv({ ...cv, softSkills: cv.softSkills.filter((_, i) => i !== idx) })
                    }
                    className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20 hover:border-rose-500/50 cursor-pointer"
                  >
                    {s} ×
                  </button>
                ))}
              </div>
            </div>
          </SurfaceCard>

          {/* Experience, Projects, Education, Achievements */}
          <SurfaceCard className="lg:col-span-6 p-6 space-y-6">
            {/* Experience */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  {isAr ? 'الخبرات العملية' : 'Work Experience'}
                </h3>
                <SecondaryButton
                  size="sm"
                  type="button"
                  onClick={() =>
                    setCv({
                      ...cv,
                      experience: [
                        ...cv.experience,
                        { id: `exp-${Date.now()}`, company: '', title: '', period: '', description: '' },
                      ],
                    })
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إضافة خبرة' : 'Add'}</span>
                </SecondaryButton>
              </div>
              {cv.experience.map((exp, idx) => (
                <div
                  key={exp.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20 space-y-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      value={exp.title}
                      onChange={(e) => {
                        const next = [...cv.experience];
                        next[idx] = { ...exp, title: e.target.value };
                        setCv({ ...cv, experience: next });
                      }}
                      placeholder="Role Title"
                      className="px-2.5 py-1.5 text-xs rounded bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20"
                    />
                    <input
                      value={exp.company}
                      onChange={(e) => {
                        const next = [...cv.experience];
                        next[idx] = { ...exp, company: e.target.value };
                        setCv({ ...cv, experience: next });
                      }}
                      placeholder="Company"
                      className="px-2.5 py-1.5 text-xs rounded bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20"
                    />
                    <div className="flex gap-1">
                      <input
                        value={exp.period}
                        onChange={(e) => {
                          const next = [...cv.experience];
                          next[idx] = { ...exp, period: e.target.value };
                          setCv({ ...cv, experience: next });
                        }}
                        placeholder="2022–2025"
                        className="flex-1 px-2.5 py-1.5 text-xs rounded bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCv({ ...cv, experience: cv.experience.filter((_, i) => i !== idx) })
                        }
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={exp.description}
                    onChange={(e) => {
                      const next = [...cv.experience];
                      next[idx] = { ...exp, description: e.target.value };
                      setCv({ ...cv, experience: next });
                    }}
                    placeholder="Key responsibilities and measurable results..."
                    className="w-full px-2.5 py-1.5 text-xs rounded bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20"
                  />
                </div>
              ))}
            </div>

            {/* Projects */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-blue-500/15">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  {isAr ? 'المشاريع والإنجازات' : 'Projects'}
                </h3>
                <SecondaryButton
                  size="sm"
                  type="button"
                  onClick={() =>
                    setCv({
                      ...cv,
                      projects: [
                        ...cv.projects,
                        { id: `prj-${Date.now()}`, name: '', role: '', summary: '', impact: '' },
                      ],
                    })
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إضافة مشروع' : 'Add'}</span>
                </SecondaryButton>
              </div>
              {cv.projects.map((prj, idx) => (
                <div
                  key={prj.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20 space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      value={prj.name}
                      onChange={(e) => {
                        const next = [...cv.projects];
                        next[idx] = { ...prj, name: e.target.value };
                        setCv({ ...cv, projects: next });
                      }}
                      placeholder="Project Name"
                      className="flex-1 px-2.5 py-1.5 text-xs rounded bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20"
                    />
                    <input
                      value={prj.role}
                      onChange={(e) => {
                        const next = [...cv.projects];
                        next[idx] = { ...prj, role: e.target.value };
                        setCv({ ...cv, projects: next });
                      }}
                      placeholder="Your Role"
                      className="flex-1 px-2.5 py-1.5 text-xs rounded bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setCv({ ...cv, projects: cv.projects.filter((_, i) => i !== idx) })}
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    value={prj.summary}
                    onChange={(e) => {
                      const next = [...cv.projects];
                      next[idx] = { ...prj, summary: e.target.value };
                      setCv({ ...cv, projects: next });
                    }}
                    placeholder="What did you build?"
                    className="w-full px-2.5 py-1.5 text-xs rounded bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20"
                  />
                  <input
                    value={prj.impact}
                    onChange={(e) => {
                      const next = [...cv.projects];
                      next[idx] = { ...prj, impact: e.target.value };
                      setCv({ ...cv, projects: next });
                    }}
                    placeholder="Outcome / impact"
                    className="w-full px-2.5 py-1.5 text-xs rounded bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20"
                  />
                </div>
              ))}
            </div>

            {/* Education & Achievements */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-blue-500/15">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  {isAr ? 'التعليم' : 'Education'}
                </h3>
                <SecondaryButton
                  size="sm"
                  type="button"
                  onClick={() =>
                    setCv({
                      ...cv,
                      education: [
                        ...cv.education,
                        { id: `edu-${Date.now()}`, institution: '', degree: '', field: '', startYear: '', endYear: '' },
                      ],
                    })
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                </SecondaryButton>
              </div>
              {cv.education.map((edu, idx) => (
                <div key={edu.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input
                    value={edu.institution}
                    onChange={(e) => {
                      const next = [...cv.education];
                      next[idx] = { ...edu, institution: e.target.value };
                      setCv({ ...cv, education: next });
                    }}
                    placeholder="University"
                    className="col-span-2 px-2.5 py-1.5 text-xs rounded bg-slate-50 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20"
                  />
                  <input
                    value={edu.degree}
                    onChange={(e) => {
                      const next = [...cv.education];
                      next[idx] = { ...edu, degree: e.target.value };
                      setCv({ ...cv, education: next });
                    }}
                    placeholder="Degree"
                    className="px-2.5 py-1.5 text-xs rounded bg-slate-50 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20"
                  />
                  <input
                    value={edu.field}
                    onChange={(e) => {
                      const next = [...cv.education];
                      next[idx] = { ...edu, field: e.target.value };
                      setCv({ ...cv, education: next });
                    }}
                    placeholder="Field"
                    className="px-2.5 py-1.5 text-xs rounded bg-slate-50 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20"
                  />
                  <div className="flex gap-1">
                    <input
                      value={edu.endYear}
                      onChange={(e) => {
                        const next = [...cv.education];
                        next[idx] = { ...edu, endYear: e.target.value };
                        setCv({ ...cv, education: next });
                      }}
                      placeholder="Year"
                      className="w-full px-2 py-1.5 text-xs rounded bg-slate-50 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setCv({ ...cv, education: cv.education.filter((_, i) => i !== idx) })}
                      className="p-1.5 text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-2 flex gap-2">
                <input
                  value={newAchievement}
                  onChange={(e) => setNewAchievement(e.target.value)}
                  placeholder={isAr ? 'أضف إنجازاً موثقاً...' : 'Add achievement...'}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
                />
                <SecondaryButton
                  size="sm"
                  type="button"
                  onClick={() => {
                    if (!newAchievement.trim()) return;
                    setCv({ ...cv, achievements: [...cv.achievements, newAchievement.trim()] });
                    setNewAchievement('');
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </SecondaryButton>
              </div>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {cv.achievements.map((ach, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2">
                    <span>· {ach}</span>
                    <button
                      type="button"
                      onClick={() => setCv({ ...cv, achievements: cv.achievements.filter((_, i) => i !== idx) })}
                      className="text-rose-500 cursor-pointer"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </SurfaceCard>
        </div>
      )}
    </div>
  );
};
