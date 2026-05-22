import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../lib/prisma';
import { JwtPayload } from '../types/express';

const router = Router();

// Get execution log for a run
router.get('/:runId', authenticate, async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const userId = (req.user as JwtPayload).id;

    const log = await prisma.executionLog.findUnique({
      where: { runId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    if (!log || log.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Not found or unauthorized' });
    }

    res.json({ success: true, log });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// List execution logs for a workflow or agent
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as JwtPayload).id;
    const { workflowId, agentId, limit = 20, offset = 0 } = req.query;

    const logs = await prisma.executionLog.findMany({
      where: {
        userId,
        ...(workflowId && { workflowId: String(workflowId) }),
        ...(agentId && { agentId: String(agentId) }),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      include: { steps: { select: { stepNumber: true, name: true, status: true } } },
    });

    const total = await prisma.executionLog.count({
      where: {
        userId,
        ...(workflowId && { workflowId: String(workflowId) }),
        ...(agentId && { agentId: String(agentId) }),
      },
    });

    res.json({ success: true, logs, total, limit: Number(limit), offset: Number(offset) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get detailed trace/steps for an execution log
router.get('/:runId/trace', authenticate, async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const userId = (req.user as JwtPayload).id;

    const log = await prisma.executionLog.findUnique({
      where: { runId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    if (!log || log.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Not found or unauthorized' });
    }

    // Format trace for better visualization
    const trace = {
      runId,
      status: log.status,
      duration: log.duration,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      steps: log.steps.map((step) => ({
        stepNumber: step.stepNumber,
        name: step.name,
        status: step.status,
        input: step.input,
        output: step.output,
        error: step.error,
        duration: step.duration,
        tokens: step.tokens,
        timestamps: step.timestamps,
      })),
      metadata: log.metadata,
    };

    res.json({ success: true, trace });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Create execution log (called by ai-worker before run)
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as JwtPayload).id;
    const { runId, agentId, workflowId } = req.body;

    const log = await prisma.executionLog.create({
      data: {
        runId,
        userId,
        agentId,
        workflowId,
        status: 'running',
        startedAt: new Date(),
      },
    });

    res.json({ success: true, log });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update execution log with completion
router.patch('/:runId', authenticate, async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const userId = (req.user as JwtPayload).id;
    const { status, completedAt, duration, metadata } = req.body;

    const log = await prisma.executionLog.findUnique({
      where: { runId },
    });

    if (!log || log.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Not found or unauthorized' });
    }

    const updated = await prisma.executionLog.update({
      where: { runId },
      data: { status, completedAt, duration, metadata },
    });

    res.json({ success: true, log: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Add step to execution log
router.post('/:runId/steps', authenticate, async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const userId = (req.user as JwtPayload).id;
    const { stepNumber, name, status, input, output, error, duration, tokens, timestamps } = req.body;

    const log = await prisma.executionLog.findUnique({
      where: { runId },
    });

    if (!log || log.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Not found or unauthorized' });
    }

    const step = await prisma.executionStep.create({
      data: {
        executionLogId: log.id,
        stepNumber,
        name,
        status,
        input,
        output,
        error,
        duration,
        tokens,
        timestamps,
      },
    });

    res.json({ success: true, step });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
