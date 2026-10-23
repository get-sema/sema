import { OpenAICompatibleProvider } from './openai-compatible';

/**
 * DeepSeek — OpenAI-compatible API (same request/response shape, different base
 * URL and key). DeepSeek does not return cost, so it is estimated from a
 * cache-aware price table: cache-hit input tokens bill at `cachedIn`, the rest at
 * the full `in` rate. Prices are USD per 1M tokens at the peak-hour rate
 * (api-docs.deepseek.com/quick_start/pricing), so the estimate is an upper bound —
 * off-peak bills at half. `deepseek-flash` serves V4.1 Flash; `deepseek-chat` /
 * `deepseek-reasoner` were retired on 2026-07-24.
 */
export const deepseekProvider = new OpenAICompatibleProvider({
  id: 'deepseek',
  label: 'DeepSeek',
  baseURL: 'https://api.deepseek.com',
  secretKey: 'sema.apiKey.deepseek',
  keyHint: 'platform.deepseek.com/api_keys',
  modelHint: 'e.g. deepseek-flash, deepseek-v4-pro',
  models: ['deepseek-flash', 'deepseek-v4-pro'],
  defaultModel: 'deepseek-flash',
  // No `accepts`: images/PDFs are refused up front rather than 400-ing upstream.
  // (deepseek-flash gained image input; enable it once its wire format is verified.)
  prices: {
    'deepseek-flash': { in: 0.3, cachedIn: 0.006, out: 1.2 },
    'deepseek-v4-pro': { in: 1.32, cachedIn: 0.044, out: 3.96 },
  },
});
