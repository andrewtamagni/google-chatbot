#!/bin/bash
# Deploy Cloud Run service for Google Chat Bot
# This script automates the deployment of the chatbot service to Google Cloud Run

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deploying Google Chat Bot to Cloud Run${NC}\n"

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}Loading environment variables from .env...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
elif [ -f ".env.example" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Using .env.example as reference.${NC}"
    echo -e "${YELLOW}Please create .env file with your actual values.${NC}"
    read -p "Continue with defaults? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${RED}No .env or .env.example file found.${NC}"
    exit 1
fi

# Required variables with defaults
PROJECT_ID=${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}
REGION=${CLOUD_RUN_REGION:-${GCP_REGION:-us-central1}}
SERVICE_NAME=${CLOUD_RUN_SERVICE_NAME:-chatbot-service}
SERVICE_ACCOUNT=${GCP_SERVICE_ACCOUNT:-chatbot-service@${PROJECT_ID}.iam.gserviceaccount.com}

# Validate required variables
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID not set and no default project configured.${NC}"
    echo "Please set GCP_PROJECT_ID in .env or run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"
echo "  Service Account: $SERVICE_ACCOUNT"
echo ""

# Check if gcloud is authenticated
echo -e "${YELLOW}Checking authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}Not authenticated with gcloud.${NC}"
    echo "Running: gcloud auth login"
    gcloud auth login
fi

# Set the project
echo -e "${YELLOW}Setting GCP project...${NC}"
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo -e "${YELLOW}Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    aiplatform.googleapis.com \
    chat.googleapis.com \
    --project="$PROJECT_ID" \
    --quiet

echo -e "${GREEN}✓ APIs enabled${NC}"

# Create service account if it doesn't exist
echo -e "${YELLOW}Checking service account...${NC}"
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" --project="$PROJECT_ID" &>/dev/null; then
    echo -e "${YELLOW}Creating service account: $SERVICE_ACCOUNT${NC}"
    gcloud iam service-accounts create "${SERVICE_NAME}" \
        --display-name="Chatbot Service Account" \
        --description="Service account for Cloud Run chatbot service" \
        --project="$PROJECT_ID"
    
    # Grant necessary permissions
    echo -e "${YELLOW}Granting permissions to service account...${NC}"
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/aiplatform.user" \
        --condition=None
    
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --condition=None
    
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/logging.logWriter" \
        --condition=None
    
    echo -e "${GREEN}✓ Service account created and permissions granted${NC}"
else
    echo -e "${GREEN}✓ Service account already exists${NC}"
fi

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo -e "${YELLOW}Dockerfile not found. Creating basic Dockerfile...${NC}"
    cat > Dockerfile << 'EOF'
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
EOF
    echo -e "${GREEN}✓ Dockerfile created${NC}"
fi

# Build and deploy to Cloud Run
echo -e "${YELLOW}Building and deploying to Cloud Run...${NC}"

# Build the container image
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
echo -e "${BLUE}Building container image: $IMAGE_NAME${NC}"
gcloud builds submit --tag "$IMAGE_NAME" --project="$PROJECT_ID"

# Deploy to Cloud Run
echo -e "${BLUE}Deploying to Cloud Run...${NC}"
gcloud run deploy "$SERVICE_NAME" \
    --image="$IMAGE_NAME" \
    --platform=managed \
    --region="$REGION" \
    --service-account="$SERVICE_ACCOUNT" \
    --allow-unauthenticated \
    --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID}" \
    --set-env-vars="GCP_REGION=${REGION}" \
    --memory=512Mi \
    --cpu=1 \
    --timeout=300 \
    --max-instances=10 \
    --min-instances=0 \
    --project="$PROJECT_ID"

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --platform=managed \
    --region="$REGION" \
    --format="value(status.url)" \
    --project="$PROJECT_ID")

echo -e "\n${GREEN}✅ Deployment complete!${NC}\n"
echo -e "${GREEN}Service URL: ${SERVICE_URL}${NC}\n"

# Display next steps
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure Google Chat webhook to point to: $SERVICE_URL"
echo "2. Set up secrets in Secret Manager:"
echo "   - AZURE_OPENAI_KEY"
echo "   - AZURE_OPENAI_ENDPOINT"
echo "   - (and other secrets)"
echo "3. Update Cloud Run service to use secrets:"
echo "   gcloud run services update $SERVICE_NAME \\"
echo "     --update-secrets=AZURE_OPENAI_KEY=azure-openai-key:latest \\"
echo "     --region=$REGION"
echo ""
echo "4. Test the service:"
echo "   curl $SERVICE_URL/health"

