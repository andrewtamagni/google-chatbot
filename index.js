/**
 * Google Chat Bot with Multiple AI Providers - Cloud Run Version
 * 
 * A Google Workspace Add-on that provides AI-powered responses in Google Chat
 * with support for multiple AI providers and retrieval-augmented generation (RAG).
 * 
 * Features:
 * - Google Gemini AI (default for plain messages)
 * - Azure OpenAI ChatGPT integration (/chatgpt command)
 * - Wiki search with RAG using Azure OpenAI + Azure AI Search (/wiki command)
 * - Chat history management with CosmosDB (for /wiki command)
 * - Command-based interface: /gemini, /wiki, /chatgpt, /help
 * 
 * Commands:
 * - /gemini <message> - Use Google Gemini AI
 * - /wiki <question> - Search internal wiki with RAG and chat history
 * - /chatgpt <message> - Use Azure OpenAI ChatGPT (no search)
 * - /help - Show help message
 * 
 * Configuration:
 * See ENVIRONMENT_VARIABLES.md for required environment variables.
 */

import { http } from '@google-cloud/functions-framework';
import crypto from 'crypto';
import { env } from './env.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Application configuration object.
 * Stores default settings for the application.
 * Configuration is loaded from environment variables via env.js.
 */
const CONFIG = {
  DEFAULT_AI_PROVIDER: 'gemini' // Currently only supports Gemini AI
};

// ============================================================================
// GOOGLE CHAT EVENT HANDLERS
// ============================================================================

/**
 * Main HTTP handler for Google Chat webhook events.
 * 
 * This function handles all incoming events from Google Chat and routes them
 * to the appropriate handler based on event type.
 * 
 * @param {Object} req - The HTTP request object from Google Workspace
 * @param {Object} res - The HTTP response object
 */
http('google-chat-bot', async (req, res) => {
  try {
    console.log('Received event');
    console.log('Event structure:', JSON.stringify(sanitizeForLogging(req.body), null, 2));
    
    const event = req.body;
    
    // Determine event type and route to appropriate handler
    if (event.type === 'MESSAGE' || event.chat?.messagePayload) {
      return res.send(await handleMessageEvent(event));
    } else if (event.type === 'ADDED_TO_SPACE' || event.chat?.addedToSpacePayload) {
      return res.send(handleAddedToSpaceEvent(event));
    } else if (event.type === 'REMOVED_FROM_SPACE' || event.chat?.removedFromSpacePayload) {
      return res.send(handleRemovedFromSpaceEvent(event));
    } else if (event.type === 'CARD_CLICKED' || event.action) {
      return res.send(handleActionEvent(event));
    } else if (event.type === 'SLASH_COMMAND' || event.chat?.appCommandPayload) {
      return res.send(await handleAppCommandEvent(event));
    } else {
      // Default: treat as message event
      return res.send(await handleMessageEvent(event));
    }
  } catch (error) {
    console.error('Error processing event:', error);
    return res.status(500).send(createChatResponse(`Sorry, I encountered an error: ${error.message}`));
  }
});

/**
 * Handles MESSAGE events in Google Chat.
 * 
 * @param {Object} event - The event object from Google Workspace
 * @returns {Object} Response in hostAppDataAction format
 */
