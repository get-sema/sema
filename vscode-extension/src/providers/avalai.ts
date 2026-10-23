import { OpenAICompatibleProvider } from './openai-compatible';

/**
 * AvalAI — an OpenAI-compatible gateway (base URL `https://api.avalai.ir/v1`)
 * fronting models from several providers, addressed by bare model id rather than
 * a `provider/model` slug. Reachable from networks where the upstream provider
 * APIs are not, which is the reason it is here: it keeps sema usable when
 * api.anthropic.com and friends are unreachable.
 *
 * Cost is neither reported nor estimated. AvalAI returns an `estimated_cost` object
 * (USD and toman) on the response or final stream chunk, but its own docs say not
 * to bill from it — exact figures need a second, authenticated transactions lookup
 * keyed by `x-request-id`, which this transport has no hook for. Reporting nothing
 * beats reporting a number the provider itself won't stand behind.
 *
 * The curated list below is a starting point; "+ custom id…" reaches the full
 * catalogue (see GET https://api.avalai.ir/public/models).
 */
export const avalaiProvider = new OpenAICompatibleProvider({
  id: 'avalai',
  label: 'AvalAI',
  baseURL: 'https://api.avalai.ir/v1',
  secretKey: 'sema.apiKey.avalai',
  keyHint: 'chat.avalai.ir/platform → API keys',
  modelHint: 'bare model id — e.g. claude-opus-5-5, gpt-6.1-sol (see docs.avalai.ir/en/models)',
  // As with OpenRouter: images are allowed by default because a custom id's modality
  // is unknowable up front, and a wrong guess surfaces as a clear upstream error
  // rather than a silently refused attachment. Curated entries carry explicit
  // `accepts` where the modality is known. Ids from docs.avalai.ir/en/models.
  accepts: ['image', 'text'],
  modelInfos: [
    {
      id: 'claude-opus-5-5',
      name: 'Claude Opus 5.5',
      section: 'Anthropic',
      recommended: true,
      accepts: ['image', 'pdf', 'text'],
    },
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', section: 'Anthropic', accepts: ['image', 'pdf', 'text'] },
    { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', section: 'Anthropic', accepts: ['image', 'pdf', 'text'] },
    { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', section: 'Anthropic', accepts: ['image', 'pdf', 'text'] },
    { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', section: 'OpenAI' },
    { id: 'gpt-6-astra', name: 'GPT-6 Astra', section: 'OpenAI' },
    { id: 'gemini-4-argon', name: 'Gemini 4 Argon', section: 'Google', accepts: ['image', 'pdf', 'text'] },
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', section: 'Google', accepts: ['image', 'pdf', 'text'] },
    { id: 'grok-4.7', name: 'Grok 4.7', section: 'xAI' },
    { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', section: 'Open models' },
    { id: 'qwen3.8-max', name: 'Qwen3.8 Max', section: 'Open models' },
    { id: 'kimi-k3', name: 'Kimi K3', section: 'Open models' },
    { id: 'glm-5.3', name: 'GLM 5.3', section: 'Open models', accepts: ['text'] },
  ],
  defaultModel: 'claude-opus-5-5',
});
