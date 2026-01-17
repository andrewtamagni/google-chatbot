# Google Chat Bot with Multiple AI Providers

A Google Workspace Add-on that provides an AI-powered chatbot for Google Chat with support for multiple AI providers and retrieval-augmented generation (RAG). This bot can be added to team spaces and direct messages to provide intelligent responses.

## Features

- 🤖 **Gemini AI Integration** - Powered by Google's advanced AI models (default)
- 💬 **Azure OpenAI ChatGPT** - Direct access to Azure OpenAI GPT-5.1 models via `/chatgpt` command
- 📚 **Wiki Search with RAG** - Search internal wiki using Azure OpenAI GPT-4 + Azure AI Search via `/wiki` command (GPT-4 required as GPT-5 models don't support data_sources yet)
- 🔄 **Chat History** - CosmosDB integration for conversation history (for `/wiki` command)
- 💬 **Google Chat Integration** - Responds to messages in Google Chat spaces
- ⚡ **Command-based** - Multiple commands: `/gemini`, `/wiki`, `/chatgpt`, `/help`
- 📎 **Google Drive File Attachment** - Native support for attaching Drive files via Chat's built-in attachment feature
- 🔧 **Easy Configuration** - Set API keys via Script Properties
- 📝 **Help System** - Built-in help command with `/help`
- 🚀 **Local Development** - Full IDE support with Apps Script CLI
- 📚 **Well-Documented** - Comprehensive code comments and documentation

## Quick Start

### Option 1: Traditional Setup (Browser-based)
1. Go to [script.google.com](https://script.google.com)
2. Create a new project
3. Copy the code from `Code.js`
4. Configure API keys in Script Properties
5. Deploy as a Google Workspace Add-on

### Option 2: Local Development with CLI (Recommended)
Follow the detailed setup below for a better development experience.

## Detailed Setup Instructions

### Prerequisites

- Node.js installed on your system
- Google account with access to Google Cloud Console
- Google Apps Script project (we'll create this)

### Step 1: Install Apps Script CLI

```bash
npm install -g @google/clasp
```

### Step 2: Enable Apps Script API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Library**
4. Search for "Apps Script API"
5. Click **Enable**

### Step 3: Authenticate with Google

```bash
clasp login
```

This will open a browser window for you to sign in with your Google account.

### Step 4: Create Apps Script Project

```bash
clasp create --title "Chatbot" --type standalone
```

This will:
- Create a new Google Apps Script project
- Generate a `.clasp.json` file with your project ID
- Set up the connection between your local files and Google

### Step 5: Configure Your Project

The `.clasp.json` file should look like this:
```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "."
}
```

### Step 6: Push Your Code

```bash
clasp push
```

This uploads your local `Code.js` file to Google Apps Script.

### Step 7: Configure API Keys

1. Go to [script.google.com](https://script.google.com)
2. Open your project
3. Go to **Project Settings** (gear icon)
4. Click **Script Properties** tab
5. Add these properties:
   - `GEMINI_API_KEY`: Your Google AI Studio API key
   - `GEMINI_API_URL`: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`
   
   For `/wiki` and `/chatgpt` commands, also configure:
   - Azure OpenAI properties (see `ENVIRONMENT_VARIABLES.md`)
   - Azure AI Search properties (for `/wiki` RAG functionality)

### Step 8: Get Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the generated key
4. Paste it into your Script Properties

### Step 9: Deploy as Google Workspace Add-on

1. In your Apps Script project, click **Deploy** → **New deployment**
2. Choose **Add-on** as the type
3. Set execution as **Me**
4. Click **Deploy**
5. Copy the deployment ID

### Step 10: Configure Google Chat Triggers

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 client ID
4. Go to **Google Chat API** → **Configuration**
5. Set up the following triggers:
   - **Message**: `onMessage`
   - **Added to space**: `onAddedToSpace`
   - **Removed from space**: `onRemovedFromSpace`
   - **App command**: `onAppCommand`

## Development Workflow

### Making Changes

1. **Edit locally** in your favorite IDE (like Cursor)
2. **Test your changes** (optional)
3. **Push to Google**: `clasp push`
4. **Deploy updates**: `clasp deploy` (if needed)

### Useful Commands

```bash
# Push changes to Google Apps Script
clasp push

# Pull latest changes from Google Apps Script
clasp pull

# Deploy a new version
clasp deploy

# Open the project in browser
clasp open

# View execution logs
clasp logs

# List all deployments
clasp deployments
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
3. Check the execution logs in Apps Script for any issues
4. Verify the bot responds correctly

## Troubleshooting

### Common Issues

1. **"API key not configured" error**
   - Verify `GEMINI_API_KEY` is set in Script Properties
   - Check the property name matches exactly

2. **"Invalid response from API" error**
   - Verify your API key is valid
   - Check that the Gemini API URL is correct
   - Ensure you have access to the Gemini 2.5 Pro model
   - For `/wiki` or `/chatgpt`: Verify Azure OpenAI configuration in Script Properties
   - For `/chatgpt`: Ensure `AZURE_OPENAI_MODEL` is set to a GPT-5.1 deployment
   - For `/wiki`: Ensure `AZURE_SEARCH_OPENAI_MODEL` is set to a GPT-4 model (GPT-5 models don't support data_sources)

3. **Bot not responding in Google Chat**
   - Verify the bot is properly deployed as a Google Workspace Add-on
   - Check that triggers are configured correctly in Google Cloud Console
   - Ensure the bot has permission to access the space

4. **"Invalid add-on response returned" error**
   - This usually means the response format is incorrect
   - The bot uses `hostAppDataAction` format for Google Workspace Add-ons
   - Check the execution logs for detailed error messages

### Debugging

1. Use `console.log()` statements in your code for debugging
2. Check the **Executions** tab in Apps Script for detailed logs
3. Verify Script Properties are set correctly (GEMINI_API_KEY and GEMINI_API_URL)
4. Check that the bot is properly deployed and triggers are configured

## File Structure

```
ito-google-chatbot/
├── Code.js              # Main chatbot code
├── appsscript.json      # Apps Script manifest
├── .clasp.json         # CLI configuration (auto-generated)
├── .cursorrules        # Cursor IDE rules for AI assistant guidance
├── README.md           # This file
├── SETUP_EXAMPLES.md   # Guide for setting up Google Apps Script examples reference
└── setup-examples.ps1  # PowerShell script to clone examples repository
```

### New Files Explained

- **`.cursorrules`** - Contains project-specific rules and context for the Cursor AI assistant. This helps guide code suggestions to follow Apps Script best practices, reference the examples repository, and maintain consistency with your project structure.

- **`SETUP_EXAMPLES.md`** - Comprehensive guide for connecting Google's official Apps Script examples repository to your workspace. This enables the AI assistant to reference official Google examples when helping with your code. Essential for leveraging examples from Google's `apps-script-samples` repository (Chat, Triggers, etc.).

- **`setup-examples.ps1`** - Automated PowerShell script that clones the Google Apps Script samples repository to your workspace parent directory. Run this script to quickly set up the examples reference. See `SETUP_EXAMPLES.md` for detailed instructions.

## Security Notes

- ✅ **API keys stored in Script Properties** - Never in code
- ✅ **No sensitive data in version control** - Keys are managed separately
- ✅ **Google's security model** - Leverages Google's authentication
- ⚠️ **Monitor API usage** - Set up billing alerts for Gemini API
- ⚠️ **Rate limiting** - Consider implementing for production use

## Customization

### Changing the AI Model

Edit the `GEMINI_API_URL` in Script Properties:
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent
```

### Modifying Response Format

Edit the `createChatResponse()` function to change how responses appear in Google Chat.

### Adding New Commands

1. Add command detection in `parseCommand()` function
2. Add routing logic in `onMessage()` and `onAppCommand()` handlers
3. Create a handler function for the new command
4. Update the `getHelpMessage()` function to include the new command
5. Register the command in Google Cloud Console (if using slash commands)

## Support

For issues with:
- **Google Apps Script**: [Apps Script documentation](https://developers.google.com/apps-script)
- **Google Chat**: [Google Chat API documentation](https://developers.google.com/chat)
- **Gemini API**: [Google AI documentation](https://ai.google.dev/docs)
- **Apps Script CLI**: [clasp documentation](https://github.com/google/clasp)

## License

This project is open source and available under the MIT License.