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

export async function generateAiCompletion(
  cfg: Partial<AiProviderConfig>,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ text: string; provider: string; model: string }> {
  const provider = cfg.provider === 'GROQ' ? 'GROQ' : 'GEMINI';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);

  try {
    if (provider === 'GROQ') {
      const apiKey = String(cfg.groqApiKey || '').trim();
      const model = String(cfg.groqModel || 'llama-3.3-70b-versatile').trim();
      if (!apiKey) {
        throw new Error('Clé API Groq manquante dans Paramètres Système > Intelligence Artificielle.');
      }
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 1200,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || `Erreur Groq API (HTTP ${res.status}).`);
      }
      const text = String(json?.choices?.[0]?.message?.content || '').trim();
      if (!text) throw new Error('Réponse vide reçue depuis Groq.');
      return { text, provider: 'GROQ', model };
    }

    // GEMINI (Google AI Studio free tier)
    const apiKey = String(cfg.geminiApiKey || '').trim();
    const model = String(cfg.geminiModel || 'gemini-2.5-flash').trim();
    if (!apiKey) {
      throw new Error('Clé API Google AI Studio (Gemini) manquante dans Paramètres Système > Intelligence Artificielle.');
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
      throw new Error(json?.error?.message || `Erreur Gemini API (HTTP ${res.status}).`);
    }
    const text = String(json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!text) throw new Error('Réponse vide reçue depuis Gemini.');
    return { text, provider: 'GEMINI', model };
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
