# Implementation Plan: Enhanced Google Chat Bot with Cloud Run

## Overview

This document outlines the implementation plan for migrating the Google Chat bot from Apps Script to Cloud Run and adding new features including Drive search, Vertex AI integration, model armor protection, and conversational history.

## Current Architecture

- **Platform**: Google Apps Script
- **Commands**: `/gemini`, `/wiki`, `/chatgpt`, `/help`
- **AI Providers**: Google Gemini API, Azure OpenAI
- **Storage**: CosmosDB (for wiki chat history, currently disabled)
- **Search**: Azure AI Search (for wiki RAG)

## Target Architecture

- **Platform**: Google Cloud Run (containerized service)
- **Commands**: `/gemini`, `/wiki`, `/chatgpt`, `/drive`, `/help`
- **AI Providers**: Vertex AI (Gemini), Azure OpenAI, Vertex AI Search
- **Storage**: Cloud Firestore or Cloud SQL (for conversation history)
- **Search**: Vertex AI Search (for Drive data), Azure AI Search (for wiki)
- **Security**: Model Armor for all AI requests
- **Features**: Full conversational history across all commands

---

## Phase 1: Architecture & Infrastructure Setup

### 1.1 Cloud Run Service Setup

**Objectives:**
- Create Cloud Run service to replace Apps Script
- Set up Google Chat webhook endpoint
- Configure authentication and authorization

**Tasks:**
1. Create new Cloud Run service
   - Language: Python (recommended) or Node.js
   - Region: Same as other GCP resources
   - Authentication: Require authentication (IAM)
   
2. Set up Google Chat API integration
   - Create Google Cloud project with Chat API enabled
   - Configure OAuth 2.0 credentials
   - Set up Chat app manifest
   - Configure webhook URL to Cloud Run service

3. Environment configuration
   - Use Cloud Secret Manager for API keys
   - Set environment variables for configuration
   - Configure service account with necessary permissions

**Automation:**
- ✅ **Local Setup Scripts**: `scripts/setup-local.sh` (Linux/Mac) and `scripts/setup-local.ps1` (Windows)
  - Automatically installs and configures: gcloud CLI, Docker, Python, virtual environment
  - Sets up authentication and application-default credentials
  - Creates `.env.example` template
  
- ✅ **Deployment Scripts**: `scripts/deploy-cloud-run.sh` (Linux/Mac) and `scripts/deploy-cloud-run.ps1` (Windows)
  - Automatically enables required Google Cloud APIs
  - Creates service account with necessary IAM roles
  - Builds Docker container and deploys to Cloud Run
  - Outputs service URL for configuration

- ✅ **Pulumi Configuration**: `pulumi/__main__.py`
  - Infrastructure as Code for service account and IAM roles
  - Python-based IaC (matches application language)
  - Can be used for reproducible infrastructure deployment

**Deliverables:**
- Cloud Run service deployed
- Google Chat bot connected to Cloud Run endpoint
- Basic webhook handler responding to Chat events
- Automated deployment scripts ready

**Estimated Time:** 3-5 days (reduced from 1-2 weeks due to automation)

---

### 1.2 Authentication & Authorization

**Objectives:**
- Secure Cloud Run service
- Authenticate Google Chat requests
- Manage user permissions

**Tasks:**
1. Implement request validation
   - Verify Google Chat request signatures
   - Validate OAuth tokens
   - Check user permissions

2. Service account setup
   - Create service account with minimal required permissions
   - Grant access to:
     - Vertex AI APIs
     - Cloud Storage (for Drive indexing)
     - Firestore/Cloud SQL
     - Secret Manager

3. IAM configuration
   - Set up Cloud Run IAM policies
   - Configure domain-restricted sharing (if needed)

**Deliverables:**
- Secure authentication flow
- Service account configured
- IAM policies in place

**Estimated Time:** 3-5 days

---

## Phase 2: Core Service Migration

### 2.1 Port Existing Commands to Cloud Run

**Objectives:**
- Migrate `/gemini`, `/wiki`, `/chatgpt`, `/help` commands
- Maintain existing functionality
- Improve error handling and logging

