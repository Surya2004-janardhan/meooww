/**
 * EXAMPLE: How to integrate AI config validation into agent routes
 * 
 * This file shows example implementations of how to use the configuration
 * validation middleware and services in actual agent execution routes.
 * 
 * Copy the patterns from this file into your actual routes.
 */

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateAgentConfigs, getAgentMissingConfigs } from '../middleware/validateConfigs';
import { cryptoService } from '../lib/crypto';

const router = Router();

/**
 * PATTERN 1: Using the validation middleware
 * 
 * This middleware automatically checks if the agent has all required configs
 * and returns 409 Conflict if any are missing.
 */
router.post(
  '/:agentId/run',
  authenticate,
  validateAgentConfigs, // Middleware validates automatically
  async (req: AuthRequest, res: Response) => {
    try {
      const { agentId } = req.params;
      const { prompt } = req.body;

      // If we reach here, all required configs are satisfied
      // Get the user's configs to pass to the LLM call
      const userConfigs = await prisma.userAIConfig.findMany({
        where: {
          userId: req.user!.sub,
          isActive: true,
        },
      });

      // Example: Get OpenAI config if the agent needs it
      const openaiConfig = userConfigs.find(c => c.provider === 'openai');
      let openaiKey: string | null = null;

      if (openaiConfig) {
        openaiKey = cryptoService.decrypt(openaiConfig.encryptedKey);
      }

      // Execute agent with the API key
      // ... rest of implementation
      
      res.json({ message: 'Agent started successfully' });
    } catch (error) {
      console.error('Error running agent:', error);
      res.status(500).json({ error: 'Failed to run agent' });
    }
  }
);

/**
 * PATTERN 2: Manual validation for more control
 * 
 * Use this if you need custom logic or want to handle the missing configs
 * differently than the middleware provides.
 */
router.post(
  '/:agentId/run-with-custom-handling',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agentId } = req.params;
      const { prompt } = req.body;

      // Get missing configs
      const missingConfigs = await getAgentMissingConfigs(req.user!.sub, agentId);

      // Custom handling based on business logic
      if (missingConfigs.length > 0) {
        // Option A: Return the list of missing configs
        return res.status(409).json({
          error: 'Missing required configurations',
          missingConfigs,
          hint: 'User should visit /settings to configure these providers',
        });

        // Option B: Optionally auto-configure with env vars for local development
        // This allows .env.ai_key=... pattern for testing
        // See alternative implementation below
      }

      // Configs are satisfied, proceed with execution
      res.json({ message: 'Agent started successfully' });
    } catch (error) {
      console.error('Error running agent:', error);
      res.status(500).json({ error: 'Failed to run agent' });
    }
  }
);

/**
 * PATTERN 3: With environment variable fallback for local testing
 * 
 * This pattern allows AI_PROVIDER_API_KEY=... in .env for local development
 * Falls back to database-stored configs if env vars are not set.
 */
router.post(
  '/:agentId/run-with-env-fallback',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { agentId } = req.params;
      const { prompt } = req.params;

      // Get agent config requirements
      const requirements = await prisma.agentConfigRequirement.findMany({
        where: { agentId },
      });

      if (requirements.length === 0) {
        // No requirements, proceed
        return res.json({ message: 'Agent started' });
      }

      const missingConfigs: typeof requirements = [];

      for (const req of requirements) {
        if (req.isOptional) continue;

        // Check for saved config in database
        const dbConfig = await prisma.userAIConfig.findUnique({
          where: {
            userId_provider: {
              userId: req.user!.sub,
              provider: req.provider,
            },
          },
        });

        // Check for env var override (AI_PROVIDER_API_KEY)
        const envKey = `AI_${req.provider.toUpperCase()}_API_KEY`;
        const envValue = process.env[envKey];

        if (!dbConfig && !envValue) {
          missingConfigs.push(req);
        }
      }

      if (missingConfigs.length > 0) {
        return res.status(409).json({
          error: 'Missing required configurations',
          missingConfigs: missingConfigs.map(r => ({
            provider: r.provider,
            requiredKeys: r.requiredKeys,
            description: r.description,
          })),
        });
      }

      // Proceed with execution
      // Build config object from db or env vars
      const configs: Record<string, string> = {};

      for (const req of requirements) {
        const envKey = `AI_${req.provider.toUpperCase()}_API_KEY`;
        const envValue = process.env[envKey];

        if (envValue) {
          configs[req.provider] = envValue;
        } else {
          const dbConfig = await prisma.userAIConfig.findUnique({
            where: {
              userId_provider: {
                userId: req.user!.sub,
                provider: req.provider,
              },
            },
          });
          if (dbConfig) {
            configs[req.provider] = cryptoService.decrypt(dbConfig.encryptedKey);
          }
        }
      }

      // Use configs to call LLMs
      // configs['openai'] = "sk-..."
      // configs['anthropic'] = "sk-ant-..."
      // etc.

      res.json({ message: 'Agent started with configs' });
    } catch (error) {
      console.error('Error running agent:', error);
      res.status(500).json({ error: 'Failed to run agent' });
    }
  }
);

/**
 * PATTERN 4: Bulk config validation for workflows
 * 
 * For workflows with multiple steps, validate all required configs upfront
 */
router.post(
  '/workflows/:workflowId/validate-configs',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { workflowId } = req.params;

      // Get all agents in the workflow
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          steps: {
            include: {
              agent: true,
            },
          },
        },
      });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Collect all required configs across all steps
      const allMissingConfigs: Record<string, typeof requirements[0]> = {};

      for (const step of workflow.steps) {
        const missingConfigs = await getAgentMissingConfigs(
          req.user!.sub,
          step.agentId
        );

        for (const config of missingConfigs) {
          const key = `${config.provider}`;
          if (!allMissingConfigs[key]) {
            allMissingConfigs[key] = config;
          }
        }
      }

      if (Object.keys(allMissingConfigs).length > 0) {
        return res.status(409).json({
          error: 'Workflow requires configuration',
          missingConfigs: Object.values(allMissingConfigs),
          workflowName: workflow.name,
        });
      }

      res.json({ message: 'All configurations satisfied' });
    } catch (error) {
      console.error('Error validating workflow configs:', error);
      res.status(500).json({ error: 'Failed to validate configurations' });
    }
  }
);

/**
 * Helper function to get decrypted API key safely
 */
export async function getProviderApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  // Try environment variable first (local development)
  const envKey = `AI_${provider.toUpperCase()}_API_KEY`;
  const envValue = process.env[envKey];
  if (envValue) {
    return envValue;
  }

  // Fall back to database
  const config = await prisma.userAIConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: provider.toLowerCase(),
      },
    },
  });

  if (!config) {
    return null;
  }

  return cryptoService.decrypt(config.encryptedKey);
}

/**
 * Helper function to get multiple provider API keys
 */
export async function getProviderApiKeys(
  userId: string,
  providers: string[]
): Promise<Record<string, string>> {
  const keys: Record<string, string> = {};

  for (const provider of providers) {
    const key = await getProviderApiKey(userId, provider);
    if (key) {
      keys[provider] = key;
    }
  }

  return keys;
}

export default router;
