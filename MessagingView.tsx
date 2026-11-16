import React, { useEffect, useRef, useState } from 'react';
import { Megaphone, Paperclip, Pin, Plus, Reply, Search, Send, Users } from 'lucide-react';
import { PrimaryButton, SecondaryButton, SectionHeader, SurfaceCard } from '../design-system/components';
import { apiRequest } from '../lib/api';
import type { Language } from '../lib/i18n';
import type { ChatAttachment, ChatMessage, Conversation, UserProfile } from '../lib/types';

interface MessagingViewProps {
  lang: Language;
  currentUser: UserProfile;
  users: UserProfile[];
  onlineUserIds: string[];
  wsEvents: { event: string; payload: any; seq: number } | null;
  sendWsTyping: (conversationId: string, isTyping: boolean) => void;
}

export const MessagingView: React.FC<MessagingViewProps> = ({
  lang,
  currentUser,
  users,
  onlineUserIds,
  wsEvents,
  sendWsTyping,
}) => {
  const isAr = lang === 'ar';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftText, setDraftText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [attachment, setAttachment] = useState<ChatAttachment | undefined>(undefined);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [showNewModal, setShowNewModal] = useState(false);
  const [newChatType, setNewChatType] = useState<'direct' | 'group'>('group');
  const [newChatName, setNewChatName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [showGroupPanel, setShowGroupPanel] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const onlineSet = new Set(onlineUserIds);

  const loadConversations = async () => {
    const res = await apiRequest<{ conversations: Conversation[] }>('/api/conversations');
    setConversations(res.conversations);
    if (!selectedId && res.conversations.length > 0) {
      setSelectedId(res.conversations[0].id);
    }
  };

  const loadMessages = async (convId: string, q = searchQuery) => {
    const res = await apiRequest<{ messages: ChatMessage[] }>(
      `/api/conversations/${convId}/messages${q ? `?q=${encodeURIComponent(q)}` : ''}`
    );
    setMessages(res.messages);
    await apiRequest(`/api/conversations/${convId}/read`, { method: 'POST' });
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
      const conv = conversations.find((c) => c.id === selectedId);
      setAnnouncementInput(conv?.announcement || '');
    }
  }, [selectedId]);

  useEffect(() => {
    if (!wsEvents) return;
    const { event, payload } = wsEvents;
    if (event === 'message:new' && payload.conversationId === selectedId) {
      setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]));
      apiRequest(`/api/conversations/${selectedId}/read`, { method: 'POST' }).catch(() => {});
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
    } else if (event === 'message:reaction') {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m))
      );
    } else if (event === 'message:read' && payload.conversationId === selectedId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.readBy.includes(payload.userId) ? m : { ...m, readBy: [...m.readBy, payload.userId] }
        )
      );
    } else if (event === 'typing:update' && payload.conversationId === selectedId) {
      setTypingUsers((prev) => ({ ...prev, [payload.userId]: payload.isTyping }));
    } else if (event === 'conversation:new' || event === 'conversation:updated') {
      loadConversations();
    }
  }, [wsEvents, selectedId]);

  const activeConv = conversations.find((c) => c.id === selectedId) || null;
  const isGroupAdmin =
    activeConv && (activeConv.adminIds.includes(currentUser.id) || currentUser.role === 'admin');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || (!draftText.trim() && !attachment)) return;
    const content = draftText.trim();
    setDraftText('');
    setReplyTo(null);
    const attached = attachment;
    setAttachment(undefined);
    sendWsTyping(selectedId, false);
    await apiRequest(`/api/conversations/${selectedId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        replyToId: replyTo?.id,
        attachment: attached,
      }),
    });
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 2_000_000) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest<{ conversation: Conversation }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        type: newChatType,
        name: newChatType === 'group' ? newChatName : undefined,
        memberIds: selectedMembers,
      }),
    });
    setShowNewModal(false);
    setNewChatName('');
    setSelectedMembers([]);
    await loadConversations();
    setSelectedId(res.conversation.id);
  };

  const handlePinToggle = async (messageId: string) => {
    if (!activeConv) return;
    await apiRequest(`/api/conversations/${activeConv.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ togglePinMessageId: messageId }),
    });
  };

  const handleUpdateAnnouncement = async () => {
    if (!activeConv) return;
    await apiRequest(`/api/conversations/${activeConv.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ announcement: announcementInput }),
    });
  };

  const activeTypers = Object.entries(typingUsers)
    .filter(([uid, active]) => active && uid !== currentUser.id)
    .map(([uid]) => userMap.get(uid)?.fullName || 'Someone');

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isAr ? 'المراسلات الفورية والقنوات' : 'Real-Time Team Messaging'}
        subtitle={
          isAr
            ? 'محادثات خاصة ومجموعات فريق مع مؤشرات الكتابة وتأكيدات القراءة وتبادل الملفات.'
            : 'Direct messages and group channels powered by live WebSockets with typing indicators, read receipts, replies, and shared files.'
        }
        action={
          <PrimaryButton size="sm" onClick={() => setShowNewModal(!showNewModal)}>
            <Plus className="w-3.5 h-3.5" />
            <span>{isAr ? 'محادثة / مجموعة جديدة' : 'New Chat / Group'}</span>
          </PrimaryButton>
        }
      />

      {showNewModal && (
        <SurfaceCard elevated className="p-5">
          <form onSubmit={handleCreateConversation} className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={newChatType}
                onChange={(e) => setNewChatType(e.target.value as 'direct' | 'group')}
                className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
              >
                <option value="group">Team Group</option>
                <option value="direct">Direct Message</option>
              </select>
              {newChatType === 'group' && (
                <input
                  required
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="Channel name (e.g. Design Review)"
                  className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
                />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {users
                .filter((u) => u.id !== currentUser.id)
                .map((u) => {
                  const chosen = selectedMembers.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setSelectedMembers(
                          newChatType === 'direct'
                            ? [u.id]
                            : chosen
                            ? selectedMembers.filter((id) => id !== u.id)
                            : [...selectedMembers, u.id]
                        )
                      }
                      className={`px-3 py-1.5 text-xs rounded-lg border cursor-pointer ${
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
              <SecondaryButton size="sm" type="button" onClick={() => setShowNewModal(false)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton size="sm" type="submit" disabled={selectedMembers.length === 0}>
                Create
              </PrimaryButton>
            </div>
          </form>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[540px]">
        {/* Channels & DM List */}
        <SurfaceCard className="lg:col-span-4 p-3 flex flex-col gap-2">
          <div className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'القنوات والمحادثات' : 'Channels & Direct Messages'}
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[480px]">
            {conversations.map((conv) => {
              const otherId =
                conv.type === 'direct'
                  ? conv.memberIds.find((id) => id !== currentUser.id)
                  : undefined;
              const isOnline = otherId ? onlineSet.has(otherId) : false;
              const active = conv.id === selectedId;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-start px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    active
                      ? 'bg-[#1D7AFC]/15 border border-blue-500/35 text-slate-900 dark:text-white'
                      : 'hover:bg-slate-100 dark:hover:bg-[#0e1934] text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">
                      {conv.type === 'group' ? `# ${conv.name}` : userMap.get(otherId || '')?.fullName || conv.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {conv.memberIds.length} members · {conv.type}
                    </div>
                  </div>
                  {conv.type === 'direct' && (
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                      title={isOnline ? 'Online' : 'Offline'}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </SurfaceCard>

        {/* Active Chat Thread */}
        <SurfaceCard className="lg:col-span-8 flex flex-col overflow-hidden">
          {activeConv ? (
            <>
              <div className="px-4 py-3 border-b border-slate-200 dark:border-blue-500/15 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">
                    {activeConv.type === 'group' ? `# ${activeConv.name}` : activeConv.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {activeConv.memberIds.length} members
                    {activeConv.pinnedMessageIds.length > 0 && ` · ${activeConv.pinnedMessageIds.length} pinned`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2 start-2.5" />
                    <input
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (selectedId) loadMessages(selectedId, e.target.value);
                      }}
                      placeholder={isAr ? 'بحث في الرسائل...' : 'Search messages...'}
                      className="ps-8 pe-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/20"
                    />
                  </div>
                  {activeConv.type === 'group' && (
                    <SecondaryButton size="sm" onClick={() => setShowGroupPanel(!showGroupPanel)}>
                      <Users className="w-3.5 h-3.5" />
                      <span>{isAr ? 'إدارة المجموعة' : 'Group Info'}</span>
                    </SecondaryButton>
                  )}
                </div>
              </div>

              {activeConv.announcement && (
                <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 text-xs text-blue-700 dark:text-cyan-300 flex items-center gap-2">
                  <Megaphone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{activeConv.announcement}</span>
                </div>
              )}

              {showGroupPanel && activeConv.type === 'group' && (
                <div className="p-4 bg-slate-50 dark:bg-[#0e1934] border-b border-slate-200 dark:border-blue-500/20 space-y-3 text-xs">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {isAr ? 'إعلان المجموعة والمشرفون' : 'Group Announcement & Members'}
                  </div>
                  {isGroupAdmin && (
                    <div className="flex gap-2">
                      <input
                        value={announcementInput}
                        onChange={(e) => setAnnouncementInput(e.target.value)}
                        placeholder="Broadcast announcement to group..."
                        className="flex-1 px-3 py-1.5 rounded bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/20"
                      />
                      <PrimaryButton size="sm" type="button" onClick={handleUpdateAnnouncement}>
                        Update
                      </PrimaryButton>
                    </div>
                  )}
                  <div className="text-slate-600 dark:text-slate-300">
                    Members: {activeConv.memberIds.map((id) => userMap.get(id)?.fullName).filter(Boolean).join(' · ')}
                  </div>
                </div>
              )}

              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[380px]">
                {messages.map((msg) => {
                  const sender = userMap.get(msg.senderId);
                  const isMine = msg.senderId === currentUser.id;
                  const isPinned = activeConv.pinnedMessageIds.includes(msg.id);
                  const repliedMsg = msg.replyToId ? messages.find((m) => m.id === msg.replyToId) : undefined;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-xl px-3.5 py-2.5 border ${
                          isMine
                            ? 'bg-[#1D7AFC]/15 border-blue-500/35 text-slate-900 dark:text-white'
                            : 'bg-slate-50 dark:bg-[#0e1934] border-slate-200 dark:border-blue-500/20 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {sender?.fullName || 'Member'}
                          </span>
                          <span className="font-mono-tabular">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isPinned && ' · Pinned'}
                          </span>
                        </div>

                        {repliedMsg && (
                          <div className="mt-1 px-2 py-1 rounded bg-slate-200/60 dark:bg-[#091124] text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            ↩ {repliedMsg.content}
                          </div>
                        )}

                        {msg.content && <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>}

                        {msg.attachment && (
                          <a
                            href={msg.attachment.dataUrl}
                            download={msg.attachment.name}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#1D7AFC] dark:text-[#00D4FF] underline"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>{msg.attachment.name}</span>
                          </a>
                        )}

                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() =>
                              apiRequest(`/api/messages/${msg.id}/react`, {
                                method: 'POST',
                                body: JSON.stringify({ emoji: '👍' }),
                              })
                            }
                            className="hover:text-[#00D4FF] cursor-pointer"
                          >
                            👍 {msg.reactions['👍']?.length || 0}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyTo(msg)}
                            className="hover:text-[#00D4FF] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Reply className="w-3 h-3" />
                            <span>Reply</span>
                          </button>
                          {isGroupAdmin && (
                            <button
                              type="button"
                              onClick={() => handlePinToggle(msg.id)}
                              className="hover:text-[#00D4FF] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Pin className="w-3 h-3" />
                              <span>{isPinned ? 'Unpin' : 'Pin'}</span>
                            </button>
                          )}
                          {isMine && (
                            <span className="ms-auto">
                              {msg.readBy.length > 1 ? 'Read' : 'Sent'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {activeTypers.length > 0 && (
                <div className="px-4 py-1 text-[11px] text-[#1D7AFC] dark:text-[#00D4FF]">
                  {activeTypers.join(', ')} {isAr ? 'يكتب الآن...' : 'is typing...'}
                </div>
              )}

              {replyTo && (
                <div className="px-4 py-1.5 bg-slate-100 dark:bg-[#0e1934] text-xs flex items-center justify-between">
                  <span className="truncate text-slate-600 dark:text-slate-300">
                    Replying to: {replyTo.content}
                  </span>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-rose-500 cursor-pointer">
                    ×
                  </button>
                </div>
              )}

              <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-blue-500/15 flex items-center gap-2">
                <label className="p-2 rounded-lg bg-slate-100 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/20 text-slate-600 dark:text-slate-300 cursor-pointer">
                  <Paperclip className="w-4 h-4" />
                  <input type="file" onChange={handleFilePick} className="hidden" />
                </label>
                <input
                  value={draftText}
                  onChange={(e) => {
                    setDraftText(e.target.value);
                    if (selectedId) sendWsTyping(selectedId, e.target.value.length > 0);
                  }}
                  placeholder={
                    attachment
                      ? `Attached: ${attachment.name} — add note...`
                      : isAr
                      ? 'اكتب رسالتك...'
                      : 'Write a message...'
                  }
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-900 dark:text-white"
                />
                <PrimaryButton size="sm" type="submit">
                  <Send className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إرسال' : 'Send'}</span>
                </PrimaryButton>
              </form>
            </>
          ) : (
            <div className="p-8 text-sm text-slate-400">Select a conversation to begin.</div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
};
