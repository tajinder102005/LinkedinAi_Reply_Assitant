import {
  getAISettings,
  buildPrompt,
  callGroqAPI,
  callGeminiAPI,
  callOpenAIAPI,
  generateFastModeOutreach,
} from './aiEngine';

export interface DraftVariation {
  id: string;
  title: string;
  tag: string;
  text: string;
  charCount: number;
  wordCount: number;
  type: string;
}

export interface OutreachRequest {
  recipientName?: string;
  recipientHeadline?: string;
  recipientAbout?: string;
  currentCompany?: string;
  currentRole?: string;
  recentActivity?: string;
  threadContext?: string;
  intentMode: string;
  tone?: string;
  messageLength?: string;
  userNotes?: string;
  charLimit?: number;
  mock?: boolean;
}

export interface OutreachResponse {
  success: boolean;
  verifiedSignal?: string;
  relevanceReason?: string;
  hasMeaningfulSignal?: boolean;
  drafts: DraftVariation[];
  intentMode?: string;
  isMock?: boolean;
  message?: string;
  error?: string;
}

export async function checkBackendHealth(): Promise<{ online: boolean; message: string }> {
  const settings = await getAISettings();
  const currentKey =
    settings.provider === 'groq'
      ? settings.groqKey
      : settings.provider === 'gemini'
      ? settings.geminiKey
      : settings.openaiKey;

  if (currentKey && currentKey.trim().length > 5) {
    const providerName = settings.provider === 'groq' ? 'Groq' : settings.provider === 'gemini' ? 'Gemini' : 'OpenAI';
    return {
      online: true,
      message: `AI Model Ready (${providerName})`,
    };
  }

  return {
    online: false,
    message: 'No API Key Saved',
  };
}

export async function generateOutreach(payload: OutreachRequest): Promise<OutreachResponse> {
  // 1. Fast Mode / Instant Templates
  if (payload.mock) {
    return generateFastModeOutreach(payload);
  }

  // 2. Direct Client-Side AI with User's Saved Key
  const settings = await getAISettings();
  const provider = settings.provider || 'groq';
  const apiKey =
    provider === 'groq'
      ? settings.groqKey
      : provider === 'gemini'
      ? settings.geminiKey
      : settings.openaiKey;

  if (apiKey && apiKey.trim().length > 5) {
    const prompt = buildPrompt(payload, payload.intentMode || 'referral');

    try {
      if (provider === 'groq') {
        return await callGroqAPI(prompt, apiKey.trim());
      } else if (provider === 'gemini') {
        return await callGeminiAPI(prompt, apiKey.trim());
      } else if (provider === 'openai') {
        return await callOpenAIAPI(prompt, apiKey.trim());
      }
    } catch (err: any) {
      console.warn(`[LinkedIn AI] Direct ${provider} call failed:`, err);
      throw new Error(`AI Generation failed (${provider}): ${err.message || err}`);
    }
  }

  // 3. No Key Configured Error with clear instructions
  throw new Error('NO_KEY_SAVED: Please enter your free API Key in ⚙️ Settings, or use Fast Mode.');
}
