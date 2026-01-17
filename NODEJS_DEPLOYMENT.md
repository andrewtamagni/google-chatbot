# Node.js Cloud Run Deployment Guide

This guide covers deploying the Node.js version of the Google Chat Bot to Google Cloud Run.

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Node.js 18+** installed locally (for testing)
4. **Docker** installed (for building container)

## Quick Deployment

### 1. Build and Deploy

```bash
# Set your project ID
export PROJECT_ID=your-project-id
export REGION=us-central1
export SERVICE_NAME=google-chat-bot

# Build and deploy
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}

gcloud run deploy ${SERVICE_NAME} \
  --image=gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --platform=managed \
  --region=${REGION} \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --timeout=300 \
  --max-instances=10 \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCP_LOCATION=${REGION}"
```

### 2. Set Environment Variables

Set required environment variables in Cloud Run:

```bash
gcloud run services update ${SERVICE_NAME} \
  --region=${REGION} \
  --update-env-vars="GEMINI_API_URL=https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/gemini-2.0-flash-exp"
```

Or set via Cloud Console:
1. Go to Cloud Run → Your Service → Edit & Deploy New Revision
2. Add environment variables in the "Variables & Secrets" tab

### 3. Required Environment Variables

- `GCP_PROJECT_ID` - Your Google Cloud project ID
- `GCP_LOCATION` - Region (e.g., `us-central1`)
- `GEMINI_API_URL` - Vertex AI Gemini endpoint URL (optional, can be constructed)
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint (for /chatgpt and /wiki)
- `AZURE_OPENAI_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_MODEL` - Azure OpenAI model name
- `AZURE_SEARCH_SERVICE` - Azure AI Search service name (for /wiki)
- `AZURE_SEARCH_INDEX` - Azure AI Search index name
- `AZURE_COSMOSDB_ACCOUNT` - CosmosDB account (optional, for chat history)
- `AZURE_COSMOSDB_DATABASE` - CosmosDB database
- `AZURE_COSMOSDB_CONVERSATIONS_CONTAINER` - CosmosDB container
- `AZURE_COSMOSDB_ACCOUNT_KEY` - CosmosDB key

### 4. Local Testing

```bash
# Install dependencies
npm install

# Set environment variables
export GCP_PROJECT_ID=your-project-id
export GCP_LOCATION=us-central1
# ... set other required vars

# Run locally
npm start
```

The service will be available at `http://localhost:8080`

### 5. Test the Service

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region=${REGION} \
  --format="value(status.url)")

# Test with a sample Google Chat event
curl -X POST ${SERVICE_URL} \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MESSAGE",
    "chat": {
      "messagePayload": {
        "message": {
          "text": "Hello, what is the capital of France?"
        },
        "space": {
          "name": "spaces/test"
        }
      }
    },
    "user": {
      "name": "users/test"
    }
  }'
```

## Google Chat Integration

After deployment, configure your Google Chat bot to send webhook events to the Cloud Run service URL:

1. In Google Cloud Console → APIs & Services → Google Chat API
2. Configure your bot to send events to: `https://your-service-url.run.app`
3. The service will handle all event types (MESSAGE, ADDED_TO_SPACE, etc.)

## Troubleshooting

### Service won't start
- Check logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME}" --limit 50`
- Verify environment variables are set correctly
- Check that the service account has necessary permissions

### Authentication errors with Vertex AI
- Ensure the Cloud Run service has the `roles/aiplatform.user` role
- Verify `GCP_PROJECT_ID` and `GCP_LOCATION` are set correctly

### Module not found errors
- Ensure `package.json` dependencies are correct
- Rebuild the container: `gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}`

## Differences from Apps Script Version

- Uses environment variables instead of Script Properties
- Uses Node.js `fetch` API instead of `UrlFetchApp`
- Uses Node.js `crypto` module instead of `Utilities`
- Uses `google-auth-library` for Vertex AI authentication
- All functions are async/await
- Event handling via HTTP request/response instead of Apps Script event handlers

