# Setting Up Reference Repositories

This guide will help you set up all reference repositories for your Cursor workspace.

## Repositories

1. **Google Apps Script Samples** - [https://github.com/googleworkspace/apps-script-samples](https://github.com/googleworkspace/apps-script-samples)
2. **EIP Chatbot** - [https://github.com/yourorg/eipchatbot](https://github.com/yourorg/eipchatbot)
3. **EIP AI Search Update** - [https://github.com/andrewtamagni/ai-search-update](https://github.com/andrewtamagni/ai-search-update)

## Option 1: Automated Setup (Recommended)

Use the provided PowerShell script to automatically clone all repositories:

```powershell
# Run from the Cursor directory
cd Cursor
.\setup-examples.ps1
```

This script will clone all three repositories to your parent directory:
- `apps-script-samples/` - Google Apps Script examples
- `eipchatbot/` - EIP Azure OpenAI chatbot
- `eip-ai-search-update/` - EIP AI Search index management

## Option 2: Manual Setup

### Step 1: Clone All Repositories

Navigate to your workspace parent directory and clone all repos:

```bash
# Navigate to parent directory of your project
cd C:\Users\andrewta\Documents\Github

# Clone Google's official Apps Script samples repository
git clone https://github.com/googleworkspace/apps-script-samples.git

# Clone EIP Chatbot repository
git clone https://github.com/yourorg/eipchatbot.git

# Clone EIP AI Search Update repository
git clone https://github.com/andrewtamagni/ai-search-update.git
```

### Repository Contents

**apps-script-samples** contains examples for:
- **Chat** (perfect for your Google Chat bot!)
- **Drive** (for your Drive integration)
- **Gmail**, **Sheets**, **Docs**, **Slides**
- **Triggers**, **Templates**, **Advanced Services**
- And many more Google Workspace APIs

**eipchatbot** contains:
- Azure OpenAI integration patterns
- Chat interface and conversation handling
- Azure AI Search integration for RAG
- CosmosDB for chat history
- Frontend/backend architecture examples

**eip-ai-search-update** contains:
- Azure AI Search index management
- Content processing and indexing workflows
- PII detection and redaction patterns
- Azure Blob Storage integration

### Step 2: Add to Cursor Workspace

**Option A: Use Workspace File (Recommended)**
- Open `Cursor/ito-google-chatbot.code-workspace` in Cursor
- This workspace file already includes all three repositories
- All folders will appear in your workspace sidebar automatically

**Option B: Manual Addition**
1. In Cursor, go to **File** → **Add Folder to Workspace...**
2. Navigate to and select each cloned repository folder
3. All folders will now appear in your workspace sidebar

### Step 3: Using in Cursor

- Use `@` mentions in Cursor chat to reference files from any repository
- Examples:
  - `@apps-script-samples/chat/filename.js explain this code`
  - `@eipchatbot/app.py show me the Azure OpenAI integration`
  - `@eip-ai-search-update/aiIndexUpdate_V2.py how does PII detection work?`
- The AI will have context from all repositories in your workspace

## Option 3: Create a Reference Directory

If the examples are in a different format or location:

1. Create a `references/` folder in your project
2. Copy or clone relevant example files there
3. Add a `.gitignore` entry to exclude them from your repo:

```
references/
```

## Option 4: Use Symbolic Links (Windows)

Create a symbolic link to the examples repo:

```powershell
# Run PowerShell as Administrator
New-Item -ItemType SymbolicLink -Path ".\examples" -Target "C:\path\to\apps-script-samples"
```

Then add the `examples` folder to your workspace.

## Quick Start

### Automated Setup (Easiest)

Run the PowerShell script from the Cursor directory:

```powershell
cd Cursor
.\setup-examples.ps1
```

This will clone all three repositories automatically.

### Manual Verification

✅ Repositories should be cloned to:
   - `C:\Users\andrewta\Documents\Github\apps-script-samples`
   - `C:\Users\andrewta\Documents\Github\eipchatbot`
   - `C:\Users\andrewta\Documents\Github\eip-ai-search-update`

### Next Steps:

1. **Open Workspace in Cursor**:
   - Open `Cursor/ito-google-chatbot.code-workspace` in Cursor
   - All repositories will appear in your workspace sidebar automatically
   - Or manually add folders: **File** → **Add Folder to Workspace...**

2. **Enable Agent Mode in Cursor**:
   - Press `Ctrl+I` to open the Agent side pane
   - Select "Agent" mode from the mode picker dropdown
   - You can now reference all repositories in your conversations

3. **Using Repositories in Agent**:
   - Type `@apps-script-samples/chat/` and see available Chat examples
   - Type `@eipchatbot/` to reference EIP chatbot patterns
   - Type `@eip-ai-search-update/` to reference search index patterns
   - Ask questions like: "How does the Chat example handle onMessage events?"
   - Reference specific files: "Compare my onMessage handler with @apps-script-samples/chat/"

## Key Directories in the Repositories

### apps-script-samples/
Based on your project (Google Chat bot with Gemini AI & Drive), these directories are most relevant:

- **`chat/`** - Google Chat bot examples (most relevant for your project!)
- **`drive/`** - Google Drive API examples (for your Drive search feature)
- **`triggers/`** - Trigger examples (onMessage, onEdit, etc.)
- **`templates/`** - Project templates and frameworks
- **`advanced/`** - Advanced services usage

### eipchatbot/
Key files and directories:

- **`app.py`** - Main Flask/Quart application with Azure OpenAI integration
- **`backend/`** - Backend services (auth, history, settings)
- **`frontend/`** - React frontend components
- **`backend/history/`** - CosmosDB chat history implementation
- **`backend/settings/`** - Configuration management

### eip-ai-search-update/
Key files:

- **`aiIndexUpdate_V2.py`** - Main script for updating Azure AI Search indexes
- **`aiIndexUpdate.py`** - Original version (legacy)
- **`README.md`** - Setup and configuration instructions

## Additional Resources

Google also provides Apps Script examples in:

1. **Official Documentation**:
   - https://developers.google.com/apps-script/samples
   - https://developers.google.com/apps-script/guides

2. **Sample Templates**:
   - Google Apps Script editor → Extensions → Browse sample add-ons

## Using with Cursor Agent

Once all repositories are in your workspace:

1. **Enable Agent Mode**: Press `Ctrl+I` and select "Agent" mode
2. **Reference Files**: Use `@` to mention specific files from any repository
   - `@apps-script-samples/chat/on-message.js`
   - `@eipchatbot/app.py`
   - `@eip-ai-search-update/aiIndexUpdate_V2.py`
3. **Ask Questions**: 
   - "How does the example in `@apps-script-samples/chat/` handle message events?"
   - "Show me how `@eipchatbot` integrates with Azure OpenAI"
   - "How does `@eip-ai-search-update` handle PII detection?"
4. **Compare Code**: Ask Cursor to compare your implementation with examples from any repository
5. **Cross-Reference**: Ask questions that span multiple repos, like "How do both eipchatbot and my project handle AI responses?"

## Best Practices

- Keep reference repositories read-only if they're reference material
- The `.cursorrules` file in `Cursor/` already references these repositories for AI context
- Your workspace file (`Cursor/ito-google-chatbot.code-workspace`) includes all three repositories
- Consider creating a `docs/` folder with notes about which examples relate to your features
- Update repositories periodically: `git pull` in each repository directory to get latest changes
