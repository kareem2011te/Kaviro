import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { PrimaryButton, SecondaryButton, SectionHeader, SurfaceCard } from '../design-system/components';
import { apiRequest } from '../lib/api';
import type { Language } from '../lib/i18n';
import type { Assessment, AssessmentAttempt, AssessmentQuestion, QuestionType, UserProfile } from '../lib/types';

interface AssessmentsViewProps {
  lang: Language;
  currentUser: UserProfile;
  users: UserProfile[];
  onUserUpdated: (u: UserProfile) => void;
}

export const AssessmentsView: React.FC<AssessmentsViewProps> = ({
  lang,
  currentUser,
  users,
  onUserUpdated,
}) => {
  const isAr = lang === 'ar';
  const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'supervisor';

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [captcha, setCaptcha] = useState<{ challengeId: string; svgDataUri: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Active Attempt runner state
  const [activeAttempt, setActiveAttempt] = useState<AssessmentAttempt | null>(null);
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<AssessmentQuestion[]>([]);
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Supervisor Grading & Builder state
  const [gradingAttempt, setGradingAttempt] = useState<AssessmentAttempt | null>(null);
  const [gradeInputs, setGradeInputs] = useState<Record<string, { points: number; feedback: string }>>({});
  const [showBuilder, setShowBuilder] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Engineering');
  const [newTimeLimit, setNewTimeLimit] = useState(15);
  const [newQuestions, setNewQuestions] = useState<AssessmentQuestion[]>([
    {
      id: 'q-new-1',
      type: 'mcq',
      prompt: '',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      points: 50,
    },
  ]);

  const loadData = async () => {
    try {
      const res = await apiRequest<{ assessments: Assessment[]; attempts: AssessmentAttempt[] }>('/api/assessments');
      setAssessments(res.assessments);
      setAttempts(res.attempts);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadCaptcha = async () => {
    try {
      const res = await apiRequest<{ challengeId: string; svgDataUri: string }>('/api/assessments/captcha');
      setCaptcha(res);
      setCaptchaAnswer('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadData();
    if (!currentUser.humanVerified) {
      loadCaptcha();
    }
  }, [currentUser.humanVerified]);

  useEffect(() => {
    if (!activeAttempt || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          handleSubmitAttempt();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeAttempt, secondsLeft]);

  const handleVerifyCaptcha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captcha) return;
    setError(null);
    try {
      const res = await apiRequest<{ verified: boolean; user: UserProfile }>('/api/assessments/captcha/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId: captcha.challengeId, answer: captchaAnswer }),
      });
      onUserUpdated(res.user);
      setNotice(isAr ? 'تم التحقق البشري بنجاح! يمكنك بدء الاختبارات الآن.' : 'Human verification passed. Assessments unlocked.');
    } catch (err: any) {
      setError(err.message);
      loadCaptcha();
    }
  };

  const handleStartAssessment = async (assessment: Assessment) => {
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ attempt: AssessmentAttempt; questions: AssessmentQuestion[] }>(
        `/api/assessments/${assessment.id}/start`,
        { method: 'POST' }
      );
      setActiveAttempt(res.attempt);
      setActiveAssessment(assessment);
      setActiveQuestions(res.questions);
      setAnswersMap({});
      setSecondsLeft(assessment.timeLimitMinutes * 60);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmitAttempt = async () => {
    if (!activeAttempt) return;
    try {
      const answers = activeQuestions.map((q) => ({
        questionId: q.id,
        answer: answersMap[q.id] || '',
      }));
      const res = await apiRequest<{ attempt: AssessmentAttempt; onboarding: UserProfile['onboarding'] }>(
        `/api/assessments/attempts/${activeAttempt.id}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ answers }),
        }
      );
      onUserUpdated({ ...currentUser, onboarding: res.onboarding });
      setActiveAttempt(null);
      setActiveAssessment(null);
      setActiveQuestions([]);
      setNotice(
        res.attempt.status === 'graded'
          ? `Assessment graded: ${res.attempt.totalScore}/${res.attempt.maxScore}`
          : isAr
          ? 'تم إرسال إجاباتك بنجاح وبانتظار التقييم اليدوي من المشرف.'
          : 'Submission recorded and queued for supervisor review.'
      );
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/assessments', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          timeLimitMinutes: newTimeLimit,
          maxAttempts: 2,
          passingScore: 70,
          randomizeQuestions: true,
          assignedUserIds: [],
          questions: newQuestions,
        }),
      });
      setShowBuilder(false);
      setNewTitle('');
      loadData();
      setNotice(isAr ? 'تم إنشاء الاختبار الجديد.' : 'Assessment published to workspace.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmitGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingAttempt) return;
    try {
      const grades = Object.entries(gradeInputs).map(([questionId, val]) => ({
        questionId,
        pointsAwarded: val.points,
        feedback: val.feedback,
      }));
      await apiRequest(`/api/assessments/attempts/${gradingAttempt.id}/grade`, {
        method: 'POST',
        body: JSON.stringify({ grades }),
      });
      setGradingAttempt(null);
      loadData();
      setNotice(isAr ? 'تم اعتماد التقييم اليدوي وإشعار العضو.' : 'Manual grading finalized.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const userNameMap = new Map(users.map((u) => [u.id, u.fullName]));

  return (
    <div className="space-y-6">
      <SectionHeader
        title={isAr ? 'مركز التحقق البشري والاختبارات' : 'Human Verification & Assessment Center'}
        subtitle={
          isAr
            ? 'تحقق أمني (CAPTCHA)، اختبارات عشوائية محددة بالوقت، وتقييم تلقائي ويدوي بواسطة المشرفين.'
            : 'CAPTCHA verification, randomized timed assessments, automatic objective grading, and supervisor manual evaluation.'
        }
        action={
          isPrivileged ? (
            <PrimaryButton size="sm" onClick={() => setShowBuilder(!showBuilder)}>
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إنشاء اختبار' : 'Create Assessment'}</span>
            </PrimaryButton>
          ) : undefined
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

      {/* Human Verification CAPTCHA Gate */}
      <SurfaceCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck
              className={`w-6 h-6 shrink-0 mt-0.5 ${
                currentUser.humanVerified ? 'text-emerald-500' : 'text-[#1D7AFC] dark:text-[#00D4FF]'
              }`}
            />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {isAr ? 'التحقق البشري الأمني (CAPTCHA)' : 'Human Verification Gate'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentUser.humanVerified
                  ? isAr
                    ? 'تم التحقق من هويتك البشرية بنجاح — الاختبارات متاحة الآن.'
                    : 'Your account is human-verified. Timed assessments are unlocked.'
                  : isAr
                  ? 'أكمل تحدي التحقق البشري لفتح اختبارات المهارات.'
                  : 'Solve the server-verified challenge below to unlock skill assessments.'}
              </p>
            </div>
          </div>

          {currentUser.humanVerified ? (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>{isAr ? 'مُتحقق' : 'Verified'}</span>
            </div>
          ) : (
            captcha && (
              <form onSubmit={handleVerifyCaptcha} className="flex flex-wrap items-center gap-3">
                <img
                  src={captcha.svgDataUri}
                  alt="Security Challenge"
                  className="h-12 rounded-lg border border-blue-500/30"
                />
                <button
                  type="button"
                  onClick={loadCaptcha}
                  title="Refresh challenge"
                  className="p-2 rounded-lg bg-slate-100 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/20 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <input
                  required
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  placeholder={isAr ? 'النتيجة' : 'Answer'}
                  className="w-24 px-3 py-2 text-sm font-mono-tabular rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
                />
                <PrimaryButton size="sm" type="submit">
                  {isAr ? 'تحقق' : 'Verify'}
                </PrimaryButton>
              </form>
            )
          )}
        </div>
      </SurfaceCard>

      {/* Supervisor Assessment Builder */}
      {showBuilder && isPrivileged && (
        <SurfaceCard elevated className="p-6">
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {isAr ? 'إنشاء اختبار جديد' : 'New Assessment Builder'}
          </h3>
          <form onSubmit={handleCreateAssessment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={isAr ? 'عنوان الاختبار' : 'Assessment Title'}
                className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category"
                className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                type="number"
                min={5}
                max={120}
                value={newTimeLimit}
                onChange={(e) => setNewTimeLimit(Number(e.target.value))}
                placeholder="Time limit (min)"
                className="px-3 py-2 text-sm font-mono-tabular rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
              />
            </div>

            {newQuestions.map((q, idx) => (
              <div key={q.id} className="p-4 rounded-lg bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={q.type}
                    onChange={(e) => {
                      const next = [...newQuestions];
                      const type = e.target.value as QuestionType;
                      next[idx] = {
                        ...q,
                        type,
                        options:
                          type === 'mcq'
                            ? ['Option A', 'Option B', 'Option C', 'Option D']
                            : type === 'true_false'
                            ? ['True', 'False']
                            : undefined,
                        correctAnswer: type === 'true_false' ? 'True' : type === 'mcq' ? 'Option A' : undefined,
                      };
                      setNewQuestions(next);
                    }}
                    className="px-2.5 py-1.5 text-xs rounded bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/20"
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="true_false">True / False</option>
                    <option value="written">Written</option>
                    <option value="scenario">Scenario-Based</option>
                  </select>
                  <input
                    type="number"
                    min={5}
                    value={q.points}
                    onChange={(e) => {
                      const next = [...newQuestions];
                      next[idx] = { ...q, points: Number(e.target.value) };
                      setNewQuestions(next);
                    }}
                    className="w-24 px-2.5 py-1.5 text-xs font-mono-tabular rounded bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/20"
                  />
                  <span className="text-xs text-slate-400">pts</span>
                </div>
                <input
                  required
                  value={q.prompt}
                  onChange={(e) => {
                    const next = [...newQuestions];
                    next[idx] = { ...q, prompt: e.target.value };
                    setNewQuestions(next);
                  }}
                  placeholder="Enter question prompt..."
                  className="w-full px-3 py-2 text-xs rounded bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/20"
                />
                {q.type === 'mcq' && q.options && (
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt, oi) => (
                      <input
                        key={oi}
                        value={opt}
                        onChange={(e) => {
                          const next = [...newQuestions];
                          const opts = [...(q.options || [])];
                          opts[oi] = e.target.value;
                          next[idx] = { ...q, options: opts, correctAnswer: oi === 0 ? e.target.value : q.correctAnswer };
                          setNewQuestions(next);
                        }}
                        placeholder={`Option ${oi + 1}`}
                        className="px-2.5 py-1.5 text-xs rounded bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/20"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between">
              <SecondaryButton
                size="sm"
                type="button"
                onClick={() =>
                  setNewQuestions([
                    ...newQuestions,
                    { id: `q-new-${Date.now()}`, type: 'written', prompt: '', points: 50 },
                  ])
                }
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'إضافة سؤال' : 'Add Question'}</span>
              </SecondaryButton>
              <div className="flex gap-2">
                <SecondaryButton size="sm" type="button" onClick={() => setShowBuilder(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </SecondaryButton>
                <PrimaryButton size="sm" type="submit">
                  {isAr ? 'نشر الاختبار' : 'Publish Assessment'}
                </PrimaryButton>
              </div>
            </div>
          </form>
        </SurfaceCard>
      )}

      {/* Active Timed Assessment Runner */}
      {activeAttempt && activeAssessment ? (
        <SurfaceCard elevated className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-blue-500/20">
            <div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {isAr && activeAssessment.titleAr ? activeAssessment.titleAr : activeAssessment.title}
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {activeQuestions.length} {isAr ? 'أسئلة' : 'questions'}
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono-tabular text-sm font-semibold text-[#1D7AFC] dark:text-[#00D4FF]">
              <Clock className="w-4 h-4" />
              <span>
                {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                {String(secondsLeft % 60).padStart(2, '0')}
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {activeQuestions.map((q, idx) => (
              <div key={q.id} className="space-y-2.5 pb-5 border-b border-slate-200 dark:border-blue-500/15 last:border-0">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Question 0{idx + 1} · {q.type.replace('_', '/')}
                  </span>
                  <span className="font-mono-tabular">{q.points} pts</span>
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {isAr && q.promptAr ? q.promptAr : q.prompt}
                </p>

                {q.options ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswersMap({ ...answersMap, [q.id]: opt })}
                        className={`text-start px-3.5 py-2.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                          answersMap[q.id] === opt
                            ? 'bg-[#1D7AFC]/15 border-[#00D4FF] text-slate-900 dark:text-white font-semibold'
                            : 'bg-white dark:bg-[#091124] border-slate-200 dark:border-blue-500/20 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    rows={4}
                    value={answersMap[q.id] || ''}
                    onChange={(e) => setAnswersMap({ ...answersMap, [q.id]: e.target.value })}
                    placeholder={isAr ? 'اكتب إجابتك هنا...' : 'Write your response...'}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={() => setActiveAttempt(null)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </SecondaryButton>
            <PrimaryButton onClick={handleSubmitAttempt}>
              {isAr ? 'إرسال الإجابات' : 'Submit Assessment'}
            </PrimaryButton>
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Available Assessments */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              {isAr ? 'الاختبارات المتاحة' : 'Assigned & Available Assessments'}
            </h3>
            {assessments.map((asm) => {
              const myAttempts = attempts.filter(
                (a) => a.assessmentId === asm.id && a.userId === currentUser.id
              );
              return (
                <SurfaceCard key={asm.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">
                      {isAr && asm.titleAr ? asm.titleAr : asm.title}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{asm.description}</p>
                    <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                      {asm.category} · {asm.timeLimitMinutes} min · {asm.questions.length} Qs ·{' '}
                      <span className="font-mono-tabular">
                        {myAttempts.length}/{asm.maxAttempts} attempts
                      </span>
                    </div>
                  </div>
                  <PrimaryButton
                    size="sm"
                    disabled={!currentUser.humanVerified || myAttempts.length >= asm.maxAttempts}
                    onClick={() => handleStartAssessment(asm)}
                  >
                    {isAr ? 'بدء الاختبار' : 'Start Test'}
                  </PrimaryButton>
                </SurfaceCard>
              );
            })}
          </div>

          {/* Results & Supervisor Grading Queue */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              {isPrivileged
                ? isAr
                  ? 'سجل النتائج وطابور التقييم اليدوي'
                  : 'Results & Grading Queue'
                : isAr
                ? 'سجل نتائجي'
                : 'My Performance History'}
            </h3>
            <SurfaceCard className="divide-y divide-slate-200 dark:divide-blue-500/15">
              {attempts.map((att) => {
                const asm = assessments.find((a) => a.id === att.assessmentId);
                return (
                  <div key={att.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {userNameMap.get(att.userId) || currentUser.fullName} · {asm?.title || att.assessmentId}
                      </span>
                      <span className="font-mono-tabular text-xs font-bold text-[#1D7AFC] dark:text-[#00D4FF]">
                        {att.totalScore}/{att.maxScore}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        {att.status === 'graded'
                          ? att.passed
                            ? 'Passed'
                            : 'Needs Review / Failed'
                          : 'Pending Manual Review'}
                      </span>
                      {isPrivileged && att.status === 'pending_review' && (
                        <button
                          type="button"
                          onClick={() => {
                            setGradingAttempt(att);
                            const init: Record<string, { points: number; feedback: string }> = {};
                            att.answers.forEach((a) => {
                              init[a.questionId] = { points: a.pointsAwarded, feedback: a.feedback || '' };
                            });
                            setGradeInputs(init);
                          }}
                          className="text-[#1D7AFC] dark:text-[#00D4FF] font-semibold hover:underline cursor-pointer"
                        >
                          {isAr ? 'تقييم الإجابات' : 'Grade Submission'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </SurfaceCard>

            {gradingAttempt && (
              <SurfaceCard elevated className="p-5 space-y-4">
                <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Manual Grading · {userNameMap.get(gradingAttempt.userId)}
                </h4>
                <form onSubmit={handleSubmitGrade} className="space-y-4">
                  {gradingAttempt.answers.map((ans) => {
                    const asm = assessments.find((a) => a.id === gradingAttempt.assessmentId);
                    const q = asm?.questions.find((item) => item.id === ans.questionId);
                    if (!q || (q.type !== 'written' && q.type !== 'scenario')) return null;
                    return (
                      <div key={ans.questionId} className="space-y-2 text-xs">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{q.prompt}</div>
                        <div className="p-2.5 rounded bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/20 text-slate-600 dark:text-slate-300">
                          {ans.answer || '(No response)'}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={0}
                            max={q.points}
                            value={gradeInputs[q.id]?.points ?? 0}
                            onChange={(e) =>
                              setGradeInputs({
                                ...gradeInputs,
                                [q.id]: { ...gradeInputs[q.id], points: Number(e.target.value) },
                              })
                            }
                            className="w-24 px-2 py-1 rounded bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/20 font-mono-tabular"
                          />
                          <input
                            value={gradeInputs[q.id]?.feedback ?? ''}
                            onChange={(e) =>
                              setGradeInputs({
                                ...gradeInputs,
                                [q.id]: { ...gradeInputs[q.id], feedback: e.target.value },
                              })
                            }
                            placeholder="Reviewer feedback..."
                            className="flex-1 px-2 py-1 rounded bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/20"
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-end gap-2">
                    <SecondaryButton size="sm" type="button" onClick={() => setGradingAttempt(null)}>
                      Cancel
                    </SecondaryButton>
                    <PrimaryButton size="sm" type="submit">
                      Finalize Grade
                    </PrimaryButton>
                  </div>
                </form>
              </SurfaceCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
