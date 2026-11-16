import React, { useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { PrimaryButton } from '../design-system/components';
import { apiRequest } from '../lib/api';
import type { Language } from '../lib/i18n';

interface AiAssistantWidgetProps {
  lang: Language;
}

export const AiAssistantWidget: React.FC<AiAssistantWidgetProps> = ({ lang }) => {
  const isAr = lang === 'ar';
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: isAr
        ? 'مرحباً! أنا مساعد KAVIRO الذكي. يمكنني مساعدتك في السيرة الذاتية، الاختبارات، المهام، والاجتماعات بالعربية أو الإنجليزية.'
        : 'Hello! I am KAVIRO AI. Ask me in Arabic or English about your CV, assessments, tasks, meetings, or workspace workflows.',
    },
  ]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    try {
      const res = await apiRequest<{ reply: string }>('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory,
        }),
      });
      setMessages([...nextHistory, { role: 'assistant', text: res.reply }]);
    } catch (err: any) {
      setMessages([
        ...nextHistory,
        {
          role: 'assistant',
          text: err.message || 'Unable to reach KAVIRO AI right now.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 end-5 z-40 no-print">
      {open ? (
        <div className="w-[340px] sm:w-[390px] h-[480px] rounded-2xl bg-white dark:bg-[#091124] border border-slate-200 dark:border-blue-500/30 shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-[#02050d] border-b border-blue-500/20 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#00D4FF]" />
              <span className="font-display text-sm font-semibold">KAVIRO AI</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
              aria-label="Close AI assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 p-3.5 space-y-3 overflow-y-auto">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'ms-8 bg-[#1D7AFC]/15 border border-blue-500/30 text-slate-900 dark:text-white'
                    : 'me-6 bg-slate-100 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20 text-slate-800 dark:text-slate-200'
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="text-xs text-[#1D7AFC] dark:text-[#00D4FF] px-2">
                {isAr ? 'جاري التفكير...' : 'Thinking...'}
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-blue-500/15 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isAr ? 'اسأل KAVIRO AI...' : 'Ask KAVIRO AI in EN or AR...'}
              className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
            />
            <PrimaryButton size="sm" type="submit" disabled={loading}>
              <Send className="w-3.5 h-3.5" />
            </PrimaryButton>
          </form>
        </div>
      ) : (
        <PrimaryButton
          onClick={() => setOpen(true)}
          className="rounded-full px-4 py-3 shadow-[0_12px_30px_-8px_rgba(0,212,255,0.65)]"
        >
          <Bot className="w-4 h-4" />
          <span>{isAr ? 'مساعد KAVIRO' : 'KAVIRO AI'}</span>
        </PrimaryButton>
      )}
    </div>
  );
};
