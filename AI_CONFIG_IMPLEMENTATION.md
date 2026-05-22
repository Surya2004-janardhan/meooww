# AI Configuration Management Implementation Guide

This document describes the implementation of user AI configuration management, allowing users to securely store and manage API keys for different LLM providers.

## Overview

### What It Does

- Users can save API keys for multiple AI providers (OpenAI, Anthropic, Google, etc.)
- API keys are encrypted at rest using AES-256-GCM encryption
- Agents can have configuration requirements defined, and users are prompted to set them before running
- Configuration validation happens before agent execution
- Support for local development with `.env.ai_key` pattern

### Key Features

1. **Secure Storage**: API keys encrypted with AES-256-GCM
2. **User Profile Settings**: `/settings` page to manage configurations
3. **Provider Support**: 9+ LLM providers (OpenAI, Anthropic, Google, Mistral, Cohere, Groq, Together, Azure, OpenRouter)
4. **Configuration Validation**: Agents check required configs before execution
5. **Connection Testing**: Test if saved API keys are valid
6. **Missing Config Modal**: User-friendly prompts when required configs are missing

## Database Schema

### New Models

#### `UserAIConfig`
Stores encrypted API keys and configurations for each user per provider.

```prisma
model UserAIConfig {
  id            String   @id @default(uuid())
  userId        String
  provider      String   // e.g., "openai", "anthropic"
  encryptedKey  String   @db.Text
  metadata      Json?
  isActive      Boolean  @default(true)
  testStatus    String   @default("untested")
  lastTestedAt  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, provider])
}
```

#### `AgentConfigRequirement`
Defines what configuration an agent needs to run.

```prisma
model AgentConfigRequirement {
  id            String   @id @default(uuid())
  agentId       String
  provider      String   // "openai", "anthropic", etc.
  requiredKeys  String[] // ["api_key"], ["api_key", "endpoint"]
  description   String?
  isOptional    Boolean  @default(false)
  createdAt     DateTime @default(now())

  agent Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)
  @@unique([agentId, provider])
}
```

## Backend Implementation

### 1. Encryption Service (`src/lib/crypto.ts`)

Provides encryption/decryption utilities using AES-256-GCM:

```typescript
import { cryptoService } from '@/lib/crypto';

// Encrypt API key
const encrypted = cryptoService.encrypt(apiKey);

// Decrypt API key
const decrypted = cryptoService.decrypt(encrypted);

// Hash value
const hash = cryptoService.hash(value);

// Generate token
const token = cryptoService.generateToken(32);
```

**Configuration:**
- Uses `ENCRYPTION_MASTER_KEY` from environment if provided
- Falls back to deriving from `JWT_SECRET`
- Algorithm: AES-256-GCM with random IV and authentication tag

### 2. API Endpoints (`src/routes/user-ai-config.ts`)

#### `GET /api/user/ai-config`
List all saved configurations (without exposing keys).

**Response:**
```json
{
  "configs": [
    {
      "id": "uuid",
      "provider": "openai",
      "isActive": true,
      "testStatus": "valid",
      "lastTestedAt": "2026-05-22T...",
      "metadata": {...},
      "hasKey": true,
      "createdAt": "2026-05-22T...",
      "updatedAt": "2026-05-22T..."
    }
  ]
}
```

#### `POST /api/user/ai-config`
Save or update a configuration.

**Request:**
```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "metadata": {
    "model_preference": "gpt-4"
  }
}
```

#### `DELETE /api/user/ai-config/:provider`
Remove a configuration.

#### `GET /api/user/ai-config/:provider/required-fields`
Get provider requirements and documentation.

#### `POST /api/user/ai-config/:provider/test`
Test if the saved configuration is valid by making a test API call.

### 3. Validation Middleware (`src/middleware/validateConfigs.ts`)

Middleware to check if an agent has all required configurations:

```typescript
import { validateAgentConfigs, getAgentMissingConfigs } from '@/middleware/validateConfigs';

// Use in routes
router.post('/:agentId/run', authenticate, validateAgentConfigs, async (req, res) => {
  // If validation fails, returns 409 with missing configs
  // Otherwise, execution continues
});

// Or get missing configs programmatically
const missingConfigs = await getAgentMissingConfigs(userId, agentId);
```

**Response (409 Conflict):**
```json
{
  "error": "Missing required AI configuration",
  "missingConfigs": [
    {
      "provider": "openai",
      "requiredKeys": ["api_key"],
      "description": "OpenAI API key is required"
    }
  ],
  "configUrl": "/settings/ai-config"
}
```

## Frontend Implementation

### 1. API Client (`src/lib/userAIConfigClient.ts`)

