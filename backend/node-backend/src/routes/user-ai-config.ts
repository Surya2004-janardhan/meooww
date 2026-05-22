import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cryptoService } from '../lib/crypto';
import { z } from 'zod';

const router = Router();

// Validation schemas
const SaveConfigSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
  metadata: z.any().optional(),
});

const TestConfigSchema = z.object({
  provider: z.string().min(1),
});

/**
 * GET /api/user/ai-config
 * List all saved AI configurations for the current user (without exposing keys)
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const configs = await prisma.userAIConfig.findMany({
      where: { userId: req.user!.sub },
      select: {
        id: true,
        provider: true,
        isActive: true,
        testStatus: true,
        lastTestedAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        // Never select encryptedKey
      },
    });

    res.json({
      configs: configs.map(config => ({
        ...config,
        hasKey: true, // Indicate that key exists but don't expose it
      })),
    });
  } catch (error) {
    console.error('Error fetching AI configs:', error);
    res.status(500).json({ error: 'Failed to fetch configurations' });
  }
});

/**
 * POST /api/user/ai-config
 * Save or update an AI provider configuration
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { provider, apiKey, metadata } = SaveConfigSchema.parse(req.body);

    const encryptedKey = cryptoService.encrypt(apiKey);

    const config = await prisma.userAIConfig.upsert({
      where: {
        userId_provider: {
          userId: req.user!.sub,
          provider: provider.toLowerCase(),
        },
      },
      update: {
        encryptedKey,
        metadata,
        updatedAt: new Date(),
      },
      create: {
        userId: req.user!.sub,
        provider: provider.toLowerCase(),
        encryptedKey,
        metadata,
      },
      select: {
        id: true,
        provider: true,
        isActive: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      message: `${provider} configuration saved successfully`,
      config,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body', details: error.errors });
    }
    console.error('Error saving AI config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

/**
 * DELETE /api/user/ai-config/:provider
 * Delete an AI provider configuration
 */
router.delete('/:provider', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.params;

    await prisma.userAIConfig.deleteMany({
      where: {
        userId: req.user!.sub,
        provider: provider.toLowerCase(),
      },
    });

    res.json({ message: `${provider} configuration deleted successfully` });
  } catch (error) {
    console.error('Error deleting AI config:', error);
    res.status(500).json({ error: 'Failed to delete configuration' });
  }
});

/**
 * GET /api/user/ai-config/:provider/required-fields
 * Get required fields for a provider
 */
router.get('/:provider/required-fields', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.params;

    // Define required fields per provider
    const providerRequirements: Record<string, {
      fields: string[];
      documentation: string;
      description: string;
    }> = {
      openai: {
        fields: ['api_key'],
        documentation: 'https://platform.openai.com/api-keys',
        description: 'OpenAI API Key for GPT models',
      },
      anthropic: {
        fields: ['api_key'],
        documentation: 'https://console.anthropic.com',
        description: 'Anthropic API Key for Claude models',
      },
      google: {
        fields: ['api_key'],
        documentation: 'https://makersuite.google.com/app/apikey',
        description: 'Google API Key for Gemini models',
      },
      mistral: {
        fields: ['api_key'],
        documentation: 'https://console.mistral.ai',
        description: 'Mistral API Key',
      },
      cohere: {
        fields: ['api_key'],
        documentation: 'https://dashboard.cohere.com',
        description: 'Cohere API Key',
      },
      groq: {
        fields: ['api_key'],
        documentation: 'https://console.groq.com',
        description: 'Groq API Key for fast LLM inference',
      },
      together: {
        fields: ['api_key'],
        documentation: 'https://api.together.xyz',
        description: 'Together AI API Key',
      },
      azure: {
        fields: ['api_key', 'endpoint', 'deployment_id'],
        documentation: 'https://portal.azure.com',
        description: 'Azure OpenAI credentials',
      },
      openrouter: {
        fields: ['api_key'],
        documentation: 'https://openrouter.ai',
        description: 'OpenRouter API Key for multi-model access',
      },
    };

    const requirements = providerRequirements[provider.toLowerCase()];

    if (!requirements) {
      return res.status(404).json({ error: 'Unknown provider' });
    }

    res.json({
      provider: provider.toLowerCase(),
      ...requirements,
    });
  } catch (error) {
    console.error('Error fetching provider requirements:', error);
    res.status(500).json({ error: 'Failed to fetch provider requirements' });
  }
});

/**
 * POST /api/user/ai-config/:provider/test
 * Test if the stored configuration is valid by making a test API call
 */
router.post('/:provider/test', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.params;

    const config = await prisma.userAIConfig.findUnique({
      where: {
        userId_provider: {
          userId: req.user!.sub,
          provider: provider.toLowerCase(),
        },
      },
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    try {
      const decryptedKey = cryptoService.decrypt(config.encryptedKey);

      // Test the API key by making a simple request to the provider
      const testResult = await testProviderConnection(provider.toLowerCase(), decryptedKey);

      // Update test status
      await prisma.userAIConfig.update({
        where: { id: config.id },
        data: {
          testStatus: testResult.success ? 'valid' : 'invalid',
          lastTestedAt: new Date(),
        },
      });

      res.json({
        provider: provider.toLowerCase(),
        status: testResult.success ? 'valid' : 'invalid',
        message: testResult.message,
      });
    } catch (error) {
      // Update test status as invalid
      await prisma.userAIConfig.update({
        where: { id: config.id },
        data: {
          testStatus: 'invalid',
          lastTestedAt: new Date(),
        },
      });

      res.status(400).json({
        provider: provider.toLowerCase(),
        status: 'invalid',
        message: 'Failed to verify configuration: ' + (error instanceof Error ? error.message : 'Unknown error'),
      });
    }
  } catch (error) {
    console.error('Error testing AI config:', error);
    res.status(500).json({ error: 'Failed to test configuration' });
  }
});

/**
 * Test provider connection by making a minimal API call
 */
async function testProviderConnection(provider: string, apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    switch (provider.toLowerCase()) {
      case 'openai':
        return await testOpenAI(apiKey);
      case 'anthropic':
        return await testAnthropic(apiKey);
      case 'google':
        return await testGoogle(apiKey);
      default:
        return { success: true, message: 'Provider test not implemented, assuming valid' };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function testOpenAI(apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  return { success: true, message: 'OpenAI API key is valid' };
}

async function testAnthropic(apiKey: string) {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
  }

  return { success: true, message: 'Anthropic API key is valid' };
}

async function testGoogle(apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${response.statusText}`);
  }

  return { success: true, message: 'Google API key is valid' };
}

export default router;
