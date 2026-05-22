'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { userAIConfigClient, type AIConfig, type ProviderRequirements } from '@/lib/userAIConfigClient';
import styles from '../app.module.css';

const SUPPORTED_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: '🤖' },
  { id: 'anthropic', name: 'Anthropic Claude', icon: '🧠' },
  { id: 'google', name: 'Google Gemini', icon: '🔍' },
  { id: 'mistral', name: 'Mistral AI', icon: '✨' },
  { id: 'cohere', name: 'Cohere', icon: '🎯' },
  { id: 'groq', name: 'Groq', icon: '⚡' },
  { id: 'together', name: 'Together AI', icon: '🤝' },
  { id: 'azure', name: 'Azure OpenAI', icon: '☁️' },
  { id: 'openrouter', name: 'OpenRouter', icon: '🛣️' },
];

export default function AIConfigSettingsPage() {
  const { token } = useAuth();
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [requirements, setRequirements] = useState<ProviderRequirements | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load configs on mount
  useEffect(() => {
    if (token) {
      loadConfigs();
    }
  }, [token]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await userAIConfigClient.listConfigs(token!);
      setConfigs(data.configs);
    } catch (error) {
      console.error('Failed to load configs:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load configurations',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditProvider = async (providerId: string) => {
    try {
      setEditingProvider(providerId);
      setApiKey('');
      const reqs = await userAIConfigClient.getProviderRequirements(token!, providerId);
      setRequirements(reqs);
    } catch (error) {
      console.error('Failed to load requirements:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load provider requirements',
      });
    }
  };

  const handleSaveConfig = async () => {
    if (!editingProvider || !apiKey.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter an API key',
      });
      return;
    }

    try {
      setSaving(true);
      await userAIConfigClient.saveConfig(token!, editingProvider, apiKey);
      setMessage({
        type: 'success',
        text: `${editingProvider} configuration saved successfully`,
      });
      setEditingProvider(null);
      setApiKey('');
      await loadConfigs();
    } catch (error) {
      console.error('Failed to save config:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save configuration',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (provider: string) => {
    if (!window.confirm(`Are you sure you want to delete ${provider} configuration?`)) {
      return;
    }

    try {
      await userAIConfigClient.deleteConfig(token!, provider);
      setMessage({
        type: 'success',
        text: `${provider} configuration deleted`,
      });
      await loadConfigs();
    } catch (error) {
      console.error('Failed to delete config:', error);
      setMessage({
        type: 'error',
        text: 'Failed to delete configuration',
      });
    }
  };

  const handleTestConfig = async (provider: string) => {
    try {
      setTesting(provider);
      const result = await userAIConfigClient.testConfig(token!, provider);
      setMessage({
        type: result.status === 'valid' ? 'success' : 'error',
        text: result.message,
      });
      await loadConfigs();
    } catch (error) {
      console.error('Failed to test config:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to test configuration',
      });
    } finally {
      setTesting(null);
    }
  };

  if (!token) {
    return <div className={styles.page}>Please log in to manage AI configurations.</div>;
  }

  const configMap = new Map(configs.map(c => [c.provider.toLowerCase(), c]));

  return (
    <div className={`${styles.page} animate-fade-in`}>
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionLabel}>Settings</div>
            <h1 className={styles.sectionTitle}>AI Provider Configuration</h1>
          </div>
        </div>
        <p className={styles.sectionText}>
          Save your API keys for different AI providers. Your keys are encrypted and stored securely. 
          You can use them across all agents without re-entering them every time.
        </p>
      </section>

      {message && (
        <div
          className={styles.routeCard}
          style={{
            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderLeft: `4px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`,
          }}
        >
          <p style={{ margin: 0, color: message.type === 'success' ? '#22c55e' : '#ef4444' }}>
            {message.text}
          </p>
        </div>
      )}

      {loading ? (
        <div className={styles.routeCard}>
          <p className={styles.cardText}>Loading configurations...</p>
        </div>
      ) : (
        <>
          <section className={styles.grid3}>
            {SUPPORTED_PROVIDERS.map((provider) => {
              const config = configMap.get(provider.id);
              const isEditing = editingProvider === provider.id;

              return (
                <div
                  key={provider.id}
                  className={`${styles.routeCard} glass`}
                  style={{
                    opacity: isEditing ? 1 : undefined,
                    transform: isEditing ? 'scale(1.05)' : undefined,
                  }}
                >
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.routeTitle}>
                      {provider.icon} {provider.name}
                    </h3>
                    {config && (
                      <span
                        className={styles.badge}
                        style={{
                          background:
                            config.testStatus === 'valid'
                              ? 'rgba(34, 197, 94, 0.1)'
                              : 'rgba(234, 179, 8, 0.1)',
                          color: config.testStatus === 'valid' ? '#22c55e' : '#eab308',
                        }}
                      >
                        {config.testStatus === 'valid' ? '✓ Valid' : '⚠ ' + config.testStatus}
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div style={{ marginTop: '15px' }}>
                      <textarea
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your API key..."
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(0, 0, 0, 0.3)',
                          color: '#fff',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          minHeight: '60px',
                          resize: 'vertical',
                        }}
                      />
                      {requirements && (
                        <p className={styles.cardText} style={{ fontSize: '12px', marginTop: '10px' }}>
                          {requirements.description}
                          {requirements.documentation && (
                            <a
                              href={requirements.documentation}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ marginLeft: '10px', color: '#60a5fa' }}
                            >
                              Get key →
                            </a>
                          )}
                        </p>
                      )}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '10px',
                          marginTop: '15px',
                        }}
                      >
                        <button
                          onClick={handleSaveConfig}
                          disabled={saving}
                          className={styles.primaryButton}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingProvider(null)}
                          className={styles.secondaryButton}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={styles.cardText}>
                        {config
                          ? `Configured • Last tested ${new Date(config.lastTestedAt || config.updatedAt).toLocaleDateString()}`
                          : 'Not configured'}
                      </p>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: config ? '1fr 1fr 1fr' : '1fr 1fr',
                          gap: '10px',
                          marginTop: 'auto',
                          paddingTop: '15px',
                        }}
                      >
                        {config && (
                          <button
                            onClick={() => handleTestConfig(provider.id)}
                            disabled={testing === provider.id}
                            className={styles.secondaryButton}
                            style={{ fontSize: '12px' }}
                          >
                            {testing === provider.id ? '🧪 Testing...' : '🧪 Test'}
                          </button>
                        )}
                        <button
                          onClick={() => handleEditProvider(provider.id)}
                          className={styles.primaryButton}
                          style={{ fontSize: '12px' }}
                        >
                          {config ? 'Update' : 'Configure'}
                        </button>
                        {config && (
                          <button
                            onClick={() => handleDeleteConfig(provider.id)}
                            className={styles.secondaryButton}
                            style={{
                              fontSize: '12px',
                              color: '#ef4444',
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}

      <section className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>Security & Privacy</h3>
        <p className={styles.cardText}>
          ✓ All API keys are encrypted using AES-256-GCM encryption<br />
          ✓ Keys are never logged or displayed in full<br />
          ✓ You can revoke access at any time by deleting the configuration<br />
          ✓ Your keys are only used to execute agents and workflows you initiate<br />
        </p>
      </section>

      <section className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>Local Development</h3>
        <p className={styles.cardText}>
          For local testing, you can set environment variables in your .env file:
          <pre
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '15px',
              borderRadius: '6px',
              overflow: 'auto',
              marginTop: '10px',
              fontSize: '12px',
            }}
          >
            {`OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# For local testing prefix with AI_
AI_OPENAI_API_KEY=sk-...
AI_ANTHROPIC_API_KEY=sk-ant-...`}
          </pre>
        </p>
      </section>
    </div>
  );
}