```typescript
import { userAIConfigClient } from '@/lib/userAIConfigClient';

// Get all configs
const { configs } = await userAIConfigClient.listConfigs(token);

// Save config
await userAIConfigClient.saveConfig(token, 'openai', 'sk-...', { model_preference: 'gpt-4' });

// Delete config
await userAIConfigClient.deleteConfig(token, 'openai');

// Get provider requirements
const reqs = await userAIConfigClient.getProviderRequirements(token, 'openai');

// Test configuration
const result = await userAIConfigClient.testConfig(token, 'openai');
```

### 2. Settings Page (`src/app/settings/page.tsx`)

User interface for managing AI configurations:

- Display all supported providers (OpenAI, Anthropic, Google, etc.)
- Show current status (valid, invalid, untested, not configured)
- Add/update/delete configurations
- Test configurations
- Security information and best practices

### 3. Missing Config Modal (`src/components/MissingConfigModal.tsx`)

Modal that appears when user tries to run an agent without required configs:

- Shows list of missing configurations
- Provides link to provider documentation
- One-click navigation to settings page

### 4. Agent Launch Integration

Updated agents page to:
1. Check for missing configs before launching
2. Show modal if configs are missing
3. Allow user to go to settings or cancel
4. Proceed with launch if all configs are satisfied

## Environment Variables

Add to `.env`:

```bash
# Optional: Master key for encrypting sensitive data
# If not set, derives from JWT_SECRET
ENCRYPTION_MASTER_KEY=your-encryption-master-key-hex-string

# For local development, you can use .env.ai_key pattern:
AI_OPENAI_API_KEY=sk-...
AI_ANTHROPIC_API_KEY=sk-ant-...
AI_GOOGLE_API_KEY=...
```

## Database Migration

### Step 1: Create Migration

```bash
cd backend/node-api
npx prisma migrate dev --name add_user_ai_config_management
```

This creates:
- `user_ai_configs` table
- `agent_config_requirements` table
- Relations from `users` and `agents`

### Step 2: Apply to Production

```bash
npx prisma migrate deploy
```

### Step 3: Seed Initial Data (Optional)

```typescript
// prisma/seed.ts
import { prisma } from '@prisma/client';

async function main() {
  // Define config requirements for agents that need specific providers
  // Example: Gmail Triage agent requires Google API
  await prisma.agentConfigRequirement.create({
    data: {
      agentId: 'gmail-triage-agent-id',
      provider: 'google',
      requiredKeys: ['api_key'],
      description: 'Google API key for Gmail access',
    },
  });
}

main().catch(console.error);
```

Run with: `npx prisma db seed`

## Security Considerations

1. **Encryption**: AES-256-GCM with random IVs
2. **Never Log Keys**: API keys are never logged in full
3. **No Frontend Exposure**: Keys never transmitted to frontend
4. **HTTPS Only**: Always use HTTPS in production
5. **Access Control**: Only user can access their own configs
6. **Audit Trail**: Log configuration changes via AuditLog model

## API Test Examples

### Save OpenAI Configuration

```bash
curl -X POST http://localhost/api/user/ai-config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-...",
    "metadata": {
      "model_preference": "gpt-4"
    }
  }'
```

### Get Configurations

```bash
curl http://localhost/api/user/ai-config \
  -H "Authorization: Bearer $TOKEN"
```

### Test Configuration

```bash
curl -X POST http://localhost/api/user/ai-config/openai/test \
  -H "Authorization: Bearer $TOKEN"
```

### Delete Configuration

```bash
curl -X DELETE http://localhost/api/user/ai-config/openai \
  -H "Authorization: Bearer $TOKEN"
```

### Get Provider Requirements

```bash
curl http://localhost/api/user/ai-config/openai/required-fields \
  -H "Authorization: Bearer $TOKEN"
```

## Local Development Setup

### 1. Start Services

```bash
docker compose up --build
```

### 2. Create Test User

```bash
# Use OAuth or manual registration via frontend
```

### 3. Add Configuration via Settings Page

```
http://localhost:3000/settings
```

Or via API:

```bash
curl -X POST http://localhost/api/user/ai-config \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  -d '{"provider":"openai","apiKey":"sk-..."}'
```

### 4. Set Agent Requirements (Manual for now)

```bash
# Via Prisma Studio
npx prisma studio

# Or via API in future
```

### 5. Test Agent Launch

```
http://localhost:3000/agents
# Click "Launch Agent"
# If config is missing, modal should appear
# Click "Go to Settings" to configure
```

## Frontend Features

### Settings Page Walkthrough

1. **Provider Grid**: Shows all 9+ supported providers
2. **Status Indicators**: Valid ✓, Invalid ⚠, Untested, Not Configured
3. **Add/Update Flow**:
   - Click "Configure" or "Update"
   - Enter API key
   - Click "Save"
   - Key is encrypted and stored