async function handleMessageEvent(event) {
  try {
    console.log('handleMessageEvent: Processing message event');
    
    // Extract message data from the event structure
    const message = event.chat?.messagePayload?.message || event.message;
    const space = event.chat?.messagePayload?.space || event.space;
    const user = event.user;
    
    console.log('handleMessageEvent: Raw message text:', message?.text);
    
    // Validate that the message has text content
    if (!message?.text) {
      console.log('handleMessageEvent: No text content in message');
      return createChatResponse("I received a message without text content.");
    }
    
    // Clean the message text: remove bot mentions and trim whitespace
    let messageText = message.text
      .replace(/<@[^>]+>/g, '')  // Remove HTML-style mentions
      .replace(/@[^\s]+\s*/g, '') // Remove plain text mentions
      .trim();
    
    console.log('handleMessageEvent: Cleaned message text:', messageText);
    
    // If message is empty after cleaning, show help
    if (!messageText) {
      console.log('handleMessageEvent: Empty message after cleaning, showing help');
      return createChatResponse(getHelpMessage());
    }
    
    // Parse commands from the message text
    const commandResult = parseCommand(messageText);
    console.log('handleMessageEvent: Parsed command:', commandResult.command, 'argument:', commandResult.argument);
    
    // Route to appropriate handler
    if (commandResult.command === 'gemini') {
      return await handleAIRequest(commandResult.argument, 'gemini', space, user);
    } else if (commandResult.command === 'wiki') {
      return await handleWikiRequest(commandResult.argument, space, user);
    } else if (commandResult.command === 'chatgpt') {
      return await handleChatGPTRequest(commandResult.argument, space, user);
    } else if (commandResult.command === 'help') {
      return createChatResponse(getHelpMessage());
    } else {
      // No command found: treat entire message as AI request (default behavior)
      return await handleAIRequest(messageText, CONFIG.DEFAULT_AI_PROVIDER, space, user);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    return createChatResponse("Sorry, I encountered an error processing your message.");
  }
}

/**
 * Handles ADDED_TO_SPACE events.
 * 
 * @param {Object} event - The event object
 * @returns {Object} Welcome message
 */
function handleAddedToSpaceEvent(event) {
  const spaceName = event.chat?.addedToSpacePayload?.space?.name || 'space';
  console.log('handleAddedToSpaceEvent: Bot added to space:', spaceName);
  
  return createChatResponse(
    "Hello! I'm your AI assistant powered by Gemini. " +
    "Send me any message to get started, or type /help for commands!"
  );
}

/**
 * Handles REMOVED_FROM_SPACE events.
 * 
 * @param {Object} event - The event object
 * @returns {Object} Empty response (no response sent when removed)
 */
function handleRemovedFromSpaceEvent(event) {
  const spaceName = event.chat?.removedFromSpacePayload?.space?.name || 'space';
  console.log('handleRemovedFromSpaceEvent: Bot removed from space:', spaceName);
  // No response is sent when the bot is removed
  return createChatResponse("");
}

/**
 * Handles ACTION events from interactive cards.
 * 
 * @param {Object} event - The event object
 * @returns {Object} Response
 */
function handleActionEvent(event) {
  try {
    // Placeholder for future interactive card functionality
    return createChatResponse('Unknown action. Please try again.');
  } catch (error) {
    console.error('Error handling action:', error);
    return createChatResponse(`Sorry, I encountered an error: ${error.message}`);
  }
}

/**
 * Handles APP_COMMAND events (slash commands).
 * 
 * @param {Object} event - The event object
 * @returns {Object} Response
 */
async function handleAppCommandEvent(event) {
  try {
    console.log('handleAppCommandEvent: Processing app command event');
    
    // Extract space and user information
    const space = event.chat?.appCommandPayload?.space || 
                  event.chat?.messagePayload?.space || 
                  event.space;
    const user = event.chat?.user || event.user;
    
    // Extract raw command text
    let rawText = '';
    if (event.chat?.appCommandPayload?.message?.text) {
      rawText = event.chat.appCommandPayload.message.text;
    } else if (event.chat?.messagePayload?.message?.text) {
      rawText = event.chat.messagePayload.message.text;
    } else if (event.message?.text) {
      rawText = event.message.text;
    }
    
    // Extract argument text
    let argumentText = '';
    if (event.chat?.appCommandPayload?.message?.argumentText) {
      argumentText = event.chat.appCommandPayload.message.argumentText;
    } else if (event.message?.argumentText) {
      argumentText = event.message.argumentText;
    } else if (event.appCommand?.argumentText) {
      argumentText = event.appCommand.argumentText;
    }
    
    // Extract command ID
    const commandId = event.chat?.appCommandPayload?.appCommandMetadata?.appCommandId ||
                      event.commandId ||
                      event.appCommand?.commandId ||
                      '';
    
    console.log('handleAppCommandEvent: Command ID:', commandId);
    console.log('handleAppCommandEvent: Argument text:', argumentText);
    
    // Normalize message text
    let messageText = String(rawText || '')
      .replace(/<@[^>]+>/g, '')
      .replace(/@[^\s]+\s*/g, '')
      .trim();
    
    // Extract command name
    const commandName = event.chat?.appCommandPayload?.message?.annotations?.[0]?.slashCommand?.commandName ||
                        event.appCommand?.commandName ||
                        '';
    
    console.log('handleAppCommandEvent: Command name:', commandName);
    
    // Route by command name or text
    if (/^\/?gemini\b/i.test(messageText) || commandName === 'gemini' || commandName === '/gemini') {
      const prompt = (argumentText && argumentText.trim()) || messageText.replace(/^\/?gemini\b/i, '').trim();
      return await handleAIRequest(prompt || '', 'gemini', space, user);
    } else if (/^\/?wiki\b/i.test(messageText) || commandName === 'wiki' || commandName === '/wiki') {
      const prompt = (argumentText && argumentText.trim()) || messageText.replace(/^\/?wiki\b/i, '').trim();
      return await handleWikiRequest(prompt || '', space, user);
    } else if (/^\/?chatgpt\b/i.test(messageText) || commandName === 'chatgpt' || commandName === '/chatgpt') {
      const prompt = (argumentText && argumentText.trim()) || messageText.replace(/^\/?chatgpt\b/i, '').trim();
      return await handleChatGPTRequest(prompt || '', space, user);
    } else if (/^\/?help\b/i.test(messageText) || commandName === 'help' || commandName === '/help') {
      return createChatResponse(getHelpMessage());
    }
    
    // Fallback: try commandId mapping
    if (commandId) {
      if (commandId === '2' || String(commandId) === '2') {
        const prompt = (argumentText || '').trim();
        return await handleAIRequest(prompt || '', 'gemini', space, user);
      } else if (commandId === '3' || String(commandId) === '3') {
        return createChatResponse(getHelpMessage());
      } else if (commandId === '4' || String(commandId) === '4') {
        const prompt = (argumentText || '').trim();
        return await handleWikiRequest(prompt || '', space, user);
      } else if (commandId === '5' || String(commandId) === '5') {
        const prompt = (argumentText || '').trim();
        return await handleChatGPTRequest(prompt || '', space, user);
      }
    }
    
    // Final fallback: show help
    return createChatResponse(getHelpMessage());
  } catch (error) {
    console.error('Error handling app command:', error);
    return createChatResponse('Sorry, I could not process that command.');
  }
}

// ============================================================================
// COMMAND PARSING
// ============================================================================

/**
 * Parses a message text to extract command and argument.
 * 
 * @param {string} messageText - The raw message text
 * @returns {Object} Object with 'command' and 'argument' properties
 */
function parseCommand(messageText) {
  let trimmed = messageText
    .replace(/<@[^>]+>/g, '')
    .replace(/@[^\s]+\s*/g, '')
    .trim();
  
  trimmed = trimmed.replace(/\s+/g, ' ');
  const lower = trimmed.toLowerCase();
  
  // Check for numeric shortcuts
  const numericMatch = lower.match(/^([2-5])\s+(.*)$/);
  if (numericMatch) {
    const [, id, rest] = numericMatch;
    if (id === '2') return { command: 'gemini', argument: rest.trim() };
    if (id === '3') return { command: 'help', argument: '' };
    if (id === '4') return { command: 'wiki', argument: rest.trim() };
    if (id === '5') return { command: 'chatgpt', argument: rest.trim() };
  }
  
  // Check for slash commands
  const geminiMatch = trimmed.match(/^\/?gemini\b\s*(.*)$/i);
  if (geminiMatch) {
    return { command: 'gemini', argument: (geminiMatch[1] || '').trim() };
  }
  
  const wikiMatch = trimmed.match(/^\/?wiki\b\s*(.*)$/i);
  if (wikiMatch) {
    return { command: 'wiki', argument: (wikiMatch[1] || '').trim() };
  }
  
  const chatgptMatch = trimmed.match(/^\/?chatgpt\b\s*(.*)$/i);
  if (chatgptMatch) {
    return { command: 'chatgpt', argument: (chatgptMatch[1] || '').trim() };
  }
  
  if (/^\/?help\b/i.test(trimmed)) {
    return { command: 'help', argument: '' };
  }
  
  // No command found
  return { command: '', argument: trimmed };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Truncates text for logging.
 * 
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 200) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Sanitizes an object for logging by masking sensitive keys.
 * 
 * @param {*} obj - Object to sanitize
 * @param {number} depth - Current recursion depth
 * @returns {*} Sanitized copy
 */
function sanitizeForLogging(obj, depth = 0) {
  if (depth > 10) {
    return '[Max depth reached]';
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item, depth + 1));
  }
  
  const sanitized = {};
  const sensitiveKeys = [
    'project_key', 'user_key', 'api_key', 'apiKey', 'key', 'token',
    'access_token', 'refresh_token', 'secret', 'password', 'auth',
    'authorization', 'credentials', 'private_key', 'privateKey'
  ];
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '***MASKED***';
    } else {
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    }
  }
  
  return sanitized;
}

