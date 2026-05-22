import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../lib/prisma';
import { JwtPayload } from '../types/express';

const router = Router();

// Create or get knowledge base
router.post('/bases', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const userId = (req.user as JwtPayload).id;

    const kb = await prisma.knowledgeBase.create({
      data: { userId, name, description },
    });

    res.json({ success: true, knowledgeBase: kb });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// List knowledge bases
router.get('/bases', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as JwtPayload).id;

    const bases = await prisma.knowledgeBase.findMany({
      where: { userId },
      include: { documents: true },
    });

    res.json({ success: true, bases });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Upload document to knowledge base
router.post('/bases/:baseId/documents', authenticate, async (req: Request, res: Response) => {
  try {
    const { baseId } = req.params;
    const { fileName, fileUrl, fileSize, fileType, textContent } = req.body;
    const userId = (req.user as JwtPayload).id;

    // Verify ownership
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: baseId },
    });

    if (!kb || kb.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // TODO: Generate embeddings using OpenAI API
    // const embedding = await generateEmbedding(textContent);

    const doc = await prisma.knowledgeBaseDocument.create({
      data: {
        knowledgeBaseId: baseId,
        fileName,
        fileUrl,
        fileSize,
        fileType,
        textContent,
        // embedding: JSON.stringify(embedding),
      },
    });

    res.json({ success: true, document: doc });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Search knowledge base
router.post('/bases/:baseId/search', authenticate, async (req: Request, res: Response) => {
  try {
    const { baseId } = req.params;
    const { query, limit = 5 } = req.body;
    const userId = (req.user as JwtPayload).id;

    // Verify ownership
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: baseId },
    });

    if (!kb || kb.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // TODO: Full-text search or semantic search
    // For now, simple text search
    const results = await prisma.knowledgeBaseDocument.findMany({
      where: {
        knowledgeBaseId: baseId,
        textContent: { search: query },
      },
      take: limit,
    });

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete document
router.delete('/bases/:baseId/documents/:docId', authenticate, async (req: Request, res: Response) => {
  try {
    const { baseId, docId } = req.params;
    const userId = (req.user as JwtPayload).id;

    // Verify ownership via KB
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: baseId },
    });

    if (!kb || kb.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    await prisma.knowledgeBaseDocument.delete({
      where: { id: docId },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
