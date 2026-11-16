import React, { useEffect, useState } from 'react';
import { Calendar, Download, ExternalLink, Link2, Plus, Video } from 'lucide-react';
import { PrimaryButton, SecondaryButton, SectionHeader, SurfaceCard } from '../design-system/components';
import { apiRequest, getAuthToken } from '../lib/api';
import type { Language } from '../lib/i18n';
import type { IntegrationConfig, Meeting, UserProfile } from '../lib/types';

interface MeetingsIntegrationsViewProps {
  lang: Language;
  currentUser: UserProfile;
  users: UserProfile[];
}

export const MeetingsIntegrationsView: React.FC<MeetingsIntegrationsViewProps> = ({
  lang,
  currentUser,
  users,
}) => {
  const isAr = lang === 'ar';
  const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'supervisor';

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [provider, setProvider] = useState<'internal' | 'google_meet' | 'zoom'>('internal');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Real credential verification forms
  const [googleToken, setGoogleToken] = useState('');
  const [zoomAccountId, setZoomAccountId] = useState('');
  const [zoomClientId, setZoomClientId] = useState('');
  const [zoomClientSecret, setZoomClientSecret] = useState('');

  const loadData = async () => {
    const res = await apiRequest<{ meetings: Meeting[]; integrations: IntegrationConfig[] }>('/api/meetings');
    setMeetings(res.meetings);
    setIntegrations(res.integrations);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          provider,
          meetingUrl: meetingUrl || undefined,
          participantIds: participants,
        }),
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setMeetingUrl('');
      loadData();
      setNotice(isAr ? 'تمت جدولة الاجتماع وإرسال الدعوات.' : 'Meeting scheduled and invitations sent.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVerifyIntegration = async (prov: 'google' | 'zoom') => {
    setError(null);
    setNotice(null);
    try {
      await apiRequest('/api/integrations/verify', {
        method: 'POST',
        body: JSON.stringify(
          prov === 'google'
            ? { provider: 'google', accessToken: googleToken }
            : {
                provider: 'zoom',
                zoomAccountId,
                zoomClientId,
                zoomClientSecret,
              }
        ),
      });
      setNotice(`${prov === 'google' ? 'Google' : 'Zoom'} credentials verified and connected.`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDownloadIcs = async (meetingId: string) => {
    const res = await fetch(`/api/meetings/${meetingId}/ics`, {
      headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
    });
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meetingId}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const googleCfg = integrations.find((i) => i.provider === 'google');
  const zoomCfg = integrations.find((i) => i.provider === 'zoom');

  return (
    <div className="space-y-6">
      <SectionHeader
        title={isAr ? 'الاجتماعات وتكامل Google و Zoom' : 'Meetings, Calendar & Integrations'}
        subtitle={
          isAr
            ? 'جدولة اجتماعات الفريق وتصدير ملفات التقويم (.ics) والتحقق الحقيقي من اتصال Google و Zoom.'
            : 'Schedule team meetings, download .ics calendar invites, and verify authentic Google and Zoom OAuth credentials.'
        }
        action={
          <PrimaryButton size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-3.5 h-3.5" />
            <span>{isAr ? 'جدولة اجتماع' : 'Schedule Meeting'}</span>
          </PrimaryButton>
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

      {showCreate && (
        <SurfaceCard elevated className="p-6">
          <form onSubmit={handleCreateMeeting} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isAr ? 'عنوان الاجتماع' : 'Meeting title'}
                className="sm:col-span-2 px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
              />
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
              >
                <option value="internal">KAVIRO Workspace Calendar</option>
                <option value="google_meet">Google Meet</option>
                <option value="zoom">Zoom</option>
              </select>
              <input
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="Join URL (optional if internal)"
                className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                required
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-3 py-2 text-xs font-mono-tabular rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                required
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="px-3 py-2 text-xs font-mono-tabular rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agenda..."
                className="sm:col-span-2 px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {users
                .filter((u) => u.id !== currentUser.id)
                .map((u) => {
                  const chosen = participants.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setParticipants(
                          chosen ? participants.filter((id) => id !== u.id) : [...participants, u.id]
                        )
                      }
                      className={`px-3 py-1 text-xs rounded-lg border cursor-pointer ${
                        chosen
                          ? 'bg-[#1D7AFC]/15 border-[#00D4FF] text-slate-900 dark:text-white'
                          : 'bg-white dark:bg-[#091124] border-slate-200 dark:border-blue-500/20 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {u.fullName}
                    </button>
                  );
                })}
            </div>

            <div className="flex justify-end gap-2">
              <SecondaryButton size="sm" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton size="sm" type="submit">
                Schedule
              </PrimaryButton>
            </div>
          </form>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upcoming Meetings */}
        <SurfaceCard className="lg:col-span-7 p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            {isAr ? 'الاجتماعات القادمة' : 'Upcoming Team Schedule'}
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-blue-500/15">
            {meetings.map((m) => (
              <div key={m.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#1D7AFC] dark:text-[#00D4FF]" />
                    <span>{m.title}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{m.description}</p>
                  <div className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                    {new Date(m.startTime).toLocaleString()} · {m.provider} · {m.participantIds.length} participants
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SecondaryButton size="sm" onClick={() => handleDownloadIcs(m.id)}>
                    <Download className="w-3.5 h-3.5" />
                    <span>.ICS</span>
                  </SecondaryButton>
                  {m.meetingUrl && (
                    <a href={m.meetingUrl} target="_blank" rel="noreferrer">
                      <PrimaryButton size="sm" type="button">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Join</span>
                      </PrimaryButton>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        {/* Honest Google & Zoom Integration Cards */}
        <div className="lg:col-span-5 space-y-4">
          <SurfaceCard className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-base font-semibold text-slate-900 dark:text-white">
                <Link2 className="w-4 h-4 text-[#1D7AFC] dark:text-[#00D4FF]" />
                <span>Google Workspace & Calendar</span>
              </div>
              <span
                className={`text-xs font-semibold ${
                  googleCfg?.connected ? 'text-emerald-500' : 'text-amber-500'
                }`}
              >
                {googleCfg?.connected ? 'Connected (Verified)' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">{googleCfg?.note}</p>
            {isPrivileged && !googleCfg?.connected && (
              <div className="space-y-2 pt-2">
                <input
                  value={googleToken}
                  onChange={(e) => setGoogleToken(e.target.value)}
                  placeholder="Paste verified Google OAuth2 Access Token..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
                />
                <SecondaryButton size="sm" onClick={() => handleVerifyIntegration('google')}>
                  Verify Google OAuth Token
                </SecondaryButton>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-base font-semibold text-slate-900 dark:text-white">
                <Video className="w-4 h-4 text-[#1D7AFC] dark:text-[#00D4FF]" />
                <span>Zoom Meetings API</span>
              </div>
              <span
                className={`text-xs font-semibold ${
                  zoomCfg?.connected ? 'text-emerald-500' : 'text-amber-500'
                }`}
              >
                {zoomCfg?.connected ? 'Connected (Verified)' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">{zoomCfg?.note}</p>
            {isPrivileged && !zoomCfg?.connected && (
              <div className="space-y-2 pt-2">
                <input
                  value={zoomAccountId}
                  onChange={(e) => setZoomAccountId(e.target.value)}
                  placeholder="Zoom Account ID"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
                />
                <input
                  value={zoomClientId}
                  onChange={(e) => setZoomClientId(e.target.value)}
                  placeholder="Zoom Client ID"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
                />
                <input
                  type="password"
                  value={zoomClientSecret}
                  onChange={(e) => setZoomClientSecret(e.target.value)}
                  placeholder="Zoom Client Secret"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
                />
                <SecondaryButton size="sm" onClick={() => handleVerifyIntegration('zoom')}>
                  Verify Zoom Credentials
                </SecondaryButton>
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
};