// ============================================================================
// AI REQUEST HANDLING
// ============================================================================

/**
 * Processes AI requests and routes them to the appropriate AI provider.
 * 
 * @param {string} messageText - The user's message text
 * @param {string} provider - AI provider to use
 * @param {Object} space - Chat space information
 * @param {Object} user - User information
 * @returns {Object} AI response in hostAppDataAction format
 */
async function handleAIRequest(messageText, provider, space, user) {
  if (!messageText || !messageText.trim()) {
    return createChatResponse("Please provide a message to process.");
  }

  try {
    if (provider !== 'gemini') {
      return createChatResponse("Only Gemini AI is currently supported.");
    }
    
    console.log(`handleAIRequest: Processing ${provider} request`);
    console.log(`handleAIRequest: Full Prompt (${messageText.length} chars):`, messageText);
    
    const response = await callGeminiAPI(messageText);
    
    console.log(`handleAIRequest: Full Response (${response.length} chars):`, response);
    
    const formattedResponse = `🤖 ${provider.toUpperCase()} Response:\n\n${response}`;
    
    return createChatResponse(formattedResponse);
  } catch (error) {
    console.error(`Error calling ${provider}:`, error);
    return createChatResponse(`Sorry, I encountered an error with the ${provider} service: ${error.message}`);
  }
}

/**
 * Calls the Google Gemini API to generate AI responses.
 * 
 * @param {string} prompt - The user's prompt
 * @returns {Promise<string>} AI-generated response text
 */
