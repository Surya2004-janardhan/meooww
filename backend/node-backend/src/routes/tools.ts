import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../lib/prisma';
import { JwtPayload } from '../types/express';
import { getCachedData, setCachedData, invalidateCache, generateCacheKey } from '../lib/cache';

const router = Router();

// Get available tools
const BUILT_IN_TOOLS = [
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web for information',
    category: 'search',
    config: { provider: 'serpapi' },
  },
  {
    id: 'file-handler',
    name: 'File Handler',
    description: 'Read, write, and process files',
    category: 'file',
    config: { maxSize: '10MB' },
  },
  {
    id: 'api-call',
    name: 'API Call',
    description: 'Make HTTP calls to external APIs',
    category: 'integration',
    config: { timeout: 30000 },
  },
  {
    id: 'data-query',
    name: 'Data Query',
    description: 'Query your knowledge base',
    category: 'knowledge',
    config: { limit: 5 },
  },
  {
    id: 'youtube-analytics',
    name: 'YouTube Analytics',
    description: 'Fetch channel and video performance data',
    category: 'social',
    config: { requiresOAuth: true, provider: 'google' },
  },
  {
    id: 'google-gmail',
    name: 'Gmail',
    description: 'Send, read, and search emails',
    category: 'workspace',
    config: { requiresOAuth: true, provider: 'google' },
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Read and write spreadsheet data',
    category: 'workspace',
    config: { requiresOAuth: true, provider: 'google' },
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Manage files and folders',
    category: 'workspace',
    config: { requiresOAuth: true, provider: 'google' },
  },
  {
    id: 'google-bigquery',
    name: 'BigQuery',
    description: 'Query and analyze massive datasets',
    category: 'cloud',
    config: { requiresOAuth: true, provider: 'google' },
  },
  {
    id: 'google-adsense',
    name: 'AdSense',
    description: 'Manage and optimize ad revenue',
    category: 'marketing',
    config: { requiresOAuth: true, provider: 'google' },
  },
  {
    id: 'google-blogger',
    name: 'Blogger',
    description: 'Manage and publish blog posts',
    category: 'marketing',
    config: { requiresOAuth: true, provider: 'google' },
  },
  {
    id: 'github-manager',
    name: 'GitHub',
    description: 'Manage repositories, issues, and PRs',
    category: 'development',
    config: { requiresOAuth: true, provider: 'github' },
  },
];

// List available tools (Cached)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as JwtPayload).id;
    const cacheKey = generateCacheKey(userId, 'tools');

    // 1. Try Cache
    const cachedTools = await getCachedData<any[]>(cacheKey);
    if (cachedTools) {
      return res.json({ success: true, tools: cachedTools, cached: true });
    }

    // 2. Database Fetch
    const customTools = await prisma.tool.findMany({
      where: { userId },
    });

    const tools = [
      ...BUILT_IN_TOOLS.map((t) => ({ ...t, builtin: true })),
      ...customTools.map((t) => ({ ...t, builtin: false })),
    ];

    // 3. Store in Cache (10 mins)
    await setCachedData(cacheKey, tools, 600);

    res.json({ success: true, tools });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Register custom tool
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as JwtPayload).id;
    const { name, description, category, config } = req.body;

    const tool = await prisma.tool.create({
      data: { userId, name, description, category, config },
    });

    // Invalidate Cache
    await invalidateCache(generateCacheKey(userId, 'tools'));

    res.json({ success: true, tool });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update tool
router.patch('/:toolId', authenticate, async (req: Request, res: Response) => {
  try {
    const { toolId } = req.params;
    const userId = (req.user as JwtPayload).id;
    const { name, description, enabled, config } = req.body;

    const tool = await prisma.tool.findUnique({
      where: { id: toolId },
    });

    if (!tool || tool.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const updated = await prisma.tool.update({
      where: { id: toolId },
      data: { name, description, enabled, config },
    });

    // Invalidate Cache
    await invalidateCache(generateCacheKey(userId, 'tools'));

    res.json({ success: true, tool: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Execute tool (Uncached as it is dynamic)
router.post('/:toolId/execute', async (req: Request, res: Response) => {
  try {
    const { toolId } = req.params;
    const { runId, input } = req.body;
    
    const internalSecret = req.headers['x-internal-secret'];
    const userIdHeader = req.headers['x-user-id'] as string;
    
    let userId: string;
    
    if (internalSecret && internalSecret === process.env.INTERNAL_API_SECRET) {
      userId = userIdHeader;
    } else {
      userId = (req.user as JwtPayload).id;
    }

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const tool = BUILT_IN_TOOLS.find(t => t.id === toolId) || await prisma.tool.findUnique({
      where: { id: toolId },
    });

    if (!tool || (tool as any).userId && (tool as any).userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const startTime = Date.now();
    let output: any = null;
    let error: string | null = null;

    try {
      switch (toolId) {
        case 'web-search':
          output = { results: [], source: 'web-search' };
          break;
        case 'file-handler':
          output = { status: 'handled', source: 'file-handler' };
          break;
        case 'api-call':
          output = { status: 'success', source: 'api-call' };
          break;
        case 'data-query':
          output = { results: [], source: 'data-query' };
          break;
        default:
          output = { executed: true, tool: tool.name };
      }
    } catch (e: any) {
      error = e.message;
    }

    const duration = Date.now() - startTime;

    const usage = await prisma.toolUsage.create({
      data: {
        userId,
        runId,
        toolName: tool.name,
        input,
        output,
        error,
        duration,
      },
    });

    res.json({ success: true, output, error, duration, usage });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete tool
router.delete('/:toolId', authenticate, async (req: Request, res: Response) => {
  try {
    const { toolId } = req.params;
    const userId = (req.user as JwtPayload).id;

    const tool = await prisma.tool.findUnique({
      where: { id: toolId },
    });

    if (!tool || tool.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    await prisma.tool.delete({
      where: { id: toolId },
    });

    // Invalidate Cache
    await invalidateCache(generateCacheKey(userId, 'tools'));

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
