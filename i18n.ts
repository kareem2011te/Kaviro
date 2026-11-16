export type Language = 'en' | 'ar';

export type NavTab =
  | 'dashboard'
  | 'design-system'
  | 'cv-builder'
  | 'assessments'
  | 'messages'
  | 'tasks'
  | 'meetings'
  | 'security'
  | 'analytics'
  | 'profile';

export const translations = {
  en: {
    brand: 'KAVIRO',
    tagline: 'AI-Powered Team Management Platform',
    nav: {
      dashboard: 'Dashboard',
      'design-system': 'Design System',
      'cv-builder': 'AI CV Builder',
      assessments: 'Assessments',
      messages: 'Messages',
      tasks: 'Tasks & Projects',
      meetings: 'Meetings & Sync',
      security: 'Sessions & Security',
      analytics: 'Reports & Export',
      profile: 'Profile & 2FA',
    },
    actions: {
      signIn: 'Sign In',
      register: 'Create Account',
      signOut: 'Sign Out',
      save: 'Save Changes',
      cancel: 'Cancel',
      approve: 'Approve',
      reject: 'Reject',
      revoke: 'Force Logout',
      downloadZip: 'Download Website (.zip)',
      downloadCsv: 'Export CSV',
      askAi: 'KAVIRO AI',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
    },
    dashboard: {
      welcome: 'Workspace Overview',
      subtitle: 'Unified control center for team onboarding, assessments, projects, and security telemetry.',
      totalMembers: 'Total Members',
      activeMembers: 'Approved Active',
      pendingApps: 'Pending Applications',
      securityAlerts: 'Unusual Logins',
      onboardingTitle: 'Member Onboarding Pipeline',
      onboardingSteps: [
        'Profile completion',
        'CV creation or upload',
        'Human verification',
        'Assigned skill assessment',
        'Application submission',
      ],
      submitApplication: 'Submit Application',
      applicationSubmitted: 'Application Submitted',
      pendingQueue: 'Pending Member Approvals',
      recentActivity: 'Recent Audit Activity',
    },
    designSystem: {
      title: 'KAVIRO Design System',
      subtitle: 'Visual architecture anchored to the official KAVIRO brand mark, Blue Dark surfaces, and bilingual RTL/LTR typography.',
    },
  },
  ar: {
    brand: 'KAVIRO',
    tagline: 'منصة إدارة الفرق الذكية المدعومة بالذكاء الاصطناعي',
    nav: {
      dashboard: 'لوحة التحكم',
      'design-system': 'نظام التصميم',
      'cv-builder': 'منشئ السيرة الذاتية',
      assessments: 'الاختبارات والتقييم',
      messages: 'المراسلات الفورية',
      tasks: 'المهام والمشاريع',
      meetings: 'الاجتماعات والتكامل',
      security: 'الجلسات والأمان',
      analytics: 'التقارير والتنزيل',
      profile: 'الملف الشخصي و 2FA',
    },
    actions: {
      signIn: 'تسجيل الدخول',
      register: 'إنشاء حساب',
      signOut: 'تسجيل الخروج',
      save: 'حفظ التغييرات',
      cancel: 'إلغاء',
      approve: 'موافقة',
      reject: 'رفض',
      revoke: 'إنهاء الجلسة فوراً',
      downloadZip: 'تنزيل الموقع (.zip)',
      downloadCsv: 'تصدير CSV',
      askAi: 'مساعد KAVIRO',
      lightMode: 'الوضع الفاتح',
      darkMode: 'الوضع الداكن',
    },
    dashboard: {
      welcome: 'مركز عمليات الفريق',
      subtitle: 'لوحة تحكم موحدة لمتابعة انضمام الأعضاء، التقييمات، المشاريع، ومراقبة الجلسات.',
      totalMembers: 'إجمالي الأعضاء',
      activeMembers: 'الأعضاء المعتمدون',
      pendingApps: 'طلبات بانتظار المراجعة',
      securityAlerts: 'تنبيهات دخول غير معتادة',
      onboardingTitle: 'مسار تأهيل العضو الجديد',
      onboardingSteps: [
        'استكمال الملف الشخصي',
        'إنشاء أو رفع السيرة الذاتية',
        'التحقق البشري (CAPTCHA)',
        'إتمام اختبار المهارات المخصص',
        'تقديم طلب الانضمام النهائي',
      ],
      submitApplication: 'تقديم الطلب النهائي',
      applicationSubmitted: 'تم تقديم الطلب بنجاح',
      pendingQueue: 'طلبات الانضمام المعلقة',
      recentActivity: 'أحدث سجلات التدقيق والنشاط',
    },
    designSystem: {
      title: 'نظام تصميم KAVIRO',
      subtitle: 'الهوية البصرية المشتقة مباشرة من شعار KAVIRO الرسمي، مع ألوان الأزرق الداكن ودعم كامل للغة العربية RTL.',
    },
  },
} as const;
