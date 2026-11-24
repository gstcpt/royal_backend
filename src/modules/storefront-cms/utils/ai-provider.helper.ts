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
  enableOverviewRecaps?: boolean;
  enableFormAutofill?: boolean;
  recapTargets?: Record<string, boolean>;
  formTargets?: Record<string, boolean>;
  defaultTone?: string;
}

export type AiWorkerPhase =
  | 'STARTING'
  | 'TRYING'
  | 'THINKING'
  | 'WORKING'
  | 'SWITCHING'
  | 'RETRYING'
  | 'QUOTA_EXHAUSTED'
  | 'COMPLETED'
  | 'FAILED_QUOTA'
  | 'FAILED_CONFIG'
  | 'CANCELLED';

export interface AiProgressEvent {
  phase: AiWorkerPhase;
  workerNumber: 1 | 2;
  provider: 'GEMINI' | 'GROQ';
  model: string;
  attempt: number;
  message: string;
  timestamp: string;
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
      max_tokens: 1400,
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

async function callGeminiCompletion(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  signal: AbortSignal,
): Promise<{ ok: boolean; status: number; text: string; errorMessage: string; errorCode: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1400 },
    }),
    signal,
  });

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      text: '',
      errorMessage: json?.error?.message || `Erreur Gemini API (HTTP ${res.status}).`,
      errorCode: String(json?.error?.status || json?.error?.code || ''),
    };
  }

  const text = String(json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  return {
    ok: Boolean(text),
    status: res.status,
    text,
    errorMessage: text ? '' : 'Réponse vide reçue depuis Gemini.',
    errorCode: '',
  };
}

export function classifyAiFailure(
  status: number,
  errorMessage: string,
  errorCode = '',
): 'QUOTA_EXHAUSTED' | 'BUSY' {
  const msg = `${errorMessage || ''} ${errorCode || ''}`.toLowerCase();

  // Temporary server busy / overload / short rate spikes must keep retrying
  const isTransientSpike =
    msg.includes('overloaded') ||
    msg.includes('temporarily') ||
    msg.includes('try again') ||
    msg.includes('busy') ||
    msg.includes('unavailable') ||
    msg.includes('requests per minute') ||
    msg.includes('tokens per minute') ||
    status === 408 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 529;

  if (isTransientSpike && !msg.includes('limit: 0') && !msg.includes('exceeded your current quota')) {
    return 'BUSY';
  }

  // Hard usage quota / billing / invalid credentials
  if (
    status === 401 ||
    status === 403 ||
    status === 402 ||
    msg.includes('exceeded your current quota') ||
    msg.includes('insufficient_quota') ||
    msg.includes('billing') ||
    msg.includes('limit: 0') ||
    msg.includes('invalid api key') ||
    msg.includes('api key not valid') ||
    msg.includes('daily limit') ||
    msg.includes('requests per day') ||
    msg.includes('tokens per day') ||
    msg.includes('resource_exhausted')
  ) {
    return 'QUOTA_EXHAUSTED';
  }

  // Default 429 without explicit daily exhaustion wording -> treat as transient RPM busy first
  return 'BUSY';
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('ABORTED'));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('ABORTED'));
    };
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class AiQuotaExhaustedError extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}

