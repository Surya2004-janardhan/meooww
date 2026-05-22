# Database Migration Guide: AI Configuration Management

This document explains how to apply the database schema changes for the AI Configuration Management feature.

## Prerequisites

- Node.js 18+ installed
- Access to the `backend/node-api` directory
- Database credentials configured in `.env`

## Quick Start

### For Development

```bash
cd backend/node-api

# Generate and apply migration
npx prisma migrate dev --name add_user_ai_config_management
```

This will:
1. Create a new migration file with the schema changes
2. Apply it to your local database
3. Regenerate Prisma client

### For Production

```bash
cd backend/node-api

# Apply existing migrations (don't generate new ones)
npx prisma migrate deploy
```

## What Gets Created

The migration creates two new tables:

### 1. `user_ai_configs` Table

Stores encrypted API keys for each user per provider.

```sql
CREATE TABLE user_ai_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR NOT NULL,
  encryptedKey TEXT NOT NULL,
  metadata JSONB,
  isActive BOOLEAN DEFAULT true,
  testStatus VARCHAR DEFAULT 'untested',
  lastTestedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now(),
  UNIQUE(userId, provider)
);
```

### 2. `agent_config_requirements` Table

Defines what configuration each agent needs.

```sql
CREATE TABLE agent_config_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agentId UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  provider VARCHAR NOT NULL,
  requiredKeys TEXT[] NOT NULL,
  description VARCHAR,
  isOptional BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT now(),
  UNIQUE(agentId, provider)
);
```

### 3. Foreign Key Relationships

- `user_ai_configs.userId` → `users.id`
- `agent_config_requirements.agentId` → `agents.id`

## Detailed Steps

### Step 1: Update Environment Variables

Add to `.env`:

```bash
# Optional: Set a dedicated encryption master key
# If not set, will use JWT_SECRET
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_MASTER_KEY=your-encryption-master-key-here-hex-encoded
```

### Step 2: Run Migration

For development:

```bash
cd backend/node-api
npx prisma migrate dev --name add_user_ai_config_management
```

For production (if migration already exists):

```bash
cd backend/node-api
npx prisma migrate deploy
```

### Step 3: Verify Migration

Check that tables were created:

```bash
# Using Prisma Studio
npx prisma studio

# Or query directly (if using PostgreSQL CLI)
psql -U $DB_USER -d $DB_NAME -c "\dt user_ai_configs agent_config_requirements"
```

### Step 4: Seed Initial Data (Optional)

Create agent configuration requirements for your agents:

```bash
# Create a seed file
cat > prisma/seed.ts << 'EOF'
import { prisma } from '../src/lib/prisma';

async function main() {
  // Define requirements for agents that need specific providers
  
  // Example: Gmail Triage agent requires Google API
  // await prisma.agentConfigRequirement.create({
  //   data: {
  //     agentId: 'your-agent-id',
  //     provider: 'google',
  //     requiredKeys: ['api_key'],
  //     description: 'Google API key for Gmail access',
  //   },
  // });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF

# Run seed
npx prisma db seed
```

## Rollback

If you need to rollback the migration:

### Development

```bash
cd backend/node-api

# List all migrations
npx prisma migrate status

# Rollback to previous state
npx prisma migrate resolve --rolled-back add_user_ai_config_management
```

### Production

For production systems, use `prisma migrate resolve` carefully:

```bash
cd backend/node-api

# Verify what you're rolling back
npx prisma migrate status

# Mark migration as rolled back (doesn't actually modify DB, just metadata)
npx prisma migrate resolve --rolled-back add_user_ai_config_management

# Manually run the down migration if needed:
# psql -U $DB_USER -d $DB_NAME < migration_down.sql
```

**Important:** Always backup your database before rolling back in production.

## Troubleshooting

### Issue: "Migration lockfile is locked"

**Cause**: Another migration is in progress

**Solution**:
```bash
# Release the lock
npx prisma migrate resolve --rolled-back <migration-name>

# Or wait for the other process to complete
```

