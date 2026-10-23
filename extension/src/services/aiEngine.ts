import { DraftVariation, OutreachRequest, OutreachResponse } from './api';

export type AIProvider = 'groq' | 'gemini' | 'openai';

export interface AISettings {
  provider: AIProvider;
  groqKey: string;
  geminiKey: string;
  openaiKey: string;
}

const STORAGE_KEYS = {
  PROVIDER: 'lk_ai_provider',
  GROQ_KEY: 'lk_groq_api_key',
  GEMINI_KEY: 'lk_gemini_api_key',
  OPENAI_KEY: 'lk_openai_api_key',
};

export async function getAISettings(): Promise<AISettings> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve({
        provider: (localStorage.getItem(STORAGE_KEYS.PROVIDER) as AIProvider) || 'groq',
        groqKey: localStorage.getItem(STORAGE_KEYS.GROQ_KEY) || '',
        geminiKey: localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) || '',
        openaiKey: localStorage.getItem(STORAGE_KEYS.OPENAI_KEY) || '',
      });
      return;
    }

    chrome.storage.local.get(
      [STORAGE_KEYS.PROVIDER, STORAGE_KEYS.GROQ_KEY, STORAGE_KEYS.GEMINI_KEY, STORAGE_KEYS.OPENAI_KEY],
      (res) => {
        resolve({
          provider: (res[STORAGE_KEYS.PROVIDER] as AIProvider) || 'groq',
          groqKey: res[STORAGE_KEYS.GROQ_KEY] || '',
          geminiKey: res[STORAGE_KEYS.GEMINI_KEY] || '',
          openaiKey: res[STORAGE_KEYS.OPENAI_KEY] || '',
        });
      }
    );
  });
}

export async function saveAISettings(settings: Partial<AISettings>): Promise<void> {
  return new Promise((resolve) => {
    const toSave: Record<string, any> = {};
    if (settings.provider) toSave[STORAGE_KEYS.PROVIDER] = settings.provider;
    if (settings.groqKey !== undefined) toSave[STORAGE_KEYS.GROQ_KEY] = settings.groqKey.trim();
    if (settings.geminiKey !== undefined) toSave[STORAGE_KEYS.GEMINI_KEY] = settings.geminiKey.trim();
    if (settings.openaiKey !== undefined) toSave[STORAGE_KEYS.OPENAI_KEY] = settings.openaiKey.trim();

    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      if (toSave[STORAGE_KEYS.PROVIDER]) localStorage.setItem(STORAGE_KEYS.PROVIDER, toSave[STORAGE_KEYS.PROVIDER]);
      if (toSave[STORAGE_KEYS.GROQ_KEY] !== undefined) localStorage.setItem(STORAGE_KEYS.GROQ_KEY, toSave[STORAGE_KEYS.GROQ_KEY]);
      if (toSave[STORAGE_KEYS.GEMINI_KEY] !== undefined) localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, toSave[STORAGE_KEYS.GEMINI_KEY]);
      if (toSave[STORAGE_KEYS.OPENAI_KEY] !== undefined) localStorage.setItem(STORAGE_KEYS.OPENAI_KEY, toSave[STORAGE_KEYS.OPENAI_KEY]);
      resolve();
      return;
    }

    chrome.storage.local.set(toSave, () => resolve());
  });
}

export function parseJobDetails(userNotes?: string): Record<string, string> {
  const details: Record<string, string> = {};
  if (!userNotes || !userNotes.trim()) return details;

  const clean = userNotes.replace(/undefined\s*:\s*/gi, '').trim();

  const jobIdMatch = clean.match(/job\s*id\s*[:=-]\s*([A-Za-z0-9_-]+)/i);
  if (jobIdMatch) details.jobId = jobIdMatch[1].trim();

  const locMatch = clean.match(/location\s*[:=-]\s*([^\n]+)/i);
  if (locMatch) details.location = locMatch[1].trim();

  const modeMatch = clean.match(/\b(hybrid|remote|on-site|onsite)\b/i);
  if (modeMatch) details.workMode = modeMatch[1].trim();

  const compMatch = clean.match(/(?:company|organization|org)\s*[:=-]\s*([^\n]+)/i);
  if (compMatch) {
    details.company = compMatch[1].trim();
  }

  const lines = clean.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(role|title|position)\s*:/i.test(trimmed)) {
      details.title = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      break;
    } else if (
      !/location/i.test(trimmed) &&
      !/job\s*id/i.test(trimmed) &&
      !/hybrid|remote|on-site/i.test(trimmed) &&
      trimmed.length > 3 &&
      trimmed.length < 50 &&
      !details.title
    ) {
      details.title = trimmed;
    }
  }

  return details;
}

