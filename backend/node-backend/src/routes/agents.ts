import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const AgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  templateId: z.string().uuid().optional(),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(64).max(8192).optional(),
});

const TEMPLATE_SEEDS = [
  // --- Google Workspace (1-6) ---
  { name: 'Gmail Triage Expert', description: 'Complex email sorting and drafting.', category: 'Workspace', prompt: 'You manage Gmail. Triage, summarize, and draft replies.', icon: 'mail' },
  { name: 'Sheets Data Architect', description: 'Advanced spreadsheet automation.', category: 'Workspace', prompt: 'You manage Sheets. Read/write data and perform analysis.', icon: 'table' },
  { name: 'Calendar Life Coordinator', description: 'Intelligent scheduling assistant.', category: 'Workspace', prompt: 'You manage Calendar. Coordinate events and invites.', icon: 'calendar' },
  { name: 'Drive Folder Janitor', description: 'Organizes messy Google Drive folders.', category: 'Workspace', prompt: 'You manage Drive. Organize, rename, and move files.', icon: 'folder' },
  { name: 'Meeting Minutes Pro', description: 'Transcribes and summarizes meetings.', category: 'Workspace', prompt: 'Create agendas and meeting notes from transcripts.', icon: 'clock' },
  { name: 'Slide Deck Drafter', description: 'Outlines presentations in Slides.', category: 'Workspace', prompt: 'Draft structured outlines for slide presentations.', icon: 'image' },

  // --- Social Media (7-12) ---
  { name: 'YouTube Growth Hacker', description: 'YouTube Analytics & SEO strategy.', category: 'Social', prompt: 'Analyze YouTube data to suggest viral strategies.', icon: 'youtube' },
  { name: 'Instagram Visual Strategist', description: 'Captions and visual planning.', category: 'Social', prompt: 'Plan Instagram posts and hashtag strategies.', icon: 'instagram' },
  { name: 'Blogger Content Engine', description: 'Drafts and publishes blog posts.', category: 'Social', prompt: 'Create and publish content to Blogger.', icon: 'edit' },
  { name: 'Twitter Engagement Lead', description: 'Threads and viral tweet drafting.', category: 'Social', prompt: 'Draft engaging Twitter threads and tweets.', icon: 'twitter' },
  { name: 'LinkedIn Thought Leader', description: 'B2B content strategy and posting.', category: 'Social', prompt: 'Create professional LinkedIn content.', icon: 'linkedin' },
  { name: 'Pinterest Trend Spotter', description: 'Visual trend analysis and pinning.', category: 'Social', prompt: 'Identify visual trends for Pinterest boards.', icon: 'map' },

  // --- Cloud & DevOps (13-18) ---
  { name: 'BigQuery Data Scientist', description: 'Advanced SQL and data modeling.', category: 'Cloud', prompt: 'Write and run SQL on BigQuery datasets.', icon: 'database' },
  { name: 'GCS Infrastructure Bot', description: 'Bucket and object management.', category: 'Cloud', prompt: 'Manage Google Cloud Storage buckets/files.', icon: 'cloud' },
  { name: 'GitHub Repo Orchestrator', description: 'Issues, PRs, and code review.', category: 'Cloud', prompt: 'Manage GitHub repos, PRs, and issue triage.', icon: 'github' },
  { name: 'Cloud Logging Detective', description: 'Sifts through logs for errors.', category: 'Cloud', prompt: 'Analyze Google Cloud Logs for troubleshooting.', icon: 'search' },
  { name: 'Monitoring Alert Guard', description: 'Uptime and performance tracking.', category: 'Cloud', prompt: 'Manage Cloud Monitoring alerts and dashboards.', icon: 'activity' },
  { name: 'BigQuery Cost Optimizer', description: 'Analyzes query efficiency/cost.', category: 'Cloud', prompt: 'Optimize BigQuery queries for lower cost.', icon: 'dollar' },

  // --- Marketing & Growth (19-24) ---
  { name: 'AdSense Profit Scout', description: 'Revenue and ad unit optimization.', category: 'Marketing', prompt: 'Analyze AdSense data to boost revenue.', icon: 'trending-up' },
  { name: 'Campaign 360 Strategist', description: 'Full-funnel campaign management.', category: 'Marketing', prompt: 'Optimize digital marketing in Campaign 360.', icon: 'pie-chart' },
  { name: 'Google Analytics Oracle', description: 'User behavior and conversion stats.', category: 'Marketing', prompt: 'Extract insights from Google Analytics 4.', icon: 'bar-chart' },
  { name: 'SEO Keyword Stalker', description: 'Search Console and keyword trends.', category: 'Marketing', prompt: 'Analyze search trends and SEO performance.', icon: 'key' },
  { name: 'Email Campaigner', description: 'Newsletter and blast management.', category: 'Marketing', prompt: 'Design and manage email marketing blasts.', icon: 'send' },
  { name: 'Customer Sentiment Bot', description: 'Reviews and feedback analysis.', category: 'Marketing', prompt: 'Analyze sentiment in user reviews.', icon: 'smile' },

  // --- Advanced Operations (25-30) ---
  { name: 'Scientific Research Peer', description: 'Literature review and synthesis.', category: 'Research', prompt: 'Perform scientific research and summarize papers.', icon: 'book' },
  { name: 'Legal Brief Assistant', description: 'Case law and document drafting.', category: 'Research', prompt: 'Draft legal summaries and analyze cases.', icon: 'briefcase' },
  { name: 'Market Intelligence Scout', description: 'Competitor and trend analysis.', category: 'Research', prompt: 'Track competitors and market shifts.', icon: 'globe' },
  { name: 'Expense Audit Bot', description: 'Scans receipts and logs expenses.', category: 'Operations', prompt: 'Audit expense reports and log to Sheets.', icon: 'check-square' },
  { name: 'Supply Chain Tracker', description: 'Logistics and inventory monitoring.', category: 'Operations', prompt: 'Track logistics data and inventory levels.', icon: 'truck' },
  { name: 'Travel Concierge', description: 'Itinerary planning and booking.', category: 'Operations', prompt: 'Plan travel itineraries and track flights.', icon: 'navigation' },
];

async function ensureTemplates() {
  const existing = await prisma.agentTemplate.count();
  if (existing >= TEMPLATE_SEEDS.length) return;
  
  // Wipe and re-seed to ensure all 30 are there with correct names/categories
  await prisma.agentTemplate.deleteMany();
  await prisma.agentTemplate.createMany({ data: TEMPLATE_SEEDS });
}

// GET /api/agents/templates — List all pre-seeded templates
router.get('/templates', authenticate, async (req: AuthRequest, res: Response) => {
  await ensureTemplates();
  const templates = await prisma.agentTemplate.findMany();
  res.json({ templates });
});

// GET /api/agents — List user's created agents
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const agents = await prisma.agent.findMany({
    where: { userId: req.user!.sub },
    include: { template: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ agents });
});

// POST /api/agents — Create a new agent from a template or scratch
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const data = AgentSchema.parse(req.body);
  
  const agent = await prisma.agent.create({
    data: {
      userId: req.user!.sub,
      name: data.name,
      description: data.description,
      templateId: data.templateId,
      provider: data.provider || 'openai',
      model: data.model || 'gpt-4o',
      temperature: data.temperature,
      maxTokens: data.maxTokens,
    },
  });

  res.json({ agent });
});

export default router;
