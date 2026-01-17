# Google Chat Bot with Multiple AI Providers

> ⚠️ **WORK IN PROGRESS - UNDER ACTIVE DEVELOPMENT** ⚠️
> 
> This project is currently under active development and is a work in progress. Features may be incomplete, documentation may be outdated, and breaking changes may occur. Use at your own risk and expect ongoing updates and improvements.

---

A Google Workspace Add-on that provides an AI-powered chatbot for Google Chat with support for multiple AI providers and retrieval-augmented generation (RAG). This bot can be added to team spaces and direct messages to provide intelligent responses.

---

## AI Assistance Disclosure

**Drafted with AI assistance; verified by humans.** This repository was developed with significant assistance from Cursor AI (powered by Claude Sonnet 4.5). The AI was used for code generation, documentation, architecture design, and problem-solving throughout the development process. All code and documentation have been reviewed, verified, and refined by humans to ensure quality and accuracy.

## Features

- 🤖 **Gemini AI Integration** - Powered by Google's advanced AI models (default)
- 💬 **Azure OpenAI ChatGPT** - Direct access to Azure OpenAI GPT-5.1 models via `/chatgpt` command
- 📚 **Wiki Search with RAG** - Search internal wiki using Azure OpenAI GPT-4 + Azure AI Search via `/wiki` command (GPT-4 required as GPT-5 models don't support data_sources yet)
- 🔄 **Chat History** - CosmosDB integration for conversation history (for `/wiki` command)
- 💬 **Google Chat Integration** - Responds to messages in Google Chat spaces
- ⚡ **Command-based** - Multiple commands: `/gemini`, `/wiki`, `/chatgpt`, `/help`
- 📎 **Google Drive File Attachment** - Native support for attaching Drive files via Chat's built-in attachment feature
- 🔧 **Cloud Run Deployment** - Deployed as a Google Cloud Run service for better scalability and performance
- 📝 **Help System** - Built-in help command with `/help`
- 🚀 **Local Development** - Full IDE support with Node.js and Google Cloud Functions Framework
- 📚 **Well-Documented** - Comprehensive code comments and documentation

## Architecture

This bot is deployed as a **Google Cloud Run** service using the Google Cloud Functions Framework. The service receives webhook events from Google Chat and processes them using various AI providers.

```
Google Chat → Cloud Run Service (Webhook) → AI Processing → Response
```

## Quick Start

### Prerequisites

- Node.js 18+ installed on your system
- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed (for container builds)

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp env.example.js env.js
   # Edit env.js with your actual values
   ```

3. **Set up Google Cloud authentication:**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

## Deployment

For detailed deployment instructions, see [CLOUD_RUN_DEPLOYMENT.md](./CLOUD_RUN_DEPLOYMENT.md).

### Configure Google Chat Webhook

After deployment, you'll receive a Cloud Run service URL. Configure this in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 client ID
4. Go to **Google Chat API** → **Configuration**
5. Set the webhook URL to your Cloud Run service URL
6. Configure the following triggers:
   - **Message**: Handled automatically by the service
   - **Added to space**: Handled automatically by the service
   - **Removed from space**: Handled automatically by the service
   - **App command**: Handled automatically by the service

## Configuration

### Environment Variables

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for a complete list of required environment variables.

Key configuration areas:
- **Gemini AI**: Google AI Studio API key
- **Azure OpenAI**: For `/chatgpt` and `/wiki` commands
- **Azure AI Search**: For `/wiki` RAG functionality
- **CosmosDB**: For chat history (optional, for `/wiki` command)

### Using Google Secret Manager

For production deployments, store sensitive data in Google Secret Manager:

```bash
# Create secrets
echo -n "your-api-key" | gcloud secrets create gemini-api-key --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:chatbot-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Update Cloud Run service to use secrets:

```bash
gcloud run services update chatbot-service \
  --update-secrets=GEMINI_API_KEY=gemini-api-key:latest \
  --region=us-central1
```

## Development Workflow

### Local Development

1. **Start the local server:**
   ```bash
   npm start
   ```

   The service will run on `http://localhost:8080`

2. **Test locally:**
   ```bash
   # Test health endpoint
   curl http://localhost:8080/health
   
   # Test chat endpoint
   curl -X POST http://localhost:8080/api/chat \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Hello", "command": "gemini"}'
   ```

3. **Make changes** to `index.js` or other files
4. **Restart the server** to see changes (or use a process manager with auto-reload)

### Deploying Changes

1. **Test locally** to ensure changes work
2. **Deploy to Cloud Run** - See [CLOUD_RUN_DEPLOYMENT.md](./CLOUD_RUN_DEPLOYMENT.md) for deployment instructions

### Useful Commands

```bash
# Start local development server
npm start

# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=chatbot-service" --limit 50

# Get service URL
gcloud run services describe chatbot-service \
  --region=us-central1 \
  --format="value(status.url)"

# View service details
gcloud run services describe chatbot-service --region=us-central1
```

## Usage

### Commands

- **Default**: Send any message to automatically use Gemini AI
- **`/gemini <message>`**: Use Google Gemini AI explicitly
- **`/wiki <question>`**: Search internal wiki using Azure OpenAI GPT-4 + Azure AI Search (RAG). **Note**: Uses GPT-4 because GPT-5 models don't support data_sources at this time.
- **`/chatgpt <message>`**: Use Azure OpenAI GPT-5.1 (simple chat, no search)
- **`/help`**: Show help information

### Attaching Google Drive Files

The bot supports native Google Drive file attachment through Google Chat's built-in attachment feature. When composing a message in Chat, you can use the attachment button to attach Drive files directly. This is handled natively by Google Chat - no special commands are needed.

### Examples

```
What's the weather like today?                              # Uses Gemini automatically
/gemini Explain quantum computing in simple terms          # Explicit Gemini request
/wiki where do I view the Entra ID sign in logs?           # Wiki search with RAG (GPT-4)
/chatgpt Write a Python function to query ldap.org.edu LDAP?  # Azure OpenAI GPT-5.1
/help                                                       # Show help message
```

**Note**: Drive file attachments are handled natively by Google Chat. Simply use the attachment button when composing a message - no special commands are required.

## Testing

### Test Bot in Chat

1. Add the bot to a Google Chat space
2. Send a test message (e.g., "Hello" or "/help")
3. Check the Cloud Run logs for any issues:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=chatbot-service" --limit 50
   ```
4. Verify the bot responds correctly

### Local Testing

Test the service locally before deploying:

```bash
# Start the service
npm start

# In another terminal, test the endpoint
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MESSAGE",
    "message": {
      "text": "Hello, bot!"
    },
    "user": {
      "name": "users/test-user"
    }
  }'
