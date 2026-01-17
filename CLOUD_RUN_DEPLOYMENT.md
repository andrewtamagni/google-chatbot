# Cloud Run Deployment Guide

This guide covers deploying the Google Chat Bot to Google Cloud Run while maintaining the existing Apps Script integration.

## Architecture Overview

The hybrid architecture allows you to:
- Keep using Apps Script for Google Chat integration (webhook receiver)
- Deploy Cloud Run service for AI processing and advanced features
- Gradually migrate functionality from Apps Script to Cloud Run

```
Google Chat → Apps Script (Webhook) → Cloud Run (AI Processing) → Response
```

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed (for local testing)
4. **Python 3.11+** installed

## Quick Start

### 1. Local Setup

**Windows (PowerShell):**
```powershell
.\scripts\setup-local.ps1
```

**Linux/Mac (Bash):**
```bash
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh
```

This script will:
- Check and install required tools (gcloud, Docker, Python)
- Set up Python virtual environment
- Install dependencies
- Configure authentication
- Create `.env.example` file

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
# Edit .env with your actual values
```

Required configuration:
- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `CLOUD_RUN_REGION`: Region for Cloud Run (e.g., `us-central1`)
- `CLOUD_RUN_SERVICE_NAME`: Name for your Cloud Run service
- Azure OpenAI credentials (for `/chatgpt` and `/wiki` commands)
- Vertex AI configuration (for `/gemini` command)

### 3. Deploy to Cloud Run

**Windows (PowerShell):**
```powershell
.\scripts\deploy-cloud-run.ps1
```

**Linux/Mac (Bash):**
```bash
chmod +x scripts/deploy-cloud-run.sh
./scripts/deploy-cloud-run.sh
```

This script will:
- Enable required Google Cloud APIs
- Create service account with necessary permissions
- Build Docker container
- Deploy to Cloud Run
- Output the service URL

### 4. Configure Google Chat Webhook

After deployment, you'll get a Cloud Run service URL. Update your Apps Script to call this URL for AI processing:

1. In Apps Script, add a function to call Cloud Run:
```javascript
function callCloudRunService(prompt, command) {
  const cloudRunUrl = PropertiesService.getScriptProperties().getProperty('CLOUD_RUN_URL');
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({
      prompt: prompt,
      command: command,
      userId: Session.getActiveUser().getEmail()
    }),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(`${cloudRunUrl}/api/chat`, options);
  return JSON.parse(response.getContentText());
}
```

2. Set `CLOUD_RUN_URL` in Script Properties to your Cloud Run service URL

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  chat.googleapis.com \
  --project=YOUR_PROJECT_ID
```

### 2. Create Service Account

```bash
gcloud iam service-accounts create chatbot-service \
  --display-name="Chatbot Service Account" \
  --project=YOUR_PROJECT_ID

SERVICE_ACCOUNT="chatbot-service@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/logging.logWriter"
```

### 3. Build and Deploy

```bash
# Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/chatbot-service

# Deploy to Cloud Run
gcloud run deploy chatbot-service \
  --image=gcr.io/YOUR_PROJECT_ID/chatbot-service \
  --platform=managed \
  --region=us-central1 \
  --service-account=chatbot-service@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --timeout=300 \
  --max-instances=10
```

## Using Pulumi (Infrastructure as Code - Optional)

For infrastructure as code approach using Pulumi:

1. Install Pulumi: https://www.pulumi.com/docs/get-started/install/

2. Install Python dependencies:
```bash
cd pulumi
pip install -r requirements.txt
```

3. Configure Pulumi:
```bash
# Edit Pulumi.dev.yaml with your values, or set via CLI:
pulumi config set chatbot-infrastructure:projectId YOUR_PROJECT_ID
pulumi config set chatbot-infrastructure:region us-central1
```

4. Preview and deploy:
```bash
pulumi preview
pulumi up
```

**Note**: Pulumi is optional. The deployment scripts can create everything via `gcloud` CLI commands. Pulumi provides Infrastructure as Code benefits like versioning and state management.

See `pulumi/README.md` for detailed Pulumi usage.

## Managing Secrets

Store sensitive data in Google Secret Manager:

```bash
# Create secrets
echo -n "your-azure-key" | gcloud secrets create azure-openai-key --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding azure-openai-key \
  --member="serviceAccount:chatbot-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Update Cloud Run service to use secrets:

```bash
gcloud run services update chatbot-service \
  --update-secrets=AZURE_OPENAI_KEY=azure-openai-key:latest \
  --region=us-central1
```

## Testing

### Local Testing

```bash
# Activate virtual environment
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\Activate.ps1  # Windows

# Run locally
uvicorn main:app --reload --port 8080
```

### Test Cloud Run Service

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe chatbot-service \
  --region=us-central1 \
  --format="value(status.url)")

# Test health endpoint
curl ${SERVICE_URL}/health

# Test chat endpoint
curl -X POST ${SERVICE_URL}/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "command": "gemini"}'
```

## Monitoring

View logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=chatbot-service" --limit 50
```

View metrics in Cloud Console:
- Go to Cloud Run → chatbot-service → Metrics

## Troubleshooting

### Service won't start
- Check logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=chatbot-service" --limit 50`
- Verify service account permissions
- Check environment variables and secrets

### Authentication errors
- Verify service account has correct IAM roles
- Check Secret Manager access
- Ensure application-default credentials are set

### High latency
- Increase memory allocation
- Enable Cloud CDN
- Use minimum instances to avoid cold starts

## Next Steps

1. **Implement Cloud Run service** - Create FastAPI application (see `main.py` structure)
2. **Migrate commands** - Port `/gemini`, `/wiki`, `/chatgpt` to Cloud Run
3. **Add new features** - Implement `/drive` command, conversation history, model armor
4. **Update Apps Script** - Modify to call Cloud Run instead of processing locally

## Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [gcloud CLI Reference](https://cloud.google.com/sdk/gcloud/reference)
- [Terraform Google Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)

