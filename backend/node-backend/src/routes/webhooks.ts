import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../lib/prisma';
import { JwtPayload } from '../types/express';
import crypto from 'crypto';

const router = Router();

// Generate webhook secret
function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

// List webhooks
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as JwtPayload).id;

    const webhooks = await prisma.webhook.findMany({
      where: { userId },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, webhooks });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Create webhook
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as JwtPayload).id;
    const { url, events, retries = 3, timeout = 30000 } = req.body;

    if (!url || !events || events.length === 0) {
      return res.status(400).json({ success: false, error: 'URL and events are required' });
    }

    const secret = generateSecret();

    const webhook = await prisma.webhook.create({
      data: {
        userId,
        url,
        events,
        secret,
        retries,
        timeout,
      },
    });

    res.json({
      success: true,
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        secret: webhook.secret,
        createdAt: webhook.createdAt,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update webhook
router.patch('/:webhookId', authenticate, async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    const userId = (req.user as JwtPayload).id;
    const { url, events, active, retries, timeout } = req.body;

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || webhook.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const updated = await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(url && { url }),
        ...(events && { events }),
        ...(active !== undefined && { active }),
        ...(retries && { retries }),
        ...(timeout && { timeout }),
      },
    });

    res.json({ success: true, webhook: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete webhook
router.delete('/:webhookId', authenticate, async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    const userId = (req.user as JwtPayload).id;

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || webhook.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    await prisma.webhook.delete({
      where: { id: webhookId },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Test webhook
router.post('/:webhookId/test', authenticate, async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    const userId = (req.user as JwtPayload).id;

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || webhook.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const payload = {
      event_type: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { test: true },
    };

    // TODO: Send actual HTTP request with signature
    // For now, just simulate
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    res.json({
      success: true,
      message: 'Test webhook sent',
      payload,
      signature,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get webhook deliveries/history
router.get('/:webhookId/deliveries', authenticate, async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    const userId = (req.user as JwtPayload).id;
    const { limit = 20, offset = 0 } = req.query;

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || webhook.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.webhookDelivery.count({
      where: { webhookId },
    });

    res.json({ success: true, deliveries, total, limit: Number(limit), offset: Number(offset) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Create event and trigger webhooks (internal)
router.post('/events/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { type, runId, workflowId, agentId, payload, metadata } = req.body;

    const event = await prisma.event.create({
      data: {
        userId,
        type,
        runId,
        workflowId,
        agentId,
        payload,
        metadata,
      },
    });

    // Find webhooks subscribed to this event and queue deliveries
    const webhooks = await prisma.webhook.findMany({
      where: {
        userId,
        active: true,
        events: { has: type },
      },
    });

    for (const webhook of webhooks) {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType: type,
          payload: event.payload || {},
          attempts: 0,
        },
      });

      // TODO: Queue delivery for async send
      // scheduleWebhookDelivery(delivery);
    }

    res.json({ success: true, event, webhooksTriggered: webhooks.length });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