async function callGeminiAPI(prompt) {
  const apiKey = env.geminiApiKey;
  const baseUrl = env.geminiApiUrl;
  const projectId = env.projectID;
  const location = env.location;
  
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY environment variable.');
  }
  
  if (!baseUrl) {
    throw new Error('GEMINI_API_URL not configured in environment variables.');
  }
  
  // Extract model name from URL
  const modelMatch = baseUrl.match(/models\/([^:?\/]+)/);
  const modelName = modelMatch ? modelMatch[1] : 'gemini-2.0-flash-exp';
  
  console.log('callGeminiAPI: Model:', modelName);
  console.log('callGeminiAPI: Prompt length:', prompt.length, 'characters');
  console.log('callGeminiAPI: Base URL:', baseUrl);
  
  try {
    // Check if this is Google AI Studio API (generativelanguage.googleapis.com) or Vertex AI
    const isGoogleAIStudio = baseUrl.includes('generativelanguage.googleapis.com');
    
    let url, headers, payload;
    
    if (isGoogleAIStudio) {
      // Use Google AI Studio API (API key authentication)
      url = `${baseUrl}?key=${apiKey}`;
      headers = {
        'Content-Type': 'application/json'
      };
      payload = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      };
      console.log('callGeminiAPI: Using Google AI Studio API');
    } else {
      // Use Vertex AI REST API (service account authentication)
      const projectIdValue = projectId || env.projectID;
      const locationValue = location || 'us-central1';
      
      // Build Vertex AI endpoint URL for generateContent
      url = `https://${locationValue}-aiplatform.googleapis.com/v1/projects/${projectIdValue}/locations/${locationValue}/publishers/google/models/${modelName}:generateContent`;
      
      // Get access token for Vertex AI (Cloud Run has default credentials)
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      const accessToken = tokenResponse.token;
      
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      };
      payload = {
        contents: [{
          role: 'user',
          parts: [{
            text: prompt
          }]
        }]
      };
      console.log('callGeminiAPI: Using Vertex AI API');
    }
    
    console.log('callGeminiAPI: Sending request...');
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('callGeminiAPI: API request failed:', errorText);
      throw new Error(`Gemini API request failed: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    
    // Extract response text from Gemini API response format
    // Format: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
    if (responseData.candidates && responseData.candidates[0] && 
        responseData.candidates[0].content && responseData.candidates[0].content.parts && 
        responseData.candidates[0].content.parts[0]) {
      const responseText = responseData.candidates[0].content.parts[0].text;
      console.log('callGeminiAPI: Response extracted successfully');
      console.log('callGeminiAPI: Full Response (', responseText.length, 'characters):', responseText);
      return responseText;
    }
    
    throw new Error('Invalid response format from Gemini API: ' + JSON.stringify(responseData));
  } catch (error) {
    console.error('callGeminiAPI: Error:', error);
    throw new Error(`Gemini API request failed: ${error.message}`);
  }
}

// ============================================================================
// RESPONSE FORMATTING
// ============================================================================

/**
 * Creates a properly formatted response for Google Workspace Add-ons.
 * 
 * @param {string} text - The message text to send
 * @returns {Object} Response object in hostAppDataAction format
 */
function createChatResponse(text) {
  return {
    hostAppDataAction: {
      chatDataAction: {
        createMessageAction: {
          message: {
            text: text
          }
        }
      }
    }
  };
}

// ============================================================================
// HELP & UTILITIES
// ============================================================================

/**
 * Extracts the Gemini model name from the GEMINI_API_URL.
 * 
 * @returns {string} Model name or "unknown"
 */
function getGeminiModelName() {
  const baseUrl = env.geminiApiUrl;
  if (!baseUrl) {
    return 'unknown';
  }
  
  const modelMatch = baseUrl.match(/models\/([^:?\/]+)/);
  return modelMatch ? modelMatch[1] : 'unknown';
}

/**
 * Returns the help message with bot information and available commands.
 * 
 * @returns {string} Formatted help message text
 */
function getHelpMessage() {
  const geminiModel = getGeminiModelName();
  const azureModel = env.azureOpenAIModel || 'not configured';
  const searchModel = env.azureSearchOpenAIModel || azureModel;
  
  return `🤖 AI Chat Bot - Multiple AI Providers

Commands:
• /wiki [question] - Search internal wiki (Azure OpenAI + RAG) (${searchModel})
• /gemini [message] - Google Gemini AI (${geminiModel})
• /chatgpt [message] - Azure OpenAI ChatGPT (${azureModel})
• /help - Show this message

Default: Send any message to use Gemini AI automatically

Examples:
• "What's largest city in Colorado?" → Uses Gemini
• /wiki where do I view the Entra ID sign in logs? → Wiki search
• /chatgpt Write a Python function to query ldap.org.edu LDAP? → ChatGPT
• /help → This message

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 HOW TO WRITE A GOOD PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A "prompt" is the instruction you give to the AI. The quality of the answer depends on the quality of your prompt.

Instead of asking "Write an email about the server outage," try something like this:

\`\`\`
Role: "Act as a Senior IT System Administrator..."
Context: "...writing to non-technical staff about the email server outage caused by a power failure."
Task: "Draft a reassuring notification email explaining what happened."
Format: "Keep it under 100 words and use bullet points."
\`\`\``;
}