**Tasks:**
1. Port command handlers
   - `/help` - Help message handler
   - `/gemini` - Gemini AI integration
   - `/wiki` - Wiki search with RAG
   - `/chatgpt` - Azure OpenAI integration

2. Update API integrations
   - Replace Apps Script `UrlFetchApp` with `requests` (Python) or `fetch` (Node.js)
   - Update Azure OpenAI client
   - Update Gemini API client (prepare for Vertex AI migration)

3. Implement logging
   - Cloud Logging integration
   - Structured logging for debugging
   - Error tracking and monitoring

**Deliverables:**
- All existing commands working in Cloud Run
- Improved logging and error handling
- Feature parity with Apps Script version

**Estimated Time:** 2-3 weeks

---

### 2.2 Vertex AI Integration

**Objectives:**
- Migrate Gemini calls to Vertex AI
- Leverage Vertex AI features (safety settings, model selection)
- Prepare for Vertex AI Search integration

**Tasks:**
1. Set up Vertex AI
   - Enable Vertex AI API
   - Configure project and location
   - Set up authentication

2. Migrate Gemini integration
   - Replace Gemini API with Vertex AI SDK
   - Update model calls to use Vertex AI
   - Configure safety settings
   - Implement model selection (Gemini 1.5 Pro, Gemini 2.0, etc.)

3. Update `/gemini` command
   - Use Vertex AI for Gemini requests
   - Maintain backward compatibility with existing prompts
   - Add support for Vertex AI features (streaming, function calling)

**Deliverables:**
- `/gemini` command using Vertex AI
- Safety settings configured
- Model selection support

**Estimated Time:** 1-2 weeks

---

## Phase 3: Drive Search Implementation

### 3.1 Drive Data Indexing Strategy

**Objectives:**
- Index Google Drive files for search
- Choose between Vertex AI Search or custom indexing
- Design data structure for Drive metadata

**Tasks:**
1. Evaluate indexing options
   - **Option A**: Vertex AI Search (recommended)
     - Native Google integration
     - Automatic indexing from Drive
     - Built-in RAG capabilities
   - **Option B**: Custom indexing with Cloud Storage + Vector DB
     - More control over indexing
     - Custom metadata handling
     - Requires more infrastructure

2. Design data model
   - File metadata (name, ID, type, owner, permissions)
   - Content extraction (text from Docs, Sheets, PDFs)
   - Embeddings for semantic search
   - Access control information

3. Implement indexing pipeline
   - Drive API integration for file discovery
   - Content extraction (Google Workspace APIs)
   - Embedding generation (Vertex AI Embeddings API)
   - Index storage (Vertex AI Search or custom vector DB)

**Deliverables:**
- Indexing strategy selected
- Data model designed
- Indexing pipeline implemented

**Estimated Time:** 2-3 weeks

---

### 3.2 Drive Search Command Implementation

**Objectives:**
- Implement `/drive` command
- Enable semantic search across Drive files
- Respect file permissions and access control

**Tasks:**
1. Implement `/drive` command handler
   - Parse command and query
   - Authenticate user
   - Check user permissions

2. Search implementation
   - Query Vertex AI Search or custom index
   - Filter by user permissions
   - Rank results by relevance
   - Return file links and snippets

3. RAG integration
   - Use Vertex AI for RAG with Drive context
   - Include file citations in responses
   - Handle large result sets

4. Access control
   - Verify user has access to files
   - Filter search results by permissions
   - Log access attempts

**Deliverables:**
- `/drive` command functional
- Search working with permission checks
- RAG responses with citations

**Estimated Time:** 2-3 weeks

---

## Phase 4: Model Armor Implementation

### 4.1 Model Armor for Gemini (Vertex AI)

**Objectives:**
- Implement safety filters for Gemini requests
- Configure content filtering
- Handle blocked content gracefully

**Tasks:**
1. Configure Vertex AI safety settings
   - Harm categories (HARM_CATEGORY_HARASSMENT, etc.)
   - Block thresholds (BLOCK_MEDIUM_AND_ABOVE)
   - Custom safety settings per use case