export function buildPrompt(request: OutreachRequest, mode: string): string {
  let recipient = request.recipientName ? request.recipientName.trim() : '';
  if (recipient.toLowerCase().includes('messaging') || recipient.toLowerCase().includes('feed')) {
    recipient = '';
  }

  let firstName = recipient;
  if (recipient.length > 0) {
    firstName = recipient.split(' ')[0].trim();
  }

  const salutation = firstName ? `Hi ${firstName},` : 'Hi,';

  let targetCompany = request.currentCompany ? request.currentCompany.trim() : null;
  if (!targetCompany && request.recipientHeadline) {
    const hl = request.recipientHeadline;
    if (hl.includes(' @ ')) targetCompany = hl.split(' @ ')[1].split('|')[0].trim();
    else if (hl.includes(' at ')) targetCompany = hl.split(' at ')[1].split('|')[0].trim();
  }

  const jobDetails = parseJobDetails(request.userNotes);
  if (jobDetails.company) targetCompany = jobDetails.company;

  const selectedTone = request.tone || 'Professional';
  const lengthTarget = request.messageLength ? request.messageLength.toLowerCase() : 'auto';

  let targetWords = 100;
  let minWords = 80;
  let maxWords = 130;

  if (lengthTarget === '50w') {
    targetWords = 50; minWords = 40; maxWords = 65;
  } else if (lengthTarget === '100w' || lengthTarget === 'auto') {
    targetWords = 100; minWords = 80; maxWords = 130;
  } else if (lengthTarget === '200w') {
    targetWords = 200; minWords = 180; maxWords = 240;
  } else if (lengthTarget === '300w') {
    targetWords = 300; minWords = 280; maxWords = 340;
  } else if (lengthTarget === '500w') {
    targetWords = 500; minWords = 460; maxWords = 550;
  }

  return `You are an expert LinkedIn communications and career outreach specialist.
Your mission is to write clean, high-converting, strictly professional outreach messages.

TARGET RECIPIENT INFORMATION:
- Recipient Name: ${firstName || 'Not provided'}
- Recipient Headline: ${request.recipientHeadline || 'Not provided'}
${targetCompany ? `- TARGET COMPANY: ${targetCompany}` : ''}
- Selected Tone: ${selectedTone}
- Target Word Count: approximately ${targetWords} words (Strict range: ${minWords} to ${maxWords} words)
- Selected Playbook Objective: ${mode}

JOB OPENING SPECIFICATIONS (FROM USER NOTES):
${jobDetails.title ? `- Target Role Title: ${jobDetails.title}\n` : ''}${jobDetails.jobId ? `- Job ID: ${jobDetails.jobId}\n` : ''}${jobDetails.location ? `- Role Location: ${jobDetails.location} (Job opening location, NOT sender home)\n` : ''}${jobDetails.workMode ? `- Role Work Mode: ${jobDetails.workMode}\n` : ''}${request.userNotes ? `- Raw Custom Notes: ${request.userNotes.trim()}\n` : ''}
${mode === 'contextual_reply' && request.threadContext ? `- Active Chat Snippet (To reply to): ${request.threadContext}\n` : ''}
STRICT NON-NEGOTIABLE RULES:
1. MANDATORY SALUTATION:
   Draft 1 MUST start strictly with:
   ${salutation}

2. ZERO SENDER HALLUCINATIONS:
   - NEVER invent the sender's location (do NOT claim any city/state).
   - NEVER invent past employers or college names unless provided in user notes.
   - Highlight standard software engineering competencies: problem-solving, DSA, clean code, scalable architecture.

3. WORD COUNT & PARAGRAPHS:
   - Draft 1 MUST be approximately ${targetWords} words.
   ${targetWords >= 200 ? `- Because ${targetWords} words are requested, write 3-4 natural paragraphs.\n` : '- Keep the message crisp and focused.'}

OUTPUT FORMAT:
Return ONLY valid raw JSON with this exact schema (no markdown, no extra keys):
{
  "verifiedSignal": "Role and context verified",
  "relevanceReason": "Tailored to ${selectedTone} tone and ~${targetWords} words",
  "hasMeaningfulSignal": true,
  "drafts": [
    {
      "id": "draft-1",
      "title": "Best Tailored Message (~${targetWords}w)",
      "tag": "Recommended",
      "text": "${salutation}\\n\\n...",
      "type": "direct_message"
    },
    {
      "id": "draft-2",
      "title": "Short Connection Note (<300 Chars)",
      "tag": "300-Char Limit",
      "text": "${salutation.replace(',', '')} - ...",
      "type": "connect_note"
    }
  ]
}`;
}

export async function callGroqAPI(prompt: string, apiKey: string): Promise<OutreachResponse> {
  const models = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ];

  let lastError = '';
  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are an expert LinkedIn outreach assistant. You strictly return clean JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `Groq HTTP ${res.status}: ${errText}`;
        continue;
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (rawContent) {
        const parsed = parseLLMResponse(rawContent);
        if (parsed) return parsed;
      }
    } catch (err: any) {
      lastError = err.message || String(err);
    }
  }

  throw new Error(lastError || 'Groq generation failed');
}