// ============================================================================
// AZURE OPENAI INTEGRATION
// ============================================================================

/**
 * Calls the Azure OpenAI API to generate AI responses.
 * 
 * @param {string} prompt - The user's prompt
 * @param {Array} chatHistory - Array of previous messages
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Response object with content and optional citations
 */
async function callAzureOpenAI(prompt, chatHistory = [], options = {}) {
  console.log('callAzureOpenAI: Starting request', options.useSearch ? 'with RAG' : 'without RAG');
  console.log('callAzureOpenAI: Full Prompt (', prompt.length, 'characters):', prompt);
  console.log('callAzureOpenAI: Chat history messages:', chatHistory.length);
  
  const endpoint = env.azureOpenAIEndpoint;
  const apiKey = env.azureOpenAIKey;
  
  // Determine which model to use
  let model = options.model;
  let modelSource = 'options.model';
  if (!model) {
    if (options.useSearch) {
      model = env.azureSearchOpenAIModel;
      modelSource = 'AZURE_SEARCH_OPENAI_MODEL';
      if (!model) {
        model = env.azureOpenAIModel;
        modelSource = 'AZURE_OPENAI_MODEL (fallback)';
        console.warn('callAzureOpenAI: AZURE_SEARCH_OPENAI_MODEL not configured, using AZURE_OPENAI_MODEL');
      }
    } else {
      model = env.azureOpenAIModel;
      modelSource = 'AZURE_OPENAI_MODEL';
    }
  }
  
  console.log('callAzureOpenAI: Model selection - Source:', modelSource, 'Model:', model);
  
  const apiVersion = env.azureOpenAIApiVersion;
  const temperature = env.azureOpenAITemperature;
  const maxTokens = env.azureOpenAIMaxTokens;
  const topP = env.azureOpenAITopP;
  const systemMessage = env.azureOpenAISystemMessage;
  
  console.log('callAzureOpenAI: Endpoint:', endpoint);
  console.log('callAzureOpenAI: Model:', model);
  console.log('callAzureOpenAI: API Version:', apiVersion);
  
  // Validate required configuration
  if (!endpoint || !apiKey || !model) {
    console.error('callAzureOpenAI: Configuration incomplete');
    throw new Error('Azure OpenAI configuration incomplete. Required: AZURE_OPENAI_ENDPOINT (or AZURE_OPENAI_RESOURCE), AZURE_OPENAI_KEY, AZURE_OPENAI_MODEL');
  }
  
  // Build messages array
  const messages = [];
  
  // Add system message only when using search
  if (options.useSearch) {
    messages.push({
      role: 'system',
      content: systemMessage
    });
  }
  
  // Add chat history
  if (chatHistory && chatHistory.length > 0) {
    messages.push(...chatHistory);
  }
  
  // Add current user message
  messages.push({
    role: 'user',
    content: prompt
  });
  
  // Build request payload
  const payload = {
    messages: messages,
    temperature: temperature,
    top_p: topP,
    model: model
  };
  
  // Add max_completion_tokens only when NOT using search
  if (!options.useSearch) {
    payload.max_completion_tokens = maxTokens;
  }
  
  // Add data sources if using search
  if (options.useSearch) {
    const dataSourceConfig = buildAzureSearchDataSource();
    if (dataSourceConfig) {
      payload.data_sources = [dataSourceConfig];
      if (dataSourceConfig.parameters) {
        console.log('callAzureOpenAI: Search config - Index:', dataSourceConfig.parameters.index_name);
        console.log('callAzureOpenAI: Search config - Query type:', dataSourceConfig.parameters.query_type);
      }
    } else {
      console.warn('callAzureOpenAI: Data source config is null - search may not be configured');
    }
  }
  
  // Build API URL
  const cleanEndpoint = endpoint.replace(/\/$/, '');
  const url = `${cleanEndpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
  
  console.log('callAzureOpenAI: Request URL:', url);
  console.log('callAzureOpenAI: Total messages in payload:', messages.length);
  
  // Make the API request
  console.log('callAzureOpenAI: Sending request...');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(payload)
  });
  
  const responseCode = response.status;
  console.log('callAzureOpenAI: Response code:', responseCode);
  
  if (responseCode !== 200) {
    const responseText = await response.text();
    console.error('callAzureOpenAI: API request failed with code', responseCode);
    console.error('callAzureOpenAI: Response text:', responseText);
    throw new Error(`Azure OpenAI API request failed with code ${responseCode}: ${responseText}`);
  }
  
  // Parse response
  const responseData = await response.json();
  
  // Extract response content and citations
  if (responseData.choices && responseData.choices.length > 0) {
    const choice = responseData.choices[0];
    const message = choice.message;
    
    // Handle different content formats
    let content = '';
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = message.content.map(block => {
        if (typeof block === 'string') return block;
        if (block && typeof block.text === 'string') return block.text;
        if (block && typeof block.content === 'string') return block.content;
        return '';
      }).join('\n');
    } else if (message.content && typeof message.content === 'object') {
      content = message.content.text || message.content.content || '';
    }
    
    const result = {
      content: content || '',
      citations: null
    };
    
    // Extract citations from context if available
    if (message.context && message.context.citations) {
      result.citations = message.context.citations;
      console.log('callAzureOpenAI: Found', result.citations.length, 'citations');
    }
    
    console.log('callAzureOpenAI: Full Response (', result.content.length, 'characters):', result.content);
    
    return result;
  } else {
    console.error('callAzureOpenAI: Invalid response format:', JSON.stringify(responseData));
    throw new Error('Invalid response format from Azure OpenAI API: ' + JSON.stringify(responseData));
  }
}

/**
 * Builds the Azure AI Search data source configuration for RAG.
 * 
 * @returns {Object|null} Data source configuration object or null
 */
function buildAzureSearchDataSource() {
  console.log('buildAzureSearchDataSource: Building search data source configuration');
  
  const searchService = env.azureSearchService;
  const searchIndex = env.azureSearchIndex;
  const searchKey = env.azureSearchKey;
  const queryType = env.azureSearchQueryType;
  const topK = env.azureSearchTopK;
  const strictness = env.azureSearchStrictness;
  const enableInDomain = env.azureSearchEnableInDomain;
  const semanticConfig = env.azureSearchSemanticSearchConfig;
  
  console.log('buildAzureSearchDataSource: Search service:', searchService);
  console.log('buildAzureSearchDataSource: Search index:', searchIndex);
  console.log('buildAzureSearchDataSource: Query type:', queryType);
  
  // Validate required configuration
  if (!searchService || !searchIndex) {
    console.warn('buildAzureSearchDataSource: Search not configured - missing service or index');
    return null;
  }
  
  // Build endpoint
  const searchEndpoint = `https://${searchService}.search.windows.net`;
  
  // Build authentication
  const authentication = searchKey ? 
    { type: 'api_key', key: searchKey } :
    { type: 'system_assigned_managed_identity' };
  
  // Build fields mapping
  const fieldsMapping = {};
  const contentColumns = env.azureSearchContentColumns;
  const vectorColumns = env.azureSearchVectorColumns;
  const titleColumn = env.azureSearchTitleColumn;
  const urlColumn = env.azureSearchUrlColumn;
  const filenameColumn = env.azureSearchFilenameColumn;
  
  if (contentColumns) {
    fieldsMapping.content_fields = contentColumns.split('|').map(c => c.trim());
  }
  if (vectorColumns) {
    fieldsMapping.vector_fields = vectorColumns.split('|').map(c => c.trim());
  }
  if (titleColumn) fieldsMapping.title_field = titleColumn;
  if (urlColumn) fieldsMapping.url_field = urlColumn;
  if (filenameColumn) fieldsMapping.filepath_field = filenameColumn;
  
  // Build embedding dependency if using vector search
  let embeddingDependency = null;
  const embeddingName = env.azureOpenAIEmbeddingName;
  if (embeddingName && (queryType.includes('vector'))) {
    embeddingDependency = {
      type: 'deployment_name',
      deployment_name: embeddingName
    };
  }
  
  // Get search common settings
  const maxSearchQueries = env.searchMaxSearchQueries;
  const allowPartialResult = env.searchAllowPartialResult;
  const includeContexts = env.searchIncludeContexts;
  
  // Build parameters object
  const parameters = {
    endpoint: searchEndpoint,
    index_name: searchIndex,
    authentication: authentication,
    top_n_documents: topK,
    strictness: strictness,
    in_scope: enableInDomain,
    query_type: queryType,
    include_contexts: includeContexts
  };
  
  // Add optional search common settings
  if (maxSearchQueries) {
    parameters.max_search_queries = parseInt(maxSearchQueries);
  }
  if (allowPartialResult) {
    parameters.allow_partial_result = allowPartialResult;
  }
  if (env.searchVectorizationDimensions) {
    parameters.vectorization_dimensions = parseInt(env.searchVectorizationDimensions);
  }
  
  // Add semantic search config if specified
  if (semanticConfig && (queryType.includes('semantic'))) {
    parameters.semantic_configuration = semanticConfig;
  }
  
  // Add fields mapping if any fields are specified
  if (Object.keys(fieldsMapping).length > 0) {
    parameters.fields_mapping = fieldsMapping;
  }
  
  // Add embedding dependency if needed
  if (embeddingDependency) {
    parameters.embedding_dependency = embeddingDependency;
    console.log('buildAzureSearchDataSource: Using embedding:', embeddingDependency.deployment_name);
  }
  
  console.log('buildAzureSearchDataSource: Configuration built successfully');
  
  return {
    type: 'azure_search',
    parameters: parameters
  };
}