2. Implement request filtering
   - Pre-filter user input for obvious violations
   - Log filtered requests
   - Return user-friendly error messages

3. Response validation
   - Check response safety scores
   - Handle blocked responses
   - Retry with adjusted settings if needed

**Deliverables:**
- Gemini requests protected with Model Armor
- Safety settings configured
- Error handling implemented

**Estimated Time:** 1 week

---

### 4.2 Model Armor for Azure OpenAI (ChatGPT)

**Objectives:**
- Implement content filtering for Azure OpenAI
- Use Azure Content Safety API
- Configure filtering policies

**Tasks:**
1. Set up Azure Content Safety
   - Enable Content Safety API
   - Configure content filters
   - Set severity levels

2. Implement request/response filtering
   - Filter user prompts before sending to OpenAI
   - Validate responses from OpenAI
   - Handle blocked content

3. Integration with `/chatgpt` command
   - Add content safety checks
   - Log safety events
   - Return appropriate error messages

**Deliverables:**
- Azure OpenAI requests protected
- Content Safety API integrated
- Filtering policies configured

**Estimated Time:** 1 week

---

## Phase 5: Conversational History

### 5.1 Storage Design

**Objectives:**
- Design conversation storage schema
- Choose storage solution (Firestore vs Cloud SQL)
- Plan for scalability

**Tasks:**
1. Evaluate storage options
   - **Option A**: Cloud Firestore (recommended for Chat)
     - NoSQL, document-based
     - Real-time capabilities
     - Easy integration with Cloud Run
   - **Option B**: Cloud SQL (PostgreSQL/MySQL)
     - SQL queries
     - Better for complex queries
     - More traditional approach

2. Design data schema
   - Conversation documents
     - conversationId, userId, spaceId, createdAt, updatedAt
   - Message documents
     - messageId, conversationId, role, content, timestamp, metadata
   - User context
     - userId, preferences, settings

3. Implement storage layer
   - Create database client
   - Implement CRUD operations
   - Set up indexes for queries

**Deliverables:**
- Storage solution selected
- Schema designed
- Storage layer implemented

**Estimated Time:** 1-2 weeks

---

### 5.2 Conversation Management

**Objectives:**
- Implement conversation tracking
- Support multi-turn conversations
- Manage conversation context

**Tasks:**
1. Conversation lifecycle
   - Create new conversations
   - Retrieve conversation history
   - Update conversations
   - Archive old conversations

2. Context management
   - Maintain conversation context across messages
   - Include relevant history in AI requests
   - Manage context window limits
   - Summarize long conversations

3. Integration with commands
   - `/gemini` - Include conversation history
   - `/wiki` - Include conversation history
   - `/chatgpt` - Include conversation history
   - `/drive` - Include conversation history
   - Support conversation switching (if needed)

**Deliverables:**
- Conversation tracking implemented
- History included in all AI requests
- Context management working

**Estimated Time:** 2-3 weeks

---

## Phase 6: Testing & Deployment

### 6.1 Testing Strategy

**Objectives:**
- Comprehensive testing of all features
- Performance testing
- Security testing

**Tasks:**
1. Unit tests
   - Test individual functions
   - Mock external APIs
   - Test error handling

2. Integration tests
   - Test command handlers
   - Test API integrations
   - Test storage operations

3. End-to-end tests
   - Test full user flows
   - Test in Google Chat environment
   - Test with real Drive files

4. Performance testing
   - Load testing
   - Response time optimization
   - Resource usage monitoring

5. Security testing
   - Penetration testing
   - Access control verification
   - Data privacy checks

**Deliverables:**
- Test suite implemented
- All tests passing
- Performance benchmarks met

**Estimated Time:** 2-3 weeks

---

### 6.2 Deployment & Migration

**Objectives:**
- Deploy Cloud Run service to production
- Migrate from Apps Script
- Monitor and optimize

**Tasks:**
1. Production deployment
   - Deploy Cloud Run service
   - Configure production environment
   - Set up monitoring and alerts

