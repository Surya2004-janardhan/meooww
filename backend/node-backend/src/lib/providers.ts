export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'cohere'
  | 'groq'
  | 'together'
  | 'fireworks'
  | 'perplexity'
  | 'openrouter'
  | 'azure'
  | 'ollama'
  | 'openai-compatible';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  envKey?: string;
  baseUrlEnv?: string;
  models: string[];
  type: 'openai-compatible' | 'anthropic' | 'google' | 'cohere' | 'ollama' | 'azure';
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1-mini', 'o1-mini'],
    type: 'openai-compatible',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    models: ['claude-3-5-sonnet-20240620', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    type: 'anthropic',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    envKey: 'GOOGLE_API_KEY',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
    type: 'google',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    envKey: 'MISTRAL_API_KEY',
    models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x7b'],
    type: 'openai-compatible',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    envKey: 'COHERE_API_KEY',
    models: ['command-r-plus', 'command-r', 'command'],
    type: 'cohere',
  },
  {
    id: 'groq',
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    type: 'openai-compatible',
  },
  {
    id: 'together',
    name: 'Together',
    envKey: 'TOGETHER_API_KEY',
    models: ['meta-llama/Llama-3.1-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct', 'mistralai/Mixtral-8x22B-Instruct-v0.1'],
    type: 'openai-compatible',
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    envKey: 'FIREWORKS_API_KEY',
    models: ['accounts/fireworks/models/llama-v3p1-70b-instruct', 'accounts/fireworks/models/qwen2p5-72b-instruct'],
    type: 'openai-compatible',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    envKey: 'PERPLEXITY_API_KEY',
    models: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online'],
    type: 'openai-compatible',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-70b-instruct'],
    type: 'openai-compatible',
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    envKey: 'AZURE_OPENAI_API_KEY',
    baseUrlEnv: 'AZURE_OPENAI_ENDPOINT',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
    type: 'azure',
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    baseUrlEnv: 'OLLAMA_BASE_URL',
    models: ['llama3.1:8b', 'qwen2.5:7b', 'mistral:7b'],
    type: 'ollama',
  },
  {
    id: 'openai-compatible',
    name: 'Custom (OpenAI-compatible)',
    envKey: 'CUSTOM_LLM_API_KEY',
    baseUrlEnv: 'CUSTOM_LLM_BASE_URL',
    models: ['custom-model'],
    type: 'openai-compatible',
  },
];

export function listProviders() {
  return PROVIDERS.map((provider) => {
    const configured = provider.envKey
      ? Boolean(process.env[provider.envKey])
      : Boolean(provider.baseUrlEnv && process.env[provider.baseUrlEnv]);
    return {
      ...provider,
      configured,
      requires: {
        apiKeyEnv: provider.envKey,
        baseUrlEnv: provider.baseUrlEnv,
      },
    };
  });
}

export function getProvider(id: ProviderId) {
  return PROVIDERS.find((provider) => provider.id === id);
}