// ============================================================================
// COSMOSDB CHAT HISTORY INTEGRATION
// ============================================================================

/**
 * Gets or creates a conversation ID for a user in CosmosDB.
 * 
 * @param {string} userId - The user's unique identifier
 * @param {string} conversationId - Optional existing conversation ID
 * @param {string} title - Optional conversation title
 * @returns {Promise<string>} Conversation ID
 */
async function getOrCreateConversation(userId, conversationId = null, title = '') {
  if (conversationId) {
    return conversationId;
  }
  
  const cosmosAccount = env.azureCosmosDBAccount;
  const cosmosDatabase = env.azureCosmosDBDatabase;
  const cosmosContainer = env.azureCosmosDBConversationsContainer;
  const cosmosKey = env.azureCosmosDBAccountKey;
  
  if (!cosmosAccount || !cosmosDatabase || !cosmosContainer || !cosmosKey) {
    return crypto.randomUUID();
  }
  
  try {
    const cosmosEndpoint = `https://${cosmosAccount}.documents.azure.com:443/`;
    const url = `${cosmosEndpoint}dbs/${cosmosDatabase}/colls/${cosmosContainer}/docs`;
    
    const conversation = {
      id: crypto.randomUUID(),
      type: 'conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: userId,
      title: title || 'New Conversation'
    };
    
    const authData = generateCosmosDBAuthHeader('POST', 'docs', cosmosKey, cosmosDatabase, cosmosContainer);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ms-documentdb-partitionkey': `["${userId}"]`,
        'x-ms-version': '2018-12-31',
        'Authorization': authData.auth,
        'Date': authData.date
      },
      body: JSON.stringify(conversation)
    });
    
    if (response.status === 201 || response.status === 200) {
      const result = await response.json();
      return result.id;
    } else {
      console.error('Failed to create CosmosDB conversation:', await response.text());
      return conversation.id;
    }
  } catch (error) {
    console.error('Error creating conversation:', error);
    return crypto.randomUUID();
  }
}