2. Migration plan
   - Run both systems in parallel
   - Gradual migration of users
   - Data migration (if needed)
   - Decommission Apps Script version

3. Monitoring setup
   - Cloud Monitoring dashboards
   - Error alerting
   - Performance metrics
   - Cost monitoring

4. Documentation
   - Update README
   - API documentation
   - Deployment guide
   - Troubleshooting guide

**Deliverables:**
- Production deployment complete
- Apps Script version decommissioned
- Monitoring in place
- Documentation updated

**Estimated Time:** 1-2 weeks

---

## Technical Stack Recommendations

### Backend
- **Language**: Python 3.11+ (recommended) or Node.js 20+
- **Framework**: 
  - Python: FastAPI or Flask
  - Node.js: Express.js
- **Cloud Platform**: Google Cloud Platform
- **Runtime**: Cloud Run

### AI Services
- **Gemini**: Vertex AI (Gemini API)
- **ChatGPT**: Azure OpenAI
- **Search**: Vertex AI Search (for Drive), Azure AI Search (for Wiki)
- **Embeddings**: Vertex AI Embeddings API

### Storage
- **Conversations**: Cloud Firestore (recommended) or Cloud SQL
- **Secrets**: Cloud Secret Manager
- **Files**: Google Drive API

### Security
- **Model Armor**: Vertex AI Safety Settings, Azure Content Safety
- **Authentication**: Google OAuth 2.0, Service Account
- **Authorization**: IAM, Domain-restricted sharing

### Monitoring
- **Logging**: Cloud Logging
- **Monitoring**: Cloud Monitoring
- **Tracing**: Cloud Trace
- **Error Reporting**: Error Reporting

---

## Implementation Timeline

### Phase 1: Infrastructure (3-4 weeks)
- Week 1-2: Cloud Run setup, Chat API integration
- Week 3-4: Authentication, IAM, service accounts

### Phase 2: Core Migration (3-4 weeks)
- Week 1-2: Port existing commands
- Week 3-4: Vertex AI integration

### Phase 3: Drive Search (4-5 weeks)
- Week 1-2: Indexing strategy and implementation
- Week 3-4: Search command implementation
- Week 5: Testing and refinement

### Phase 4: Model Armor (2 weeks)
- Week 1: Vertex AI safety settings
- Week 2: Azure Content Safety

### Phase 5: Conversation History (3-4 weeks)
- Week 1-2: Storage design and implementation
- Week 3-4: Conversation management

### Phase 6: Testing & Deployment (3-4 weeks)
- Week 1-2: Testing
- Week 3-4: Deployment and migration

**Total Estimated Time: 18-23 weeks (4.5-6 months)**

---

## Risk Mitigation

### Technical Risks
1. **Cloud Run cold starts**
   - Mitigation: Use minimum instances, optimize container startup
   
2. **Drive API rate limits**
   - Mitigation: Implement caching, batch requests, use quotas

3. **Cost overruns**
   - Mitigation: Set up billing alerts, optimize resource usage, use committed use discounts

4. **Data migration complexity**
   - Mitigation: Plan migration carefully, test thoroughly, have rollback plan

### Security Risks
1. **Unauthorized access to Drive files**
   - Mitigation: Strict permission checks, audit logging, regular security reviews

2. **Data leakage**
   - Mitigation: Encrypt data at rest, use secure connections, implement data retention policies

3. **Model abuse**
   - Mitigation: Model Armor, rate limiting, content filtering

---

## Success Criteria

1. ✅ All existing commands working in Cloud Run
2. ✅ `/drive` command functional with search
3. ✅ Vertex AI integrated for Gemini
4. ✅ Model Armor protecting all AI requests
5. ✅ Conversational history working across all commands
6. ✅ Performance meets or exceeds Apps Script version
7. ✅ Security requirements met
8. ✅ Documentation complete
9. ✅ Apps Script version successfully decommissioned

---

## Automation & Scripts

### Available Automation Scripts

All automation scripts are located in the `scripts/` directory:

#### Local Development Setup
- **`setup-local.sh`** (Linux/Mac): Automated local environment setup
- **`setup-local.ps1`** (Windows): PowerShell version for Windows

**What they do:**
- Check and install required tools (gcloud CLI, Docker, Python 3.11+)
- Create Python virtual environment
- Install Python dependencies from `requirements.txt`
- Configure Google Cloud authentication
- Create `.env.example` template

**Usage:**
```bash
# Linux/Mac
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh

# Windows
.\scripts\setup-local.ps1
```

#### Cloud Run Deployment
- **`deploy-cloud-run.sh`** (Linux/Mac): Automated Cloud Run deployment
- **`deploy-cloud-run.ps1`** (Windows): PowerShell version for Windows

**What they do:**
- Enable required Google Cloud APIs automatically
- Create service account with necessary IAM roles
- Build Docker container image
- Deploy to Cloud Run with proper configuration
- Output service URL for webhook configuration

**Usage:**
```bash
# Linux/Mac
chmod +x scripts/deploy-cloud-run.sh
./scripts/deploy-cloud-run.sh

# Windows
.\scripts\deploy-cloud-run.ps1
```

#### Infrastructure as Code (Optional)
- **`pulumi/__main__.py`**: Pulumi configuration for infrastructure
- **`pulumi/Pulumi.dev.yaml`**: Example configuration file

**What it does:**
- Defines service account and IAM roles
- Enables required APIs
- Provides reproducible infrastructure deployment
- Python-based (matches application language)

**Usage:**
```bash
cd pulumi
pip install -r requirements.txt
# Edit Pulumi.dev.yaml with your values
pulumi preview
pulumi up
```

**Note**: Pulumi is optional. The deployment scripts can create everything via `gcloud` CLI commands. Pulumi provides Infrastructure as Code benefits like versioning and state management.

### Google Cloud CLI Commands

All resources can be created via `gcloud` CLI:

**APIs:**
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com aiplatform.googleapis.com chat.googleapis.com
```

**Service Account:**
```bash
gcloud iam service-accounts create chatbot-service --display-name="Chatbot Service Account"
gcloud projects add-iam-policy-binding PROJECT_ID --member="serviceAccount:chatbot-service@PROJECT_ID.iam.gserviceaccount.com" --role="roles/aiplatform.user"
```

**Cloud Run Deployment:**
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/chatbot-service
gcloud run deploy chatbot-service --image=gcr.io/PROJECT_ID/chatbot-service --platform=managed --region=us-central1
```

### Benefits of Automation

1. **Consistency**: Same setup across all environments
2. **Speed**: Reduces setup time from hours to minutes
3. **Documentation**: Scripts serve as executable documentation
4. **Reproducibility**: Easy to recreate infrastructure
5. **Error Reduction**: Automated checks prevent common mistakes

## Next Steps

1. ✅ **Automation scripts created** - Ready for use
2. Review and approve this implementation plan
3. Create new GitHub branch for Cloud Run development
4. Run `setup-local.sh` or `setup-local.ps1` to set up development environment
5. Configure `.env` file with your values
6. Run `deploy-cloud-run.sh` or `deploy-cloud-run.ps1` to deploy Cloud Run service
7. Begin Phase 1: Infrastructure setup (now automated)
8. Schedule regular check-ins and reviews
9. Adjust plan as needed based on learnings

---

## Questions to Consider

1. **Drive Indexing Scope**: 
   - Index all Drive files or specific folders/domains?
   - How to handle file updates and deletions?
   - What file types to index?

2. **Conversation History**:
   - How long to retain conversations?
   - Should conversations be shared across spaces?
   - How to handle conversation cleanup?

3. **Model Armor**:
   - What safety levels to use?
   - How to handle false positives?
   - User notification for blocked content?

4. **Migration Strategy**:
   - Big bang or gradual migration?
   - How to handle users during migration?
   - Rollback plan?

5. **Cost Management**:
   - Budget constraints?
   - Cost optimization priorities?
   - Usage monitoring and alerts?

