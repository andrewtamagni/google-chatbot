# PowerShell script to deploy Cloud Run service for Google Chat Bot
# This script automates the deployment of the chatbot service to Google Cloud Run

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying Google Chat Bot to Cloud Run" -ForegroundColor Cyan
Write-Host ""

# Load environment variables from .env file if it exists
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} elseif (Test-Path ".env.example") {
    Write-Host "⚠️  .env file not found. Using .env.example as reference." -ForegroundColor Yellow
    Write-Host "Please create .env file with your actual values." -ForegroundColor Yellow
    $response = Read-Host "Continue with defaults? (y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        exit 1
    }
} else {
    Write-Host "No .env or .env.example file found." -ForegroundColor Red
    exit 1
}

# Required variables with defaults
$PROJECT_ID = if ($env:GCP_PROJECT_ID) { $env:GCP_PROJECT_ID } else { 
    $defaultProject = gcloud config get-value project 2>$null
    if ($defaultProject) { $defaultProject } else { $null }
}
$REGION = if ($env:CLOUD_RUN_REGION) { $env:CLOUD_RUN_REGION } elseif ($env:GCP_REGION) { $env:GCP_REGION } else { "us-central1" }
$SERVICE_NAME = if ($env:CLOUD_RUN_SERVICE_NAME) { $env:CLOUD_RUN_SERVICE_NAME } else { "chatbot-service" }
$SERVICE_ACCOUNT = if ($env:GCP_SERVICE_ACCOUNT) { $env:GCP_SERVICE_ACCOUNT } else { "chatbot-service@${PROJECT_ID}.iam.gserviceaccount.com" }

# Validate required variables
if (-not $PROJECT_ID) {
    Write-Host "Error: GCP_PROJECT_ID not set and no default project configured." -ForegroundColor Red
    Write-Host "Please set GCP_PROJECT_ID in .env or run: gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Yellow
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Green
Write-Host "  Project ID: $PROJECT_ID"
Write-Host "  Region: $REGION"
Write-Host "  Service Name: $SERVICE_NAME"
Write-Host "  Service Account: $SERVICE_ACCOUNT"
Write-Host ""

# Check if gcloud is authenticated
Write-Host "Checking authentication..." -ForegroundColor Yellow
$activeAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null | Select-Object -First 1
if (-not $activeAccount) {
    Write-Host "Not authenticated with gcloud." -ForegroundColor Red
    Write-Host "Running: gcloud auth login" -ForegroundColor Cyan
    gcloud auth login
}

# Set the project
Write-Host "Setting GCP project..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Enable required APIs
Write-Host "Enabling required Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    secretmanager.googleapis.com `
    aiplatform.googleapis.com `
    chat.googleapis.com `
    --project=$PROJECT_ID `
    --quiet

Write-Host "✓ APIs enabled" -ForegroundColor Green

# Create service account if it doesn't exist
Write-Host "Checking service account..." -ForegroundColor Yellow
try {
    $null = gcloud iam service-accounts describe $SERVICE_ACCOUNT --project=$PROJECT_ID 2>$null
    Write-Host "✓ Service account already exists" -ForegroundColor Green
} catch {
    Write-Host "Creating service account: $SERVICE_ACCOUNT" -ForegroundColor Yellow
    gcloud iam service-accounts create $SERVICE_NAME `
        --display-name="Chatbot Service Account" `
        --description="Service account for Cloud Run chatbot service" `
        --project=$PROJECT_ID
    
    # Grant necessary permissions
    Write-Host "Granting permissions to service account..." -ForegroundColor Yellow
    gcloud projects add-iam-policy-binding $PROJECT_ID `
        --member="serviceAccount:$SERVICE_ACCOUNT" `
        --role="roles/aiplatform.user" `
        --condition=None
    
    gcloud projects add-iam-policy-binding $PROJECT_ID `
        --member="serviceAccount:$SERVICE_ACCOUNT" `
        --role="roles/secretmanager.secretAccessor" `
        --condition=None
    
    gcloud projects add-iam-policy-binding $PROJECT_ID `
        --member="serviceAccount:$SERVICE_ACCOUNT" `
        --role="roles/logging.logWriter" `
        --condition=None
    
    Write-Host "✓ Service account created and permissions granted" -ForegroundColor Green
}

# Check if Dockerfile exists
if (-not (Test-Path "Dockerfile")) {
    Write-Host "Dockerfile not found. Creating basic Dockerfile..." -ForegroundColor Yellow
    @"
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
"@ | Out-File -FilePath "Dockerfile" -Encoding utf8
    Write-Host "✓ Dockerfile created" -ForegroundColor Green
}

# Build and deploy to Cloud Run
Write-Host "Building and deploying to Cloud Run..." -ForegroundColor Yellow

# Build the container image
$IMAGE_NAME = "gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
Write-Host "Building container image: $IMAGE_NAME" -ForegroundColor Cyan
gcloud builds submit --tag $IMAGE_NAME --project=$PROJECT_ID

# Deploy to Cloud Run
Write-Host "Deploying to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $SERVICE_NAME `
    --image=$IMAGE_NAME `
    --platform=managed `
    --region=$REGION `
    --service-account=$SERVICE_ACCOUNT `
    --allow-unauthenticated `
    --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID}" `
    --set-env-vars="GCP_REGION=${REGION}" `
    --memory=512Mi `
    --cpu=1 `
    --timeout=300 `
    --max-instances=10 `
    --min-instances=0 `
    --project=$PROJECT_ID

# Get the service URL
$SERVICE_URL = gcloud run services describe $SERVICE_NAME `
    --platform=managed `
    --region=$REGION `
    --format="value(status.url)" `
    --project=$PROJECT_ID

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Green
Write-Host ""

# Display next steps
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure Google Chat webhook to point to: $SERVICE_URL"
Write-Host "2. Set up secrets in Secret Manager:"
Write-Host "   - AZURE_OPENAI_KEY"
Write-Host "   - AZURE_OPENAI_ENDPOINT"
Write-Host "   - (and other secrets)"
Write-Host "3. Update Cloud Run service to use secrets:"
Write-Host "   gcloud run services update $SERVICE_NAME \"
Write-Host "     --update-secrets=AZURE_OPENAI_KEY=azure-openai-key:latest \"
Write-Host "     --region=$REGION"
Write-Host ""
Write-Host "4. Test the service:"
Write-Host "   curl $SERVICE_URL/health"