/**
 * Saves a message to CosmosDB chat history.
 * 
 * @param {string} userId - The user's unique identifier
 * @param {string} conversationId - The conversation ID
 * @param {string} role - Message role ('user' or 'assistant')
 * @param {string} content - Message content
 */
async function saveMessageToHistory(userId, conversationId, role, content) {
  const cosmosAccount = env.azureCosmosDBAccount;
  const cosmosDatabase = env.azureCosmosDBDatabase;
  const cosmosContainer = env.azureCosmosDBConversationsContainer;
  const cosmosKey = env.azureCosmosDBAccountKey;
  
  if (!cosmosAccount || !cosmosDatabase || !cosmosContainer || !cosmosKey) {
    return; // CosmosDB not configured
  }
  
  try {
    const cosmosEndpoint = `https://${cosmosAccount}.documents.azure.com:443/`;
    const url = `${cosmosEndpoint}dbs/${cosmosDatabase}/colls/${cosmosContainer}/docs`;
    
    const message = {
      id: crypto.randomUUID(),
      type: 'message',
      userId: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conversationId: conversationId,
      role: role,
      content: content
    };
    
    const authData = generateCosmosDBAuthHeader('POST', 'docs', cosmosKey, cosmosDatabase, cosmosContainer);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ms-documentdb-partitionkey': `["${userId}"]`,
        'x-ms-version': '2018-12-31',
        'Authorization': authData.auth,
        'Date': authData.date
      },
      body: JSON.stringify(message)
    });
    
    if (response.status !== 201 && response.status !== 200) {
      console.error('Failed to save message to CosmosDB:', await response.text());
    }
  } catch (error) {
    console.error('Error saving message to history:', error);
  }
}

/**
 * Retrieves chat history for a conversation from CosmosDB.
 * 
 * @param {string} userId - The user's unique identifier
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Array>} Array of messages
 */
async function getChatHistory(userId, conversationId) {
  const cosmosAccount = env.azureCosmosDBAccount;
  const cosmosDatabase = env.azureCosmosDBDatabase;
  const cosmosContainer = env.azureCosmosDBConversationsContainer;
  const cosmosKey = env.azureCosmosDBAccountKey;
  
  if (!cosmosAccount || !cosmosDatabase || !cosmosContainer || !cosmosKey) {
    return []; // CosmosDB not configured
  }
  
  try {
    const cosmosEndpoint = `https://${cosmosAccount}.documents.azure.com:443/`;
    const url = `${cosmosEndpoint}dbs/${cosmosDatabase}/colls/${cosmosContainer}/docs`;
    
    const query = {
      query: 'SELECT * FROM c WHERE c.conversationId = @conversationId AND c.type = @type AND c.userId = @userId ORDER BY c.createdAt ASC',
      parameters: [
        { name: '@conversationId', value: conversationId },
        { name: '@type', value: 'message' },
        { name: '@userId', value: userId }
      ]
    };
    
    const authData = generateCosmosDBAuthHeader('POST', 'docs', cosmosKey, cosmosDatabase, cosmosContainer);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/query+json',
        'x-ms-documentdb-partitionkey': `["${userId}"]`,
        'x-ms-version': '2018-12-31',
        'x-ms-documentdb-query-enablecrosspartition': 'true',
        'x-ms-documentdb-isquery': 'true',
        'Authorization': authData.auth,
        'Date': authData.date
      },
      body: JSON.stringify(query)
    });
    
    if (response.status === 200) {
      const result = await response.json();
      const messages = [];
      
      if (result.Documents && result.Documents.length > 0) {
        for (const doc of result.Documents) {
          messages.push({
            role: doc.role,
            content: doc.content
          });
        }
      }
      
      return messages;
    } else {
      const errorText = await response.text();
      console.error('Failed to retrieve chat history:', errorText);
      throw new Error(`CosmosDB error: ${errorText}`);
    }
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    throw error;
  }
}