```

## Troubleshooting

### Common Issues

1. **"API key not configured" error**
   - Verify environment variables are set correctly in `env.js` or Cloud Run service
   - Check that secrets are properly configured in Secret Manager
   - Ensure service account has access to secrets

2. **"Invalid response from API" error**
   - Verify your API keys are valid
   - Check that the Gemini API URL is correct
   - Ensure you have access to the Gemini 2.5 Pro model
   - For `/wiki` or `/chatgpt`: Verify Azure OpenAI configuration
   - For `/chatgpt`: Ensure `AZURE_OPENAI_MODEL` is set to a GPT-5.1 deployment
   - For `/wiki`: Ensure `AZURE_SEARCH_OPENAI_MODEL` is set to a GPT-4 model (GPT-5 models don't support data_sources)

3. **Bot not responding in Google Chat**
   - Verify the bot is properly deployed to Cloud Run
   - Check that the webhook URL is correctly configured in Google Cloud Console
   - Ensure the Cloud Run service is publicly accessible (or properly authenticated)
   - Check Cloud Run logs for errors

4. **"Invalid add-on response returned" error**
   - This usually means the response format is incorrect
   - The bot uses `hostAppDataAction` format for Google Workspace Add-ons
   - Check the Cloud Run logs for detailed error messages

5. **Service won't start**
   - Check Cloud Run logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=chatbot-service" --limit 50`
   - Verify service account permissions
   - Check environment variables and secrets are properly configured

### Debugging

