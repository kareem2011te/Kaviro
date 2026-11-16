import { GoogleGenAI, Type } from '@google/genai';
import type { UserCv, SafeUser } from './types.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

export async function analyzeCvWithGemini(params: {
  cv: Partial<UserCv>;
  language: 'en' | 'ar';
  pdfBase64?: string;
  extractedText?: string;
}): Promise<CvAnalysisResult> {
  const ai = getGeminiClient();
  const langLabel = params.language === 'ar' ? 'Arabic' : 'English';

  const systemInstruction = `You are the KAVIRO AI CV Analyst.
Analyze the user's CV and produce constructive, honest improvements in ${langLabel}.
CRITICAL RULES:
1. NEVER invent, fabricate, or hallucinate degrees, companies, job titles, dates, certifications, or skills that the user did not provide.
2. Only refine wording, grammar, clarity, and structure of existing information, and ask targeted follow-up questions for missing details.
3. All proposed edits in improvedDraft and projectSuggestions are a DRAFT requiring explicit user approval before being saved.`;

  const textPrompt = `Analyze this CV data and any attached document content:
Structured CV JSON:
${JSON.stringify(params.cv, null, 2)}

${params.extractedText ? `Uploaded Document Extracted Text:\n${params.extractedText.slice(0, 12000)}` : ''}

Return a comprehensive analysis with missing information, follow-up questions, grammar fixes, project description enhancements (strictly based on provided projects), and an improved draft.`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (params.pdfBase64) {
    parts.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: params.pdfBase64,
      },
    });
  }
  parts.push({ text: textPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallReadiness: {
            type: Type.STRING,
            description: 'Concise qualitative assessment of the CV clarity and completeness.',
          },
          missingInformation: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Specific sections or details missing from the CV.',
          },
          followUpQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Relevant follow-up questions to help the candidate strengthen their CV truthfully.',
          },
          grammarAndWordingFixes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Specific grammar, clarity, or phrasing improvements.',
          },
          projectSuggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                projectName: { type: Type.STRING },
                improvedSummary: { type: Type.STRING },
                improvedImpact: { type: Type.STRING },
              },
              required: ['projectName', 'improvedSummary', 'improvedImpact'],
            },
          },
          improvedDraft: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              technicalSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
              softSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['headline', 'summary', 'technicalSkills', 'softSkills'],
          },
        },
        required: [
          'overallReadiness',
          'missingInformation',
          'followUpQuestions',
          'grammarAndWordingFixes',
          'projectSuggestions',
          'improvedDraft',
        ],
      },
    },
  });

  const raw = (response.text ?? '{}').trim();
  return JSON.parse(raw) as CvAnalysisResult;
}

export async function runKaviroAssistant(params: {
  user: SafeUser;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  permittedContext: {
    tasksSummary: string;
    meetingsSummary: string;
    assessmentsSummary: string;
    teamSummary?: string;
    cvHeadline?: string;
  };
}): Promise<string> {
  const ai = getGeminiClient();

  const systemInstruction = `You are KAVIRO AI, the official bilingual (Arabic and English) digital assistant for the KAVIRO Team Management Platform.
Respond in the same language the user writes in (Arabic if they write in Arabic, English if they write in English).
Keep answers clear, structured, actionable, and grounded ONLY in the user's permitted workspace context below. Never reveal sensitive data outside the user's role (${params.user.role}).
Never fabricate facts, metrics, or external connection statuses.

Current User:
- Name: ${params.user.fullName}
- Role: ${params.user.role}
- Department: ${params.user.department}
- Desired Role: ${params.user.desiredRole}
- Status: ${params.user.status}
- Human Verified: ${params.user.humanVerified}

Permitted Workspace Context:
- CV Headline: ${params.permittedContext.cvHeadline || 'No CV created yet'}
- Tasks: ${params.permittedContext.tasksSummary}
- Upcoming Meetings: ${params.permittedContext.meetingsSummary}
- Assessments: ${params.permittedContext.assessmentsSummary}
${params.permittedContext.teamSummary ? `- Team Overview (Authorized): ${params.permittedContext.teamSummary}` : ''}`;

  const historyLines = params.history
    .slice(-8)
    .map((h) => `${h.role === 'user' ? 'User' : 'KAVIRO AI'}: ${h.text}`)
    .join('\n');

  const prompt = historyLines
    ? `Conversation history:\n${historyLines}\n\nLatest user message:\n${params.message}`
    : params.message;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
    },
  });

  return response.text || 'I could not generate a response right now. Please try again.';
}
