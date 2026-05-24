import logger from '../middleware/errorHandler.js';

const SYSTEM_PROMPT = `You are an AI assistant processing call transcripts for a contact center. Your role is to generate structured case notes and extract actionable tasks.

Guidelines:
- Be clinically cautious — never invent medical advice or diagnoses
- Note PI (personally identifiable information) but do not store or repeat sensitive health identifiers
- Flag any urgent or safety concerns explicitly
- Use Australian English spelling and terminology
- Be empathetic but factual — avoid speculation
- If the transcript is unclear or incomplete, note that explicitly
- Never attribute statements that aren't clearly in the transcript`;

export function isLlmEnabled(): boolean {
  if (process.env.TELNYX_AI_ENABLED === 'false') return false;
  return Boolean(process.env.TELNYX_API_KEY?.trim());
}

export function getLlmModel(): string {
  return process.env.TELNYX_AI_MODEL || 'Qwen/Qwen3-235B-A22B';
}

interface CaseNoteResult {
  skipped: boolean;
  reason?: string;
  error?: string;
  callerName?: string;
  summary?: string;
  keyPoints?: string[];
  sentiment?: string;
  tasks?: any[];
  rawLlmOutput?: any;
}

export async function generateCaseNotes(transcript: string): Promise<CaseNoteResult> {
  if (!isLlmEnabled()) {
    logger.info('LLM disabled — skipping AI case notes');
    return { skipped: true, reason: 'no_llm_key' };
  }

  const model = getLlmModel();
  logger.info({ model, transcriptLength: transcript?.length ?? 0 }, 'Generating AI case notes via Telnyx AI');

  try {
    const apiKey = process.env.TELNYX_API_KEY;

    const response = await fetch('https://api.telnyx.com/v2/ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze this call transcript and reply with ONLY a single raw JSON object matching this exact schema (no markdown, no prose):
{
  "callerName": string,
  "summary": string (3-5 sentences),
  "keyPoints": string[],
  "sentiment": "positive"|"neutral"|"negative"|"urgent",
  "tasks": [{ "type": "follow_up"|"callback"|"escalation"|"appointment"|"referral", "description": string, "priority": "low"|"medium"|"high"|"critical", "due": string|null }]
}

Transcript:
${transcript}` },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telnyx AI API error ${response.status}: ${body}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Telnyx AI');
    }

    return parseResult(content);
  } catch (err: any) {
    logger.error({ err }, 'Telnyx AI call failed — case notes not generated');
    return { skipped: true, reason: 'llm_error', error: err.message };
  }
}

interface AgentAssistSuggestion {
  text: string;
  confidence: number;
  category: string;
}

interface AgentAssistResult {
  suggestions: AgentAssistSuggestion[];
  callerSentiment: string;
  topicDetected: string;
  skipped: boolean;
}

export async function generateAgentAssistSuggestions({ transcript, context = {} }: { transcript?: string; context?: Record<string, any> } = {}): Promise<AgentAssistResult> {
  const fallback: AgentAssistResult = {
    suggestions: [
      { text: "I understand — let me look into that for you right now.", confidence: 0.5, category: 'empathy' },
      { text: "Could you give me a little more detail so I can help faster?", confidence: 0.5, category: 'clarify' },
      { text: "Thanks for your patience while I sort this out.", confidence: 0.5, category: 'acknowledge' },
    ],
    callerSentiment: 'neutral',
    topicDetected: 'general',
    skipped: !isLlmEnabled(),
  };

  if (!isLlmEnabled() || !transcript || !String(transcript).trim()) {
    return fallback;
  }

  const model = getLlmModel();
  const systemPrompt = `You are a real-time contact-center agent assistant. Given the recent conversation transcript, produce 3 short, professional response options the agent could say next, plus a caller sentiment and topic guess.

CRITICAL OUTPUT RULES:
- Reply with ONLY a single raw JSON object — no markdown fences, no prose.
- Match this schema exactly:
  {
    "suggestions": [
      { "text": string, "confidence": number, "category": "empathy"|"action"|"clarify"|"resolve"|"escalate"|"acknowledge" }
    ],
    "callerSentiment": "positive"|"neutral"|"frustrated"|"angry"|"confused"|"urgent",
    "topicDetected": string
  }
- Suggestions must be ≤ 1 sentence, in Australian English, empathetic but factual.
- Never invent facts or make commitments the agent hasn't agreed to.
- Use 'confidence' between 0 and 1.`;

  const userContent = `Recent transcript:\n${String(transcript).slice(-2000)}\n\nContext: ${JSON.stringify(context || {}).slice(0, 500)}\n\nReturn the JSON now.`;

  try {
    const apiKey = process.env.TELNYX_API_KEY;
    const response = await fetch('https://api.telnyx.com/v2/ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.warn({ status: response.status, body: body.slice(0, 200) }, 'Agent-assist LLM call failed');
      return fallback;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return fallback;

    const parsed = extractJson(content);
    if (!parsed || typeof parsed !== 'object') {
      logger.warn({ preview: typeof content === 'string' ? content.slice(0, 200) : null }, 'Agent-assist response not JSON');
      return fallback;
    }

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.slice(0, 5).map((s: any) => ({
          text: String(s.text || '').slice(0, 400),
          confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0.7,
          category: typeof s.category === 'string' ? s.category : 'general',
        })).filter((s: any) => s.text)
      : [];

    return {
      suggestions: suggestions.length > 0 ? suggestions : fallback.suggestions,
      callerSentiment: typeof parsed.callerSentiment === 'string' ? parsed.callerSentiment : 'neutral',
      topicDetected:   typeof parsed.topicDetected   === 'string' ? parsed.topicDetected   : 'general',
      skipped: false,
    };
  } catch (err: any) {
    logger.error({ err: err.message }, 'Agent-assist LLM threw');
    return fallback;
  }
}

// ── Private helpers ──────────────────────────────────────────────────────────

function parseResult(raw: any): CaseNoteResult {
  try {
    let parsed: any;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      parsed = JSON.parse(cleaned);
    } else {
      parsed = raw;
    }

    return {
      skipped: false,
      callerName: parsed.callerName || 'Unknown',
      summary: parsed.summary || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      sentiment: ['positive', 'neutral', 'negative', 'urgent'].includes(parsed.sentiment)
        ? parsed.sentiment
        : 'neutral',
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      rawLlmOutput: parsed,
    };
  } catch (err) {
    logger.warn({ err }, 'LLM response was not valid JSON — storing as plain summary');
    return {
      skipped: false,
      callerName: 'Unknown',
      summary: typeof raw === 'string' ? raw : JSON.stringify(raw),
      keyPoints: [],
      sentiment: 'neutral',
      tasks: [],
      rawLlmOutput: { raw, parseError: true },
    };
  }
}

function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}
