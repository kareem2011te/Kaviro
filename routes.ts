import crypto from 'node:crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import JSZip from 'jszip';
import { getDb, saveDb } from './store.ts';
import type { SafeUser, SupervisorPermissions, User, UserCv, UserRole } from './types.ts';
import {
  createCaptchaChallenge,
  extractBearerToken,
  generateNumericCode,
  generateSessionToken,
  getClientIp,
  hashPassword,
  hashToken,
  parseUserAgent,
  rateLimit,
  sanitizeUser,
  verifyCaptchaChallenge,
  verifyPassword,
} from './security.ts';
import { analyzeCvWithGemini, runKaviroAssistant } from './ai.ts';
import {
  broadcastToUsers,
  forceDisconnectSession,
  getOnlineUserIds,
} from './realtime.ts';
import { buildProjectZipBuffer } from './exporter.ts';

interface AuthedRequest extends Request {
  authUser?: User;
  safeUser?: SafeUser;
  sessionId?: string;
}

function addAudit(actorId: string, action: string, targetType: string, targetId: string, details: string, req: Request) {
  const db = getDb();
  db.auditLogs.unshift({
    id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    actorId,
    action,
    targetType,
    targetId,
    details,
    ipAddress: getClientIp(req),
    createdAt: new Date().toISOString(),
  });
  if (db.auditLogs.length > 500) db.auditLogs.length = 500;
}

function pushNotification(params: {
  userId: string;
  category: 'meeting' | 'task' | 'message' | 'announcement' | 'assessment' | 'security' | 'application';
  title: string;
  body: string;
  targetTab?: string;
}) {
  const db = getDb();
  const notif = {
    id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
    userId: params.userId,
    category: params.category,
    title: params.title,
    body: params.body,
    read: false,
    createdAt: new Date().toISOString(),
    targetTab: params.targetTab,
  };
  db.notifications.unshift(notif);
  broadcastToUsers([params.userId], 'notification:new', notif);
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const db = getDb();
  const tokenHash = hashToken(token);
  const session = db.sessions.find((s) => s.tokenHash === tokenHash && s.status === 'active');
  if (!session) {
    return res.status(401).json({ error: 'Session expired or revoked' });
  }
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Account not found' });
  }
  if (user.status === 'suspended' || user.status === 'rejected') {
    return res.status(403).json({ error: 'Account access is suspended or rejected' });
  }
  session.lastActivityAt = new Date().toISOString();
  user.lastActiveAt = session.lastActivityAt;
  req.authUser = user;
  req.safeUser = sanitizeUser(user);
  req.sessionId = session.id;
  next();
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

function hasPermission(user: SafeUser, perm: keyof SupervisorPermissions): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'supervisor') {
    return Boolean((user.supervisorPermissions || DEFAULT_SUPERVISOR_PERMS)[perm]);
  }
  return false;
}

function requireRole(roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.safeUser || !roles.includes(req.safeUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}

function requirePermission(perm: keyof SupervisorPermissions) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.safeUser || !hasPermission(req.safeUser, perm)) {
      return res.status(403).json({ error: `Missing permission: ${perm}` });
    }
    next();
  };
}

function createSessionForUser(user: User, req: Request) {
  const db = getDb();
  const { rawToken, tokenHash } = generateSessionToken();
  const ua = parseUserAgent(req.headers['user-agent']);
  const pastSessions = db.sessions.filter((s) => s.userId === user.id);
  const knownCombo = pastSessions.some((s) => s.browser === ua.browser && s.os === ua.os);
  const isUnusual = pastSessions.length > 0 && !knownCombo;

  const session = {
    id: `ses-${crypto.randomUUID().slice(0, 8)}`,
    userId: user.id,
    tokenHash,
    deviceType: ua.deviceType,
    browser: ua.browser,
    os: ua.os,
    ipAddress: getClientIp(req),
    loginAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    status: 'active' as const,
    isUnusual,
    alertReason: isUnusual ? `New ${ua.os} / ${ua.browser} sign-in detected` : undefined,
  };

  db.sessions.unshift(session);

  if (isUnusual) {
    const supervisors = db.users.filter((u) => u.role === 'admin' || u.role === 'supervisor');
    for (const sup of supervisors) {
      pushNotification({
        userId: sup.id,
        category: 'security',
        title: 'Unusual Login Detected',
        body: `${user.fullName} signed in from ${ua.browser} on ${ua.os} (${ua.deviceType}).`,
        targetTab: 'security',
      });
    }
  }

  return { rawToken, session };
}

