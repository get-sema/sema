import { OpenAICompatibleProvider } from './openai-compatible';

/**
 * OpenRouter — an OpenAI-compatible gateway to many models, addressed by
 * `provider/model` slug. Usage (including a real dollar `cost`) is always
 * streamed in the final chunk, so cost is reported, never estimated. The optional
 * HTTP-Referer / X-Title headers attribute traffic to this app on the OpenRouter
 * dashboard. The curated list below is a starting point; "+ custom id…" reaches
 * the full catalogue (see GET https://openrouter.ai/api/v1/models).
 */
export const openrouterProvider = new OpenAICompatibleProvider({
  id: 'openrouter',
  label: 'OpenRouter',
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    'HTTP-Referer': 'https://github.com/get-sema/sema',
    'X-Title': 'sema',
  },
  secretKey: 'sema.apiKey.openrouter',
  keyHint: 'openrouter.ai/keys',
  modelHint: 'provider/model slug — e.g. anthropic/claude-opus-5.5, x-ai/grok-4.7 (see openrouter.ai/models)',
  // Images are allowed by default: OpenRouter fronts hundreds of models (and any
  // custom slug), so we can't know a model's modality up front. Where we'd guess
  // wrong, OpenRouter returns a clear error — better than refusing an attachment a
  // vision model would have read. `accepts` below marks the entries we *do* know.
  accepts: ['image', 'text'],
  modelInfos: [
    { id: 'anthropic/claude-opus-5.5', name: 'Claude Opus 5.5', recommended: true, accepts: ['image', 'pdf', 'text'] },
    { id: 'anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', accepts: ['image', 'pdf', 'text'] },
    { id: 'anthropic/claude-fable-5.1', name: 'Claude Fable 5.1', accepts: ['image', 'pdf', 'text'] },
    { id: 'anthropic/claude-haiku-5.5', name: 'Claude Haiku 5.5', accepts: ['image', 'pdf', 'text'] },
    { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol' },
    { id: 'openai/gpt-6-astra', name: 'GPT-6 Astra' },
    { id: 'openai/gpt-6-luna', name: 'GPT-6 Luna' },
    { id: 'google/gemini-4-argon', name: 'Gemini 4 Argon' },
    { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
    { id: 'x-ai/grok-4.7', name: 'Grok 4.7' },
    { id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' },
    { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', accepts: ['text'] },
    { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', accepts: ['text'] },
    { id: 'z-ai/glm-5.3', name: 'GLM 5.3' },
    { id: 'moonshotai/kimi-k3', name: 'Kimi K3' },
    { id: 'minimax/minimax-m3', name: 'MiniMax M3' },
  ],
  defaultModel: 'anthropic/claude-opus-5.5',
  costFromResponse: true,
});
