import { Router, Response } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';

const router = Router();
const AI_URL = process.env.AI_WORKER_URL || 'http://localhost:5000';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

const aiHeaders = () => ({ 'x-internal-secret': INTERNAL_SECRET });

const CURATED_AGENT_SEEDS = [
  {
    name: 'Research Brief Agent',
    description: 'Produces structured research briefs with claims, evidence, and next steps.',
    provider: 'openai',
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a research analyst. Provide a brief with key findings, citations, and risks.',
  },
  {
    name: 'Support Triage Agent',
    description: 'Classifies tickets, summarizes context, and drafts replies.',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20240620',
    systemPrompt: 'You triage support requests. Classify, summarize, and draft a concise reply.',
  },
  {
    name: 'Meeting Prep Agent',
    description: 'Generates agenda, prep notes, and talking points from context.',
    provider: 'google',
    model: 'gemini-1.5-flash',
    systemPrompt: 'You prepare meeting agendas. Summarize context, propose agenda, and list questions.',
  },
  {
    name: 'Workflow Refiner Agent',
    description: 'Turns rough task lists into executable workflows with clear steps.',
    provider: 'mistral',
    model: 'mistral-small-latest',
    systemPrompt: 'Convert the input into a clear workflow with numbered steps and owners.',
  },
];

const AGENT_TEMPLATE_SEEDS = [
  {
    name: 'Email Triage Agent',
    description: 'Drafts replies, extracts action items, and prioritizes inbox threads.',
    category: 'Communication',
    prompt: 'You triage inbound emails. Provide a concise response draft, a priority level, and action items.',
    icon: 'mail',
  },
  {
    name: 'Research Brief Agent',
    description: 'Produces structured research briefs with claims, evidence, and next steps.',
    category: 'Research',
    prompt: 'You are a research analyst. Provide a brief with key findings, citations, and risks.',
    icon: 'search',
  },
  {
    name: 'Meeting Prep Agent',
    description: 'Generates agenda, prep notes, and talking points from context.',
    category: 'Productivity',
    prompt: 'You prepare meeting agendas. Summarize context, propose agenda, and list questions.',
    icon: 'calendar',
  },
  {
    name: 'Workflow Refiner Agent',
    description: 'Turns rough task lists into executable workflows with clear steps.',
    category: 'Operations',
    prompt: 'Convert the input into a clear workflow with numbered steps and owners.',
    icon: 'layers',
  },
];

const CURATED_WORKFLOWS = [
  {
    name: 'Research brief',
    description: 'Gather context, synthesize the result, and package it for review.',
    scheduleCron: '0 9 * * 1-5',
    scheduleInput: 'Create a research brief on the current project priorities.',
    steps: [
      { agentName: 'Research Brief Agent', config: { stage: 'research' } },
      { agentName: 'Workflow Refiner Agent', config: { stage: 'package' } },
    ],
  },
  {
    name: 'Support triage',
    description: 'Classify customer messages and prepare a human-friendly response.',
    scheduleCron: '*/30 * * * *',
    scheduleInput: 'Triage the latest support queue items and draft replies.',
    steps: [
      { agentName: 'Support Triage Agent', config: { stage: 'classify' } },
      { agentName: 'Workflow Refiner Agent', config: { stage: 'draft' } },
    ],
  },
  {
    name: 'Meeting prep',
    description: 'Prepare an agenda, highlights, and follow-up actions for a meeting.',
    scheduleCron: '0 8 * * 1',
    scheduleInput: 'Prepare a meeting pack for the weekly sync.',
    steps: [
      { agentName: 'Meeting Prep Agent', config: { stage: 'agenda' } },
      { agentName: 'Workflow Refiner Agent', config: { stage: 'refine' } },
    ],
  },
];

async function ensureCuratedWorkspace(userId: string) {
  const count = await prisma.workflow.count({ where: { userId } });
  if (count > 0) return;

  let templates = await prisma.agentTemplate.findMany({ orderBy: { createdAt: 'asc' } });
  if (templates.length === 0) {
    await prisma.agentTemplate.createMany({ data: AGENT_TEMPLATE_SEEDS });
    templates = await prisma.agentTemplate.findMany({ orderBy: { createdAt: 'asc' } });
  }

  const existingAgents = await prisma.agent.findMany({ where: { userId } });

  if (templates.length === 0) {
    return;
  }

  const templateByName = new Map(templates.map((template) => [template.name, template]));
  const agentByName = new Map(existingAgents.map((agent) => [agent.name, agent]));

  for (const seed of CURATED_AGENT_SEEDS) {
    if (agentByName.has(seed.name)) continue;
    const template = templateByName.values().next().value;
    const agent = await prisma.agent.create({
      data: {
        userId,
        templateId: template?.id,
        name: seed.name,
        description: seed.description,
        systemPrompt: seed.systemPrompt,
        provider: seed.provider,
        model: seed.model,
        temperature: 0.3,
        maxTokens: 1024,
      },
    });
    agentByName.set(seed.name, agent);
  }

  for (const workflowSeed of CURATED_WORKFLOWS) {
    const workflow = await prisma.workflow.create({
      data: {
        userId,
        name: workflowSeed.name,
        description: workflowSeed.description,
        scheduleCron: workflowSeed.scheduleCron,
        scheduleInput: workflowSeed.scheduleInput,
        scheduleEnabled: false,
        steps: {
          create: workflowSeed.steps.map((step, index) => {
            const agent = agentByName.get(step.agentName);
            return {
              order: index,
              agentId: agent!.id,
              config: step.config,
            };
          }),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'workflow.seeded',
        targetType: 'workflow',
        targetId: workflow.id,
      },
    });
  }
}

const WorkflowCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  steps: z
    .array(
      z.object({
        agentId: z.string().uuid(),
        order: z.number().int().min(0),
        config: z.record(z.unknown()).default({}),
      }),
    )
    .min(1),
});

