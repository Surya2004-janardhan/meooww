'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { MissingConfigModal } from '@/components/MissingConfigModal';
import styles from '../app.module.css';

interface MissingConfig {
  provider: string;
  requiredKeys: string[];
  description?: string;
}

const CATEGORIES = [
  'All', 
  'Workspace', 
  'Social', 
  'Cloud', 
  'Marketing', 
  'Research', 
  'Operations'
];

export default function AgentsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMissingConfigModal, setShowMissingConfigModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [missingConfigs, setMissingConfigs] = useState<MissingConfig[]>([]);

  useEffect(() => {
    // In a real app, fetch from /api/agents/templates
    const mockAgents = [
      // Workspace
      { id: 'gmail-triage', title: 'Gmail Triage Expert', text: 'Complex email sorting and drafting.', category: 'Workspace', tags: ['Email', 'AI'], requiresOAuth: true, provider: 'google' },
      { id: 'sheets-architect', title: 'Sheets Data Architect', text: 'Advanced spreadsheet automation.', category: 'Workspace', tags: ['Data', 'Sheets'], requiresOAuth: true, provider: 'google' },
      { id: 'calendar-coord', title: 'Calendar Life Coordinator', text: 'Intelligent scheduling assistant.', category: 'Workspace', tags: ['Schedule'], requiresOAuth: true, provider: 'google' },
      { id: 'drive-janitor', title: 'Drive Folder Janitor', text: 'Organizes messy Google Drive folders.', category: 'Workspace', tags: ['Files'], requiresOAuth: true, provider: 'google' },
      
      // Social
      { id: 'youtube-hacker', title: 'YouTube Growth Hacker', text: 'YouTube Analytics & SEO strategy.', category: 'Social', tags: ['Video', 'SEO'], requiresOAuth: true, provider: 'google' },
      { id: 'instagram-strategist', title: 'Instagram Visual Strategist', text: 'Captions and visual planning.', category: 'Social', tags: ['Photos', 'Tags'], requiresOAuth: true, provider: 'instagram' },
      { id: 'github-orchestrator', title: 'GitHub Repo Orchestrator', text: 'Issues, PRs, and code review.', category: 'Social', tags: ['Git', 'Code'], requiresOAuth: true, provider: 'github' },
      { id: 'twitter-lead', title: 'Twitter Engagement Lead', text: 'Threads and viral tweet drafting.', category: 'Social', tags: ['Tweets'], requiresOAuth: true, provider: 'google' },
      
      // Cloud
      { id: 'bigquery-scientist', title: 'BigQuery Data Scientist', text: 'Advanced SQL and data modeling.', category: 'Cloud', tags: ['SQL', 'BigData'], requiresOAuth: true, provider: 'google' },
      { id: 'gcs-infra', title: 'GCS Infrastructure Bot', text: 'Bucket and object management.', category: 'Cloud', tags: ['Storage'], requiresOAuth: true, provider: 'google' },
      { id: 'logging-detective', title: 'Cloud Logging Detective', text: 'Sifts through logs for errors.', category: 'Cloud', tags: ['SRE', 'Logs'], requiresOAuth: true, provider: 'google' },
      
      // Marketing
      { id: 'adsense-scout', title: 'AdSense Profit Scout', text: 'Revenue and ad unit optimization.', category: 'Marketing', tags: ['Revenue'], requiresOAuth: true, provider: 'google' },
      { id: 'campaign-360', title: 'Campaign 360 Strategist', text: 'Full-funnel campaign management.', category: 'Marketing', tags: ['Ads'], requiresOAuth: true, provider: 'google' },
      { id: 'seo-stalker', title: 'SEO Keyword Stalker', text: 'Search Console and keyword trends.', category: 'Marketing', tags: ['SEO'], requiresOAuth: true, provider: 'google' },
      
      // Research & Ops
      { id: 'research-peer', title: 'Scientific Research Peer', text: 'Literature review and synthesis.', category: 'Research', tags: ['Science'], requiresOAuth: false },
      { id: 'legal-assistant', title: 'Legal Brief Assistant', text: 'Case law and document drafting.', category: 'Research', tags: ['Legal'], requiresOAuth: false },
      { id: 'expense-audit', title: 'Expense Audit Bot', text: 'Scans receipts and logs expenses.', category: 'Operations', tags: ['Finance'], requiresOAuth: true, provider: 'google' },
      { id: 'travel-concierge', title: 'Travel Concierge', text: 'Itinerary planning and booking.', category: 'Operations', tags: ['Travel'], requiresOAuth: true, provider: 'google' },
    ];
    setAgents(mockAgents);
    setLoading(false);
  }, []);

  const filteredAgents = activeCategory === 'All' 
    ? agents 
    : agents.filter(a => a.category === activeCategory);

  const handleLaunchAgent = (agent: any) => {
    // For demo purposes, simulate missing configs for certain agents
    if (agent.requiresOAuth && agent.provider) {
      const mockMissingConfigs: MissingConfig[] = [
        {
          provider: agent.provider,
          requiredKeys: ['api_key'],
          description: `${agent.provider} API key is required for this agent`,
        },
      ];
      
      setSelectedAgent(agent);
      setMissingConfigs(mockMissingConfigs);
      setShowMissingConfigModal(true);
    } else {
      // Agent doesn't require config, proceed to run it
      router.push(`/runs?agent=${agent.id}`);
    }
  };

  return (
    <div className={`${styles.page} animate-fade-in`}>
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionLabel}>Autonomous Agents</div>
            <h1 className={styles.sectionTitle}>Curated Intelligence</h1>
          </div>
          <span className={styles.pill}>Ready to Deploy</span>
        </div>
        <p className={styles.sectionText}>
          Deploy high-performance agents designed for specific outcomes. Each agent is optimized for 
          precision and can securely access your social platforms with persistent OAuth.
        </p>

        <div className={styles.tagRow} style={{ marginTop: '24px' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`${styles.pill} ${activeCategory === cat ? styles.badge : ''}`}
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.grid3}>
        {filteredAgents.map((agent) => (
          <article key={agent.id} className={`${styles.routeCard} glass`}>
            <div className={styles.sectionHeader} style={{ marginBottom: '8px' }}>
              <h3 className={styles.routeTitle}>{agent.title}</h3>
              {agent.requiresOAuth && (
                <span className={styles.tag} style={{ color: 'var(--accent-vibrant)', background: 'rgba(236, 72, 153, 0.1)' }}>
                  OAuth Required
                </span>
              )}
            </div>
            <p className={styles.cardText}>{agent.text}</p>
            <div className={styles.tagRow}>
              <span className={styles.tag} style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                {agent.category}
              </span>
              {agent.tags.map((tag: string) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
            
            <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
              <button 
                onClick={() => handleLaunchAgent(agent)}
                className={styles.primaryButton} 
                style={{ width: '100%', padding: '10px' }}
              >
                Launch Agent
              </button>
            </div>
          </article>
        ))}
      </section>

      {selectedAgent && (
        <MissingConfigModal
          isOpen={showMissingConfigModal}
          missingConfigs={missingConfigs}
          agentName={selectedAgent.title}
          onClose={() => setShowMissingConfigModal(false)}
          onGoToSettings={() => {
            setShowMissingConfigModal(false);
            router.push('/settings');
          }}
        />
      )}
    </div>
  );
}
