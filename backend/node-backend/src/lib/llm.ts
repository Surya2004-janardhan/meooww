import { ProviderId, getProvider } from './providers';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  provider: ProviderId;
  model: string;
  messages: LlmMessage[];
  temperature: number;
  maxTokens: number;
}

export interface LlmResult {
  text: string;
  usage: {
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    cost?: number | null;
  };
}

async function openAiCompatible(url: string, apiKey: string | undefined, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey ? `Bearer ${apiKey}` : '',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<any>;
}

async function anthropicRequest(apiKey: string | undefined, body: Record<string, unknown>) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<any>;
}

async function googleRequest(apiKey: string | undefined, model: string, body: Record<string, unknown>) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey || ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<any>;
}

async function cohereRequest(apiKey: string | undefined, body: Record<string, unknown>) {
  const res = await fetch('https://api.cohere.com/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey || ''}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<any>;
}

async function ollamaRequest(baseUrl: string, body: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: false }),
  });
  if (!res.ok) {
    throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<any>;
}

export async function runCompletion({ provider, model, messages, temperature, maxTokens }: LlmRequest): Promise<LlmResult> {
  const config = getProvider(provider);
  if (!config) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const system = messages.find((m) => m.role === 'system')?.content;
  const userMessages = messages.filter((m) => m.role !== 'system');

  switch (config.type) {
    case 'openai-compatible': {
      const baseUrl =
        provider === 'openai'
          ? 'https://api.openai.com/v1'
          : provider === 'openrouter'
            ? 'https://openrouter.ai/api/v1'
            : provider === 'perplexity'
              ? 'https://api.perplexity.ai'
              : provider === 'groq'
                ? 'https://api.groq.com/openai/v1'
                : provider === 'together'
                  ? 'https://api.together.xyz/v1'
                  : provider === 'fireworks'
                    ? 'https://api.fireworks.ai/inference/v1'
                    : provider === 'mistral'
                      ? 'https://api.mistral.ai/v1'
                      : provider === 'openai-compatible'
                        ? process.env.CUSTOM_LLM_BASE_URL || ''
                        : 'https://api.openai.com/v1';

      if (!baseUrl) {
        throw new Error('Missing base URL for provider');
      }

      const apiKey = config.envKey ? process.env[config.envKey] : undefined;
      const data = await openAiCompatible(`${baseUrl}/chat/completions`, apiKey, {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      return {
        text: data.choices?.[0]?.message?.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? null,
          completionTokens: data.usage?.completion_tokens ?? null,
          totalTokens: data.usage?.total_tokens ?? null,
          cost: data.usage?.cost ?? null,
        },
      };
    }
    case 'anthropic': {
      const apiKey = config.envKey ? process.env[config.envKey] : undefined;
      const data = await anthropicRequest(apiKey, {
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      const text = Array.isArray(data.content) ? data.content[0]?.text : data.content?.text;
      return {
        text: text || '',
        usage: {
          promptTokens: data.usage?.input_tokens ?? null,
          completionTokens: data.usage?.output_tokens ?? null,
          totalTokens: data.usage?.input_tokens && data.usage?.output_tokens
            ? data.usage.input_tokens + data.usage.output_tokens
            : null,
          cost: null,
        },
      };
    }
    case 'google': {
      const apiKey = config.envKey ? process.env[config.envKey] : undefined;
      const contents = [
        ...(system ? [{ role: 'user', parts: [{ text: system }] }] : []),
        ...userMessages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      ];
      const data = await googleRequest(apiKey, model, {
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      });
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return {
        text: text || '',
        usage: {
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          cost: null,
        },
      };
    }
    case 'cohere': {
      const apiKey = config.envKey ? process.env[config.envKey] : undefined;
      const chatHistory = userMessages.slice(0, -1).map((m) => ({ role: m.role, message: m.content }));
      const last = userMessages[userMessages.length - 1];
      const data = await cohereRequest(apiKey, {
        model,
        message: last?.content || '',
        temperature,
        chat_history: chatHistory,
        preamble: system,
      });
      return {
        text: data.text || data.message || '',
        usage: {
          promptTokens: data.meta?.tokens?.input_tokens ?? null,
          completionTokens: data.meta?.tokens?.output_tokens ?? null,
          totalTokens: data.meta?.tokens?.total_tokens ?? null,
          cost: null,
        },
      };
    }
    case 'ollama': {
      const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const data = await ollamaRequest(baseUrl, {
        model,
        messages,
        options: { temperature, num_predict: maxTokens },
      });
      return {
        text: data.message?.content || '',
        usage: { promptTokens: null, completionTokens: null, totalTokens: null, cost: null },
      };
    }
    case 'azure': {
      const apiKey = process.env.AZURE_OPENAI_API_KEY;
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
      if (!endpoint) {
        throw new Error('Missing Azure endpoint');
      }
      const url = `${endpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
      const data = await openAiCompatible(url, apiKey, {
        messages,
        temperature,
        max_tokens: maxTokens,
      });
      return {
        text: data.choices?.[0]?.message?.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? null,
          completionTokens: data.usage?.completion_tokens ?? null,
          totalTokens: data.usage?.total_tokens ?? null,
          cost: null,
        },
      };
    }
    default:
      throw new Error(`Unsupported provider type: ${config.type}`);
  }
}
