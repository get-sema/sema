import { OpenAICompatibleProvider } from './openai-compatible';

/**
 * Together AI — an OpenAI-compatible gateway to open models (Llama, DeepSeek,
 * Qwen, gpt-oss, …), addressed by `org/Model` slug. Same request/response shape
 * as OpenAI (base URL `https://api.together.ai/v1`); cost isn't returned, so it's
 * estimated from public list prices ($/1M tokens). The curated list plus
 * "+ custom id…" reaches the full catalogue (see together.ai/models).
 */
export const togetherProvider = new OpenAICompatibleProvider({
  id: 'together',
  label: 'Together AI',
  baseURL: 'https://api.together.ai/v1',
  secretKey: 'sema.apiKey.together',
  keyHint: 'api.together.ai/settings/api-keys',
  modelHint: 'org/Model slug — e.g. zai-org/GLM-5.3, moonshotai/Kimi-K3 (see docs.together.ai/docs/serverless/models)',
  // As with OpenRouter: images are allowed by default because a custom slug's modality
  // is unknowable, and the curated entries below carry an explicit `accepts`. Together's
  // catalogue is mostly text-only open models, so most of them say so. The Qwen3 Coder
  // and meta-llama chat models have left serverless.
  accepts: ['image', 'text'],
  modelInfos: [
    { id: 'zai-org/GLM-5.3', name: 'GLM 5.3', recommended: true, accepts: ['text'] },
    { id: 'moonshotai/Kimi-K3', name: 'Kimi K3', accepts: ['text'] },
    { id: 'moonshotai/Kimi-K2.7-Code', name: 'Kimi K2.7 Code', accepts: ['text'] },
    { id: 'deepseek-ai/DeepSeek-V4-Pro-0813', name: 'DeepSeek V4 Pro', accepts: ['text'] },
    // V4.1 Flash takes image input.
    { id: 'deepseek-ai/DeepSeek-V4.1-Flash', name: 'DeepSeek V4.1 Flash' },
    { id: 'Qwen/Qwen3.6-Plus', name: 'Qwen3.6 Plus', accepts: ['text'] },
    { id: 'zai-org/GLM-5.3-Flash', name: 'GLM 5.3 Flash', accepts: ['text'] },
    { id: 'openai/gpt-oss-120b', name: 'gpt-oss 120B', accepts: ['text'] },
  ],
  defaultModel: 'zai-org/GLM-5.3',
});
