import logger from '../middleware/errorHandler.js';
import { isLlmEnabled, getLlmModel } from './llm.js';

const ANALYSIS_SYSTEM_PROMPT = `You are an expert sales call analyst. Analyze the following sales call transcript and return a JSON object with these fields. Be precise and data-driven.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.

Required JSON structure:
{
  "summary": "3-5 sentence call summary",
  "talkToListenRatio": 0.55,
  "agentTalkPercent": 55,
  "customerTalkPercent": 40,
  "silencePercent": 5,
  "interruptionCount": 2,
  "questionCount": 8,
  "fillerWordCount": 12,
  "sentimentOverall": "positive",
  "sentimentTrajectory": [],
  "overallScore": 78,
  "scoreBreakdown": {},
  "keyMoments": [],
  "objections": [],
  "coachingTips": [],
  "keywords": [],
  "competitorMentions": [],
  "closingAttempted": true,
  "closingSuccessful": true,
  "nextSteps": []
}

Guidelines:
- Score from 0-100 where 70+ is good, 80+ is great, 90+ is exceptional
- Be honest about weaknesses — this is for coaching, not praise
- Flag specific timestamps for key moments
- If transcript is unclear, note it in the summary
- Judge objection handling effectiveness objectively`;

export async function analyzeCallTranscript(transcript: string, agentName?: string): Promise<any> {
  if (!isLlmEnabled()) {
    return { skipped: true, reason: 'llm_disabled' };
  }

  const model = getLlmModel();
  logger.info({ model, transcriptLen: transcript.length, agentName }, 'Starting sales call analysis');

  try {
    const apiKey = process.env.TELNYX_API_KEY;
    const response = await fetch('https://api.telnyx.com/v2/ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, max_tokens: 4000, temperature: 0.1,
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: `Agent name: ${agentName || 'Unknown'}\n\nTranscript:\n${transcript}` },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telnyx AI error ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty LLM response');
    return parseAnalysisResult(content);
  } catch (err: any) {
    logger.error({ err }, 'Call analysis failed');
    return { skipped: true, reason: 'analysis_error', error: err.message };
  }
}

export async function generateCoachingSummary(agentName: string, callAnalyses: any[]): Promise<string | null> {
  if (!isLlmEnabled() || !callAnalyses.length) return null;

  const summaryData = callAnalyses.map((a: any) => ({
    score: a.overallScore, breakdown: a.scoreBreakdown, tips: a.coachingTips,
    objections: a.objections?.length || 0, closingRate: a.closingSuccessful ? 'yes' : 'no',
  }));

  try {
    const apiKey = process.env.TELNYX_API_KEY;
    const response = await fetch('https://api.telnyx.com/v2/ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: getLlmModel(), max_tokens: 2000, temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are a sales coach. Generate a concise, actionable coaching summary. 3-5 paragraphs.' },
          { role: 'user', content: `Agent: ${agentName}\nCalls analyzed: ${callAnalyses.length}\n\nPerformance data:\n${JSON.stringify(summaryData, null, 2)}` },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Telnyx AI error ${response.status}`);
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    logger.error({ err }, 'Coaching summary generation failed');
    return null;
  }
}

export async function generateTeamInsights(analysesSummary: any[]): Promise<any> {
  if (!isLlmEnabled() || !analysesSummary.length) return null;

  try {
    const apiKey = process.env.TELNYX_API_KEY;
    const response = await fetch('https://api.telnyx.com/v2/ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: getLlmModel(), max_tokens: 2000, temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are a sales operations analyst. Return a JSON object with keys: strengths, weaknesses, bestPractices, trainingFocus. Each value is an array of strings.' },
          { role: 'user', content: `Team performance data:\n${JSON.stringify(analysesSummary, null, 2)}` },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Telnyx AI error ${response.status}`);
    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseAnalysisResult(content);
  } catch (err: any) {
    logger.error({ err }, 'Team insights generation failed');
    return null;
  }
}

export async function transcribeAudio(audioUrl: string, options: Record<string, any> = {}): Promise<string> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) throw new Error('TELNYX_API_KEY not configured — cannot transcribe audio');

  logger.info({ audioUrl, language: options.language || 'en' }, 'Starting offline transcription');

  try {
    const response = await fetch('https://api.telnyx.com/v2/ai/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: audioUrl, language: options.language || 'en', model: options.model || 'nova-3' }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Transcription failed: ${response.status} ${body.slice(0, 300)}`);
    }

    const data = await response.json() as any;
    const text = data?.data?.text || data?.text || '';
    logger.info({ audioUrl, textLen: text.length }, 'Offline transcription complete');
    return text;
  } catch (err: any) {
    logger.error({ err, audioUrl }, 'Offline transcription failed');
    throw err;
  }
}

export async function processUploadedCall(analysis: any, models: any) {
  try {
    let transcriptText = analysis.transcriptText;

    if (!transcriptText && analysis.audioUrl) {
      await analysis.update({ status: 'transcribing' });
      transcriptText = await transcribeAudio(analysis.audioUrl);
      await analysis.update({ transcriptText });
    }

    if (!transcriptText) {
      await analysis.update({ status: 'failed' });
      logger.info({ analysisId: analysis.id }, 'No transcript available — marking as failed');
      return;
    }

    await analysis.update({ status: 'analyzing' });

    const agent = analysis.agentId
      ? await models.Agent.findByPk(analysis.agentId, { include: [{ model: models.User, as: 'user' }] })
      : null;
    const agentName = agent?.user?.displayName || agent?.user?.username || 'Unknown';

    const result = await analyzeCallTranscript(transcriptText, agentName);

    if (result.skipped) {
      await analysis.update({ status: 'failed' });
      logger.info({ analysisId: analysis.id, reason: result.reason }, 'Call analysis skipped');
      return;
    }

    await analysis.update({
      status: 'complete',
      talkToListenRatio: result.talkToListenRatio,
      agentTalkPercent: result.agentTalkPercent,
      customerTalkPercent: result.customerTalkPercent,
      silencePercent: result.silencePercent,
      interruptionCount: result.interruptionCount,
      questionCount: result.questionCount,
      fillerWordCount: result.fillerWordCount,
      sentimentOverall: result.sentimentOverall,
      sentimentTrajectory: result.sentimentTrajectory,
      overallScore: result.overallScore,
      scoreBreakdown: result.scoreBreakdown,
      keyMoments: result.keyMoments,
      objections: result.objections,
      coachingTips: result.coachingTips,
      summary: result.summary,
      keywords: result.keywords,
      competitorMentions: result.competitorMentions,
      closingAttempted: result.closingAttempted,
      closingSuccessful: result.closingSuccessful,
      nextSteps: result.nextSteps,
      rawLlmOutput: result.rawLlmOutput,
      analyzedAt: new Date(),
    });

    logger.info({ analysisId: analysis.id, score: result.overallScore }, 'Uploaded call analysis complete');
  } catch (err: any) {
    logger.error({ err, analysisId: analysis.id }, 'Uploaded call processing failed');
    await analysis.update({ status: 'failed' }).catch(() => {});
  }
}

function parseAnalysisResult(raw: any): any {
  let cleaned = raw;
  if (typeof raw === 'string') {
    cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { parsed = JSON.parse(cleaned.slice(first, last + 1)); } catch { /* fall through */ }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      skipped: false, overallScore: 0,
      summary: typeof raw === 'string' ? raw.slice(0, 1000) : '',
      rawLlmOutput: { raw, parseError: true },
    };
  }

  return { skipped: false, ...parsed, rawLlmOutput: { raw } };
}