### Issue: "Relation 'users' does not exist"

**Cause**: Base schema not created, or running in wrong database

**Solution**:
1. Ensure you've already run all previous migrations: `npx prisma migrate deploy`
2. Verify DATABASE_URL points to correct database
3. Run: `npx prisma migrate reset` (warning: deletes all data!)

### Issue: "Column 'encryptedKey' does not exist"

**Cause**: Migration didn't apply fully

**Solution**:
```bash
# Check migration status
npx prisma migrate status

# List created tables
npx prisma db push --skip-generate

# Or reset and reapply
npx prisma migrate reset
```

### Issue: Encryption key mismatch errors after migration

**Cause**: ENCRYPTION_MASTER_KEY was changed

**Solution**:
- If you changed the key, old encrypted records cannot be decrypted
- Users will need to re-enter their API keys
- Optionally, force users to update configs: Mark all keys as `testStatus = 'invalid'`

```sql
UPDATE user_ai_configs SET testStatus = 'invalid' WHERE testStatus = 'valid';
```

## Docker Compose

If using Docker Compose, migrations are applied automatically on startup:

```yaml
services:
  node-api:
    build: ./backend/node-api
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - ENCRYPTION_MASTER_KEY=${ENCRYPTION_MASTER_KEY}
    # Migration runs as part of startup
    command: npm start
```

To manually run migrations in Docker:

```bash
docker-compose exec node-api npx prisma migrate deploy
```

## Verifying the Migration

### Check Tables Exist

```bash
# Via Prisma Studio
npx prisma studio

# Via PostgreSQL
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

### Check Columns

```bash
psql $DATABASE_URL -c "\d user_ai_configs"
psql $DATABASE_URL -c "\d agent_config_requirements"
```

### Test with Sample Data

```typescript
// In Node.js REPL or test script
import { prisma } from './backend/node-api/src/lib/prisma';
import { cryptoService } from './backend/node-api/src/lib/crypto';

// Create a sample config
const config = await prisma.userAIConfig.create({
  data: {
    userId: 'test-user-id',
    provider: 'openai',
    encryptedKey: cryptoService.encrypt('sk-test-key-123'),
  },
});

console.log('Config created:', config.id);

// Retrieve and decrypt
const retrieved = await prisma.userAIConfig.findUnique({
  where: { id: config.id },
});

const decrypted = cryptoService.decrypt(retrieved.encryptedKey);
console.log('Decrypted key matches:', decrypted === 'sk-test-key-123');

// Cleanup
await prisma.userAIConfig.delete({ where: { id: config.id } });
```

## Performance Considerations

- Add indexes on frequently queried fields (already done in schema):
  - `(userId, provider)` - unique constraint adds performance
  - Consider adding index on `userId` if querying user's all configs frequently

- Encryption/decryption adds ~5-10ms per operation
  - Consider caching decrypted keys in memory with TTL if needed

## Security Checklist

- [ ] Set `ENCRYPTION_MASTER_KEY` to a strong, unique value in production
- [ ] Backup database before migration
- [ ] Test migration in staging environment first
- [ ] Ensure HTTPS is enabled for all API endpoints
- [ ] Monitor for failed decryption attempts (indicates key mismatch or tampering)
- [ ] Rotate encryption master key periodically (requires re-encrypting all keys)

## Next Steps After Migration

1. **Register API endpoints** - The migration is complete, but routes need to be mounted
2. **Test the UI** - Visit `/settings` to test the configuration page
3. **Define agent requirements** - Use `agent_config_requirements` to specify what each agent needs
4. **Test agent validation** - Try launching agents with/without configurations
5. **Deploy to production** - Follow production deployment guide

## References

- [Prisma Migration Documentation](https://www.prisma.io/docs/guides/migrations/overview)
- [AI Configuration Implementation Guide](./AI_CONFIG_IMPLEMENTATION.md)
- [User Guide: AI Configuration](./USER_GUIDE_AI_CONFIG.md)