export function registerRoutes(app: Express): void {
  const authLimiter = rateLimit(30, 60_000);
  const aiLimiter = rateLimit(20, 60_000);

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, platform: 'KAVIRO', timestamp: new Date().toISOString() });
  });

  // ==================== AUTH & ONBOARDING ====================
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const {
      fullName,
      email,
      password,
      phone,
      whatsapp,
      avatarUrl,
      desiredRole,
      department,
      skills,
      interests,
      preferredLanguage,
    } = req.body || {};

    if (!fullName || !email || !password || !phone || !desiredRole) {
      return res.status(400).json({ error: 'Full name, email, password, phone, and desired role are required.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const db = getDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const verificationCode = generateNumericCode(6);
    const now = new Date().toISOString();
    const newUser: User = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(String(password)),
      phone: String(phone).trim(),
      whatsapp: whatsapp ? String(whatsapp).trim() : undefined,
      avatarUrl: avatarUrl ? String(avatarUrl) : undefined,
      desiredRole: String(desiredRole).trim(),
      department: department ? String(department).trim() : 'General Operations',
      skills: Array.isArray(skills) ? skills.map(String) : [],
      interests: Array.isArray(interests) ? interests.map(String) : [],
      role: 'member',
      status: 'pending',
      emailVerified: false,
      emailVerificationCode: verificationCode,
      twoFactorEnabled: false,
      humanVerified: false,
      onboarding: {
        profileCompleted: true,
        cvCompleted: false,
        humanVerified: false,
        assessmentCompleted: false,
        applicationSubmitted: false,
      },
      preferredLanguage: preferredLanguage === 'ar' ? 'ar' : 'en',
      createdAt: now,
      lastActiveAt: now,
    };

    db.users.push(newUser);
    addAudit(newUser.id, 'USER_REGISTERED', 'user', newUser.id, `New member registered: ${newUser.email}`, req);

    // Notify supervisors/admins
    for (const sup of db.users.filter((u) => u.role === 'admin' || u.role === 'supervisor')) {
      pushNotification({
        userId: sup.id,
        category: 'application',
        title: 'New Member Registration',
        body: `${newUser.fullName} (${newUser.desiredRole}) registered and is completing onboarding.`,
        targetTab: 'dashboard',
      });
    }

    await saveDb();

    res.status(201).json({
      requiresEmailVerification: true,
      email: newUser.email,
      verificationCodePreview: verificationCode,
      message: 'Account created. Verify your email code to continue onboarding.',
    });
  });

  app.post('/api/auth/verify-email', authLimiter, async (req, res) => {
    const { email, code } = req.body || {};
    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if (user.emailVerified) {
      const { rawToken } = createSessionForUser(user, req);
      await saveDb();
      return res.json({ token: rawToken, user: sanitizeUser(user) });
    }
    if (user.emailVerificationCode !== String(code || '').trim()) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }
    user.emailVerified = true;
    user.emailVerificationCode = undefined;
    const { rawToken } = createSessionForUser(user, req);
    addAudit(user.id, 'EMAIL_VERIFIED', 'user', user.id, 'Email verified successfully', req);
    await saveDb();
    res.json({ token: rawToken, user: sanitizeUser(user) });
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.status === 'suspended' || user.status === 'rejected') {
      return res.status(403).json({ error: 'This account is suspended or rejected.' });
    }
    if (!user.emailVerified) {
      user.emailVerificationCode = user.emailVerificationCode || generateNumericCode(6);
      await saveDb();
      return res.status(403).json({
        error: 'Email verification required.',
        requiresEmailVerification: true,
        email: user.email,
        verificationCodePreview: user.emailVerificationCode,
      });
    }
    if (user.twoFactorEnabled) {
      const challengeCode = generateNumericCode(6);
      user.twoFactorSecret = challengeCode;
      await saveDb();
      return res.json({
        requiresTwoFactor: true,
        email: user.email,
        twoFactorCodePreview: challengeCode,
      });
    }

    const { rawToken } = createSessionForUser(user, req);
    addAudit(user.id, 'USER_LOGIN', 'user', user.id, 'Signed in with credentials', req);
    await saveDb();
    res.json({ token: rawToken, user: sanitizeUser(user) });
  });

  app.post('/api/auth/verify-2fa', authLimiter, async (req, res) => {
    const { email, code } = req.body || {};
    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase());
    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA challenge not active.' });
    }
    if (user.twoFactorSecret !== String(code || '').trim()) {
      return res.status(401).json({ error: 'Invalid 2FA verification code.' });
    }
    user.twoFactorSecret = undefined;
    const { rawToken } = createSessionForUser(user, req);
    addAudit(user.id, 'USER_LOGIN_2FA', 'user', user.id, 'Completed 2FA sign-in', req);
    await saveDb();
    res.json({ token: rawToken, user: sanitizeUser(user) });
  });

  app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    const { email } = req.body || {};
    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase());
    if (!user) {
      return res.json({ message: 'If an account matches that email, a recovery code has been issued.' });
    }
    const code = generateNumericCode(6);
    user.resetPasswordCode = code;
    await saveDb();
    res.json({
      message: 'Password recovery code issued.',
      resetCodePreview: code,
    });
  });

  app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Valid email, code, and 8+ character password are required.' });
    }
    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!user || user.resetPasswordCode !== String(code).trim()) {
      return res.status(400).json({ error: 'Invalid recovery code.' });
    }
    user.passwordHash = hashPassword(String(newPassword));
    user.resetPasswordCode = undefined;
    addAudit(user.id, 'PASSWORD_RESET', 'user', user.id, 'Password reset completed', req);
    await saveDb();
    res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
  });

  app.post('/api/auth/logout', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    const session = db.sessions.find((s) => s.id === req.sessionId);
    if (session) {
      session.status = 'logged_out';
      session.logoutAt = new Date().toISOString();
    }
    addAudit(req.safeUser!.id, 'USER_LOGOUT', 'session', req.sessionId || '', 'Signed out cleanly', req);
    await saveDb();
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.safeUser, sessionId: req.sessionId });
  });

  app.patch('/api/auth/profile', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const db = getDb();
    const {
      fullName,
      email,
      phone,
      whatsapp,
      avatarUrl,
      desiredRole,
      department,
      skills,
      interests,
      bio,
      preferredLanguage,
    } = req.body || {};
    if (email) {
      const normalized = String(email).trim().toLowerCase();
      const taken = db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === normalized);
      if (taken) {
        return res.status(409).json({ error: 'That email address is already in use by another account.' });
      }
      user.email = normalized;
    }
    if (fullName) user.fullName = String(fullName).trim();
    if (phone) user.phone = String(phone).trim();
    if (whatsapp !== undefined) user.whatsapp = whatsapp ? String(whatsapp).trim() : undefined;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl ? String(avatarUrl) : undefined;
    if (desiredRole) user.desiredRole = String(desiredRole).trim();
    if (department) user.department = String(department).trim();
    if (Array.isArray(skills)) user.skills = skills.map(String);
    if (Array.isArray(interests)) user.interests = interests.map(String);
    if (bio !== undefined) user.bio = String(bio);
    if (preferredLanguage === 'ar' || preferredLanguage === 'en') user.preferredLanguage = preferredLanguage;
    user.onboarding.profileCompleted = Boolean(user.fullName && user.phone && user.desiredRole);
    addAudit(user.id, 'PROFILE_UPDATED', 'user', user.id, 'Updated user profile details', req);
    await saveDb();
    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthedRequest, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Current password and an 8+ character new password are required.' });
    }
    const user = req.authUser!;
    if (!verifyPassword(String(currentPassword), user.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    user.passwordHash = hashPassword(String(newPassword));
    addAudit(user.id, 'PASSWORD_CHANGED', 'user', user.id, 'Updated account password', req);
    await saveDb();
    res.json({ ok: true });
  });

  app.post('/api/auth/2fa/toggle', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    user.twoFactorEnabled = Boolean(req.body?.enabled);
    addAudit(
      user.id,
      user.twoFactorEnabled ? '2FA_ENABLED' : '2FA_DISABLED',
      'user',
      user.id,
      `Two-factor authentication ${user.twoFactorEnabled ? 'enabled' : 'disabled'}`,
      req
    );
    await saveDb();
    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/auth/onboarding/submit', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const db = getDb();
    user.onboarding.applicationSubmitted = true;
    addAudit(user.id, 'APPLICATION_SUBMITTED', 'user', user.id, 'Submitted candidate onboarding application', req);
    for (const sup of db.users.filter((u) => u.role === 'admin' || u.role === 'supervisor')) {
      pushNotification({
        userId: sup.id,
        category: 'application',
        title: 'Application Submitted for Approval',
        body: `${user.fullName} completed onboarding steps and submitted their application.`,
        targetTab: 'dashboard',
      });
    }
    await saveDb();
    res.json({ user: sanitizeUser(user) });
  });

  // ==================== TEAM & ADMIN RBAC ====================
  app.get('/api/users', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const onlineIds = new Set(getOnlineUserIds());
    const isPrivileged = req.safeUser!.role === 'admin' || req.safeUser!.role === 'supervisor';
    const users = db.users.map((u) => {
      const safe = sanitizeUser(u);
      if (isPrivileged || u.id === req.safeUser!.id) {
        return { ...safe, isOnline: onlineIds.has(u.id) };
      }
      return {
        id: safe.id,
        fullName: safe.fullName,
        email: safe.email,
        desiredRole: safe.desiredRole,
        department: safe.department,
        skills: safe.skills,
        role: safe.role,
        status: safe.status,
        avatarUrl: safe.avatarUrl,
        isOnline: onlineIds.has(u.id),
      };
    });
    res.json({ users });
  });

  app.patch('/api/admin/users/:id/status', requireAuth, requirePermission('canApproveMembers'), async (req: AuthedRequest, res) => {
    const { status } = req.body || {};
    if (!['approved', 'pending', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'admin' && req.safeUser!.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can modify administrator accounts.' });
    }
    target.status = status;
    if (status === 'suspended' || status === 'rejected') {
      for (const s of db.sessions) {
        if (s.userId === target.id && s.status === 'active') {
          s.status = 'revoked';
          s.logoutAt = new Date().toISOString();
          forceDisconnectSession(s.id, `Account ${status}`);
        }
      }
    }
    addAudit(req.safeUser!.id, 'USER_STATUS_CHANGED', 'user', target.id, `Changed account status to ${status}`, req);
    pushNotification({
      userId: target.id,
      category: 'application',
      title: `Account Status: ${status.toUpperCase()}`,
      body: `Your KAVIRO workspace account status was updated to ${status} by ${req.safeUser!.fullName}.`,
      targetTab: 'dashboard',
    });
    await saveDb();
    res.json({ user: sanitizeUser(target) });
  });

  app.patch('/api/admin/users/:id/role', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
    const { role } = req.body || {};
    if (!['member', 'supervisor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.safeUser!.id && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot demote your own administrator account.' });
    }
    target.role = role;
    if (role === 'supervisor' && !target.supervisorPermissions) {
      target.supervisorPermissions = { ...DEFAULT_SUPERVISOR_PERMS };
    }
    addAudit(req.safeUser!.id, 'USER_ROLE_CHANGED', 'user', target.id, `Updated role to ${role}`, req);
    pushNotification({
      userId: target.id,
      category: 'security',
      title: `Role Updated: ${role.toUpperCase()}`,
      body: `Your platform role was updated to ${role} by ${req.safeUser!.fullName}.`,
      targetTab: 'dashboard',
    });
    await saveDb();
    res.json({ user: sanitizeUser(target) });
  });

  app.patch('/api/admin/users/:id/permissions', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    const incoming = req.body?.permissions || {};
    target.supervisorPermissions = {
      canApproveMembers: Boolean(incoming.canApproveMembers),
      canManageAssessments: Boolean(incoming.canManageAssessments),
      canViewSessions: Boolean(incoming.canViewSessions),
      canRevokeSessions: Boolean(incoming.canRevokeSessions),
      canManageTasksAndGroups: Boolean(incoming.canManageTasksAndGroups),
      canViewAnalytics: Boolean(incoming.canViewAnalytics),
      canManageIntegrations: Boolean(incoming.canManageIntegrations),
    };
    addAudit(
      req.safeUser!.id,
      'SUPERVISOR_PERMISSIONS_UPDATED',
      'user',
      target.id,
      `Updated supervisor permissions for ${target.fullName}`,
      req
    );
    await saveDb();
    res.json({ user: sanitizeUser(target) });
  });

  app.delete('/api/admin/users/:id', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
    const db = getDb();
    if (req.params.id === req.safeUser!.id) {
      return res.status(400).json({ error: 'You cannot delete your own currently signed-in administrator account.' });
    }
    const idx = db.users.findIndex((u) => u.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'User not found' });
    const removed = db.users[idx];
    for (const s of db.sessions) {
      if (s.userId === removed.id && s.status === 'active') {
        s.status = 'revoked';
        s.logoutAt = new Date().toISOString();
        forceDisconnectSession(s.id, 'Account removed by Administrator');
      }
    }
    db.users.splice(idx, 1);
    addAudit(req.safeUser!.id, 'USER_DELETED', 'user', removed.id, `Removed account ${removed.email}`, req);
    await saveDb();
    res.json({ ok: true });
  });

  // ==================== DEVICE & SESSION MONITORING ====================
  app.get('/api/sessions', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const canViewAll = hasPermission(req.safeUser!, 'canViewSessions');
    const userMap = new Map(db.users.map((u) => [u.id, sanitizeUser(u)]));

    const visibleSessions = db.sessions
      .filter((s) => canViewAll || s.userId === req.safeUser!.id)
      .map((s) => ({
        id: s.id,
        userId: s.userId,
        userName: userMap.get(s.userId)?.fullName || 'Unknown User',
        userEmail: userMap.get(s.userId)?.email || '',
        userRole: userMap.get(s.userId)?.role || 'member',
        deviceType: s.deviceType,
        browser: s.browser,
        os: s.os,
        ipAddress: s.ipAddress,
        loginAt: s.loginAt,
        logoutAt: s.logoutAt,
        lastActivityAt: s.lastActivityAt,
        status: s.status,
        isUnusual: s.isUnusual,
        alertReason: s.alertReason,
        isCurrent: s.id === req.sessionId,
      }));

    res.json({ sessions: visibleSessions });
  });

  app.delete('/api/sessions/:id', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    const target = db.sessions.find((s) => s.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'Session not found' });

    const canRevokeOthers = hasPermission(req.safeUser!, 'canRevokeSessions');
    if (!canRevokeOthers && target.userId !== req.safeUser!.id) {
      return res.status(403).json({ error: 'Not authorized to revoke this session' });
    }

    const targetOwner = db.users.find((u) => u.id === target.userId);
    if (targetOwner?.role === 'admin' && req.safeUser!.role !== 'admin' && target.userId !== req.safeUser!.id) {
      return res.status(403).json({ error: 'Only an Administrator can revoke an Administrator session.' });
    }

    target.status = 'revoked';
    target.logoutAt = new Date().toISOString();
    forceDisconnectSession(target.id, `Revoked by ${req.safeUser!.fullName}`);
    addAudit(
      req.safeUser!.id,
      'SESSION_REVOKED',
      'session',
      target.id,
      `Force-logged out ${target.browser} (${target.os}) session for user ${target.userId}`,
      req
    );
    pushNotification({
      userId: target.userId,
      category: 'security',
      title: 'Session Terminated',
      body: `A session (${target.browser} on ${target.os}) was revoked by ${req.safeUser!.fullName}.`,
      targetTab: 'security',
    });
    await saveDb();
    res.json({ ok: true });
  });

  app.post('/api/sessions/revoke-user/:userId', requireAuth, requirePermission('canRevokeSessions'), async (req: AuthedRequest, res) => {
    const db = getDb();
    const targetUser = db.users.find((u) => u.id === req.params.userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.role === 'admin' && req.safeUser!.role !== 'admin') {
      return res.status(403).json({ error: 'Only an Administrator can revoke an Administrator’s devices.' });
    }
    let revokedCount = 0;
    for (const s of db.sessions) {
      if (s.userId === targetUser.id && s.status === 'active' && s.id !== req.sessionId) {
        s.status = 'revoked';
        s.logoutAt = new Date().toISOString();
        forceDisconnectSession(s.id, `All devices signed out by ${req.safeUser!.fullName}`);
        revokedCount++;
      }
    }
    addAudit(
      req.safeUser!.id,
      'USER_ALL_SESSIONS_REVOKED',
      'user',
      targetUser.id,
      `Force-logged out ${revokedCount} active devices for ${targetUser.fullName}`,
      req
    );
    await saveDb();
    res.json({ ok: true, revokedCount });
  });

  // ==================== CV BUILDER & AI CV ASSISTANT ====================
  app.get('/api/cv', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const targetUserId =
      req.query.userId && (req.safeUser!.role === 'admin' || req.safeUser!.role === 'supervisor')
        ? String(req.query.userId)
        : req.safeUser!.id;
    const cv = db.cvs.find((c) => c.userId === targetUserId) || null;
    res.json({ cv });
  });

  app.get('/api/cvs', requireAuth, requireRole(['admin', 'supervisor']), (_req, res) => {
    const db = getDb();
    res.json({ cvs: db.cvs });
  });

  app.post('/api/cv', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    const payload = req.body as Partial<UserCv>;
    const existingIdx = db.cvs.findIndex((c) => c.userId === req.safeUser!.id);
    const now = new Date().toISOString();

    const cvRecord: UserCv = {
      id: existingIdx >= 0 ? db.cvs[existingIdx].id : `cv-${crypto.randomUUID().slice(0, 8)}`,
      userId: req.safeUser!.id,
      fullName: payload.fullName || req.safeUser!.fullName,
      headline: payload.headline || req.safeUser!.desiredRole,
      email: payload.email || req.safeUser!.email,
      phone: payload.phone || req.safeUser!.phone,
      location: payload.location || '',
      summary: payload.summary || '',
      education: Array.isArray(payload.education) ? payload.education : [],
      experience: Array.isArray(payload.experience) ? payload.experience : [],
      projects: Array.isArray(payload.projects) ? payload.projects : [],
      achievements: Array.isArray(payload.achievements) ? payload.achievements : [],
      technicalSkills: Array.isArray(payload.technicalSkills) ? payload.technicalSkills : [],
      softSkills: Array.isArray(payload.softSkills) ? payload.softSkills : [],
      uploadedFileName: payload.uploadedFileName,
      uploadedFileMime: payload.uploadedFileMime,
      rawExtractedText: payload.rawExtractedText,
      updatedAt: now,
    };

    if (existingIdx >= 0) db.cvs[existingIdx] = cvRecord;
    else db.cvs.push(cvRecord);

    req.authUser!.onboarding.cvCompleted = true;
    addAudit(req.safeUser!.id, 'CV_SAVED', 'cv', cvRecord.id, 'Saved CV profile', req);
    await saveDb();
    res.json({ cv: cvRecord, onboarding: req.authUser!.onboarding });
  });

  app.post('/api/cv/upload', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { fileName, mimeType, base64Data } = req.body || {};
      if (!fileName || !base64Data) {
        return res.status(400).json({ error: 'File name and file payload are required.' });
      }
      const buffer = Buffer.from(String(base64Data), 'base64');
      if (buffer.byteLength > 6 * 1024 * 1024) {
        return res.status(400).json({ error: 'File exceeds 6 MB limit.' });
      }

      let extractedText = '';
      const lowerName = String(fileName).toLowerCase();
      if (lowerName.endsWith('.docx')) {
        const zip = await JSZip.loadAsync(buffer);
        const docXml = zip.file('word/document.xml');
        if (docXml) {
          const xmlText = await docXml.async('string');
          extractedText = xmlText
            .replace(/<w:p[^>]*>/g, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+\n/g, '\n')
            .replace(/[ \t]+/g, ' ')
            .trim();
        }
      } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
        extractedText = buffer.toString('utf8');
      } else if (lowerName.endsWith('.pdf')) {
        // Basic readable ASCII text extraction + PDF binary can also be passed to Gemini
        extractedText = `Uploaded PDF file: ${fileName} (${Math.round(buffer.byteLength / 1024)} KB).`;
      } else {
        return res.status(400).json({ error: 'Supported CV formats are PDF, DOCX, TXT, or MD.' });
      }

      res.json({
        fileName,
        mimeType: mimeType || 'application/octet-stream',
        extractedText,
        pdfBase64: lowerName.endsWith('.pdf') ? String(base64Data) : undefined,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to parse uploaded CV document.' });
    }
  });

  app.post('/api/ai/cv-analyze', requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
    try {
      const { cv, language, pdfBase64, extractedText } = req.body || {};
      const result = await analyzeCvWithGemini({
        cv: cv || {},
        language: language === 'ar' ? 'ar' : 'en',
        pdfBase64,
        extractedText,
      });
      res.json({ analysis: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'AI CV analysis failed.' });
    }
  });

  // ==================== HUMAN VERIFICATION & ASSESSMENTS ====================
  app.get('/api/assessments/captcha', requireAuth, (_req, res) => {
    res.json(createCaptchaChallenge());
  });

  app.post('/api/assessments/captcha/verify', requireAuth, async (req: AuthedRequest, res) => {
    const { challengeId, answer } = req.body || {};
    if (!challengeId || !answer) {
      return res.status(400).json({ error: 'Challenge ID and answer are required.' });
    }
    const ok = verifyCaptchaChallenge(String(challengeId), String(answer));
    if (!ok) {
      return res.status(400).json({ error: 'Incorrect CAPTCHA answer. Please try a new challenge.' });
    }
    req.authUser!.humanVerified = true;
    req.authUser!.onboarding.humanVerified = true;
    addAudit(req.safeUser!.id, 'HUMAN_VERIFIED', 'user', req.safeUser!.id, 'Passed CAPTCHA verification', req);
    await saveDb();
    res.json({ verified: true, user: sanitizeUser(req.authUser!) });
  });

  app.get('/api/assessments', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const isPrivileged = req.safeUser!.role === 'admin' || req.safeUser!.role === 'supervisor';
    const assessments = db.assessments
      .filter((a) => isPrivileged || a.assignedUserIds.includes(req.safeUser!.id) || a.assignedUserIds.length === 0)
      .map((a) => ({
        ...a,
        questions: isPrivileged
          ? a.questions
          : a.questions.map(({ correctAnswer: _c, ...rest }) => rest),
      }));

    const attempts = db.attempts.filter((att) => isPrivileged || att.userId === req.safeUser!.id);
    res.json({ assessments, attempts });
  });

  app.post('/api/assessments', requireAuth, requirePermission('canManageAssessments'), async (req: AuthedRequest, res) => {
    const {
      title,
      titleAr,
      description,
      category,
      timeLimitMinutes,
      maxAttempts,
      passingScore,
      assignedUserIds,
      randomizeQuestions,
      questions,
    } = req.body || {};

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Assessment title and at least one question are required.' });
    }

    const db = getDb();
    const assessment = {
      id: `asm-${crypto.randomUUID().slice(0, 8)}`,
      title: String(title).trim(),
      titleAr: titleAr ? String(titleAr).trim() : undefined,
      description: String(description || ''),
      category: String(category || 'General'),
      timeLimitMinutes: Number(timeLimitMinutes) || 20,
      maxAttempts: Number(maxAttempts) || 2,
      passingScore: Number(passingScore) || 70,
      assignedUserIds: Array.isArray(assignedUserIds) ? assignedUserIds.map(String) : [],
      randomizeQuestions: Boolean(randomizeQuestions),
      questions: questions.map((q: any, idx: number) => ({
        id: q.id || `q-${idx + 1}-${crypto.randomUUID().slice(0, 4)}`,
        type: q.type,
        prompt: String(q.prompt),
        promptAr: q.promptAr ? String(q.promptAr) : undefined,
        options: Array.isArray(q.options) ? q.options.map(String) : undefined,
        correctAnswer: q.correctAnswer ? String(q.correctAnswer) : undefined,
        points: Number(q.points) || 10,
      })),
      createdBy: req.safeUser!.id,
      createdAt: new Date().toISOString(),
    };

    db.assessments.unshift(assessment);
    for (const uid of assessment.assignedUserIds) {
      pushNotification({
        userId: uid,
        category: 'assessment',
        title: 'New Assessment Assigned',
        body: `You have been assigned "${assessment.title}" (${assessment.timeLimitMinutes} min).`,
        targetTab: 'assessments',
      });
    }
    addAudit(req.safeUser!.id, 'ASSESSMENT_CREATED', 'assessment', assessment.id, assessment.title, req);
    await saveDb();
    res.status(201).json({ assessment });
  });

  app.post('/api/assessments/:id/start', requireAuth, async (req: AuthedRequest, res) => {
    if (!req.authUser!.humanVerified) {
      return res.status(403).json({ error: 'Complete Human Verification (CAPTCHA) before starting an assessment.' });
    }
    const db = getDb();
    const assessment = db.assessments.find((a) => a.id === req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const prior = db.attempts.filter((att) => att.assessmentId === assessment.id && att.userId === req.safeUser!.id);
    if (prior.length >= assessment.maxAttempts) {
      return res.status(400).json({ error: `Attempt limit (${assessment.maxAttempts}) reached for this assessment.` });
    }

    const questions = [...assessment.questions];
    if (assessment.randomizeQuestions) {
      for (let i = questions.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    }

    const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
    const attempt = {
      id: `att-${crypto.randomUUID().slice(0, 8)}`,
      assessmentId: assessment.id,
      userId: req.safeUser!.id,
      startedAt: new Date().toISOString(),
      answers: [],
      autoScore: 0,
      manualScore: 0,
      totalScore: 0,
      maxScore,
      status: 'in_progress' as const,
    };

    db.attempts.unshift(attempt);
    await saveDb();
    res.json({
      attempt,
      questions: questions.map(({ correctAnswer: _c, ...q }) => q),
    });
  });

  app.post('/api/assessments/attempts/:attemptId/submit', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    const attempt = db.attempts.find((a) => a.id === req.params.attemptId && a.userId === req.safeUser!.id);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: 'Attempt has already been submitted.' });
    }
    const assessment = db.assessments.find((a) => a.id === attempt.assessmentId);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const submittedMap = new Map<string, string>(
      Array.isArray(req.body?.answers)
        ? req.body.answers.map((item: { questionId: string; answer: string }) => [item.questionId, String(item.answer || '')])
        : []
    );

    let autoScore = 0;
    let needsManual = false;
    const evaluated = assessment.questions.map((q) => {
      const answer = submittedMap.get(q.id) || '';
      if (q.type === 'mcq' || q.type === 'true_false') {
        const isCorrect = answer.trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase();
        const pts = isCorrect ? q.points : 0;
        autoScore += pts;
        return { questionId: q.id, answer, isCorrect, pointsAwarded: pts };
      }
      needsManual = true;
      return { questionId: q.id, answer, pointsAwarded: 0 };
    });

    attempt.answers = evaluated;
    attempt.autoScore = autoScore;
    attempt.totalScore = autoScore;
    attempt.submittedAt = new Date().toISOString();
    attempt.status = needsManual ? 'pending_review' : 'graded';
    if (!needsManual) {
      const pct = attempt.maxScore > 0 ? (attempt.totalScore / attempt.maxScore) * 100 : 0;
      attempt.passed = pct >= assessment.passingScore;
    }

    req.authUser!.onboarding.assessmentCompleted = true;
    addAudit(req.safeUser!.id, 'ASSESSMENT_SUBMITTED', 'attempt', attempt.id, `Submitted ${assessment.title}`, req);

    if (needsManual) {
      for (const sup of db.users.filter((u) => u.role === 'admin' || u.role === 'supervisor')) {
        pushNotification({
          userId: sup.id,
          category: 'assessment',
          title: 'Assessment Pending Manual Review',
          body: `${req.safeUser!.fullName} submitted "${assessment.title}" with written responses.`,
          targetTab: 'assessments',
        });
      }
    }

    await saveDb();
    res.json({ attempt, onboarding: req.authUser!.onboarding });
  });

  app.post('/api/assessments/attempts/:attemptId/grade', requireAuth, requirePermission('canManageAssessments'), async (req: AuthedRequest, res) => {
    const db = getDb();
    const attempt = db.attempts.find((a) => a.id === req.params.attemptId);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    const assessment = db.assessments.find((a) => a.id === attempt.assessmentId);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const grades: Array<{ questionId: string; pointsAwarded: number; feedback?: string }> = req.body?.grades || [];
    const gradeMap = new Map(grades.map((g) => [g.questionId, g]));

    let manualScore = 0;
    attempt.answers = attempt.answers.map((ans) => {
      const q = assessment.questions.find((item) => item.id === ans.questionId);
      if (q && (q.type === 'written' || q.type === 'scenario')) {
        const g = gradeMap.get(q.id);
        const awarded = g ? Math.max(0, Math.min(q.points, Number(g.pointsAwarded))) : ans.pointsAwarded;
        manualScore += awarded;
        return { ...ans, pointsAwarded: awarded, feedback: g?.feedback };
      }
      return ans;
    });

    attempt.manualScore = manualScore;
    attempt.totalScore = attempt.autoScore + manualScore;
    const pct = attempt.maxScore > 0 ? (attempt.totalScore / attempt.maxScore) * 100 : 0;
    attempt.passed = pct >= assessment.passingScore;
    attempt.status = 'graded';
    attempt.reviewedBy = req.safeUser!.id;

    addAudit(req.safeUser!.id, 'ASSESSMENT_GRADED', 'attempt', attempt.id, `Graded attempt (${attempt.totalScore}/${attempt.maxScore})`, req);
    pushNotification({
      userId: attempt.userId,
      category: 'assessment',
      title: 'Assessment Graded',
      body: `Your submission for "${assessment.title}" scored ${attempt.totalScore}/${attempt.maxScore}.`,
      targetTab: 'assessments',
    });
    await saveDb();
    res.json({ attempt });
  });

  // ==================== REAL-TIME MESSAGING ====================
  app.get('/api/conversations', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const convs = db.conversations
      .filter((c) => c.memberIds.includes(req.safeUser!.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ conversations: convs, onlineUserIds: getOnlineUserIds() });
  });

  app.post('/api/conversations', requireAuth, async (req: AuthedRequest, res) => {
    const { type, name, description, memberIds } = req.body || {};
    const db = getDb();
    const members = Array.from(new Set([req.safeUser!.id, ...(Array.isArray(memberIds) ? memberIds.map(String) : [])]));

    if (type === 'direct' && members.length === 2) {
      const existing = db.conversations.find(
        (c) => c.type === 'direct' && c.memberIds.length === 2 && members.every((m) => c.memberIds.includes(m))
      );
      if (existing) return res.json({ conversation: existing });
    }

    const otherUser = members.length === 2 ? db.users.find((u) => u.id !== req.safeUser!.id && members.includes(u.id)) : null;
    const conv = {
      id: `conv-${crypto.randomUUID().slice(0, 8)}`,
      type: (type === 'direct' ? 'direct' : 'group') as 'direct' | 'group',
      name: name ? String(name).trim() : otherUser ? `${req.safeUser!.fullName} & ${otherUser.fullName}` : 'Team Channel',
      description: description ? String(description) : undefined,
      memberIds: members,
      adminIds: [req.safeUser!.id],
      pinnedMessageIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.conversations.unshift(conv);
    await saveDb();
    broadcastToUsers(members, 'conversation:new', conv);
    res.status(201).json({ conversation: conv });
  });

  app.patch('/api/conversations/:id', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    const conv = db.conversations.find((c) => c.id === req.params.id);
    if (!conv || !conv.memberIds.includes(req.safeUser!.id)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const isGroupAdmin = conv.adminIds.includes(req.safeUser!.id) || req.safeUser!.role === 'admin';
    if (!isGroupAdmin) {
      return res.status(403).json({ error: 'Only group administrators can update group settings.' });
    }
    const { announcement, memberIds, togglePinMessageId, name } = req.body || {};
    if (name) conv.name = String(name).trim();
    if (announcement !== undefined) conv.announcement = String(announcement);
    if (Array.isArray(memberIds)) conv.memberIds = Array.from(new Set([...conv.adminIds, ...memberIds.map(String)]));
    if (togglePinMessageId) {
      const id = String(togglePinMessageId);
      if (conv.pinnedMessageIds.includes(id)) {
        conv.pinnedMessageIds = conv.pinnedMessageIds.filter((p) => p !== id);
      } else {
        conv.pinnedMessageIds.push(id);
      }
    }
    conv.updatedAt = new Date().toISOString();
    await saveDb();
    broadcastToUsers(conv.memberIds, 'conversation:updated', conv);
    res.json({ conversation: conv });
  });

  app.get('/api/conversations/:id/messages', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const conv = db.conversations.find((c) => c.id === req.params.id);
    if (!conv || !conv.memberIds.includes(req.safeUser!.id)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const q = String(req.query.q || '').trim().toLowerCase();
    const list = db.messages
      .filter((m) => m.conversationId === conv.id)
      .filter((m) => (!q ? true : m.content.toLowerCase().includes(q)));
    res.json({ messages: list });
  });

  app.post('/api/conversations/:id/messages', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    const conv = db.conversations.find((c) => c.id === req.params.id);
    if (!conv || !conv.memberIds.includes(req.safeUser!.id)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const { content, replyToId, attachment } = req.body || {};
    if (!content && !attachment) {
      return res.status(400).json({ error: 'Message content or attachment is required.' });
    }
    const msg = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      conversationId: conv.id,
      senderId: req.safeUser!.id,
      content: String(content || '').trim(),
      replyToId: replyToId ? String(replyToId) : undefined,
      reactions: {},
      attachment: attachment && attachment.name && attachment.dataUrl ? attachment : undefined,
      readBy: [req.safeUser!.id],
      createdAt: new Date().toISOString(),
    };
    db.messages.push(msg);
    conv.updatedAt = msg.createdAt;
    for (const memberId of conv.memberIds) {
      if (memberId !== req.safeUser!.id) {
        pushNotification({
          userId: memberId,
          category: 'message',
          title: conv.type === 'group' ? `#${conv.name}` : req.safeUser!.fullName,
          body: msg.content || `Shared attachment: ${msg.attachment?.name}`,
          targetTab: 'messages',
        });
      }
    }
    await saveDb();
    broadcastToUsers(conv.memberIds, 'message:new', msg);
    res.status(201).json({ message: msg });
  });

  app.post('/api/messages/:id/react', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    const msg = db.messages.find((m) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    const conv = db.conversations.find((c) => c.id === msg.conversationId);
    if (!conv || !conv.memberIds.includes(req.safeUser!.id)) {
      return res.status(403).json({ error: 'Not permitted' });
    }
    const emoji = String(req.body?.emoji || '👍');
    const existing = msg.reactions[emoji] || [];
    if (existing.includes(req.safeUser!.id)) {
      msg.reactions[emoji] = existing.filter((id) => id !== req.safeUser!.id);
    } else {
      msg.reactions[emoji] = [...existing, req.safeUser!.id];
    }
    await saveDb();
    broadcastToUsers(conv.memberIds, 'message:reaction', { messageId: msg.id, reactions: msg.reactions });
    res.json({ message: msg });
  });

  app.post('/api/conversations/:id/read', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    const conv = db.conversations.find((c) => c.id === req.params.id);
    if (!conv || !conv.memberIds.includes(req.safeUser!.id)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    let changed = false;
    for (const m of db.messages) {
      if (m.conversationId === conv.id && !m.readBy.includes(req.safeUser!.id)) {
        m.readBy.push(req.safeUser!.id);
        changed = true;
      }
    }
    if (changed) {
      await saveDb();
      broadcastToUsers(conv.memberIds, 'message:read', { conversationId: conv.id, userId: req.safeUser!.id });
    }
    res.json({ ok: true });
  });

  // ==================== TASKS & PROJECTS ====================
  app.get('/api/tasks', requireAuth, (_req: AuthedRequest, res) => {
    const db = getDb();
    res.json({ projects: db.projects, tasks: db.tasks });
  });

  app.post('/api/projects', requireAuth, requirePermission('canManageTasksAndGroups'), async (req: AuthedRequest, res) => {
    const { name, description, memberIds } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Project name is required.' });
    const db = getDb();
    const project = {
      id: `proj-${crypto.randomUUID().slice(0, 8)}`,
      name: String(name).trim(),
      description: String(description || ''),
      leadId: req.safeUser!.id,
      memberIds: Array.isArray(memberIds) ? memberIds.map(String) : [req.safeUser!.id],
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };
    db.projects.unshift(project);
    await saveDb();
    res.status(201).json({ project });
  });

  app.post('/api/tasks', requireAuth, async (req: AuthedRequest, res) => {
    const { projectId, title, description, assigneeId, priority, deadline } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Task title is required.' });
    const db = getDb();
    const targetAssignee = assigneeId ? String(assigneeId) : req.safeUser!.id;
    const now = new Date().toISOString();
    const task = {
      id: `tsk-${crypto.randomUUID().slice(0, 8)}`,
      projectId: projectId ? String(projectId) : db.projects[0]?.id || 'proj-01',
      title: String(title).trim(),
      description: String(description || ''),
      assigneeId: targetAssignee,
      reporterId: req.safeUser!.id,
      status: 'backlog' as const,
      priority: (['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium') as
        | 'low'
        | 'medium'
        | 'high'
        | 'urgent',
      progress: 0,
      deadline: deadline ? String(deadline) : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      comments: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    db.tasks.unshift(task);
    if (targetAssignee !== req.safeUser!.id) {
      pushNotification({
        userId: targetAssignee,
        category: 'task',
        title: 'New Task Assigned',
        body: `${req.safeUser!.fullName} assigned "${task.title}" (Due ${task.deadline}).`,
        targetTab: 'tasks',
      });
    }
    await saveDb();
    res.status(201).json({ task });
  });

  app.patch('/api/tasks/:id', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    const task = db.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { status, priority, progress, assigneeId, title, description, deadline } = req.body || {};
    if (status && ['backlog', 'in_progress', 'in_review', 'done'].includes(status)) {
      task.status = status;
      if (status === 'done') task.progress = 100;
    }
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) task.priority = priority;
    if (progress !== undefined) task.progress = Math.max(0, Math.min(100, Number(progress)));
    if (assigneeId) task.assigneeId = String(assigneeId);
    if (title) task.title = String(title).trim();
    if (description !== undefined) task.description = String(description);
    if (deadline) task.deadline = String(deadline);
    task.updatedAt = new Date().toISOString();
    await saveDb();
    res.json({ task });
  });

  app.post('/api/tasks/:id/comments', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    const task = db.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Comment text is required.' });
    const comment = {
      id: `cmt-${crypto.randomUUID().slice(0, 8)}`,
      authorId: req.safeUser!.id,
      text,
      createdAt: new Date().toISOString(),
    };
    task.comments.push(comment);
    task.updatedAt = comment.createdAt;
    await saveDb();
    res.status(201).json({ task, comment });
  });

  // ==================== MEETINGS & INTEGRATIONS ====================
  app.get('/api/meetings', requireAuth, (_req, res) => {
    const db = getDb();
    res.json({ meetings: db.meetings, integrations: db.integrations });
  });

  app.post('/api/meetings', requireAuth, async (req: AuthedRequest, res) => {
    const { title, description, participantIds, startTime, endTime, provider, meetingUrl } = req.body || {};
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ error: 'Meeting title, start time, and end time are required.' });
    }
    const db = getDb();
    const chosenProvider = provider === 'google_meet' || provider === 'zoom' ? provider : 'internal';
    if (chosenProvider !== 'internal') {
      const integ = db.integrations.find((i) => i.provider === (chosenProvider === 'google_meet' ? 'google' : 'zoom'));
      if (!integ?.connected && !meetingUrl) {
        return res.status(400).json({
          error: `${chosenProvider === 'google_meet' ? 'Google' : 'Zoom'} integration is not connected yet. Connect credentials first or provide a verified meeting join link.`,
        });
      }
    }

    const participants = Array.from(
      new Set([req.safeUser!.id, ...(Array.isArray(participantIds) ? participantIds.map(String) : [])])
    );
    const meeting = {
      id: `mtg-${crypto.randomUUID().slice(0, 8)}`,
      title: String(title).trim(),
      description: String(description || ''),
      organizerId: req.safeUser!.id,
      participantIds: participants,
      startTime: String(startTime),
      endTime: String(endTime),
      provider: chosenProvider as 'internal' | 'google_meet' | 'zoom',
      meetingUrl: meetingUrl ? String(meetingUrl).trim() : undefined,
      createdAt: new Date().toISOString(),
    };
    db.meetings.unshift(meeting);
    for (const pid of participants) {
      if (pid !== req.safeUser!.id) {
        pushNotification({
          userId: pid,
          category: 'meeting',
          title: 'Meeting Invitation',
          body: `${req.safeUser!.fullName} invited you to "${meeting.title}".`,
          targetTab: 'meetings',
        });
      }
    }
    await saveDb();
    res.status(201).json({ meeting });
  });

  app.get('/api/meetings/:id/ics', requireAuth, (req, res) => {
    const db = getDb();
    const m = db.meetings.find((item) => item.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'Meeting not found' });
    const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//KAVIRO//Team Workspace//EN',
      'BEGIN:VEVENT',
      `UID:${m.id}@kaviro.ai`,
      `DTSTAMP:${fmt(m.createdAt)}`,
      `DTSTART:${fmt(m.startTime)}`,
      `DTEND:${fmt(m.endTime)}`,
      `SUMMARY:${m.title}`,
      `DESCRIPTION:${m.description}${m.meetingUrl ? `\\nJoin: ${m.meetingUrl}` : ''}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${m.id}.ics"`);
    res.send(ics);
  });

  app.post('/api/integrations/verify', requireAuth, requirePermission('canManageIntegrations'), async (req: AuthedRequest, res) => {
    const { provider, accessToken, zoomAccountId, zoomClientId, zoomClientSecret } = req.body || {};
    const db = getDb();
    const integ = db.integrations.find((i) => i.provider === provider);
    if (!integ) return res.status(400).json({ error: 'Unsupported integration provider.' });

    if (provider === 'google') {
      if (!accessToken) {
        return res.status(400).json({ error: 'A real Google OAuth access token is required for verification.' });
      }
      try {
        const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(String(accessToken))}`);
        if (!resp.ok) {
          return res.status(400).json({ error: 'Google token verification failed. Token is invalid or expired.' });
        }
        const info = (await resp.json()) as { email?: string; scope?: string };
        integ.connected = true;
        integ.accountEmail = info.email || req.safeUser!.email;
        integ.scopes = info.scope ? info.scope.split(' ') : [];
        integ.verifiedAt = new Date().toISOString();
        integ.note = `Verified Google OAuth session for ${integ.accountEmail}`;
        await saveDb();
        return res.json({ integration: integ });
      } catch {
        return res.status(502).json({ error: 'Unable to reach Google OAuth token verification endpoint.' });
      }
    }

    if (provider === 'zoom') {
      if (!zoomAccountId || !zoomClientId || !zoomClientSecret) {
        return res.status(400).json({ error: 'Zoom Account ID, Client ID, and Client Secret are required.' });
      }
      try {
        const basic = Buffer.from(`${zoomClientId}:${zoomClientSecret}`).toString('base64');
        const resp = await fetch(
          `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(String(zoomAccountId))}`,
          {
            method: 'POST',
            headers: { Authorization: `Basic ${basic}` },
          }
        );
        if (!resp.ok) {
          return res.status(400).json({ error: 'Zoom OAuth credential verification failed. Check Account ID / Client keys.' });
        }
        const data = (await resp.json()) as { scope?: string };
        integ.connected = true;
        integ.scopes = data.scope ? data.scope.split(' ') : ['meeting:write'];
        integ.verifiedAt = new Date().toISOString();
        integ.note = `Verified Zoom Server-to-Server OAuth (${zoomAccountId})`;
        await saveDb();
        return res.json({ integration: integ });
      } catch {
        return res.status(502).json({ error: 'Unable to reach Zoom OAuth endpoint.' });
      }
    }
  });

  app.post('/api/integrations/disconnect', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
    const { provider } = req.body || {};
    const db = getDb();
    const integ = db.integrations.find((i) => i.provider === provider);
    if (!integ) return res.status(404).json({ error: 'Integration not found' });
    integ.connected = false;
    integ.accountEmail = undefined;
    integ.scopes = [];
    integ.verifiedAt = undefined;
    integ.note = `${provider === 'google' ? 'Google' : 'Zoom'} disconnected by administrator.`;
    await saveDb();
    res.json({ integration: integ });
  });

  // ==================== NOTIFICATIONS ====================
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const list = db.notifications.filter((n) => n.userId === req.safeUser!.id).slice(0, 50);
    res.json({ notifications: list });
  });

  app.post('/api/notifications/read-all', requireAuth, async (req: AuthedRequest, res) => {
    const db = getDb();
    for (const n of db.notifications) {
      if (n.userId === req.safeUser!.id) n.read = true;
    }
    await saveDb();
    res.json({ ok: true });
  });

  // ==================== AI DIGITAL ASSISTANT ====================
  app.post('/api/ai/assistant', requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
    try {
      const { message, history } = req.body || {};
      if (!message) return res.status(400).json({ error: 'Message is required.' });
      const db = getDb();
      const user = req.safeUser!;
      const myCv = db.cvs.find((c) => c.userId === user.id);
      const myTasks = db.tasks.filter(
        (t) => user.role !== 'member' || t.assigneeId === user.id || t.reporterId === user.id
      );
      const myMeetings = db.meetings.filter(
        (m) => user.role !== 'member' || m.participantIds.includes(user.id)
      );
      const myAttempts = db.attempts.filter((a) => user.role !== 'member' || a.userId === user.id);

      const permittedContext = {
        cvHeadline: myCv?.headline,
        tasksSummary: `${myTasks.length} tasks (${myTasks.filter((t) => t.status === 'done').length} done, ${myTasks.filter((t) => t.status === 'in_progress').length} in progress). Titles: ${myTasks.slice(0, 5).map((t) => `${t.title} [${t.status}]`).join('; ')}`,
        meetingsSummary: myMeetings
          .slice(0, 5)
          .map((m) => `${m.title} at ${m.startTime}`)
          .join('; ') || 'No scheduled meetings',
        assessmentsSummary: `${myAttempts.length} assessment attempt(s). Latest: ${
          myAttempts[0] ? `${myAttempts[0].totalScore}/${myAttempts[0].maxScore} (${myAttempts[0].status})` : 'None yet'
        }`,
        teamSummary:
          user.role !== 'member'
            ? `${db.users.length} total members (${db.users.filter((u) => u.status === 'pending').length} pending approval, ${db.sessions.filter((s) => s.status === 'active' && s.isUnusual).length} unusual session alerts).`
            : undefined,
      };

      const reply = await runKaviroAssistant({
        user,
        message: String(message),
        history: Array.isArray(history) ? history : [],
        permittedContext,
      });

      res.json({ reply });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'AI Assistant failed to respond.' });
    }
  });

  // ==================== ANALYTICS & EXPORTS ====================
  app.get('/api/analytics', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const isPrivileged = req.safeUser!.role === 'admin' || req.safeUser!.role === 'supervisor';
    const userMap = new Map(db.users.map((u) => [u.id, u.fullName]));

    const memberStats = {
      total: db.users.length,
      approved: db.users.filter((u) => u.status === 'approved').length,
      pending: db.users.filter((u) => u.status === 'pending').length,
      humanVerified: db.users.filter((u) => u.humanVerified).length,
    };

    const taskStats = {
      total: db.tasks.length,
      backlog: db.tasks.filter((t) => t.status === 'backlog').length,
      inProgress: db.tasks.filter((t) => t.status === 'in_progress').length,
      inReview: db.tasks.filter((t) => t.status === 'in_review').length,
      done: db.tasks.filter((t) => t.status === 'done').length,
    };

    const gradedAttempts = db.attempts.filter((a) => a.status === 'graded' && a.maxScore > 0);
    const avgScorePct =
      gradedAttempts.length > 0
        ? Math.round(gradedAttempts.reduce((acc, a) => acc + (a.totalScore / a.maxScore) * 100, 0) / gradedAttempts.length)
        : 0;

    const projectProgress = db.projects.map((p) => {
      const pTasks = db.tasks.filter((t) => t.projectId === p.id);
      const avg = pTasks.length > 0 ? Math.round(pTasks.reduce((s, t) => s + t.progress, 0) / pTasks.length) : 0;
      return { id: p.id, name: p.name, taskCount: pTasks.length, progress: avg };
    });

    const auditLogs = isPrivileged
      ? db.auditLogs.slice(0, 40).map((log) => ({ ...log, actorName: userMap.get(log.actorId) || 'System' }))
      : db.auditLogs
          .filter((log) => log.actorId === req.safeUser!.id)
          .slice(0, 20)
          .map((log) => ({ ...log, actorName: userMap.get(log.actorId) || req.safeUser!.fullName }));

    res.json({
      memberStats,
      taskStats,
      assessmentStats: {
        totalAssessments: db.assessments.length,
        totalAttempts: db.attempts.length,
        pendingReviews: db.attempts.filter((a) => a.status === 'pending_review').length,
        avgScorePct,
      },
      securityStats: {
        activeSessions: db.sessions.filter((s) => s.status === 'active').length,
        unusualAlerts: db.sessions.filter((s) => s.status === 'active' && s.isUnusual).length,
      },
      projectProgress,
      auditLogs,
    });
  });

  app.get('/api/analytics/export.csv', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const rows = [
      ['Type', 'ID', 'Title/Name', 'Status', 'Owner/Actor', 'Timestamp'].join(','),
      ...db.users.map((u) => ['Member', u.id, `"${u.fullName}"`, u.status, u.role, u.createdAt].join(',')),
      ...db.tasks.map((t) => ['Task', t.id, `"${t.title}"`, t.status, `${t.progress}%`, t.updatedAt].join(',')),
      ...db.attempts.map((a) => ['AssessmentAttempt', a.id, a.assessmentId, a.status, `${a.totalScore}/${a.maxScore}`, a.startedAt].join(',')),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kaviro-analytics-report.csv"');
    res.send(rows.join('\n'));
  });

  // Download entire KAVIRO web application source package as a .zip file
  app.get('/api/export/project-zip', async (_req, res) => {
    try {
      const buf = await buildProjectZipBuffer();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="kaviro-platform-web.zip"');
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to build downloadable package.' });
    }
  });
}