1. **View logs:**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=chatbot-service" --limit 50
   ```

2. **Check service status:**
   ```bash
   gcloud run services describe chatbot-service --region=us-central1
   ```

3. **Test locally** with detailed logging:
   ```bash
   DEBUG=* npm start
   ```

4. **Verify environment variables** are set correctly in Cloud Run:
   ```bash
   gcloud run services describe chatbot-service --region=us-central1 --format="value(spec.template.spec.containers[0].env)"
   ```

## File Structure

```
ito-google-chatbot/
├── index.js                    # Main Cloud Run service code
├── env.js                      # Environment variable configuration (create from env.example.js)
├── env.example.js              # Example environment variables
├── package.json                # Node.js dependencies and scripts
├── Dockerfile                  # Docker container definition
├── README.md                   # This file
├── CLOUD_RUN_DEPLOYMENT.md     # Detailed Cloud Run deployment guide
├── ENVIRONMENT_VARIABLES.md    # Complete environment variable reference
├── NODEJS_DEPLOYMENT.md        # Node.js deployment details
└── AppsScript-Example/         # Original Apps Script implementation (reference)
    ├── Code.js
    ├── appsscript.json
    └── README.md
```

## Security Notes

- ✅ **API keys stored in environment variables or Secret Manager** - Never in code
- ✅ **No sensitive data in version control** - Keys are managed separately
- ✅ **Google's security model** - Leverages Google's authentication and IAM
- ✅ **Service account authentication** - Uses least-privilege IAM roles
- ⚠️ **Monitor API usage** - Set up billing alerts for Gemini API and Azure OpenAI
- ⚠️ **Rate limiting** - Consider implementing for production use
- ⚠️ **HTTPS only** - Cloud Run services use HTTPS by default

## Customization

### Changing the AI Model

Edit the environment variables in `env.js` or Cloud Run service configuration:

```javascript
// For Gemini
GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'
// or
GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent'
```

### Modifying Response Format

Edit the `createChatResponse()` function in `index.js` to change how responses appear in Google Chat.

### Adding New Commands

1. Add command detection in `parseCommand()` function
2. Add routing logic in `handleMessageEvent()` and `handleAppCommandEvent()` handlers
3. Create a handler function for the new command
4. Update the `getHelpMessage()` function to include the new command
5. Register the command in Google Cloud Console (if using slash commands)

### Scaling Configuration

Adjust Cloud Run service settings for your needs:

```bash
gcloud run services update chatbot-service \
  --memory=1Gi \
  --cpu=2 \
  --timeout=300 \
  --max-instances=100 \
  --min-instances=1 \
  --region=us-central1
```

## Monitoring

### View Logs

```bash
# Real-time logs
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=chatbot-service"

# Recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=chatbot-service" --limit 50
```

### View Metrics

- Go to [Cloud Console](https://console.cloud.google.com/)
- Navigate to **Cloud Run** → **chatbot-service** → **Metrics**
- Monitor request count, latency, error rate, and instance count

### Set Up Alerts

Configure alerting policies in Cloud Monitoring for:
- High error rates
- High latency
- Unusual traffic patterns
- API quota limits

## Support

For issues with:
- **Google Cloud Run**: [Cloud Run documentation](https://cloud.google.com/run/docs)
- **Google Chat**: [Google Chat API documentation](https://developers.google.com/chat)
- **Gemini API**: [Google AI documentation](https://ai.google.dev/docs)
- **Google Cloud Functions Framework**: [Functions Framework documentation](https://github.com/GoogleCloudPlatform/functions-framework-nodejs)
- **gcloud CLI**: [gcloud CLI Reference](https://cloud.google.com/sdk/gcloud/reference)

## Migration from Apps Script

If you're migrating from the Apps Script version:

1. The original Apps Script code is preserved in `AppsScript-Example/` for reference
2. The Cloud Run version provides better scalability and performance
3. Environment variables are now managed through `env.js` or Cloud Run service configuration
4. Deployment is done via `gcloud` CLI instead of `clasp`
5. See [CLOUD_RUN_DEPLOYMENT.md](./CLOUD_RUN_DEPLOYMENT.md) for detailed migration steps

## Third-Party Dependencies

This project uses the following third-party open-source libraries:

- **@google-cloud/functions-framework** (Apache-2.0 License) - Google Cloud Functions Framework for Node.js
- **google-auth-library** (Apache-2.0 License) - Google authentication library for Node.js

All dependencies are listed in `package.json`. Please refer to each library's license for specific terms and conditions.

## License

This project is open source and available under the Apache-2.0 License.

