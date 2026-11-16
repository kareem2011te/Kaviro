export type UserRole = 'member' | 'supervisor' | 'admin';
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface SupervisorPermissions {
  canApproveMembers: boolean;
  canManageAssessments: boolean;
  canViewSessions: boolean;
  canRevokeSessions: boolean;
  canManageTasksAndGroups: boolean;
  canViewAnalytics: boolean;
  canManageIntegrations: boolean;
}

export interface OnboardingProgress {
  profileCompleted: boolean;
  cvCompleted: boolean;
  humanVerified: boolean;
  assessmentCompleted: boolean;
  applicationSubmitted: boolean;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  avatarUrl?: string;
  desiredRole: string;
  department: string;
  skills: string[];
  interests?: string[];
  bio?: string;
  role: UserRole;
  supervisorPermissions?: SupervisorPermissions;
  status: AccountStatus;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  humanVerified?: boolean;
  onboarding?: OnboardingProgress;
  preferredLanguage?: 'en' | 'ar';
  createdAt?: string;
  lastActiveAt?: string;
  isOnline?: boolean;
}

export interface SessionRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  deviceType: 'Desktop' | 'Tablet' | 'Mobile';
  browser: string;
  os: string;
  ipAddress: string;
  loginAt: string;
  logoutAt?: string;
  lastActivityAt: string;
  status: 'active' | 'revoked' | 'logged_out';
  isUnusual: boolean;
  alertReason?: string;
  isCurrent: boolean;
}

export interface CvEducation {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
}

export interface CvExperience {
  id: string;
  company: string;
  title: string;
  period: string;
  description: string;
}

export interface CvProject {
  id: string;
  name: string;
  role: string;
  summary: string;
  impact: string;
}

export interface UserCv {
  id?: string;
  userId?: string;
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  education: CvEducation[];
  experience: CvExperience[];
  projects: CvProject[];
  achievements: string[];
  technicalSkills: string[];
  softSkills: string[];
  uploadedFileName?: string;
  uploadedFileMime?: string;
  rawExtractedText?: string;
  updatedAt?: string;
}

export interface CvAnalysisResult {
  overallReadiness: string;
  missingInformation: string[];
  followUpQuestions: string[];
  grammarAndWordingFixes: string[];
  projectSuggestions: { projectName: string; improvedSummary: string; improvedImpact: string }[];
  improvedDraft: {
    headline: string;
    summary: string;
    technicalSkills: string[];
    softSkills: string[];
  };
}

export type QuestionType = 'mcq' | 'true_false' | 'written' | 'scenario';

export interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  promptAr?: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
}

export interface Assessment {
  id: string;
  title: string;
  titleAr?: string;
  description: string;
  category: string;
  timeLimitMinutes: number;
  maxAttempts: number;
  passingScore: number;
  assignedUserIds: string[];
  randomizeQuestions: boolean;
  questions: AssessmentQuestion[];
  createdBy: string;
  createdAt: string;
}

export interface AttemptAnswer {
  questionId: string;
  answer: string;
  isCorrect?: boolean;
  pointsAwarded: number;
  feedback?: string;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  userId: string;
  startedAt: string;
  submittedAt?: string;
  answers: AttemptAnswer[];
  autoScore: number;
  manualScore: number;
  totalScore: number;
  maxScore: number;
  status: 'in_progress' | 'pending_review' | 'graded';
  passed?: boolean;
  reviewedBy?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  description?: string;
  announcement?: string;
  memberIds: string[];
  adminIds: string[];
  pinnedMessageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  replyToId?: string;
  reactions: Record<string, string[]>;
  attachment?: ChatAttachment;
  readBy: string[];
  createdAt: string;
}

export type TaskStatus = 'backlog' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  id: string;
  name: string;
  description: string;
  leadId: string;
  memberIds: string[];
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
}

export interface TaskComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assigneeId: string;
  reporterId: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  deadline: string;
  comments: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  description: string;
  organizerId: string;
  participantIds: string[];
  startTime: string;
  endTime: string;
  provider: 'internal' | 'google_meet' | 'zoom';
  meetingUrl?: string;
  createdAt: string;
}

export interface IntegrationConfig {
  provider: 'google' | 'zoom';
  connected: boolean;
  accountEmail?: string;
  scopes: string[];
  verifiedAt?: string;
  note: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  category: 'meeting' | 'task' | 'message' | 'announcement' | 'assessment' | 'security' | 'application';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  targetTab?: string;
}

export interface AnalyticsPayload {
  memberStats: {
    total: number;
    approved: number;
    pending: number;
    humanVerified: number;
  };
  taskStats: {
    total: number;
    backlog: number;
    inProgress: number;
    inReview: number;
    done: number;
  };
  assessmentStats: {
    totalAssessments: number;
    totalAttempts: number;
    pendingReviews: number;
    avgScorePct: number;
  };
  securityStats: {
    activeSessions: number;
    unusualAlerts: number;
  };
  projectProgress: { id: string; name: string; taskCount: number; progress: number }[];
  auditLogs: {
    id: string;
    actorId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string;
    details: string;
    ipAddress: string;
    createdAt: string;
  }[];
}
