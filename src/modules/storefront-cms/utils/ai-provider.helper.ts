import { BadRequestException } from '@nestjs/common';

export interface AiProviderConfig {
  enabled: boolean;
  provider: 'GEMINI' | 'GROQ';
  geminiApiKey?: string;
  geminiModel?: string;
  groqApiKey?: string;
  groqModel?: string;
  enableCatalogCopy?: boolean;
  enableAnalyticsInsights?: boolean;
  defaultTone?: string;
}

export const GROQ_PREFERRED_CHAT_MODELS = [
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
  'allam-2-7b',
];

export const GEMINI_DEFAULT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
];

const GROQ_HEADERS = (apiKey: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
  'User-Agent': 'RoyalERP/1.0',
});

function isChatCapableGroqModel(id: string): boolean {
  const lower = id.toLowerCase();
  if (!lower) return false;
  if (lower.includes('whisper') || lower.includes('orpheus') || lower.includes('guard')) {
    return false;
  }
  return true;
}

export async function listGroqChatModels(apiKey: string): Promise<string[]> {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) return [...GROQ_PREFERRED_CHAT_MODELS];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'User-Agent': 'RoyalERP/1.0',
      },
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadRequestException(
        json?.error?.message || `Impossible de lister les modèles Groq (HTTP ${res.status}).`,
      );
    }
    const rawIds: string[] = Array.isArray(json?.data)
      ? json.data
          .filter((m: any) => m?.active !== false && typeof m?.id === 'string')
          .map((m: any) => m.id)
          .filter(isChatCapableGroqModel)
      : [];
    const unique = Array.from(new Set(rawIds));
    return unique.sort((a, b) => {
      const ia = GROQ_PREFERRED_CHAT_MODELS.indexOf(a);
      const ib = GROQ_PREFERRED_CHAT_MODELS.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  } catch (err: any) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(
      err?.name === 'AbortError'
        ? 'Délai dépassé lors de la récupération des modèles Groq.'
        : err?.message || 'Erreur réseau vers Groq Cloud.',
    );
  } finally {
    clearTimeout(timer);
  }
}

async function callGroqChatCompletion(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  signal: AbortSignal,
): Promise<{ ok: boolean; status: number; text: string; errorMessage: string; errorCode: string }> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: GROQ_HEADERS(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal,
  });

  const rawBody = await res.text().catch(() => '');
  let json: any = {};
  try {
    json = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    const errorMessage =
      json?.error?.message ||
      (rawBody && rawBody.length < 300 ? rawBody : '') ||
      `Erreur Groq API (HTTP ${res.status}).`;
    return {
      ok: false,
      status: res.status,
      text: '',
      errorMessage,
      errorCode: String(json?.error?.code || ''),
    };
  }

  const text = String(json?.choices?.[0]?.message?.content || '').trim();
  return {
    ok: Boolean(text),
    status: res.status,
    text,
    errorMessage: text ? '' : 'Réponse vide reçue depuis Groq.',
    errorCode: '',
  };
}

export async function generateAiCompletion(
  cfg: Partial<AiProviderConfig>,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ text: string; provider: string; model: string; fallbackFrom?: string }> {
  const provider = cfg.provider === 'GROQ' ? 'GROQ' : 'GEMINI';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);

  try {
    if (provider === 'GROQ') {
      const apiKey = String(cfg.groqApiKey || '').trim();
      const requestedModel = String(cfg.groqModel || GROQ_PREFERRED_CHAT_MODELS[0]).trim();
      if (!apiKey) {
        throw new BadRequestException(
          'Clé API Groq manquante dans Paramètres Système > Intelligence Artificielle.',
        );
      }

      const firstAttempt = await callGroqChatCompletion(
        apiKey,
        requestedModel,
        systemPrompt,
        userPrompt,
        controller.signal,
      );

      if (firstAttempt.ok) {
        return { text: firstAttempt.text, provider: 'GROQ', model: requestedModel };
      }

      const isMissingModel =
        firstAttempt.status === 404 ||
        firstAttempt.errorCode === 'model_not_found' ||
        /model.*(not found|does not exist|decommissioned)/i.test(firstAttempt.errorMessage);

      if (isMissingModel) {
        const availableModels = await listGroqChatModels(apiKey).catch(() => []);
        const fallbackModel = availableModels.find((m) => m !== requestedModel);
        if (fallbackModel) {
          const retry = await callGroqChatCompletion(
            apiKey,
            fallbackModel,
            systemPrompt,
            userPrompt,
            controller.signal,
          );
          if (retry.ok) {
            return {
              text: retry.text,
              provider: 'GROQ',
              model: fallbackModel,
              fallbackFrom: requestedModel,
            };
          }
          throw new BadRequestException(
            `${retry.errorMessage} (Fallback testé : ${fallbackModel}).`,
          );
        }
      }

      throw new BadRequestException(firstAttempt.errorMessage);
    }

    // GEMINI (Google AI Studio free tier)
    const apiKey = String(cfg.geminiApiKey || '').trim();
    const model = String(cfg.geminiModel || 'gemini-2.5-flash').trim();
    if (!apiKey) {
      throw new BadRequestException(
        'Clé API Google AI Studio (Gemini) manquante dans Paramètres Système > Intelligence Artificielle.',
      );
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
      }),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadRequestException(
        json?.error?.message || `Erreur Gemini API (HTTP ${res.status}).`,
      );
    }
    const text = String(json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!text) {
      throw new BadRequestException('Réponse vide reçue depuis Gemini.');
    }
    return { text, provider: 'GEMINI', model };
  } catch (err: any) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(
      err?.name === 'AbortError'
        ? 'Délai dépassé lors de l’appel au fournisseur IA (timeout 22s).'
        : err?.message || 'Erreur réseau lors de l’appel au fournisseur IA.',
    );
  } finally {
    clearTimeout(timer);
  }
}

export function extractJsonBlock<T = any>(rawText: string): T | null {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
