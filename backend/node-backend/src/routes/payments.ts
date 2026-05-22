import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

// POST /api/payments/order — create Razorpay order
router.post('/order', authenticate, async (req: AuthRequest, res: Response) => {
  const { amount, currency = 'INR' } = req.body; // Amount in paise (e.g., 50000 for ₹500)

  try {
    const options = {
      amount,
      currency,
      receipt: `receipt_${req.user!.sub.slice(0, 8)}`,
    };

    const order = await razorpay.orders.create(options);
    
    // Store customer reference if needed
    await prisma.subscription.upsert({
      where: { userId: req.user!.sub },
      update: { externalCustomerId: order.id },
      create: { userId: req.user!.sub, externalCustomerId: order.id, plan: 'free', status: 'pending' },
    });

    res.json({ order });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payments/verify — Verify Razorpay payment signature
router.post('/verify', authenticate, async (req: AuthRequest, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const sign = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || '')
    .update(sign.toString())
    .digest("hex");

  if (razorpay_signature === expectedSign) {
    await prisma.subscription.update({
      where: { userId: req.user!.sub },
      data: { plan: 'pro', status: 'active' },
    });
    res.json({ success: true, message: "Payment verified successfully" });
  } else {
    res.status(400).json({ success: false, message: "Invalid signature" });
  }
});

// POST /api/payments/webhook — Razorpay Webhook
router.post('/webhook', async (req: Request, res: Response) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const signature = req.headers['x-razorpay-signature'] as string;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature === expectedSignature) {
    const { event, payload } = req.body;
    
    if (event === 'payment.captured') {
      const orderId = payload.payment.entity.order_id;
      await prisma.subscription.updateMany({
        where: { externalCustomerId: orderId },
        data: { plan: 'pro', status: 'active' },
      });
    }
    
    res.json({ status: 'ok' });
  } else {
    res.status(400).send('Invalid signature');
  }
});

// GET /api/payments/subscription — get current user subscription
router.get('/subscription', authenticate, async (req: AuthRequest, res: Response) => {
  const sub = await prisma.subscription.findUnique({ where: { userId: req.user!.sub } });
  res.json(sub || { plan: 'free', status: 'active' });
});

export default router;
