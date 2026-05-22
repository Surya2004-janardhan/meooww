# Quick Start: AI Configuration Management

This guide will help you get the AI Configuration Management feature up and running in 5 minutes.

## Overview

The AI Configuration Management system allows users to:
- 🔐 Securely save API keys for multiple LLM providers
- 🔑 Use them across all agents and workflows
- ⚙️ Get prompts when agent requires specific configuration
- 🧪 Test configurations before use

## Checklist

Follow these steps in order:

### ✅ Step 1: Update Database Schema (5 min)

```bash
cd backend/node-api
npx prisma migrate dev --name add_user_ai_config_management
```

This creates two new tables:
- `user_ai_configs` - Stores encrypted API keys
- `agent_config_requirements` - Defines agent requirements

### ✅ Step 2: Configure Environment (1 min)

Add to your `.env` file:

```bash
# Optional: Encryption master key
# If not set, uses JWT_SECRET
ENCRYPTION_MASTER_KEY=your-encryption-key-here
```

For local development, you can also use environment variables for testing:

```bash
# These can be used instead of saving in database
AI_OPENAI_API_KEY=sk-...
AI_ANTHROPIC_API_KEY=sk-ant-...
```

### ✅ Step 3: Start Services

```bash
# Restart your services to load the updated code
docker compose down
docker compose up --build

# Or for local development
npm run dev  # in appropriate directories
```

### ✅ Step 4: Test the Feature

1. **Access Settings Page**
   - Open http://localhost:3000/settings
   - You should see AI provider cards

2. **Add a Configuration**
   - Click "Configure" on any provider (e.g., OpenAI)
   - Paste an API key (get from https://platform.openai.com/api-keys)
   - Click "Save"

3. **Test the Configuration**
   - Click "🧪 Test" button
   - Should show "✓ Valid" if key is correct

4. **Try Launching an Agent**
   - Go to http://localhost:3000/agents
   - Click "Launch Agent"
   - Should work without prompting for config
   - Or if agent needs different config, modal should appear

## What's New

### Frontend Changes
- **Settings Page** (`/settings`) - Manage AI configurations
- **Missing Config Modal** - Prompts when agent needs config
- **Enhanced Agents Page** - Checks configs before launching

### Backend Changes
- **New API Endpoints** - `/api/user/ai-config/*`
- **Encryption Service** - Stores keys safely
- **Validation Middleware** - Checks agent requirements
- **2 New Database Tables** - Store configs and requirements

### Files Added
- `backend/node-api/src/lib/crypto.ts` - Encryption utilities
- `backend/node-api/src/routes/user-ai-config.ts` - API routes
- `backend/node-api/src/middleware/validateConfigs.ts` - Validation
- `frontend/src/lib/userAIConfigClient.ts` - API client
- `frontend/src/app/settings/page.tsx` - Settings UI
- `frontend/src/components/MissingConfigModal.tsx` - Modal UI
- `frontend/src/lib/useAuth.ts` - Auth hook

## Common Tasks

### Add Configuration Requirement to Agent

Specify what configs an agent needs:

```typescript
import { prisma } from '@/lib/prisma';

// After creating an agent
await prisma.agentConfigRequirement.create({
  data: {
    agentId: 'your-agent-id',
    provider: 'openai',
    requiredKeys: ['api_key'],
    description: 'OpenAI API key for GPT models',
    isOptional: false,
  },
});
```

### Use Saved Configuration in Agent

Get decrypted key when running agent:

```typescript
import { prisma } from '@/lib/prisma';
import { cryptoService } from '@/lib/crypto';

const config = await prisma.userAIConfig.findUnique({
  where: {
    userId_provider: {
      userId: userId,
      provider: 'openai',
    },
  },
});

if (!config) {
  throw new Error('Configuration not found');
}

const apiKey = cryptoService.decrypt(config.encryptedKey);
// Use apiKey to call OpenAI API
```

### Validate Agent Configuration

Check if agent has required configs:

```typescript
import { getAgentMissingConfigs } from '@/middleware/validateConfigs';

const missing = await getAgentMissingConfigs(userId, agentId);

if (missing.length > 0) {
  return res.status(409).json({
    error: 'Missing configurations',
    missingConfigs: missing,
  });
}
```

## Next Steps

1. **Define Agent Requirements**
   - Add `AgentConfigRequirement` entries for each agent
   - Specify which providers each agent needs

2. **Integrate with Agent Execution**
   - Use validation middleware in agent routes
   - Use helper functions to get decrypted keys

3. **Test End-to-End**
   - Add API keys in settings
   - Launch agents with different configs
   - Verify modal appears for missing configs

4. **Deploy to Production**
   - Set strong `ENCRYPTION_MASTER_KEY` in `.env`
   - Run migration on production database
   - Deploy updated code
   - Monitor for any encryption errors

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Settings page not loading | Check `/settings` route is created and frontend rebuilt |
| "Cannot find module" error | Run `npm install` in backend/node-api and frontend |
| Encryption errors | Verify `ENCRYPTION_MASTER_KEY` or `JWT_SECRET` is set |
| Migration fails | Check PostgreSQL is running and `DATABASE_URL` is correct |
| Modal not showing | Verify agents route includes missing config check |

## Useful Links

- 📖 [Complete Implementation Guide](./AI_CONFIG_IMPLEMENTATION.md)
- 👤 [User Guide](./USER_GUIDE_AI_CONFIG.md)
- 💾 [Migration Guide](./MIGRATION_GUIDE.md)
- 📚 [Integration Examples](./INTEGRATION_EXAMPLES.md)
- 🎯 [Main README](./README.md)

## API Quick Reference

```bash
# Save configuration
curl -X POST http://localhost/api/user/ai-config \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"provider":"openai","apiKey":"sk-..."}'

# Get all configurations
curl http://localhost/api/user/ai-config \
  -H "Authorization: Bearer $TOKEN"

# Test configuration
curl -X POST http://localhost/api/user/ai-config/openai/test \
  -H "Authorization: Bearer $TOKEN"

# Get provider requirements
curl http://localhost/api/user/ai-config/openai/required-fields \
  -H "Authorization: Bearer $TOKEN"

# Delete configuration
curl -X DELETE http://localhost/api/user/ai-config/openai \
  -H "Authorization: Bearer $TOKEN"
```

## Getting Help

1. Check the troubleshooting section above
2. Review the detailed guides mentioned in "Useful Links"
3. Check browser console for error messages
4. Check backend logs for server errors

---

**Ready to go?** Start with Step 1 above! 🚀
