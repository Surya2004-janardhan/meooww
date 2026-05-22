import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from './auth';

/**
 * Middleware to validate that required AI configurations are set before executing an agent
 * Checks:
 * 1. Agent's config requirements
 * 2. User's saved configs
 * Returns 409 Conflict with list of missing configs if validation fails
 */
export async function validateAgentConfigs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { agentId } = req.params;

    if (!agentId) {
      return next(); // No agentId, skip validation
    }

    // Check if agent has config requirements defined
    const requirements = await prisma.agentConfigRequirement.findMany({
      where: { agentId },
    });

    if (requirements.length === 0) {
      // No requirements defined, allow execution
      return next();
    }

    // Get user's saved AI configs
    const userConfigs = await prisma.userAIConfig.findMany({
      where: {
        userId: req.user!.sub,
        isActive: true,
      },
    });

    const userConfigProviders = userConfigs.map(c => c.provider.toLowerCase());

    // Check if all required providers are configured
    const missingConfigs: Array<{
      provider: string;
      requiredKeys: string[];
      description?: string;
    }> = [];

    for (const req of requirements) {
      if (!req.isOptional && !userConfigProviders.includes(req.provider.toLowerCase())) {
        missingConfigs.push({
          provider: req.provider,
          requiredKeys: req.requiredKeys,
          description: req.description || undefined,
        });
      }
    }

    if (missingConfigs.length > 0) {
      // Store missing configs in request for response handler to use
      (req as any).missingConfigs = missingConfigs;
      return res.status(409).json({
        error: 'Missing required AI configuration',
        missingConfigs,
        configUrl: '/settings/ai-config',
      });
    }

    next();
  } catch (error) {
    console.error('Error validating agent configs:', error);
    next(); // Don't block execution if validation fails unexpectedly
  }
}

/**
 * Helper function to get missing configs for an agent
 */
export async function getAgentMissingConfigs(
  userId: string,
  agentId: string
): Promise<Array<{ provider: string; requiredKeys: string[]; description?: string }>> {
  const requirements = await prisma.agentConfigRequirement.findMany({
    where: { agentId },
  });

  if (requirements.length === 0) {
    return [];
  }

  const userConfigs = await prisma.userAIConfig.findMany({
    where: {
      userId,
      isActive: true,
    },
  });

  const userConfigProviders = userConfigs.map(c => c.provider.toLowerCase());

  const missingConfigs: Array<{
    provider: string;
    requiredKeys: string[];
    description?: string;
  }> = [];

  for (const req of requirements) {
    if (!req.isOptional && !userConfigProviders.includes(req.provider.toLowerCase())) {
      missingConfigs.push({
        provider: req.provider,
        requiredKeys: req.requiredKeys,
        description: req.description || undefined,
      });
    }
  }

  return missingConfigs;
}