export async function runResilientAiFailoverLoop(
  cfg: Partial<AiProviderConfig>,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    signal?: AbortSignal;
    maxAttempts?: number;
    onProgress?: (event: AiProgressEvent) => void;
  },
): Promise<{
  text: string;
  provider: 'GEMINI' | 'GROQ';
  model: string;
  workerNumber: 1 | 2;
  fallbackFrom?: string;
}> {
  const primaryProvider: 'GEMINI' | 'GROQ' = cfg.provider === 'GROQ' ? 'GROQ' : 'GEMINI';
  const secondaryProvider: 'GEMINI' | 'GROQ' = primaryProvider === 'GROQ' ? 'GEMINI' : 'GROQ';

  const geminiKey = String(cfg.geminiApiKey || '').trim();
  const groqKey = String(cfg.groqApiKey || '').trim();
  const geminiModel = String(cfg.geminiModel || GEMINI_DEFAULT_MODELS[0]).trim();
  const groqModel = String(cfg.groqModel || GROQ_PREFERRED_CHAT_MODELS[0]).trim();

  interface WorkerSlot {
    workerNumber: 1 | 2;
    provider: 'GEMINI' | 'GROQ';
    apiKey: string;
    model: string;
    quotaExhausted: boolean;
    lastError: string;
  }

  const workers: WorkerSlot[] = [
    {
      workerNumber: 1,
      provider: primaryProvider,
      apiKey: primaryProvider === 'GEMINI' ? geminiKey : groqKey,
      model: primaryProvider === 'GEMINI' ? geminiModel : groqModel,
      quotaExhausted: !(primaryProvider === 'GEMINI' ? geminiKey : groqKey),
      lastError: !(primaryProvider === 'GEMINI' ? geminiKey : groqKey) ? 'Clé API non renseignée' : '',
    },
    {
      workerNumber: 2,
      provider: secondaryProvider,
      apiKey: secondaryProvider === 'GEMINI' ? geminiKey : groqKey,
      model: secondaryProvider === 'GEMINI' ? geminiModel : groqModel,
      quotaExhausted: !(secondaryProvider === 'GEMINI' ? geminiKey : groqKey),
      lastError: !(secondaryProvider === 'GEMINI' ? geminiKey : groqKey) ? 'Clé API non renseignée' : '',
    },
  ];

  const configuredWorkers = workers.filter((w) => Boolean(w.apiKey));
  if (configuredWorkers.length === 0) {
    throw new BadRequestException(
      'Aucune clé API IA (Gemini ou Groq) configurée dans Système > Intelligence Artificielle.',
    );
  }

  const emit = (
    phase: AiWorkerPhase,
    worker: WorkerSlot,
    attempt: number,
    message: string,
  ) => {
    options?.onProgress?.({
      phase,
      workerNumber: worker.workerNumber,
      provider: worker.provider,
      model: worker.model,
      attempt,
      message,
      timestamp: new Date().toISOString(),
    });
  };

  const maxAttempts = options?.maxAttempts ?? 24;
  let totalAttempts = 0;
  let cursor = 0;

  while (totalAttempts < maxAttempts) {
    if (options?.signal?.aborted) {
      throw new Error('ABORTED');
    }

    const eligible = workers.filter((w) => !w.quotaExhausted);
    if (eligible.length === 0) {
      const details = workers
        .filter((w) => w.apiKey)
        .map((w) => `Worker ${w.workerNumber} (${w.provider}) : ${w.lastError || 'quota atteint'}`)
        .join(' | ');
      emit(
        'FAILED_QUOTA',
        workers[0],
        totalAttempts,
        `Limite d'utilisation atteinte sur les deux fournisseurs (${details}).`,
      );
      throw new AiQuotaExhaustedError(
        `Limite d'utilisation atteinte sur Worker 1 & Worker 2. Vérifiez vos quotas dans Système > Intelligence Artificielle.`,
      );
    }

    const worker = eligible[cursor % eligible.length];
    cursor++;
    totalAttempts++;

    emit(
      'TRYING',
      worker,
      totalAttempts,
      `Worker ${worker.workerNumber} (${worker.provider} · ${worker.model}) : tentative de connexion...`,
    );

    const attemptAbort = new AbortController();
    const timeoutId = setTimeout(() => attemptAbort.abort(), 22000);
    const parentAbortHandler = () => attemptAbort.abort();
    options?.signal?.addEventListener('abort', parentAbortHandler, { once: true });

    let result: { ok: boolean; status: number; text: string; errorMessage: string; errorCode: string };
    try {
      emit(
        'THINKING',
        worker,
        totalAttempts,
        `Worker ${worker.workerNumber} (${worker.provider}) : analyse et réflexion...`,
      );

      if (worker.provider === 'GROQ') {
        result = await callGroqChatCompletion(
          worker.apiKey,
          worker.model,
          systemPrompt,
          userPrompt,
          attemptAbort.signal,
        );
        // Auto-resolve missing/decommissioned Groq model once before failover
        const isMissingModel =
          !result.ok &&
          (result.status === 404 ||
            result.errorCode === 'model_not_found' ||
            /model.*(not found|does not exist|decommissioned)/i.test(result.errorMessage));
        if (isMissingModel) {
          const available = await listGroqChatModels(worker.apiKey).catch(() => []);
          const alt = available.find((m) => m !== worker.model);
          if (alt) {
            worker.model = alt;
            result = await callGroqChatCompletion(
              worker.apiKey,
              worker.model,
              systemPrompt,
              userPrompt,
              attemptAbort.signal,
            );
          }
        }
      } else {
        result = await callGeminiCompletion(
          worker.apiKey,
          worker.model,
          systemPrompt,
          userPrompt,
          attemptAbort.signal,
        );
        const isMissingGeminiModel =
          !result.ok && (result.status === 404 || /not found/i.test(result.errorMessage));
        if (isMissingGeminiModel) {
          const alt = GEMINI_DEFAULT_MODELS.find((m) => m !== worker.model);
          if (alt) {
            worker.model = alt;
            result = await callGeminiCompletion(
              worker.apiKey,
              worker.model,
              systemPrompt,
              userPrompt,
              attemptAbort.signal,
            );
          }
        }
      }
    } catch (err: any) {
      if (options?.signal?.aborted) {
        clearTimeout(timeoutId);
        options?.signal?.removeEventListener('abort', parentAbortHandler);
        throw new Error('ABORTED');
      }
      result = {
        ok: false,
        status: err?.name === 'AbortError' ? 504 : 503,
        text: '',
        errorMessage:
          err?.name === 'AbortError'
            ? 'Délai dépassé (serveur IA occupé)'
            : err?.message || 'Erreur réseau vers fournisseur IA',
        errorCode: 'BUSY',
      };
    } finally {
      clearTimeout(timeoutId);
      options?.signal?.removeEventListener('abort', parentAbortHandler);
    }

    if (result.ok) {
      emit(
        'WORKING',
        worker,
        totalAttempts,
        `Worker ${worker.workerNumber} (${worker.provider}) : rédaction et structuration...`,
      );
      emit(
        'COMPLETED',
        worker,
        totalAttempts,
        `Résultat validé par Worker ${worker.workerNumber} (${worker.provider} · ${worker.model}).`,
      );
      return {
        text: result.text,
        provider: worker.provider,
        model: worker.model,
        workerNumber: worker.workerNumber,
        fallbackFrom: worker.workerNumber === 2 ? primaryProvider : undefined,
      };
    }

    const kind = classifyAiFailure(result.status, result.errorMessage, result.errorCode);
    worker.lastError = result.errorMessage;

    if (kind === 'QUOTA_EXHAUSTED') {
      worker.quotaExhausted = true;
      emit(
        'QUOTA_EXHAUSTED',
        worker,
        totalAttempts,
        `Worker ${worker.workerNumber} (${worker.provider}) limite atteinte — recherche d'un worker disponible...`,
      );
      const stillEligible = workers.filter((w) => !w.quotaExhausted);
      if (stillEligible.length === 0) {
        emit(
          'FAILED_QUOTA',
          worker,
          totalAttempts,
          `Limite d'utilisation atteinte sur Worker 1 & Worker 2.`,
        );
        throw new AiQuotaExhaustedError(
          `Limite d'utilisation atteinte sur tous les fournisseurs IA configurés. Réessayez plus tard ou vérifiez vos quotas.`,
        );
      }
    } else {
      const nextWorker = eligible[(cursor) % eligible.length];
      if (nextWorker && nextWorker.workerNumber !== worker.workerNumber) {
        emit(
          'SWITCHING',
          worker,
          totalAttempts,
          `Panne technique / serveur occupé sur Worker ${worker.workerNumber} (${worker.provider}) — bascule vers Worker ${nextWorker.workerNumber} (${nextWorker.provider})...`,
        );
      } else {
        emit(
          'RETRYING',
          worker,
          totalAttempts,
          `Serveur occupé sur Worker ${worker.workerNumber} (${worker.provider}) — nouvelle tentative en cours...`,
        );
      }
    }

    // Short interruptible backoff before next attempt
    const delayMs = Math.min(3500, 900 + Math.floor(totalAttempts / 2) * 500);
    await sleepAbortable(delayMs, options?.signal);
  }

  throw new BadRequestException(
    'Les serveurs IA sont restés saturés après plusieurs tentatives. Réessayez dans un instant.',
  );
}

export async function generateAiCompletion(
  cfg: Partial<AiProviderConfig>,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ text: string; provider: string; model: string; fallbackFrom?: string; workerNumber: 1 | 2 }> {
  return runResilientAiFailoverLoop(cfg, systemPrompt, userPrompt, { maxAttempts: 8 });
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