export async function callGeminiAPI(prompt: string, apiKey: string): Promise<OutreachResponse> {
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];

  let lastError = '';
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `Gemini HTTP ${res.status}: ${errText}`;
        continue;
      }

      const data = await res.json();
      const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawContent) {
        const parsed = parseLLMResponse(rawContent);
        if (parsed) return parsed;
      }
    } catch (err: any) {
      lastError = err.message || String(err);
    }
  }

  throw new Error(lastError || 'Gemini generation failed');
}

export async function callOpenAIAPI(prompt: string, apiKey: string): Promise<OutreachResponse> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert LinkedIn outreach assistant. You strictly return clean JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error('Empty response from OpenAI');

  const parsed = parseLLMResponse(rawContent);
  if (!parsed) throw new Error('Failed to parse OpenAI JSON');
  return parsed;
}

function parseLLMResponse(raw: string): OutreachResponse | null {
  try {
    let clean = raw.trim();
    if (clean.startsWith('```json')) clean = clean.substring(7);
    if (clean.startsWith('```')) clean = clean.substring(3);
    if (clean.endsWith('```')) clean = clean.substring(0, clean.length - 3);
    clean = clean.trim();

    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    const obj = JSON.parse(clean);
    const drafts: DraftVariation[] = (obj.drafts || []).map((d: any, i: number) => ({
      id: d.id || `draft-${i + 1}`,
      title: d.title || (i === 0 ? 'Best Tailored Message' : 'Short Connection Note'),
      tag: d.tag || (i === 0 ? 'Recommended' : '300-Char Limit'),
      text: d.text || '',
      charCount: (d.text || '').length,
      wordCount: (d.text || '').trim().split(/\s+/).filter(Boolean).length,
      type: d.type || (i === 0 ? 'direct_message' : 'connect_note'),
    }));

    if (drafts.length > 0) {
      return {
        success: true,
        verifiedSignal: obj.verifiedSignal || 'Signal verified',
        relevanceReason: obj.relevanceReason || 'Tailored outreach',
        hasMeaningfulSignal: obj.hasMeaningfulSignal ?? true,
        drafts,
      };
    }
  } catch (err) {
    console.warn('Failed to parse LLM JSON:', err);
  }
  return null;
}

export function generateFastModeOutreach(request: OutreachRequest): OutreachResponse {
  const firstName = request.recipientName ? request.recipientName.split(' ')[0].trim() : '';
  const salutation = firstName ? `Hi ${firstName},` : 'Hi,';

  let targetCompany = request.currentCompany || '';
  if (!targetCompany && request.recipientHeadline) {
    if (request.recipientHeadline.includes(' @ ')) targetCompany = request.recipientHeadline.split(' @ ')[1].split('|')[0].trim();
    else if (request.recipientHeadline.includes(' at ')) targetCompany = request.recipientHeadline.split(' at ')[1].split('|')[0].trim();
  }

  const jobDetails = parseJobDetails(request.userNotes);
  if (jobDetails.company) targetCompany = jobDetails.company;

  const roleTitle = jobDetails.title || 'Software Development Engineer';
  const companyPhrase = targetCompany ? ` at ${targetCompany}` : '';
  const jobIdPhrase = jobDetails.jobId ? ` (Job ID: ${jobDetails.jobId})` : '';

  const mainDraft = `${salutation}

I hope you’re doing well. I noticed your experience${companyPhrase} and wanted to reach out regarding the ${roleTitle} opening${jobIdPhrase}.

Over the past year, I’ve built a strong foundation in computer science and full-stack development, solving 800+ algorithmic problems and building reliable microservices and frontend applications. I also have a solid grasp of core system design fundamentals.

Given your perspective at ${targetCompany || 'your organization'}, would you be open to sharing advice on the team or considering referring my profile? I’d be glad to share my resume and portfolio.

Thank you for your time and guidance!`;

  const shortNote = `${salutation.replace(',', '')} - Noticed your work${companyPhrase}. Looking at the ${roleTitle} role${jobIdPhrase}. Would love to connect and learn about the team!`;

  return {
    success: true,
    isMock: true,
    verifiedSignal: 'Fast Mode grounded templates',
    relevanceReason: 'Instant zero-latency generation',
    hasMeaningfulSignal: true,
    drafts: [
      {
        id: 'draft-1',
        title: 'Best Tailored Message (~100w)',
        tag: 'Fast Mode',
        text: mainDraft,
        charCount: mainDraft.length,
        wordCount: mainDraft.trim().split(/\s+/).filter(Boolean).length,
        type: 'direct_message',
      },
      {
        id: 'draft-2',
        title: 'Short Connection Note (<300 Chars)',
        tag: '300-Char Limit',
        text: shortNote,
        charCount: shortNote.length,
        wordCount: shortNote.trim().split(/\s+/).filter(Boolean).length,
        type: 'connect_note',
      },
    ],
  };
}
