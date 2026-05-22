import React, { useEffect } from 'react';
import styles from '../app.module.css';

interface MissingConfig {
  provider: string;
  requiredKeys: string[];
  description?: string;
}

interface MissingConfigModalProps {
  isOpen: boolean;
  missingConfigs: MissingConfig[];
  agentName: string;
  onClose: () => void;
  onGoToSettings: () => void;
}

export function MissingConfigModal({
  isOpen,
  missingConfigs,
  agentName,
  onClose,
  onGoToSettings,
}: MissingConfigModalProps) {
  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(20, 20, 35, 0.95)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '30px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          zIndex: 1000,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px' }}>⚙️ Configuration Required</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '20px',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ marginBottom: '25px' }}>
          <p style={{ margin: '0 0 20px 0', color: '#ccc' }}>
            The agent <strong>{agentName}</strong> requires the following AI provider configurations to run:
          </p>

          <div style={{ marginBottom: '20px' }}>
            {missingConfigs.map((config) => (
              <div
                key={config.provider}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    fontWeight: '600',
                    color: '#ef4444',
                    marginBottom: '8px',
                    textTransform: 'capitalize',
                  }}
                >
                  {config.provider}
                </div>
                <p style={{ margin: '8px 0', fontSize: '14px', color: '#aaa' }}>
                  {config.description || `${config.provider} API key is required`}
                </p>
                <p style={{ margin: '8px 0', fontSize: '12px', color: '#888' }}>
                  Required: {config.requiredKeys.join(', ')}
                </p>
              </div>
            ))}
          </div>

          <div
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '15px',
            }}
          >
            <p style={{ margin: 0, fontSize: '13px', color: '#93c5fd' }}>
              💡 Tip: You can save multiple AI provider keys and reuse them across all agents.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            className={styles.secondaryButton}
            style={{
              padding: '12px 20px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onGoToSettings}
            className={styles.primaryButton}
            style={{
              padding: '12px 20px',
            }}
          >
            Go to Settings →
          </button>
        </div>
      </div>
    </>
  );
}
