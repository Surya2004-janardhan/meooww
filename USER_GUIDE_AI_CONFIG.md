# User Guide: Managing AI Provider Configurations

## Overview

The AI Configuration Management system allows you to securely save API keys for multiple AI providers in one place. Once configured, you can use them across all agents and workflows without re-entering them every time.

## Supported Providers

The platform supports the following AI providers:

- **OpenAI** (GPT-4, GPT-3.5-Turbo, etc.)
- **Anthropic Claude** (Claude 3 Opus, Sonnet, Haiku)
- **Google Gemini** (Gemini Pro, Vision)
- **Mistral AI** (Mistral Large, Medium, Small)
- **Cohere** (Command, Command Light)
- **Groq** (Fast LLM inference)
- **Together AI** (50+ open-source models)
- **Azure OpenAI** (Via Azure Cloud)
- **OpenRouter** (200+ models aggregator)

## Getting Started

### Step 1: Access Settings

1. Log in to the platform
2. Click **Settings** in the main navigation (or go to `/settings`)
3. You'll see a grid of all supported AI providers

### Step 2: Add Your First Configuration

1. Find the AI provider you want to configure (e.g., OpenAI)
2. Click the **"Configure"** button
3. A text area will appear asking for your API key
4. Get your API key from the provider:
   - **OpenAI**: https://platform.openai.com/api-keys
   - **Anthropic**: https://console.anthropic.com
   - **Google**: https://makersuite.google.com/app/apikey
   - **Others**: See links in the settings page
5. Paste your API key into the text area
6. (Optional) Add metadata like model preferences
7. Click **"Save"**

Your API key is now encrypted and stored securely.

### Step 3: Test Your Configuration

After saving, you can test if the configuration works:

1. Click the **"🧪 Test"** button on the provider card
2. The system will make a test API call to verify the key
3. Status will update to:
   - ✓ **Valid** (green) - Key works correctly
   - ⚠ **Invalid** (orange) - Key doesn't work
   - 🧪 **Untested** (gray) - Not yet tested

### Step 4: Use in Agents

Once configured:

1. Go to the **Agents** section
2. Click **"Launch Agent"** on any agent
3. The system will automatically use your saved configuration
4. No need to enter the API key again!

## Managing Configurations

### Update Configuration

1. Go to Settings
2. Find the provider you want to update
3. Click **"Update"**
4. Enter a new API key
5. Click **"Save"**

### Delete Configuration

1. Go to Settings
2. Find the provider you want to delete
3. Click **"Delete"**
4. Confirm the deletion

The configuration is immediately revoked and cannot be used for future agent runs.

### Check Status

Each provider card shows:

- **Status Badge**: Current state (Valid, Invalid, Untested, Not Configured)
- **Last Tested**: When the key was last verified
- **Action Buttons**: Configure, Update, Test, Delete

## Security & Privacy

All your API keys are protected with military-grade encryption:

- ✓ **AES-256-GCM Encryption**: Keys encrypted at rest in the database
- ✓ **Never Logged**: API keys never appear in logs or error messages
- ✓ **No Display**: Keys are never shown in full on the UI
- ✓ **Immediate Revocation**: Delete to revoke access instantly
- ✓ **HTTPS Only**: All communication encrypted in transit

Your keys are only used to execute agents and workflows **you initiate**. They're never shared with third parties or used for any other purpose.

## When Agent Requires Configuration

If you try to launch an agent that requires configuration you haven't set up:

1. A modal will appear showing which configurations are missing
2. It will display:
   - Provider name
   - Required fields
   - Link to provider's key generation page
3. You can either:
   - **"Go to Settings"** - Navigate directly to configure it
   - **"Cancel"** - Abort the launch

After setting up the missing configuration, you can launch the agent again immediately.

## Local Development

For local testing and development, you can use environment variables instead of saving keys in the database:

### Option 1: Environment Variables

Add to your `.env` file:

```bash
AI_OPENAI_API_KEY=sk-your-test-key
AI_ANTHROPIC_API_KEY=sk-ant-your-test-key
AI_GOOGLE_API_KEY=your-google-key
```

The system will automatically use these for local development.

### Option 2: Settings Page

The same process works for local development - just add your keys through the Settings page.

## Troubleshooting

### "Failed to save configuration"

**Cause**: Invalid API key format or missing required fields

**Solution**:
1. Verify you copied the entire API key (no extra spaces)
2. Verify the key format is correct for the provider
3. Check that the key is from the correct provider
4. Try copying from the provider's website again

### "Test failed" on a valid key

**Cause**: Network issues or provider API temporary unavailability

**Solution**:
1. Check your internet connection
2. Verify the API key is valid on the provider's website
3. Try testing again in a few minutes
4. Ensure your network allows outbound HTTPS connections
5. Verify the key has the required permissions

### Agent still prompts for configuration after saving

**Cause**: Configuration not fully saved or page needs refresh

**Solution**:
1. Refresh the page (Ctrl+R or Cmd+R)
2. Verify on Settings page that config shows as saved
3. Try clicking Test to verify it's recognized
4. Try launching the agent again

### Key stopped working

**Cause**: Provider rotated the key or disabled it

**Solution**:
1. Go to Settings
2. Update the configuration with a new key from the provider
3. Test the new configuration
4. Retry the agent

## Advanced Features

### Model Preferences

Some providers allow you to set model preferences when saving:

```json
{
  "model_preference": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 2000
}
```

These are optional and can be configured when saving the API key.

### Multiple Keys (Future)

In the future, you'll be able to save multiple API keys for the same provider with different configurations.

### Cost Tracking (Future)

Coming soon: View which provider is being used most and estimated costs.

### Provider Health Dashboard (Future)

Coming soon: Real-time status of each provider's API availability.

## FAQ

**Q: Where are my API keys stored?**
A: Your keys are encrypted using AES-256-GCM encryption and stored in a PostgreSQL database. Only you can decrypt them with your account.

**Q: Can I use the same key for multiple users?**
A: Each user has their own encrypted copy of their API keys. Users cannot see or share each other's keys.

**Q: What happens if I delete a configuration?**
A: The configuration is immediately deleted from the database. Agents can no longer use it. If you delete it by mistake, you'll need to re-enter the API key.

**Q: Can I import keys from a file?**
A: Not yet, but this feature is on the roadmap.

**Q: What if I rotate my API keys?**
A: Simply update the configuration with your new API key on the Settings page.

**Q: Can I export my configurations?**
A: No, for security reasons. You can only save and retrieve keys through the Settings page.

**Q: How often should I test my configurations?**
A: The system automatically tests when you save. You can manually test anytime with the "Test" button. Periodic testing is recommended if you use old keys.

**Q: What if a provider's API goes down?**
A: The agent will fail with an error from the provider. Configure a fallback provider in your workflow.

## Best Practices

1. **Use Strong Keys**: Generate new API keys from providers, don't reuse old ones
2. **Rotate Regularly**: Update your API keys every 90 days
3. **Test Before Use**: Always test a configuration after adding/updating
4. **Secure Your Account**: Use a strong password and 2FA if available
5. **Monitor Usage**: Periodically check which providers you're using
6. **Delete Unused**: Remove API keys you're no longer using

## Need Help?

- Check the [main README](../README.md) for general platform info
- See [Integration Examples](../INTEGRATION_EXAMPLES.md) for developer documentation
- Visit [Implementation Guide](../AI_CONFIG_IMPLEMENTATION.md) for technical details

## Contact Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review your browser console for error messages
3. Try a different provider to isolate issues
4. Contact support with:
   - Provider name
   - Error message (without the actual API key)
   - Steps to reproduce
