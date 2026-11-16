import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { KaviroDatabase } from './types.ts';
import { hashPassword } from './security.ts';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'kaviro-db.json');

function createSeedDatabase(): KaviroDatabase {
  const now = new Date().toISOString();
  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const twoDaysLater = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const demoPasswordHash = hashPassword('Kaviro@2026');

  const users = [
    {
      id: 'usr-admin-01',
      fullName: 'Tariq Al-Mansoor',
      email: 'admin@kaviro.ai',
      passwordHash: demoPasswordHash,
      phone: '+971 50 482 9104',
      whatsapp: '+971 50 482 9104',
      desiredRole: 'Platform Administrator',
      department: 'Executive Operations',
      skills: ['Security Architecture', 'System Governance', 'AI Strategy', 'RBAC'],
      interests: ['Enterprise Security', 'Team Scaling'],
      bio: 'Head of Platform Operations & Security Governance at KAVIRO.',
      role: 'admin' as const,
      status: 'approved' as const,
      emailVerified: true,
      twoFactorEnabled: false,
      humanVerified: true,
      onboarding: {
        profileCompleted: true,
        cvCompleted: true,
        humanVerified: true,
        assessmentCompleted: true,
        applicationSubmitted: true,
      },
      preferredLanguage: 'en' as const,
      createdAt: dayAgo,
      lastActiveAt: now,
    },
    {
      id: 'usr-sup-01',
      fullName: 'Sarah Chen',
      email: 'supervisor@kaviro.ai',
      passwordHash: demoPasswordHash,
      phone: '+1 415 890 3312',
      whatsapp: '+1 415 890 3312',
      desiredRole: 'Engineering Team Lead',
      department: 'Core Product Engineering',
      skills: ['TypeScript', 'Distributed Systems', 'Technical Interviews', 'Agile Delivery'],
      interests: ['Mentorship', 'Code Quality'],
      bio: 'Engineering Supervisor overseeing onboarding, technical assessments, and project delivery.',
      role: 'supervisor' as const,
      supervisorPermissions: {
        canApproveMembers: true,
        canManageAssessments: true,
        canViewSessions: true,
        canRevokeSessions: true,
        canManageTasksAndGroups: true,
        canViewAnalytics: true,
        canManageIntegrations: false,
      },
      status: 'approved' as const,
      emailVerified: true,
      twoFactorEnabled: false,
      humanVerified: true,
      onboarding: {
        profileCompleted: true,
        cvCompleted: true,
        humanVerified: true,
        assessmentCompleted: true,
        applicationSubmitted: true,
      },
      preferredLanguage: 'en' as const,
      createdAt: dayAgo,
      lastActiveAt: hourAgo,
    },
    {
      id: 'usr-mem-01',
      fullName: 'Omar El-Sayed',
      email: 'member@kaviro.ai',
      passwordHash: demoPasswordHash,
      phone: '+20 100 742 8819',
      whatsapp: '+20 100 742 8819',
      desiredRole: 'Senior Full-Stack Engineer',
      department: 'Core Product Engineering',
      skills: ['React', 'Next.js', 'TypeScript', 'PostgreSQL', 'Node.js'],
      interests: ['AI Workflows', 'Realtime Collaboration'],
      bio: 'Full-stack engineer focused on resilient web platforms and bilingual interfaces.',
      role: 'member' as const,
      status: 'approved' as const,
      emailVerified: true,
      twoFactorEnabled: false,
      humanVerified: true,
      onboarding: {
        profileCompleted: true,
        cvCompleted: true,
        humanVerified: true,
        assessmentCompleted: false,
        applicationSubmitted: true,
      },
      preferredLanguage: 'en' as const,
      createdAt: dayAgo,
      lastActiveAt: now,
    },
    {
      id: 'usr-mem-02',
      fullName: 'Lina Haddad',
      email: 'lina.haddad@kaviro.ai',
      passwordHash: demoPasswordHash,
      phone: '+962 79 514 2201',
      desiredRole: 'Product Designer',
      department: 'Design Systems',
      skills: ['Figma', 'Design Tokens', 'Accessibility', 'Arabic RTL UI'],
      interests: ['Design Engineering', 'Micro-interactions'],
      bio: 'Product designer specializing in bilingual RTL enterprise interfaces.',
      role: 'member' as const,
      status: 'pending' as const,
      emailVerified: true,
      twoFactorEnabled: false,
      humanVerified: true,
      onboarding: {
        profileCompleted: true,
        cvCompleted: true,
        humanVerified: true,
        assessmentCompleted: true,
        applicationSubmitted: true,
      },
      preferredLanguage: 'ar' as const,
      createdAt: hourAgo,
      lastActiveAt: hourAgo,
    },
  ];

  const cvs = [
    {
      id: 'cv-mem-01',
      userId: 'usr-mem-01',
      fullName: 'Omar El-Sayed',
      headline: 'Senior Full-Stack Engineer · TypeScript & Cloud Architecture',
      email: 'member@kaviro.ai',
      phone: '+20 100 742 8819',
      location: 'Cairo, Egypt',
      summary:
        'Full-stack software engineer with 6+ years of experience building real-time SaaS applications, relational data pipelines, and accessible bilingual web products.',
      education: [
        {
          id: 'edu-1',
          institution: 'Cairo University',
          degree: 'B.Sc.',
          field: 'Computer Engineering',
          startYear: '2015',
          endYear: '2019',
        },
      ],
      experience: [
        {
          id: 'exp-1',
          company: 'NileCloud Systems',
          title: 'Senior Software Engineer',
          period: '2022 – Present',
          description:
            'Led migration of team workspace dashboard to TypeScript and WebSockets, cutting live sync latency by 42% across 18,000 weekly active users.',
        },
        {
          id: 'exp-2',
          company: 'Delta Fintech',
          title: 'Full-Stack Developer',
          period: '2019 – 2022',
          description:
            'Built automated reconciliation workflows and internal review tooling using React, Node.js, and PostgreSQL.',
        },
      ],
      projects: [
        {
          id: 'prj-1',
          name: 'Realtime Collab Engine',
          role: 'Lead Architect',
          summary: 'Multi-room WebSocket messaging and presence service with offline recovery.',
          impact: 'Supported 4,500 concurrent team channels with 99.95% delivery reliability.',
        },
      ],
      achievements: [
        'Reduced CI build pipeline duration from 14 minutes to 4 minutes.',
        'Mentored 5 junior engineers through structured code reviews.',
      ],
      technicalSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'WebSockets', 'Tailwind CSS'],
      softSkills: ['Cross-functional Communication', 'Technical Mentorship', 'System Ownership'],
      updatedAt: hourAgo,
    },
  ];

  const assessments = [
    {
      id: 'asm-eng-01',
      title: 'Full-Stack Architecture & Security Readiness',
      titleAr: 'اختبار جاهزية البنية البرمجية والأمن السيبراني',
      description:
        'Evaluates practical engineering judgment across authentication, real-time state, API security, and system trade-offs.',
      category: 'Engineering',
      timeLimitMinutes: 20,
      maxAttempts: 3,
      passingScore: 70,
      assignedUserIds: ['usr-mem-01', 'usr-mem-02'],
      randomizeQuestions: true,
      createdBy: 'usr-sup-01',
      createdAt: dayAgo,
      questions: [
        {
          id: 'q-1',
          type: 'mcq' as const,
          prompt: 'Where should Role-Based Access Control (RBAC) permissions be enforced in a production SaaS platform?',
          promptAr: 'أين يجب فرض صلاحيات الوصول المعتمدة على الأدوار (RBAC) في منصة SaaS احترافية؟',
          options: [
            'Only in React UI route guards',
            'On the server API layer for every protected endpoint',
            'Inside browser localStorage flags',
            'Only during user login',
          ],
          correctAnswer: 'On the server API layer for every protected endpoint',
          points: 25,
        },
        {
          id: 'q-2',
          type: 'true_false' as const,
          prompt: 'True or False: Password hashes should always use a unique per-user cryptographic salt.',
          promptAr: 'صح أم خطأ: يجب دائماً استخدام ملح تشفير فريد (Salt) لكل مستخدم عند تجزئة كلمات المرور.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          points: 20,
        },
        {
          id: 'q-3',
          type: 'scenario' as const,
          prompt:
            'Scenario: A supervisor notices a team account signed in simultaneously from an unrecognized OS and location. Outline the immediate steps you would take to contain and audit the incident.',
          promptAr:
            'سيناريو: لاحظ المشرف تسجيل دخول لحساب عضو من نظام تشغيل غير معتاد. ما الخطوات الفورية التي تتخذها لاحتواء الحادث ومراجعته؟',
          points: 30,
        },
        {
          id: 'q-4',
          type: 'written' as const,
          prompt:
            'Briefly explain how you prevent duplicate messages when a WebSocket client reconnects after a brief network drop.',
          promptAr:
            'اشرح باختصار كيف تمنع تكرار الرسائل عند إعادة اتصال عميل WebSocket بعد انقطاع الشبكة.',
          points: 25,
        },
      ],
    },
    {
      id: 'asm-design-01',
      title: 'Bilingual Design Systems & Accessibility',
      titleAr: 'أنظمة التصميم ثنائية اللغة وإتاحة الوصول',
      description: 'Covers RTL mirroring, contrast ratios, and component token consistency.',
      category: 'Design',
      timeLimitMinutes: 15,
      maxAttempts: 2,
      passingScore: 75,
      assignedUserIds: ['usr-mem-02'],
      randomizeQuestions: false,
      createdBy: 'usr-sup-01',
      createdAt: dayAgo,
      questions: [
        {
          id: 'q-d1',
          type: 'mcq' as const,
          prompt: 'What is the minimum WCAG AA contrast ratio for standard body text?',
          options: ['2.5:1', '3.0:1', '4.5:1', '7.0:1'],
          correctAnswer: '4.5:1',
          points: 50,
        },
        {
          id: 'q-d2',
          type: 'written' as const,
          prompt: 'Explain two layout adjustments required when switching an analytical dashboard from LTR English to RTL Arabic.',
          points: 50,
        },
      ],
    },
  ];

  const attempts = [
    {
      id: 'att-lina-01',
      assessmentId: 'asm-design-01',
      userId: 'usr-mem-02',
      startedAt: hourAgo,
      submittedAt: hourAgo,
      answers: [
        {
          questionId: 'q-d1',
          answer: '4.5:1',
          isCorrect: true,
          pointsAwarded: 50,
        },
        {
          questionId: 'q-d2',
          answer:
            'Mirror sidebar docking and directional icons (chevrons, back arrows) while keeping numeric metrics tabular and directional charts readable.',
          pointsAwarded: 0,
        },
      ],
      autoScore: 50,
      manualScore: 0,
      totalScore: 50,
      maxScore: 100,
      status: 'pending_review' as const,
    },
  ];

  const conversations = [
    {
      id: 'conv-grp-core',
      type: 'group' as const,
      name: 'Core Engineering & Onboarding',
      description: 'Main workspace channel for platform architecture, sprint updates, and onboarding.',
      announcement: 'Welcome to KAVIRO Q4 Sprint. Please complete your Human Verification before Friday.',
      memberIds: ['usr-admin-01', 'usr-sup-01', 'usr-mem-01', 'usr-mem-02'],
      adminIds: ['usr-admin-01', 'usr-sup-01'],
      pinnedMessageIds: ['msg-01'],
      createdAt: dayAgo,
      updatedAt: hourAgo,
    },
    {
      id: 'conv-dm-sup-mem',
      type: 'direct' as const,
      name: 'Sarah Chen & Omar El-Sayed',
      memberIds: ['usr-sup-01', 'usr-mem-01'],
      adminIds: ['usr-sup-01', 'usr-mem-01'],
      pinnedMessageIds: [],
      createdAt: dayAgo,
      updatedAt: hourAgo,
    },
  ];

  const messages: KaviroDatabase['messages'] = [
    {
      id: 'msg-01',
      conversationId: 'conv-grp-core',
      senderId: 'usr-sup-01',
      content: 'Welcome to the KAVIRO Core Engineering channel. Review your onboarding checklist and upcoming skill assessments.',
      reactions: { '👍': ['usr-admin-01', 'usr-mem-01'] },
      readBy: ['usr-sup-01', 'usr-admin-01', 'usr-mem-01'],
      createdAt: dayAgo,
    },
    {
      id: 'msg-02',
      conversationId: 'conv-grp-core',
      senderId: 'usr-mem-01',
      content: 'Thanks Sarah! My CV draft is uploaded and ready for review.',
      replyToId: 'msg-01',
      reactions: {},
      readBy: ['usr-mem-01', 'usr-sup-01'],
      createdAt: hourAgo,
    },
    {
      id: 'msg-03',
      conversationId: 'conv-dm-sup-mem',
      senderId: 'usr-sup-01',
      content: 'Hi Omar, let me know once you finish the Full-Stack Architecture assessment so we can finalize your project assignment.',
      reactions: {},
      readBy: ['usr-sup-01', 'usr-mem-01'],
      createdAt: hourAgo,
    },
  ];

  const projects = [
    {
      id: 'proj-01',
      name: 'KAVIRO Platform v2 Rollout',
      description: 'Unified onboarding, AI CV intelligence, and enterprise session security rollout.',
      leadId: 'usr-sup-01',
      memberIds: ['usr-admin-01', 'usr-sup-01', 'usr-mem-01', 'usr-mem-02'],
      status: 'active' as const,
      createdAt: dayAgo,
    },
    {
      id: 'proj-02',
      name: 'Security & Compliance Audit',
      description: 'Session monitoring, RBAC enforcement, and assessment integrity controls.',
      leadId: 'usr-admin-01',
      memberIds: ['usr-admin-01', 'usr-sup-01'],
      status: 'active' as const,
      createdAt: dayAgo,
    },
  ];

  const tasks = [
    {
      id: 'tsk-01',
      projectId: 'proj-01',
      title: 'Finalize Bilingual RTL Navigation Tokens',
      description: 'Verify sidebar, header breadcrumbs, and modals mirror cleanly in Arabic mode.',
      assigneeId: 'usr-mem-02',
      reporterId: 'usr-sup-01',
      status: 'in_review' as const,
      priority: 'high' as const,
      progress: 85,
      deadline: tomorrow.slice(0, 10),
      comments: [
        {
          id: 'cmt-1',
          authorId: 'usr-sup-01',
          text: 'Looks crisp on 1440px desktop; verify mobile drawer spacing next.',
          createdAt: hourAgo,
        },
      ],
      attachments: [],
      createdAt: dayAgo,
      updatedAt: hourAgo,
    },
    {
      id: 'tsk-02',
      projectId: 'proj-01',
      title: 'Complete Full-Stack Architecture Assessment',
      description: 'Pass human verification CAPTCHA and complete timed engineering assessment.',
      assigneeId: 'usr-mem-01',
      reporterId: 'usr-sup-01',
      status: 'in_progress' as const,
      priority: 'urgent' as const,
      progress: 50,
      deadline: tomorrow.slice(0, 10),
      comments: [],
      attachments: [],
      createdAt: dayAgo,
      updatedAt: hourAgo,
    },
    {
      id: 'tsk-03',
      projectId: 'proj-02',
      title: 'Review Pending Candidate Applications & Sessions',
      description: 'Audit unusual login alerts and grade written design assessment submissions.',
      assigneeId: 'usr-sup-01',
      reporterId: 'usr-admin-01',
      status: 'backlog' as const,
      priority: 'medium' as const,
      progress: 20,
      deadline: twoDaysLater.slice(0, 10),
      comments: [],
      attachments: [],
      createdAt: dayAgo,
      updatedAt: dayAgo,
    },
    {
      id: 'tsk-04',
      projectId: 'proj-02',
      title: 'Configure Production Rate Limiting Rules',
      description: 'Apply sliding-window rate limits to authentication and AI analysis routes.',
      assigneeId: 'usr-admin-01',
      reporterId: 'usr-admin-01',
      status: 'done' as const,
      priority: 'high' as const,
      progress: 100,
      deadline: now.slice(0, 10),
      comments: [],
      attachments: [],
      createdAt: dayAgo,
      updatedAt: hourAgo,
    },
  ];

  const meetings = [
    {
      id: 'mtg-01',
      title: 'Weekly Engineering & Onboarding Sync',
      description: 'Review candidate assessment pipelines, project milestones, and security alerts.',
      organizerId: 'usr-sup-01',
      participantIds: ['usr-admin-01', 'usr-sup-01', 'usr-mem-01'],
      startTime: tomorrow,
      endTime: new Date(new Date(tomorrow).getTime() + 45 * 60000).toISOString(),
      provider: 'internal' as const,
      createdAt: dayAgo,
    },
  ];

  const integrations = [
    {
      provider: 'google' as const,
      connected: false,
      scopes: [],
      note: 'Google Workspace OAuth credentials not configured yet. Connect with a valid Google OAuth access token or client credentials to enable Calendar sync.',
    },
    {
      provider: 'zoom' as const,
      connected: false,
      scopes: [],
      note: 'Zoom OAuth / Server-to-Server credentials not configured yet. Provide valid Zoom Account ID, Client ID, and Client Secret or meeting webhook to activate.',
    },
  ];

  const notifications = [
    {
      id: 'notif-01',
      userId: 'usr-sup-01',
      category: 'application' as const,
      title: 'New Application Ready for Review',
      body: 'Lina Haddad submitted her onboarding application and design assessment.',
      read: false,
      createdAt: hourAgo,
      targetTab: 'dashboard',
    },
    {
      id: 'notif-02',
      userId: 'usr-mem-01',
      category: 'assessment' as const,
      title: 'Assigned Assessment Pending',
      body: 'Full-Stack Architecture & Security Readiness assessment is assigned to you.',
      read: false,
      createdAt: hourAgo,
      targetTab: 'assessments',
    },
    {
      id: 'notif-03',
      userId: 'usr-admin-01',
      category: 'security' as const,
      title: 'Session Security Policy Active',
      body: 'Unusual device detection and server-side session revocation are active.',
      read: false,
      createdAt: dayAgo,
      targetTab: 'security',
    },
  ];

  const auditLogs = [
    {
      id: 'aud-01',
      actorId: 'usr-admin-01',
      action: 'SECURITY_POLICY_INIT',
      targetType: 'system',
      targetId: 'kaviro-core',
      details: 'Initialized RBAC, rate limiting, and session audit logging.',
      ipAddress: '127.0.0.1',
      createdAt: dayAgo,
    },
    {
      id: 'aud-02',
      actorId: 'usr-sup-01',
      action: 'ASSESSMENT_CREATED',
      targetType: 'assessment',
      targetId: 'asm-eng-01',
      details: 'Published Full-Stack Architecture & Security Readiness assessment.',
      ipAddress: '127.0.0.1',
      createdAt: dayAgo,
    },
  ];

  const sessions = [
    {
      id: 'ses-seed-01',
      userId: 'usr-mem-02',
      tokenHash: crypto.createHash('sha256').update('seed-inactive').digest('hex'),
      deviceType: 'Mobile' as const,
      browser: 'Apple Safari',
      os: 'iOS',
      ipAddress: '192.168.10.42',
      loginAt: hourAgo,
      lastActivityAt: hourAgo,
      status: 'active' as const,
      isUnusual: true,
      alertReason: 'First sign-in from new iOS Mobile device',
    },
  ];

  return {
    users,
    sessions,
    cvs,
    assessments,
    attempts,
    conversations,
    messages,
    projects,
    tasks,
    meetings,
    integrations,
    notifications,
    auditLogs,
  };
}

let dbCache: KaviroDatabase | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function getDb(): KaviroDatabase {
  if (dbCache) return dbCache;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      dbCache = JSON.parse(raw) as KaviroDatabase;
      return dbCache;
    } catch {
      // Fallback to fresh seed if corrupted
    }
  }
  dbCache = createSeedDatabase();
  fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf8');
  return dbCache;
}

export function saveDb(): Promise<void> {
  const snapshot = JSON.stringify(getDb(), null, 2);
  writeQueue = writeQueue.then(async () => {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    await fs.promises.writeFile(tmpFile, snapshot, 'utf8');
    await fs.promises.rename(tmpFile, DB_FILE);
  });
  return writeQueue;
}