4. **Test Validation**:
   - Click "Test" button
   - Makes minimal API call to verify key
   - Shows status
5. **Delete Option**: Revoke access immediately

### Missing Config Modal

- Appears when agent needs config that user hasn't set
- Shows provider name, required keys, documentation link
- Provides one-click navigation to settings
- Educational information about configuration

## Usage Workflow

### For End Users

1. Go to `/settings`
2. Click on an AI provider
3. Enter your API key (get from provider's website)
4. Click "Save"
5. Optionally click "Test" to verify
6. Go back to agents and launch - no more config prompts!

### For Developers

#### Define Agent Requirements

```typescript
// When creating an agent
await prisma.agentConfigRequirement.create({
  data: {
    agentId: agent.id,
    provider: 'openai',
    requiredKeys: ['api_key'],
    description: 'OpenAI API key for GPT models',
    isOptional: false,
  },
});
```

#### Check Before Execution

```typescript
// In agent run handler
const missingConfigs = await getAgentMissingConfigs(userId, agentId);
if (missingConfigs.length > 0) {
  return res.status(409).json({
    error: 'Missing required configurations',
    missingConfigs,
  });
}
// Proceed with execution
```

#### Use Decrypted Key

```typescript
// In agent executor
const config = await prisma.userAIConfig.findUnique({
  where: { userId_provider: { userId, provider: 'openai' } },
});

const apiKey = cryptoService.decrypt(config.encryptedKey);

// Use apiKey to call OpenAI API
```

## Roadmap & Future Enhancements

### Phase 2

- [ ] OAuth setup helper for providers
- [ ] Bulk operations (export, import configs)
- [ ] Rotation warnings (keys older than 90 days)
- [ ] Usage analytics per provider
- [ ] Config versioning and audit trail UI

### Phase 3

- [ ] Secrets management integration (Vault, AWS Secrets Manager)
- [ ] Team configuration sharing
- [ ] Rate limit management per provider
- [ ] Provider-specific configuration options UI
- [ ] Configuration templates

### Phase 4

- [ ] Multi-factor authentication for sensitive operations
- [ ] Configuration expiration policies
- [ ] Cost estimation based on model selection
- [ ] Provider health status dashboard
- [ ] Automatic provider fallback

## Troubleshooting

### Issue: "Failed to save configuration"

**Solution:**
- Check that API key is in correct format for the provider
- Verify database connectivity
- Check encryption master key is set in environment

### Issue: "Test failed" on valid key

**Solution:**
- Verify API key is not rate-limited
- Check provider API status
- Ensure firewall allows outbound HTTPS
- Verify key has required permissions

### Issue: Agent still asks for config after saving

**Solution:**
- Refresh page
- Verify config was saved (check Settings page)
- Ensure AgentConfigRequirement is created for that agent
- Check database directly: `SELECT * FROM agent_config_requirements WHERE agentId = '...'`

### Issue: Encryption errors

**Solution:**
- Check ENCRYPTION_MASTER_KEY is set correctly (32 bytes when hex-decoded)
- If changed, old encrypted keys become unreadable - require users to re-enter
- Check Node version is 15+ (for crypto.scryptSync)

## Testing

### Unit Tests for Crypto Service

```typescript
import { cryptoService } from '@/lib/crypto';

describe('cryptoService', () => {
  it('should encrypt and decrypt', () => {
    const original = 'sk-test-key-123';
    const encrypted = cryptoService.encrypt(original);
    const decrypted = cryptoService.decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should fail on tampered ciphertext', () => {
    const encrypted = cryptoService.encrypt('test');
    const tampered = encrypted.slice(0, -4) + 'xxxx';
    expect(() => cryptoService.decrypt(tampered)).toThrow();
  });
});
```

### Integration Tests

```typescript
describe('User AI Config API', () => {
  it('should save and retrieve configuration', async () => {
    const response = await request(app)
      .post('/api/user/ai-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-test-123' });

    expect(response.status).toBe(200);

    const { configs } = await request(app)
      .get('/api/user/ai-config')
      .set('Authorization', `Bearer ${token}`);

    expect(configs).toHaveLength(1);
    expect(configs[0].provider).toBe('openai');
  });
});
```

## Performance Considerations

1. **Encryption Overhead**: ~5-10ms per encrypt/decrypt operation
2. **Caching**: User configs cached in memory with TTL
3. **Provider Tests**: Async, don't block main request flow
4. **Database Indexes**: Add indexes on (userId, provider) for fast lookups

## Documentation

- User Guide: See `/docs/user-guide/ai-config.md`
- API Reference: See `/docs/api/ai-config.md`
- Security Policy: See `/docs/security/encryption.md`
