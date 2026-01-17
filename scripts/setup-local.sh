#!/bin/bash
# Setup script for local development environment
# This script installs all required tools and dependencies for Cloud Run development

set -e  # Exit on error

echo "🚀 Setting up local development environment for Google Chat Bot (Cloud Run)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Windows (Git Bash, WSL, or native)
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ -n "$WSL_DISTRO_NAME" ]]; then
    IS_WINDOWS=true
    echo -e "${YELLOW}Detected Windows environment${NC}"
else
    IS_WINDOWS=false
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check and install Google Cloud SDK
echo -e "\n${YELLOW}Checking Google Cloud SDK...${NC}"
if ! command_exists gcloud; then
    echo -e "${RED}Google Cloud SDK not found.${NC}"
    echo "Installing Google Cloud SDK..."
    
    if [ "$IS_WINDOWS" = true ]; then
        echo "Please install Google Cloud SDK manually from:"
        echo "https://cloud.google.com/sdk/docs/install"
        echo "Or use: winget install Google.CloudSDK"
        read -p "Press Enter after installing gcloud CLI..."
    else
        # Linux/Mac installation
        curl https://sdk.cloud.google.com | bash
        exec -l $SHELL
        gcloud init
    fi
else
    echo -e "${GREEN}✓ Google Cloud SDK found${NC}"
    gcloud --version
fi

# Check and install Docker
echo -e "\n${YELLOW}Checking Docker...${NC}"
if ! command_exists docker; then
    echo -e "${RED}Docker not found.${NC}"
    echo "Please install Docker from: https://www.docker.com/get-started"
    if [ "$IS_WINDOWS" = true ]; then
        echo "Windows: Install Docker Desktop from https://www.docker.com/products/docker-desktop"
    fi
    exit 1
else
    echo -e "${GREEN}✓ Docker found${NC}"
    docker --version
fi

# Check Python version
echo -e "\n${YELLOW}Checking Python...${NC}"
if ! command_exists python3; then
    echo -e "${RED}Python 3 not found.${NC}"
    echo "Please install Python 3.11 or later from: https://www.python.org/downloads/"
    exit 1
else
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo -e "${GREEN}✓ Python found: ${PYTHON_VERSION}${NC}"
    
    # Check if Python version is 3.11+
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]); then
        echo -e "${RED}Python 3.11 or later is required. Current version: ${PYTHON_VERSION}${NC}"
        exit 1
    fi
fi

# Create virtual environment if it doesn't exist
echo -e "\n${YELLOW}Setting up Python virtual environment...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${GREEN}✓ Virtual environment already exists${NC}"
fi

# Activate virtual environment
if [ "$IS_WINDOWS" = true ]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

# Install Python dependencies
echo -e "\n${YELLOW}Installing Python dependencies...${NC}"
if [ -f "requirements.txt" ]; then
    pip install --upgrade pip
    pip install -r requirements.txt
    echo -e "${GREEN}✓ Python dependencies installed${NC}"
else
    echo -e "${YELLOW}requirements.txt not found. Creating basic requirements...${NC}"
    cat > requirements.txt << EOF
fastapi==0.104.1
uvicorn[standard]==0.24.0
google-cloud-run==0.10.0
google-cloud-logging==3.8.0
google-cloud-secret-manager==2.18.0
google-cloud-aiplatform==1.38.0
google-auth==2.25.2
requests==2.31.0
python-dotenv==1.0.0
EOF
    pip install --upgrade pip
    pip install -r requirements.txt
    echo -e "${GREEN}✓ Basic Python dependencies installed${NC}"
fi

# Check gcloud authentication
echo -e "\n${YELLOW}Checking Google Cloud authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}No active Google Cloud authentication found.${NC}"
    echo "Please run: gcloud auth login"
    read -p "Press Enter to continue after authenticating..."
else
    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1)
    echo -e "${GREEN}✓ Authenticated as: ${ACTIVE_ACCOUNT}${NC}"
fi

# Check if application-default credentials are set
echo -e "\n${YELLOW}Checking application-default credentials...${NC}"
if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
    echo -e "${YELLOW}Application-default credentials not set.${NC}"
    echo "Running: gcloud auth application-default login"
    gcloud auth application-default login
else
    echo -e "${GREEN}✓ Application-default credentials configured${NC}"
fi

# Create .env.example if it doesn't exist
echo -e "\n${YELLOW}Setting up environment configuration...${NC}"
if [ ! -f ".env.example" ]; then
    cat > .env.example << 'EOF'
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
EOF
    echo -e "${GREEN}✓ Created .env.example${NC}"
    echo -e "${YELLOW}Please copy .env.example to .env and fill in your values${NC}"
else
    echo -e "${GREEN}✓ .env.example already exists${NC}"
fi

echo -e "\n${GREEN}✅ Local development environment setup complete!${NC}"
echo -e "\nNext steps:"
echo "1. Copy .env.example to .env and configure your values"
echo "2. Run: ./scripts/deploy-cloud-run.sh to deploy to Cloud Run"
echo "3. Or run: python -m uvicorn main:app --reload for local development"