const WorkflowUpdateSchema = WorkflowCreateSchema.partial();

const WorkflowRunSchema = z.object({
  input: z.string().min(1).max(8000),
});

// GET /api/workflows
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  await ensureCuratedWorkspace(req.user!.sub);

  const workflows = await prisma.workflow.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: 'desc' },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  res.json({ workflows });
});

// GET /api/workflows/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  await ensureCuratedWorkspace(req.user!.sub);

  const workflow = await prisma.workflow.findFirst({
    where: { id: req.params.id, userId: req.user!.sub },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json(workflow);
});

// POST /api/workflows
router.post('/', authenticate, async (_req: AuthRequest, res: Response) => {
  res.status(405).json({ error: 'Workflow creation is disabled. Use the curated workflows and schedule them.' });
});

// PATCH /api/workflows/:id
router.patch('/:id', authenticate, async (_req: AuthRequest, res: Response) => {
  res.status(405).json({ error: 'Workflow editing is disabled. Only schedule updates are allowed.' });
});

// DELETE /api/workflows/:id
router.delete('/:id', authenticate, async (_req: AuthRequest, res: Response) => {
  res.status(405).json({ error: 'Workflow deletion is disabled.' });
});

const WorkflowScheduleSchema = z.object({
  scheduleCron: z.string().max(120).nullable().optional(),
  scheduleEnabled: z.boolean().optional(),
  scheduleInput: z.string().max(8000).nullable().optional(),
});

// PATCH /api/workflows/:id/schedule
router.patch('/:id/schedule', authenticate, validate(WorkflowScheduleSchema), async (req: AuthRequest, res: Response) => {
  await ensureCuratedWorkspace(req.user!.sub);

  const workflow = await prisma.workflow.findFirst({
    where: { id: req.params.id, userId: req.user!.sub },
  });
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  const data = req.body as z.infer<typeof WorkflowScheduleSchema>;

  const updated = await prisma.workflow.update({
    where: { id: workflow.id },
    data: {
      scheduleCron: data.scheduleCron ?? workflow.scheduleCron,
      scheduleEnabled: data.scheduleEnabled ?? workflow.scheduleEnabled,
      scheduleInput: data.scheduleInput ?? workflow.scheduleInput,
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.sub,
      action: 'workflow.schedule.updated',
      targetType: 'workflow',
      targetId: workflow.id,
    },
  });

  res.json(updated);
});

// POST /api/workflows/:id/run
router.post('/:id/run', authenticate, aiLimiter, validate(WorkflowRunSchema), async (req: AuthRequest, res: Response) => {
  await ensureCuratedWorkspace(req.user!.sub);

  const workflow = await prisma.workflow.findFirst({
    where: { id: req.params.id, userId: req.user!.sub },
    include: { steps: { orderBy: { order: 'asc' } }, user: true },
  });
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  const body = req.body as z.infer<typeof WorkflowRunSchema>;
  const run = await prisma.run.create({
    data: {
      userId: req.user!.sub,
      type: 'workflow',
      status: 'queued',
      workflowId: workflow.id,
      input: { input: body.input },
      startedAt: new Date(),
    },
  });

  const steps = await prisma.workflowStep.findMany({
    where: { workflowId: workflow.id },
    orderBy: { order: 'asc' },
    include: { agent: true },
  });

  try {
    const { data } = await axios.post(
      `${AI_URL}/ai/jobs`,
      {
        type: 'workflow',
        run_id: run.id,
        user_id: req.user!.sub,
        input: body.input,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          steps: steps.map((step: (typeof steps)[number]) => ({
            order: step.order,
            config: step.config,
            agent: {
              id: step.agent.id,
              name: step.agent.name,
              system_prompt: step.agent.systemPrompt,
              provider: step.agent.provider,
              model: step.agent.model,
              temperature: step.agent.temperature,
              max_tokens: step.agent.maxTokens,
            },
          })),
        },
      },
      { headers: aiHeaders() },
    );

    const updated = await prisma.run.update({
      where: { id: run.id },
      data: { jobId: data.job_id },
    });
    res.status(202).json(updated);
  } catch (err: any) {
    const status = err.response?.status || 502;
    await prisma.run.update({
      where: { id: run.id },
      data: { status: 'failed', error: err.response?.data?.error || 'AI service error', completedAt: new Date() },
    });
    res.status(status).json({ error: err.response?.data?.error || 'AI service error' });
  }
});

export default router;
