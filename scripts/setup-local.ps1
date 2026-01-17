# PowerShell script for Windows local development environment setup
# This script installs all required tools and dependencies for Cloud Run development

$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up local development environment for Google Chat Bot (Cloud Run)" -ForegroundColor Cyan

# Function to check if command exists
function Test-Command {
    param($Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Check and install Google Cloud SDK
Write-Host "`nChecking Google Cloud SDK..." -ForegroundColor Yellow
if (-not (Test-Command gcloud)) {
    Write-Host "Google Cloud SDK not found." -ForegroundColor Red
    Write-Host "Installing Google Cloud SDK..." -ForegroundColor Yellow
    
    # Try winget first
    if (Test-Command winget) {
        Write-Host "Installing via winget..." -ForegroundColor Yellow
        winget install Google.CloudSDK
    } else {
        Write-Host "Please install Google Cloud SDK manually from:" -ForegroundColor Yellow
        Write-Host "https://cloud.google.com/sdk/docs/install" -ForegroundColor Cyan
        Write-Host "Or install winget and run: winget install Google.CloudSDK" -ForegroundColor Cyan
        Read-Host "Press Enter after installing gcloud CLI"
    }
} else {
    Write-Host "✓ Google Cloud SDK found" -ForegroundColor Green
    gcloud --version
}

# Check and install Docker
Write-Host "`nChecking Docker..." -ForegroundColor Yellow
if (-not (Test-Command docker)) {
    Write-Host "Docker not found." -ForegroundColor Red
    Write-Host "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✓ Docker found" -ForegroundColor Green
    docker --version
}

# Check Python version
Write-Host "`nChecking Python..." -ForegroundColor Yellow
if (-not (Test-Command python)) {
    Write-Host "Python not found." -ForegroundColor Red
    Write-Host "Please install Python 3.11 or later from: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
} else {
    $pythonVersion = python --version
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
    
    # Check Python version
    $versionMatch = $pythonVersion -match "(\d+)\.(\d+)"
    if ($matches) {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 11)) {
            Write-Host "Python 3.11 or later is required. Current version: $pythonVersion" -ForegroundColor Red
            exit 1
        }
    }
}

# Create virtual environment if it doesn't exist
Write-Host "`nSetting up Python virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path "venv")) {
    python -m venv venv
    Write-Host "✓ Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "✓ Virtual environment already exists" -ForegroundColor Green
}

# Activate virtual environment
& "venv\Scripts\Activate.ps1"

# Install Python dependencies
Write-Host "`nInstalling Python dependencies..." -ForegroundColor Yellow
if (Test-Path "requirements.txt") {
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    Write-Host "✓ Python dependencies installed" -ForegroundColor Green
} else {
    Write-Host "requirements.txt not found. Creating basic requirements..." -ForegroundColor Yellow
    @"
fastapi==0.104.1
uvicorn[standard]==0.24.0
google-cloud-run==0.10.0
google-cloud-logging==3.8.0
google-cloud-secret-manager==2.18.0
google-cloud-aiplatform==1.38.0
google-auth==2.25.2
requests==2.31.0
python-dotenv==1.0.0
"@ | Out-File -FilePath "requirements.txt" -Encoding utf8
    
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    Write-Host "✓ Basic Python dependencies installed" -ForegroundColor Green
}

# Check gcloud authentication
Write-Host "`nChecking Google Cloud authentication..." -ForegroundColor Yellow
$activeAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null | Select-Object -First 1
if (-not $activeAccount) {
    Write-Host "No active Google Cloud authentication found." -ForegroundColor Yellow
    Write-Host "Please run: gcloud auth login" -ForegroundColor Cyan
    Read-Host "Press Enter to continue after authenticating"
} else {
    Write-Host "✓ Authenticated as: $activeAccount" -ForegroundColor Green
}

# Check if application-default credentials are set
Write-Host "`nChecking application-default credentials..." -ForegroundColor Yellow
try {
    $null = gcloud auth application-default print-access-token 2>$null
    Write-Host "✓ Application-default credentials configured" -ForegroundColor Green
} catch {
    Write-Host "Application-default credentials not set." -ForegroundColor Yellow
    Write-Host "Running: gcloud auth application-default login" -ForegroundColor Cyan
    gcloud auth application-default login
}

# Create .env.example if it doesn't exist
Write-Host "`nSetting up environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env.example")) {
    @"
# Google Cloud Configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
GCP_SERVICE_ACCOUNT=chatbot-service@your-project-id.iam.gserviceaccount.com

# Cloud Run Configuration
CLOUD_RUN_SERVICE_NAME=chatbot-service
CLOUD_RUN_REGION=us-central1

# Google Chat Configuration
CHAT_APP_NAME=Chatbot
CHAT_APP_DESCRIPTION=AI-powered chatbot for Google Chat

# Azure OpenAI (for /chatgpt and /wiki commands)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-azure-key
AZURE_OPENAI_MODEL=gpt-5.1
AZURE_SEARCH_OPENAI_MODEL=gpt-4o

# Vertex AI (for /gemini command)
VERTEX_AI_PROJECT_ID=your-project-id
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-2.0-pro-exp

# Logging
LOG_LEVEL=INFO
"@ | Out-File -FilePath ".env.example" -Encoding utf8
    
    Write-Host "✓ Created .env.example" -ForegroundColor Green
    Write-Host "Please copy .env.example to .env and fill in your values" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env.example already exists" -ForegroundColor Green
}

Write-Host "`n✅ Local development environment setup complete!" -ForegroundColor Green
Write-Host "`nNext steps:"
Write-Host "1. Copy .env.example to .env and configure your values"
Write-Host "2. Run: .\scripts\deploy-cloud-run.ps1 to deploy to Cloud Run"
Write-Host "3. Or run: python -m uvicorn main:app --reload for local development"

