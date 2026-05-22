const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...init,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      error.error || `API error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<T>;
}

export interface AIConfig {
  id: string;
  provider: string;
  isActive: boolean;
  testStatus: "untested" | "valid" | "invalid" | "expired";
  lastTestedAt?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  hasKey: boolean;
}

export interface ProviderRequirements {
  provider: string;
  fields: string[];
  documentation: string;
  description: string;
}

export const userAIConfigClient = {
  /**
   * Get all saved AI configurations for the current user
   */
  listConfigs: (token: string) =>
    request<{ configs: AIConfig[] }>("/user/ai-config", token),

  /**
   * Save or update an AI provider configuration
   */
  saveConfig: (
    token: string,
    provider: string,
    apiKey: string,
    metadata?: any
  ) =>
    request<{ message: string; config: AIConfig }>("/user/ai-config", token, {
      method: "POST",
      body: JSON.stringify({ provider, apiKey, metadata }),
    }),

  /**
   * Delete an AI provider configuration
   */
  deleteConfig: (token: string, provider: string) =>
    request<{ message: string }>(`/user/ai-config/${provider}`, token, {
      method: "DELETE",
    }),

  /**
   * Get required fields for a specific provider
   */
  getProviderRequirements: (token: string, provider: string) =>
    request<ProviderRequirements>(
      `/user/ai-config/${provider}/required-fields`,
      token
    ),

  /**
   * Test if a saved configuration is valid
   */
  testConfig: (token: string, provider: string) =>
    request<{
      provider: string;
      status: "valid" | "invalid";
      message: string;
    }>(`/user/ai-config/${provider}/test`, token, {
      method: "POST",
    }),
};
