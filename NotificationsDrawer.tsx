import React from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { SecondaryButton } from '../design-system/components';
import type { Language, NavTab } from '../lib/i18n';
import type { NotificationItem } from '../lib/types';

interface NotificationsDrawerProps {
  open: boolean;
  lang: Language;
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkAllRead: () => Promise<void>;
  onNavigate: (tab: NavTab) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  lang,
  notifications,
  onClose,
  onMarkAllRead,
  onNavigate,
}) => {
  if (!open) return null;
  const isAr = lang === 'ar';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-md h-full bg-white dark:bg-[#091124] border-s border-slate-200 dark:border-blue-500/20 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-blue-500/15 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-semibold text-slate-900 dark:text-white">
            <Bell className="w-4 h-4 text-[#1D7AFC] dark:text-[#00D4FF]" />
            <span>{isAr ? 'مركز الإشعارات' : 'Notifications Center'}</span>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton size="sm" onClick={onMarkAllRead}>
              <CheckCheck className="w-3.5 h-3.5" />
              <span>{isAr ? 'تحديد الكل كمقروء' : 'Mark Read'}</span>
            </SecondaryButton>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-blue-500/15">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              {isAr ? 'لا توجد إشعارات جديدة.' : 'You are all caught up.'}
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (n.targetTab) onNavigate(n.targetTab as NavTab);
                  onClose();
                }}
                className={`w-full text-start p-4 hover:bg-slate-50 dark:hover:bg-[#0e1934] transition-colors cursor-pointer ${
                  n.read ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">{n.title}</span>
                  <span className="font-mono-tabular text-[11px] text-slate-500">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{n.body}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
