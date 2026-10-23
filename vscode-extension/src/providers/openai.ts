import { OpenAICompatibleProvider } from './openai-compatible';

/**
 * OpenAI via the official SDK — the OpenAI-compatible base with no baseURL
 * override (the SDK points at api.openai.com by default). Models track the
 * GPT-6 family (6.1 Sol = recommended for coding, Astra = flagship, Luna =
 * cost-efficient), with GPT-5.6 kept as the previous generation. Cost is
 * estimated from public list prices ($/1M tokens, developers.openai.com/api/docs/pricing);
 * unknown models get no estimate, and "+ custom id…" reaches any other model.
 */
export const openaiProvider = new OpenAICompatibleProvider({
  id: 'openai',
  label: 'OpenAI',
  secretKey: 'sema.apiKey.openai',
  keyHint: 'platform.openai.com',
  modelHint: 'e.g. gpt-6.1-sol, gpt-6-astra, gpt-6-luna',
  modelInfos: [
    { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', recommended: true, accepts: ['image', 'text'] },
    { id: 'gpt-6-astra', name: 'GPT-6 Astra' },
    { id: 'gpt-6-luna', name: 'GPT-6 Luna', accepts: ['image', 'text'] },
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' },
  ],
  defaultModel: 'gpt-6.1-sol',
  // The GPT-5.6 family and GPT-6 Astra read PDFs via the `file` content part; PDF
  // support for 6.1 Sol / Luna is undocumented, so those entries narrow to images.
  accepts: ['image', 'pdf', 'text'],
  prices: {
    'gpt-6-astra': { in: 10, cachedIn: 1, out: 50 },
    'gpt-6.1-sol': { in: 2, cachedIn: 0.1, out: 10 },
    'gpt-6-sol': { in: 2, cachedIn: 0.2, out: 10 },
    'gpt-6-luna': { in: 0.1, cachedIn: 0.01, out: 0.5 },
    // List price; a promotional 4 / 0.4 / 20 runs to at least 2026-11-21.
    'gpt-5.6-sol': { in: 5, cachedIn: 0.5, out: 30 },
    'gpt-5.6': { in: 5, cachedIn: 0.5, out: 30 }, // alias for gpt-5.6-sol
    'gpt-5.6-terra': { in: 2, cachedIn: 0.2, out: 12 },
    'gpt-5.6-luna': { in: 0.2, cachedIn: 0.02, out: 1.2 },
    'gpt-5.5': { in: 5, cachedIn: 0.5, out: 30 },
    'gpt-5.5-pro': { in: 30, out: 180 },
    'gpt-5.4': { in: 2.5, cachedIn: 0.25, out: 15 },
    'gpt-5.4-mini': { in: 0.75, cachedIn: 0.075, out: 4.5 },
  },
});
