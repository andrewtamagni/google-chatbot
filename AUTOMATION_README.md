# Automation Scripts Guide

This document describes the automation scripts available for setting up and deploying the Google Chat Bot Cloud Run service.

## Quick Start

### 1. Local Setup (One-time)

**Windows:**
```powershell
.\scripts\setup-local.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual values
```

### 3. Deploy to Cloud Run

**Windows:**
```powershell
.\scripts\deploy-cloud-run.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/deploy-cloud-run.sh
./scripts/deploy-cloud-run.sh
```

## Script Details

### setup-local.sh / setup-local.ps1

**Purpose**: Set up local development environment

**What it does:**
1. Checks for and installs required tools:
   - Google Cloud SDK (gcloud CLI)
   - Docker
   - Python 3.11+
2. Creates Python virtual environment
3. Installs Python dependencies
4. Configures Google Cloud authentication
5. Creates `.env.example` template

**Requirements:**
- Internet connection
- Administrator/sudo access (for tool installation)

**Output:**
- Virtual environment in `venv/`
- `requirements.txt` (if not exists)
- `.env.example` template

### deploy-cloud-run.sh / deploy-cloud-run.ps1

**Purpose**: Deploy Cloud Run service to Google Cloud

**What it does:**
1. Loads configuration from `.env` file
2. Validates required variables
3. Checks Google Cloud authentication
4. Enables required APIs:
   - Cloud Run API
   - Cloud Build API
   - Secret Manager API
   - Vertex AI API
   - Google Chat API
5. Creates service account with IAM roles:
   - `roles/aiplatform.user` (Vertex AI access)
   - `roles/secretmanager.secretAccessor` (Secret Manager access)
   - `roles/logging.logWriter` (Cloud Logging)
6. Builds Docker container image
7. Deploys to Cloud Run with configuration:
   - Memory: 512Mi
   - CPU: 1
   - Timeout: 300 seconds
   - Max instances: 10
   - Min instances: 0 (for cost optimization)

**Requirements:**
- `.env` file configured
- Google Cloud project with billing enabled
- Authenticated with `gcloud auth login`
- Docker installed and running

**Output:**
- Cloud Run service deployed
- Service URL printed to console

**Environment Variables Required:**
- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `CLOUD_RUN_REGION`: Region for deployment (default: us-central1)
- `CLOUD_RUN_SERVICE_NAME`: Service name (default: chatbot-service)

## Manual Steps (If Scripts Fail)

### Enable APIs Manually

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  chat.googleapis.com \
  --project=YOUR_PROJECT_ID
```

### Create Service Account Manually

```bash
gcloud iam service-accounts create chatbot-service \
  --display-name="Chatbot Service Account" \
  --project=YOUR_PROJECT_ID

SERVICE_ACCOUNT="chatbot-service@YOUR_PROJECT_ID.iam.gserviceaccount.com"

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

### Deploy Manually

```bash
# Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/chatbot-service

# Deploy
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

## Troubleshooting

### Script Fails: "gcloud not found"
- Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
- Or use: `winget install Google.CloudSDK` (Windows)

### Script Fails: "Not authenticated"
- Run: `gcloud auth login`
- Run: `gcloud auth application-default login`

### Script Fails: "Project not set"
- Set project: `gcloud config set project YOUR_PROJECT_ID`
- Or set `GCP_PROJECT_ID` in `.env` file

### Script Fails: "Docker not running"
- Start Docker Desktop (Windows/Mac)
- Or start Docker daemon (Linux): `sudo systemctl start docker`

### Deployment Fails: "Permission denied"
- Ensure you have necessary IAM roles:
  - `roles/run.admin`
  - `roles/iam.serviceAccountUser`
  - `roles/cloudbuild.builds.editor`

## Using Pulumi (Optional)

For Infrastructure as Code approach using Pulumi:

```bash
cd pulumi
pip install -r requirements.txt

# Configure (edit Pulumi.dev.yaml or use CLI)
pulumi config set chatbot-infrastructure:projectId YOUR_PROJECT_ID
pulumi config set chatbot-infrastructure:region us-central1

# Preview and deploy
pulumi preview
pulumi up
```

This will create:
- Service account
- IAM bindings
- Enable APIs

Then use deployment scripts for Cloud Run service itself.

**Note**: Pulumi is optional. The deployment scripts can create everything via `gcloud` CLI commands. Pulumi provides Infrastructure as Code benefits like versioning and state management.

See `pulumi/README.md` for detailed Pulumi usage.

## Next Steps After Deployment

1. **Get Service URL**: Script outputs the Cloud Run service URL
2. **Configure Secrets**: Store API keys in Secret Manager
3. **Update Apps Script**: Point webhook to Cloud Run URL
4. **Test Service**: Use `/health` endpoint to verify

See `CLOUD_RUN_DEPLOYMENT.md` for detailed deployment guide.