/**
 * Generates CosmosDB authorization header and date string.
 * 
 * @param {string} verb - HTTP verb
 * @param {string} resourceType - Resource type
 * @param {string} key - Base64-encoded CosmosDB master key
 * @param {string} database - Database name
 * @param {string} container - Container name
 * @returns {Object} Object with 'auth' and 'date' properties
 */
function generateCosmosDBAuthHeader(verb, resourceType, key, database, container) {
  const date = new Date().toUTCString();
  
  const resourceId = resourceType === 'docs' 
    ? `dbs/${database}/colls/${container}` 
    : resourceType;
  
  // Build the string to sign
  const stringToSign = `${verb.toLowerCase()}\n${resourceType}\n${resourceId}\n\n${date.toLowerCase()}\n`;
  
  // Decode base64 key to buffer
  const keyBuffer = Buffer.from(key, 'base64');
  
  // Create HMAC SHA256 signature
  const signature = crypto.createHmac('sha256', keyBuffer)
    .update(stringToSign)
    .digest('base64');
  
  // Build authorization header
  const authType = 'master';
  const tokenVersion = '1.0';
  const auth = `type=${authType}&ver=${tokenVersion}&sig=${signature}`;
  
  return {
    auth: auth,
    date: date
  };
}

// ============================================================================
// WIKI AND CHATGPT COMMAND HANDLERS
// ============================================================================

/**
 * Handles /wiki command requests with RAG.
 * 
 * @param {string} prompt - The user's query
 * @param {Object} space - Chat space information
 * @param {Object} user - User information
 * @param {string} conversationId - Optional conversation ID
 * @returns {Promise<Object>} Response in hostAppDataAction format
 */
async function handleWikiRequest(prompt, space, user, conversationId = null) {
  console.log('handleWikiRequest: Processing wiki search request');
  console.log('handleWikiRequest: Prompt:', prompt);
  
  if (!prompt || !prompt.trim()) {
    return createChatResponse("Please provide a question for the wiki search.");
  }
  
  try {
    // Call Azure OpenAI with search enabled (RAG)
    const response = await callAzureOpenAI(prompt, [], {
      useSearch: true
    });
    
    console.log('handleWikiRequest: Received response from Azure OpenAI');
    console.log('handleWikiRequest: Citations found:', response.citations ? response.citations.length : 0);
    
    // Remove citation markers
    let cleanContent = response.content || '';
    const originalLength = cleanContent.length;
    cleanContent = cleanContent.replace(/\[doc\s*\d+\]/gi, '').trim();
    
    if (originalLength !== cleanContent.length) {
      console.log('handleWikiRequest: Removed citation markers');
    }
    
    // Format response
    const formattedResponse = `📚 Wiki Response:\n\n${cleanContent}`;
    
    return createChatResponse(formattedResponse);
  } catch (error) {
    console.error('Error in /wiki command:', error);
    return createChatResponse(`Sorry, I encountered an error with the wiki search: ${error.message}`);
  }
}

/**
 * Handles /chatgpt command requests using Azure OpenAI.
 * 
 * @param {string} prompt - The user's message
 * @param {Object} space - Chat space information
 * @param {Object} user - User information
 * @returns {Promise<Object>} Response in hostAppDataAction format
 */
async function handleChatGPTRequest(prompt, space, user) {
  console.log('handleChatGPTRequest: Processing ChatGPT request');
  console.log('handleChatGPTRequest: Prompt:', prompt);
  
  if (!prompt || !prompt.trim()) {
    return createChatResponse("Please provide a message for ChatGPT.");
  }
  
  try {
    const modelName = env.azureOpenAIModel || 'not configured';
    console.log('handleChatGPTRequest: Using model:', modelName);
    
    // Call Azure OpenAI without search or history
    const response = await callAzureOpenAI(prompt, [], {
      useSearch: false
    });
    
    console.log('handleChatGPTRequest: Received response from Azure OpenAI');
    console.log('handleChatGPTRequest: Response length:', response.content.length, 'characters');
    
    // Format response
    const formattedResponse = `💬 ChatGPT Response:\n\n${response.content}`;
    
    return createChatResponse(formattedResponse);
  } catch (error) {
    console.error('Error in /chatgpt command:', error);
    return createChatResponse(`Sorry, I encountered an error with ChatGPT: ${error.message}`);
  }
}