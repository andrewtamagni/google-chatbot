/**
 * Google Chat Bot with Multiple AI Providers
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
 * See ENVIRONMENT_VARIABLES.md for required Script Properties.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Application configuration object.
 * Stores default settings for the application.
 * API keys are stored in Script Properties for security (never hardcoded).
 */
const CONFIG = {
  DEFAULT_AI_PROVIDER: 'gemini' // Currently only supports Gemini AI
};

// ============================================================================
// GOOGLE CHAT EVENT HANDLERS
// ============================================================================

/**
 * Responds to a MESSAGE event in Google Chat.
 * This is the main handler that processes all incoming text messages from users.
 * 
 * Event Structure:
 * - event.chat.messagePayload.message: Contains the message text and metadata
 * - event.chat.messagePayload.space: Contains information about the Chat space
 * - event.user: Contains information about the user who sent the message
 * 
 * @param {Object} event - The event object from Google Workspace Add-on
 * @returns {Object} Response in hostAppDataAction format for Google Chat
 */
function onMessage(event) {
  try {
    console.log('onMessage: Event received');
    // Log sanitized event structure for debugging (masks sensitive keys like project_key, user_key)
    console.log('onMessage: Event structure:', JSON.stringify(sanitizeForLogging(event), null, 2));
    
    // Extract message data from the event structure
    // Google Chat events nest message data in event.chat.messagePayload
    const message = event.chat?.messagePayload?.message;
    const space = event.chat?.messagePayload?.space;
    const user = event.user;
    
    console.log('onMessage: Raw message text:', message?.text);
    // Log sanitized space and user info (masks sensitive keys)
    if (space) {
      console.log('onMessage: Space info:', JSON.stringify(sanitizeForLogging(space), null, 2));
    }
    if (user) {
      console.log('onMessage: User info:', JSON.stringify(sanitizeForLogging(user), null, 2));
    }
    
    // Validate that the message has text content
    // Messages without text (e.g., only images or Drive attachments) are not processed
    // Note: Drive file attachments are handled natively by Google Chat, not in this code
    if (!message?.text) {
      console.log('onMessage: No text content in message');
      return createChatResponse("I received a message without text content.");
    }
    
    // Clean the message text: remove bot mentions and trim whitespace
    // Bot mentions come in format like "<@users/1234567890>" or "@CHATBOT" and should be removed
    // Handle both HTML-style mentions and plain text mentions
    let messageText = message.text
      .replace(/<@[^>]+>/g, '')  // Remove HTML-style mentions like <@users/123>
      .replace(/@[^\s]+\s*/g, '') // Remove plain text mentions like @CHATBOT
      .trim();
    
    console.log('onMessage: Cleaned message text:', messageText);
    
    // If message is empty after cleaning (e.g., only contained a mention), show help
    if (!messageText) {
      console.log('onMessage: Empty message after cleaning, showing help');
      return createChatResponse(getHelpMessage());
    }
    
    // Parse commands from the message text
    // Supports slash commands (/gemini, /help) and numeric shortcuts (2=gemini, 3=help)
    const commandResult = parseCommand(messageText);
    console.log('onMessage: Parsed command:', commandResult.command, 'argument:', commandResult.argument);
    
    // Route to appropriate handler based on parsed command
    if (commandResult.command === 'gemini') {
      // Explicit Gemini command: use the argument as the prompt
      return handleAIRequest(commandResult.argument, 'gemini', space, user);
    } else if (commandResult.command === 'wiki') {
      // Wiki command: use Azure OpenAI with search and history
      return handleWikiRequest(commandResult.argument, space, user);
    } else if (commandResult.command === 'chatgpt') {
      // ChatGPT command: use Azure OpenAI without search or history
      return handleChatGPTRequest(commandResult.argument, space, user);
    } else if (commandResult.command === 'help') {
      // Help command: display help message
      return createChatResponse(getHelpMessage());
    } else {
      // No command found: treat entire message as AI request (default behavior)
      return handleAIRequest(messageText, CONFIG.DEFAULT_AI_PROVIDER, space, user);
    }
    
  } catch (error) {
    // Log error for debugging and return user-friendly error message
    console.error('Error processing message:', error);
    return createChatResponse("Sorry, I encountered an error processing your message.");
  }
}

/**
 * Responds to an ADDED_TO_SPACE event in Google Chat.
 * Triggered automatically when the bot is added to a Chat space or direct message.
 * 
 * This function sends a welcome message to introduce the bot to users.
 * 
 * @param {Object} event - The event object from Google Workspace Add-on
 * @returns {Object} Welcome message in hostAppDataAction format
 */
function onAddedToSpace(event) {
  const spaceName = event.chat?.addedToSpacePayload?.space?.name || 'space';
  console.log('onAddedToSpace: Bot added to space:', spaceName);
  
  return createChatResponse(
    "Hello! I'm your AI assistant powered by Gemini. " +
    "Send me any message to get started, or type /help for commands!"
  );
}

/**
 * Responds to a REMOVED_FROM_SPACE event in Google Chat.
 * Triggered automatically when the bot is removed from a Chat space.
 * 
 * No response is sent when the bot is removed, but we log the event for tracking.
 * 
 * @param {Object} event - The event object from Google Workspace Add-on
 */
function onRemovedFromSpace(event) {
  const spaceName = event.chat?.removedFromSpacePayload?.space?.name || 'space';
  console.log('onRemovedFromSpace: Bot removed from space:', spaceName);
  // No response is sent as the bot is being removed from the space
  // This function is required by Google Chat API but doesn't need to return anything
}

/**
 * Responds to ACTION events from Google Chat interactive cards.
 * This handles button clicks and form submissions from card-based UI elements.
 * 
 * Currently, this bot does not use interactive cards, so this handler
 * is a placeholder for future functionality.
 * 
 * @param {Object} event - The event object from Google Workspace Add-on
 * @returns {Object} Response in hostAppDataAction format
 */
function onAction(event) {
  try {
    // Placeholder for future interactive card functionality
    // Currently, this bot does not use interactive cards
    return createChatResponse('Unknown action. Please try again.');
    
  } catch (error) {
    console.error('Error handling action:', error);
    return createChatResponse(`Sorry, I encountered an error: ${error.message}`);
  }
}

/**
 * Responds to an APP_COMMAND event in Google Chat.
 * Handles slash commands like /gemini and /help when users explicitly invoke them.
 * 
 * This handler processes slash commands that are registered in Google Chat.
 * The event structure can vary, so we check multiple possible locations for command data.
 * 
 * @param {Object} event - The event object from Google Workspace Add-on
 * @returns {Object} Response in hostAppDataAction format
 */
function onAppCommand(event) {
  try {
    console.log('onAppCommand: Event received');
    // Log sanitized event structure for debugging (masks sensitive keys like project_key, user_key)
    console.log('onAppCommand: Event structure:', JSON.stringify(sanitizeForLogging(event), null, 2));
    
    // Extract space and user information from various possible event structures
    // Google Chat events can have different shapes depending on how the command was invoked
    const space = (event && event.chat && event.chat.appCommandPayload && event.chat.appCommandPayload.space) 
                  ? event.chat.appCommandPayload.space 
                  : (event && event.chat && event.chat.messagePayload && event.chat.messagePayload.space) 
                    ? event.chat.messagePayload.space 
                    : (event && event.space ? event.space : null);
    const user = (event && event.chat && event.chat.user) 
                 ? event.chat.user 
                 : (event && event.user ? event.user : null);

    // Extract the raw command text from various possible locations in the event
    // Different Chat API versions or invocation methods may nest the text differently
    let rawText = '';
    // Check appCommandPayload structure first (newer format)
    if (event && event.chat && event.chat.appCommandPayload && event.chat.appCommandPayload.message && event.chat.appCommandPayload.message.text) {
      rawText = event.chat.appCommandPayload.message.text || '';
    } else if (event && event.chat && event.chat.messagePayload && event.chat.messagePayload.message && event.chat.messagePayload.message.text) {
      rawText = event.chat.messagePayload.message.text || '';
    } else if (event && event.message && event.message.text) {
      rawText = event.message.text || '';
    }
    
    console.log('onAppCommand: Raw text:', rawText);
    // Log sanitized space and user info (masks sensitive keys)
    if (space) {
      console.log('onAppCommand: Space info:', JSON.stringify(sanitizeForLogging(space), null, 2));
    }
    if (user) {
      console.log('onAppCommand: User info:', JSON.stringify(sanitizeForLogging(user), null, 2));
    }

    // Extract argument text (the text that follows the slash command)
    // This is the user's query/prompt after the command name
    // Check multiple possible locations as Google Chat event structure can vary
    let argumentText = '';
    // Check appCommandPayload structure first (newer format)
    if (event && event.chat && event.chat.appCommandPayload && event.chat.appCommandPayload.message && typeof event.chat.appCommandPayload.message.argumentText === 'string') {
      argumentText = event.chat.appCommandPayload.message.argumentText;
    } else if (event && event.message && typeof event.message.argumentText === 'string') {
      argumentText = event.message.argumentText;
    } else if (event && event.chat && event.chat.messagePayload && event.chat.messagePayload.message && typeof event.chat.messagePayload.message.argumentText === 'string') {
      argumentText = event.chat.messagePayload.message.argumentText;
    } else if (event && event.appCommand && typeof event.appCommand.argumentText === 'string') {
      argumentText = event.appCommand.argumentText;
    } else if (event && event.chat && event.chat.messagePayload && event.chat.messagePayload.appCommand && typeof event.chat.messagePayload.appCommand.argumentText === 'string') {
      argumentText = event.chat.messagePayload.appCommand.argumentText;
    } else if (event && event.message && event.message.slashCommand && typeof event.message.slashCommand.argumentText === 'string') {
      argumentText = event.message.slashCommand.argumentText;
    } else if (event && event.slashCommand && typeof event.slashCommand.argumentText === 'string') {
      argumentText = event.slashCommand.argumentText;
    }

    // Check fallback locations for argument text
    // Some Chat payloads may use alternative field names
    if (!argumentText && event && event.common && typeof event.common.argumentText === 'string') {
      argumentText = event.common.argumentText;
    }
    if (!argumentText && event && event.message && typeof event.message.argument === 'string') {
      argumentText = event.message.argument;
    }

    // Extract command ID (numeric identifier for registered slash commands)
    // Command IDs are used when the command is invoked but text parsing fails
    // Check multiple possible locations in the event structure
    // Priority: appCommandPayload structure (newer format) first
    const possibleIds = [
      // New appCommandPayload structure
      event && event.chat && event.chat.appCommandPayload && event.chat.appCommandPayload.appCommandMetadata && event.chat.appCommandPayload.appCommandMetadata.appCommandId,
      event && event.chat && event.chat.appCommandPayload && event.chat.appCommandPayload.message && event.chat.appCommandPayload.message.slashCommand && event.chat.appCommandPayload.message.slashCommand.commandId,
      // Legacy structures
      event && event.commandId,
      event && event.appCommand && event.appCommand.commandId,
      event && event.chat && event.chat.messagePayload && event.chat.messagePayload.appCommand && event.chat.messagePayload.appCommand.commandId,
      event && event.common && event.common.invokedFunction && event.common.invokedFunction.commandId,
      event && event.message && event.message.slashCommand && event.message.slashCommand.commandId,
      event && event.slashCommand && event.slashCommand.commandId,
      event && event.chat && event.chat.messagePayload && event.chat.messagePayload.slashCommand && event.chat.messagePayload.slashCommand.commandId
    ].filter(v => typeof v !== 'undefined' && v !== null);

    // Convert to string, handling both string and numeric commandIds
    const commandId = possibleIds.length ? String(possibleIds[0]) : '';
    console.log('onAppCommand: Command ID:', commandId);

    // Normalize the message text: remove bot mentions and trim whitespace
    // Handle both HTML-style mentions and plain text mentions
    let messageText = String(rawText || '')
      .replace(/<@[^>]+>/g, '')  // Remove HTML-style mentions like <@users/123>
      .replace(/@[^\s]+\s*/g, '') // Remove plain text mentions like @CHATBOT
      .trim();
    
    console.log('onAppCommand: Cleaned message text:', messageText);

    // Route by explicit slash command text first (if present)
    // This handles cases where the full message text contains the command and query
    // Also check command name from event structure as fallback
    const commandName = (event && event.chat && event.chat.appCommandPayload && event.chat.appCommandPayload.message && event.chat.appCommandPayload.message.annotations && event.chat.appCommandPayload.message.annotations[0] && event.chat.appCommandPayload.message.annotations[0].slashCommand && event.chat.appCommandPayload.message.annotations[0].slashCommand.commandName) ||
                        (event && event.appCommand && event.appCommand.commandName) ||
                        (event && event.chat && event.chat.messagePayload && event.chat.messagePayload.appCommand && event.chat.messagePayload.appCommand.commandName) ||
                        (event && event.message && event.message.slashCommand && event.message.slashCommand.commandName) ||
                        '';
    
    console.log('onAppCommand: Command name from event:', commandName);
    console.log('onAppCommand: Argument text:', argumentText);
    
    if (/^\/?gemini\b/i.test(messageText) || commandName === 'gemini' || commandName === '/gemini') {
      // Extract the prompt: prefer argumentText from event, fallback to parsing messageText
      // The argumentText is cleaner as it's already separated by Google Chat
      const prompt = (argumentText && argumentText.trim()) || messageText.replace(/^\/?gemini\b/i, '').trim();
      return handleAIRequest(prompt || '', 'gemini', space, user);
    } else if (/^\/?wiki\b/i.test(messageText) || commandName === 'wiki' || commandName === '/wiki') {
      const prompt = (argumentText && argumentText.trim()) || messageText.replace(/^\/?wiki\b/i, '').trim();
      return handleWikiRequest(prompt || '', space, user);
    } else if (/^\/?chatgpt\b/i.test(messageText) || commandName === 'chatgpt' || commandName === '/chatgpt') {
      const prompt = (argumentText && argumentText.trim()) || messageText.replace(/^\/?chatgpt\b/i, '').trim();
      return handleChatGPTRequest(prompt || '', space, user);
    } else if (/^\/?help\b/i.test(messageText) || commandName === 'help' || commandName === '/help') {
      // Help command: display help message
      return createChatResponse(getHelpMessage());
    }

    // If no usable text was found, try commandId mapping as fallback
    // Command IDs: 2=/gemini, 3=/help, 4=/wiki, 5=/chatgpt (configured in Google Cloud Console)
    if (commandId) {
      if (commandId === '2') {
        // Command ID 2 maps to /gemini
        const prompt = (argumentText || '').trim();
        return handleAIRequest(prompt || '', 'gemini', space, user);
      } else if (commandId === '3') {
        // Command ID 3 maps to /help
        return createChatResponse(getHelpMessage());
      } else if (commandId === '4') {
        // Command ID 4 maps to /wiki
        const prompt = (argumentText || '').trim();
        return handleWikiRequest(prompt || '', space, user);
      } else if (commandId === '5') {
        // Command ID 5 maps to /chatgpt
        const prompt = (argumentText || '').trim();
        return handleChatGPTRequest(prompt || '', space, user);
      }
    }

    // Final fallback: if no command matched, show help message
    return createChatResponse(getHelpMessage());
    
  } catch (error) {
    // Log error and return user-friendly message
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
 * Supports multiple command formats:
 * - Slash commands: /gemini, /help
 * - Commands without slash: gemini, help
 * - Numeric shortcuts: 2 (gemini), 3 (help)
 * 
 * @param {string} messageText - The raw message text from the user
 * @returns {Object} Object with 'command' (string) and 'argument' (string) properties
 *                   If no command is found, returns empty command so message defaults to AI
 */
function parseCommand(messageText) {
  // Normalize the input: remove any remaining mentions and trim whitespace
  // Handle cases where mentions might not have been fully removed
  let trimmed = messageText
    .replace(/<@[^>]+>/g, '')  // Remove HTML-style mentions
    .replace(/@[^\s]+\s*/g, '') // Remove plain text mentions
    .trim();
  
  // Collapse multiple spaces into single space
  trimmed = trimmed.replace(/\s+/g, ' ');
  
  const lower = trimmed.toLowerCase();
  
  // Check for numeric shortcuts first (e.g., "2 question" or "3")
  // Numeric shortcuts are a convenience feature for quick command access
  const numericMatch = lower.match(/^([2-5])\s+(.*)$/);
  if (numericMatch) {
    const [, id, rest] = numericMatch;
    // Map numeric IDs to commands: 2 = gemini, 3 = help, 4 = wiki, 5 = chatgpt
    if (id === '2') return { command: 'gemini', argument: rest.trim() };
    if (id === '3') return { command: 'help', argument: '' };
    if (id === '4') return { command: 'wiki', argument: rest.trim() };
    if (id === '5') return { command: 'chatgpt', argument: rest.trim() };
  }
  
  // Check for slash commands or commands without slash prefix
  // Examples: "/gemini question", "gemini question", "/help", "help"
  // Use word boundary (\b) to ensure we match complete command words only
  const geminiMatch = trimmed.match(/^\/?gemini\b\s*(.*)$/i);
  if (geminiMatch) {
    // Extract the argument (everything after "gemini")
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
  
  // Check for help command (with or without slash)
  if (/^\/?help\b/i.test(trimmed)) {
    return { command: 'help', argument: '' };
  }
  
  // No command found - return empty command so the message defaults to AI processing
  // This allows users to send plain text messages that are automatically processed by Gemini
  return { command: '', argument: trimmed };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Truncates text for logging purposes while preserving readability.
 * 
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default: 200)
 * @returns {string} Truncated text with ellipsis if needed
 */
function truncateText(text, maxLength = 200) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Sanitizes an object for logging by masking sensitive keys.
 * Recursively processes objects and arrays to mask sensitive fields.
 * 
 * @param {*} obj - Object, array, or primitive to sanitize
 * @param {number} depth - Current recursion depth (prevents infinite loops)
 * @returns {*} Sanitized copy of the object
 */
function sanitizeForLogging(obj, depth = 0) {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[Max depth reached]';
  }
  
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item, depth + 1));
  }
  
  // Handle objects - create a copy and mask sensitive fields
  const sanitized = {};
  const sensitiveKeys = [
    'project_key', 'user_key', 'api_key', 'apiKey', 'key', 'token', 
    'access_token', 'refresh_token', 'secret', 'password', 'auth',
    'authorization', 'credentials', 'private_key', 'privateKey'
  ];
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this key should be masked
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '***MASKED***';
    } else {
      // Recursively sanitize nested objects
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
 * This function validates the input, calls the AI API, and formats the response
 * for display in Google Chat. Currently only supports Gemini AI.
 * 
 * @param {string} messageText - The user's message text to process with AI
 * @param {string} provider - AI provider to use (currently only 'gemini' is supported)
 * @param {Object} space - Chat space information (optional, reserved for future use)
 * @param {Object} user - User information (optional, reserved for future use)
 * @returns {Object} AI response in hostAppDataAction format for Google Chat
 */
function handleAIRequest(messageText, provider, space, user) {
  // Validate input: ensure message text is not empty
  if (!messageText || !messageText.trim()) {
    return createChatResponse("Please provide a message to process.");
  }

  try {
    // Validate provider: currently only Gemini is supported
    // This check allows for future expansion to other AI providers
    if (provider !== 'gemini') {
      return createChatResponse("Only Gemini AI is currently supported.");
    }
    
    console.log(`handleAIRequest: Processing ${provider} request`);
    console.log(`handleAIRequest: Full Prompt (${messageText.length} chars):`, messageText);
    
    // Call the Gemini API with the user's message
    // This is where the actual AI processing happens
    const response = callGeminiAPI(messageText);
    
    console.log(`handleAIRequest: Full Response (${response.length} chars):`, response);
    
    // Format the response with provider information for clarity
    // The emoji and provider name help users understand which AI responded
    const formattedResponse = `🤖 ${provider.toUpperCase()} Response:\n\n${response}`;
    
    // Return the formatted response in the proper Chat format
    return createChatResponse(formattedResponse);

  } catch (error) {
    // Log the error for debugging and return a user-friendly error message
    console.error(`Error calling ${provider}:`, error);
    return createChatResponse(`Sorry, I encountered an error with the ${provider} service: ${error.message}`);
  }
}

/**
 * Calls the Google Gemini API to generate AI responses.
 * 
 * This function handles the complete API interaction:
 * 1. Retrieves API configuration from Script Properties (secure storage)
 * 2. Validates the configuration
 * 3. Builds the API request with proper formatting
 * 4. Makes the HTTP request
 * 5. Parses and extracts the AI response
 * 
 * API keys are stored in Script Properties for security (never hardcoded).
 * 
 * @param {string} prompt - The user's prompt/question to send to Gemini
 * @returns {string} AI-generated response text from Gemini
 * @throws {Error} If API call fails, configuration is missing, or response format is invalid
 */
function callGeminiAPI(prompt) {
  // Get API configuration from Script Properties (secure storage)
  // Script Properties are encrypted and only accessible to the script owner
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const baseUrl = PropertiesService.getScriptProperties().getProperty('GEMINI_API_URL');
  
  // Validate API key configuration
  // Check for both missing key and placeholder value
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in Script Properties.');
  }
  
  // Validate API URL configuration
  if (!baseUrl) {
    throw new Error('GEMINI_API_URL not configured in Script Properties.');
  }
  
  // Extract model name from URL for logging (e.g., "gemini-2.5-pro" from URL)
  const modelMatch = baseUrl.match(/models\/([^:]+)/);
  const modelName = modelMatch ? modelMatch[1] : 'unknown';
  
  console.log('callGeminiAPI: Endpoint:', baseUrl.replace(/\?key=.*$/, '?key=***'));
  console.log('callGeminiAPI: Model:', modelName);
  console.log('callGeminiAPI: Prompt length:', prompt.length, 'characters');
  
  // Build the full API URL with the API key as a query parameter
  // Gemini API uses the key as a query parameter: ?key=YOUR_API_KEY
  const url = `${baseUrl}?key=${apiKey}`;
  
  // Prepare the request payload according to Gemini API format
  // The API expects a JSON object with a 'contents' array
  // Each content item has 'parts' containing the actual text
  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };
  
  // Configure HTTP request options
  const options = {
    method: 'POST',  // Gemini API uses POST for generateContent endpoint
    headers: {
      'Content-Type': 'application/json'  // Required for JSON payload
    },
    payload: JSON.stringify(payload),  // Convert payload object to JSON string
    muteHttpExceptions: true  // Prevents exceptions from being thrown, returns status code instead
    // This allows us to handle HTTP errors gracefully and return custom error messages
  };
  
  // Make the HTTP request to Gemini API using Google Apps Script's UrlFetchApp
  console.log('callGeminiAPI: Sending request...');
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  console.log('callGeminiAPI: Response code:', responseCode);
  
  // Check for HTTP errors (non-200 status codes)
  // Common errors: 400 (bad request), 401 (unauthorized), 429 (rate limit), 500 (server error)
  if (responseCode !== 200) {
    console.error('callGeminiAPI: Error response:', truncateText(responseText, 500));
    throw new Error(`Gemini API request failed with code ${responseCode}: ${responseText}`);
  }
  
  // Parse the JSON response from Gemini
  // The response is a JSON string that needs to be converted to a JavaScript object
  const responseData = JSON.parse(responseText);
  
  console.log('callGeminiAPI: Response parsed successfully');
  
  // Extract the text content from the API response structure
  // Gemini API response format:
  // {
  //   candidates: [{
  //     content: {
  //       parts: [{
  //         text: "AI-generated response text here"
  //       }]
  //     }
  //   }]
  // }
  // Use optional chaining (?.) to safely access nested properties
  if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
    const responseText = responseData.candidates[0].content.parts[0].text;
    console.log('callGeminiAPI: Response extracted successfully');
    console.log('callGeminiAPI: Full Response (', responseText.length, 'characters):', responseText);
    return responseText;
  } else {
    // If the response structure doesn't match expected format, throw descriptive error
    console.error('callGeminiAPI: Invalid response structure:', JSON.stringify(responseData).substring(0, 500));
    throw new Error('Invalid response format from Gemini API: ' + JSON.stringify(responseData));
  }
}


// ============================================================================
// RESPONSE FORMATTING
// ============================================================================

/**
 * Creates a properly formatted response for Google Workspace Add-ons.
 * 
 * This function formats the response in the hostAppDataAction format required by
 * Google Chat API. All responses from event handlers must use this format.
 * 
 * Response Structure:
 * - hostAppDataAction: Top-level wrapper for Workspace Add-on responses
 * - chatDataAction: Specific to Google Chat add-ons
 * - createMessageAction: Indicates we're creating a new message
 * - message: Contains the actual message content
 * 
 * @param {string} text - The message text to send to the user
 * @returns {Object} Response object in hostAppDataAction format for Google Chat
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
 * @returns {string} Model name (e.g., "gemini-2.5-pro") or "unknown" if not found
 */
function getGeminiModelName() {
  const baseUrl = PropertiesService.getScriptProperties().getProperty('GEMINI_API_URL');
  if (!baseUrl) {
    return 'unknown';
  }
  
  // Extract model name from URL (e.g., "gemini-2.5-pro" from URL containing "models/gemini-2.5-pro")
  const modelMatch = baseUrl.match(/models\/([^:?\/]+)/);
  return modelMatch ? modelMatch[1] : 'unknown';
}

/**
 * Returns the help message with bot information and available commands.
 * 
 * This function generates a formatted help message that explains:
 * - Available commands and how to use them
 * - Default behavior for plain text messages
 * - Features and capabilities
 * - Usage examples
 * - Setup requirements
 * - Models being used
 * 
 * @returns {string} Formatted help message text to display to users
 */
function getHelpMessage() {
  const props = PropertiesService.getScriptProperties();
  const geminiModel = getGeminiModelName();
  const azureModel = props.getProperty('AZURE_OPENAI_MODEL') || 'not configured';
  const searchModel = props.getProperty('AZURE_SEARCH_OPENAI_MODEL') || azureModel;
  
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
 * This function handles Azure OpenAI chat completions with optional data sources.
 * Supports both simple chat (no search) and RAG (with Azure AI Search).
 * 
 * @param {string} prompt - The user's prompt/question
 * @param {Array} chatHistory - Array of previous messages in format [{role: "user|assistant", content: "..."}]
 * @param {Object} options - Configuration options
 * @param {boolean} options.useSearch - Whether to use Azure AI Search (RAG)
 * @param {string} options.conversationId - Optional conversation ID for history tracking
 * @param {string} options.model - Optional model override (if not provided, uses appropriate model based on useSearch)
 * @returns {Object} Response object with content and optional citations
 * @throws {Error} If API call fails or configuration is missing
 */
function callAzureOpenAI(prompt, chatHistory = [], options = {}) {
  console.log('callAzureOpenAI: Starting request', options.useSearch ? 'with RAG' : 'without RAG');
  console.log('callAzureOpenAI: Full Prompt (', prompt.length, 'characters):', prompt);
  console.log('callAzureOpenAI: Chat history messages:', chatHistory.length);
  
  const props = PropertiesService.getScriptProperties();
  
  // Get Azure OpenAI configuration
  const endpoint = props.getProperty('AZURE_OPENAI_ENDPOINT') || 
                   `https://${props.getProperty('AZURE_OPENAI_RESOURCE')}.openai.azure.com`;
  const apiKey = props.getProperty('AZURE_OPENAI_KEY');
  
  // Determine which model to use:
  // - If model is provided in options, use it
  // - If using search, use AZURE_SEARCH_OPENAI_MODEL (for GPT-4 models that support data_sources)
  // - Otherwise, use AZURE_OPENAI_MODEL (for GPT-5 models)
  let model = options.model;
  let modelSource = 'options.model';
  if (!model) {
    if (options.useSearch) {
      model = props.getProperty('AZURE_SEARCH_OPENAI_MODEL');
      modelSource = 'AZURE_SEARCH_OPENAI_MODEL';
      if (!model) {
        // Fallback to regular model if search model not configured
        model = props.getProperty('AZURE_OPENAI_MODEL');
        modelSource = 'AZURE_OPENAI_MODEL (fallback)';
        console.warn('callAzureOpenAI: AZURE_SEARCH_OPENAI_MODEL not configured, using AZURE_OPENAI_MODEL');
      }
    } else {
      model = props.getProperty('AZURE_OPENAI_MODEL');
      modelSource = 'AZURE_OPENAI_MODEL';
    }
  }
  
  console.log('callAzureOpenAI: Model selection - Source:', modelSource, 'Model:', model);
  
  const apiVersion = props.getProperty('AZURE_OPENAI_API_VERSION') || '2024-12-01-preview';
  const temperature = parseFloat(props.getProperty('AZURE_OPENAI_TEMPERATURE') || '0');
  const maxTokens = parseInt(props.getProperty('AZURE_OPENAI_MAX_TOKENS') || '1000');
  const topP = parseFloat(props.getProperty('AZURE_OPENAI_TOP_P') || '1.0');
  const systemMessage = props.getProperty('AZURE_OPENAI_SYSTEM_MESSAGE') || 
                       'You are an AI assistant that helps people find information.';
  
  // Log configuration (without sensitive data)
  console.log('callAzureOpenAI: Endpoint:', endpoint);
  console.log('callAzureOpenAI: Model:', model);
  console.log('callAzureOpenAI: API Version:', apiVersion);
  console.log('callAzureOpenAI: Temperature:', temperature, 'Max Tokens:', maxTokens);
  
  // Validate required configuration
  if (!endpoint || !apiKey || !model) {
    console.error('callAzureOpenAI: Configuration incomplete');
    throw new Error('Azure OpenAI configuration incomplete. Required: AZURE_OPENAI_ENDPOINT (or AZURE_OPENAI_RESOURCE), AZURE_OPENAI_KEY, AZURE_OPENAI_MODEL');
  }
  
  // Build messages array
  const messages = [];
  
  // Add system message only when using search (for /wiki command)
  // /chatgpt should not have a system message
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
  // GPT-5.1 requires max_completion_tokens instead of max_tokens
  // When using data_sources, max_completion_tokens is NOT permitted at top level
  const payload = {
    messages: messages,
    temperature: temperature,
    top_p: topP,
    model: model
  };
  
  // Add max_completion_tokens only when NOT using search (for /chatgpt with GPT-5.1)
  // When using data_sources (for /wiki), this parameter is not permitted
  if (!options.useSearch) {
    payload.max_completion_tokens = maxTokens;
  }
  
  // Add data sources if using search (REST API format - data_sources at top level)
  if (options.useSearch) {
    const dataSourceConfig = buildAzureSearchDataSource();
    if (dataSourceConfig) {
      payload.data_sources = [dataSourceConfig];
      // Log search configuration (without sensitive keys)
      if (dataSourceConfig.parameters) {
        console.log('callAzureOpenAI: Search config - Index:', dataSourceConfig.parameters.index_name);
        console.log('callAzureOpenAI: Search config - Query type:', dataSourceConfig.parameters.query_type);
        console.log('callAzureOpenAI: Search config - Top K:', dataSourceConfig.parameters.top_n_documents);
        console.log('callAzureOpenAI: Search config - Strictness:', dataSourceConfig.parameters.strictness);
      }
    } else {
      console.warn('callAzureOpenAI: Data source config is null - search may not be configured');
    }
  }
  
  // Build API URL (ensure no double slashes)
  const cleanEndpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash if present
  const url = `${cleanEndpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
  
  console.log('callAzureOpenAI: Request URL:', url);
  console.log('callAzureOpenAI: Total messages in payload:', messages.length);
  
  // Configure HTTP request
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  // Make the API request
  console.log('callAzureOpenAI: Sending request...');
  const response = UrlFetchApp.fetch(url, requestOptions);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  console.log('callAzureOpenAI: Response code:', responseCode);
  
  // Check for HTTP errors
  if (responseCode !== 200) {
    console.error('callAzureOpenAI: API request failed with code', responseCode);
    console.error('callAzureOpenAI: Response text:', responseText);
    throw new Error(`Azure OpenAI API request failed with code ${responseCode}: ${responseText}`);
  }
  
  // Parse response
  const responseData = JSON.parse(responseText);
  
  // Extract response content and citations
  if (responseData.choices && responseData.choices.length > 0) {
    const choice = responseData.choices[0];
    const message = choice.message;
    
    // Handle different content formats - could be string or array
    let content = '';
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      // Content might be an array of content blocks
      content = message.content.map(block => {
        if (typeof block === 'string') return block;
        if (block && typeof block.text === 'string') return block.text;
        if (block && typeof block.content === 'string') return block.content;
        return '';
      }).join('\n');
    } else if (message.content && typeof message.content === 'object') {
      // Try to extract text from object
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
 * This constructs the data_sources payload that tells Azure OpenAI
 * to use Azure AI Search for retrieval-augmented generation.
 * 
 * @returns {Object|null} Data source configuration object or null if not configured
 */
function buildAzureSearchDataSource() {
  console.log('buildAzureSearchDataSource: Building search data source configuration');
  
  const props = PropertiesService.getScriptProperties();
  
  // Get Azure AI Search configuration
  const searchService = props.getProperty('AZURE_SEARCH_SERVICE');
  const searchIndex = props.getProperty('AZURE_SEARCH_INDEX');
  const searchKey = props.getProperty('AZURE_SEARCH_KEY');
  const queryType = props.getProperty('AZURE_SEARCH_QUERY_TYPE') || 'simple';
  const topK = parseInt(props.getProperty('AZURE_SEARCH_TOP_K') || '5');
  const strictness = parseInt(props.getProperty('AZURE_SEARCH_STRICTNESS') || '3');
  const enableInDomain = props.getProperty('AZURE_SEARCH_ENABLE_IN_DOMAIN') !== 'false';
  const semanticConfig = props.getProperty('AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG') || '';
  
  // Log search resources being used
  console.log('buildAzureSearchDataSource: Search service:', searchService);
  console.log('buildAzureSearchDataSource: Search index:', searchIndex);
  console.log('buildAzureSearchDataSource: Query type:', queryType);
  console.log('buildAzureSearchDataSource: Top K:', topK, 'Strictness:', strictness);
  
  // Validate required configuration
  if (!searchService || !searchIndex) {
    console.warn('buildAzureSearchDataSource: Search not configured - missing service or index');
    return null; // Search not configured
  }
  
  // Build endpoint
  const searchEndpoint = `https://${searchService}.search.windows.net`;
  
  // Build authentication
  const authentication = searchKey ? 
    { type: 'api_key', key: searchKey } :
    { type: 'system_assigned_managed_identity' };
  
  // Build fields mapping
  const fieldsMapping = {};
  const contentColumns = props.getProperty('AZURE_SEARCH_CONTENT_COLUMNS');
  const vectorColumns = props.getProperty('AZURE_SEARCH_VECTOR_COLUMNS');
  const titleColumn = props.getProperty('AZURE_SEARCH_TITLE_COLUMN');
  const urlColumn = props.getProperty('AZURE_SEARCH_URL_COLUMN');
  const filenameColumn = props.getProperty('AZURE_SEARCH_FILENAME_COLUMN');
  
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
  const embeddingName = props.getProperty('AZURE_OPENAI_EMBEDDING_NAME');
  if (embeddingName && (queryType.includes('vector'))) {
    embeddingDependency = {
      type: 'deployment_name',
      deployment_name: embeddingName
    };
  }
  
  // Get search common settings (matching Python chatbot implementation)
  const maxSearchQueries = props.getProperty('SEARCH_MAX_SEARCH_QUERIES');
  const allowPartialResult = props.getProperty('SEARCH_ALLOW_PARTIAL_RESULT') === 'true';
  const includeContextsStr = props.getProperty('SEARCH_INCLUDE_CONTEXTS');
  const includeContexts = includeContextsStr ? 
    includeContextsStr.split('|').map(c => c.trim()) : 
    ['citations', 'intent']; // Default from Python code
  const vectorizationDimensions = props.getProperty('SEARCH_VECTORIZATION_DIMENSIONS');
  const roleInformation = props.getProperty('AZURE_OPENAI_SYSTEM_MESSAGE') || 
                         'You are an AI assistant that helps people find information.';
  
  // Build parameters object
  // Note: role_information is not supported in data_sources parameters
  // System message should be in the messages array instead
  const parameters = {
    endpoint: searchEndpoint,
    index_name: searchIndex,
    authentication: authentication,
    top_n_documents: topK,
    strictness: strictness,
    in_scope: enableInDomain,
    query_type: queryType,
    // Add search common settings (critical for proper responses)
    include_contexts: includeContexts
    // role_information removed - not supported in data_sources parameters
  };
  
  // Add optional search common settings
  if (maxSearchQueries) {
    parameters.max_search_queries = parseInt(maxSearchQueries);
  }
  if (allowPartialResult) {
    parameters.allow_partial_result = allowPartialResult;
  }
  if (vectorizationDimensions) {
    parameters.vectorization_dimensions = parseInt(vectorizationDimensions);
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
  console.log('buildAzureSearchDataSource: Search endpoint:', searchEndpoint);
  
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
 * @returns {string} Conversation ID
 */
function getOrCreateConversation(userId, conversationId = null, title = '') {
  if (conversationId) {
    return conversationId;
  }
  
  // Create new conversation
  const props = PropertiesService.getScriptProperties();
  const cosmosAccount = props.getProperty('AZURE_COSMOSDB_ACCOUNT');
  const cosmosDatabase = props.getProperty('AZURE_COSMOSDB_DATABASE');
  const cosmosContainer = props.getProperty('AZURE_COSMOSDB_CONVERSATIONS_CONTAINER');
  const cosmosKey = props.getProperty('AZURE_COSMOSDB_ACCOUNT_KEY');
  
  if (!cosmosAccount || !cosmosDatabase || !cosmosContainer || !cosmosKey) {
    // CosmosDB not configured, generate a simple conversation ID
    return Utilities.getUuid();
  }
  
  try {
    const cosmosEndpoint = `https://${cosmosAccount}.documents.azure.com:443/`;
    const url = `${cosmosEndpoint}dbs/${cosmosDatabase}/colls/${cosmosContainer}/docs`;
    
    // Generate conversation document
    const conversation = {
      id: Utilities.getUuid(),
      type: 'conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: userId,
      title: title || 'New Conversation'
    };
    
    // Create conversation in CosmosDB
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ms-documentdb-partitionkey': `["${userId}"]`,
        'x-ms-version': '2018-12-31'
      },
      payload: JSON.stringify(conversation),
      muteHttpExceptions: true
    };
  
    // Generate authorization header and date for CosmosDB
    const authData = generateCosmosDBAuthHeader('POST', 'docs', cosmosKey, cosmosDatabase, cosmosContainer);
    options.headers['Authorization'] = authData.auth;
    options.headers['Date'] = authData.date;
    
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() === 201 || response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      return result.id;
    } else {
      // If CosmosDB fails, still return a conversation ID for this session
      console.error('Failed to create CosmosDB conversation:', response.getContentText());
      return conversation.id;
    }
  } catch (error) {
    console.error('Error creating conversation:', error);
    // Return a generated ID even if CosmosDB fails
    return Utilities.getUuid();
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
function saveMessageToHistory(userId, conversationId, role, content) {
  const props = PropertiesService.getScriptProperties();
  const cosmosAccount = props.getProperty('AZURE_COSMOSDB_ACCOUNT');
  const cosmosDatabase = props.getProperty('AZURE_COSMOSDB_DATABASE');
  const cosmosContainer = props.getProperty('AZURE_COSMOSDB_CONVERSATIONS_CONTAINER');
  const cosmosKey = props.getProperty('AZURE_COSMOSDB_ACCOUNT_KEY');
  
  if (!cosmosAccount || !cosmosDatabase || !cosmosContainer || !cosmosKey) {
    return; // CosmosDB not configured, skip history
  }
  
  try {
    const cosmosEndpoint = `https://${cosmosAccount}.documents.azure.com:443/`;
    const url = `${cosmosEndpoint}dbs/${cosmosDatabase}/colls/${cosmosContainer}/docs`;
    
    const message = {
      id: Utilities.getUuid(),
      type: 'message',
      userId: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conversationId: conversationId,
      role: role,
      content: content
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ms-documentdb-partitionkey': `["${userId}"]`,
        'x-ms-version': '2018-12-31'
      },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    };
    
    // Generate authorization header and date for CosmosDB
    const authData = generateCosmosDBAuthHeader('POST', 'docs', cosmosKey, cosmosDatabase, cosmosContainer);
    options.headers['Authorization'] = authData.auth;
    options.headers['Date'] = authData.date;
    
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 201 && response.getResponseCode() !== 200) {
      console.error('Failed to save message to CosmosDB:', response.getContentText());
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
 * @returns {Array} Array of messages in format [{role: "user|assistant", content: "..."}]
 */
function getChatHistory(userId, conversationId) {
  const props = PropertiesService.getScriptProperties();
  const cosmosAccount = props.getProperty('AZURE_COSMOSDB_ACCOUNT');
  const cosmosDatabase = props.getProperty('AZURE_COSMOSDB_DATABASE');
  const cosmosContainer = props.getProperty('AZURE_COSMOSDB_CONVERSATIONS_CONTAINER');
  const cosmosKey = props.getProperty('AZURE_COSMOSDB_ACCOUNT_KEY');
  
  if (!cosmosAccount || !cosmosDatabase || !cosmosContainer || !cosmosKey) {
    return []; // CosmosDB not configured, return empty history
  }
  
  try {
    const cosmosEndpoint = `https://${cosmosAccount}.documents.azure.com:443/`;
    const url = `${cosmosEndpoint}dbs/${cosmosDatabase}/colls/${cosmosContainer}/docs`;
    
    // Build SQL query
    const query = {
      query: 'SELECT * FROM c WHERE c.conversationId = @conversationId AND c.type = @type AND c.userId = @userId ORDER BY c.createdAt ASC',
      parameters: [
        { name: '@conversationId', value: conversationId },
        { name: '@type', value: 'message' },
        { name: '@userId', value: userId }
      ]
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/query+json',
        'x-ms-documentdb-partitionkey': `["${userId}"]`,
        'x-ms-version': '2018-12-31',
        'x-ms-documentdb-query-enablecrosspartition': 'true',
        'x-ms-documentdb-isquery': 'true'
      },
      payload: JSON.stringify(query),
      muteHttpExceptions: true
    };
    
    // Generate authorization header and date for CosmosDB
    const authData = generateCosmosDBAuthHeader('POST', 'docs', cosmosKey, cosmosDatabase, cosmosContainer);
    options.headers['Authorization'] = authData.auth;
    options.headers['Date'] = authData.date;
    
    // CosmosDB query endpoint is the same docs endpoint with query in body
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
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
      // If CosmosDB fails, throw error so caller can handle gracefully
      const errorText = response.getContentText();
      console.error('Failed to retrieve chat history:', errorText);
      throw new Error(`CosmosDB error: ${errorText}`);
    }
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    // Re-throw so caller can handle gracefully
    throw error;
  }
}

/**
 * Generates CosmosDB authorization header using master key.
 * 
 * CosmosDB uses HMAC SHA256 to sign requests. The signature is computed over:
 * verb + "\n" + resourceType + "\n" + resourceId + "\n" + date + "\n" + "\n"
 * 
 * @param {string} verb - HTTP verb (GET, POST, etc.)
 * @param {string} resourceType - CosmosDB resource type (docs, colls, etc.)
 * @param {string} key - CosmosDB master key (base64 encoded)
 * @param {string} database - Database name
 * @param {string} container - Container name
 * @returns {string} Authorization header value
 */
/**
 * Generates CosmosDB authorization header and date string.
 * 
 * @param {string} verb - HTTP verb (GET, POST, etc.)
 * @param {string} resourceType - Resource type (docs, colls, etc.)
 * @param {string} key - Base64-encoded CosmosDB master key
 * @param {string} database - Database name
 * @param {string} container - Container name
 * @returns {Object} Object with 'auth' (authorization header) and 'date' (RFC 1123 date string)
 */
function generateCosmosDBAuthHeader(verb, resourceType, key, database, container) {
  // Generate RFC 1123 date string (required by CosmosDB)
  const date = new Date().toUTCString();
  
  // CosmosDB signature requires resourceId WITHOUT leading slash
  // Format: dbs/{database}/colls/{container} for docs operations
  const resourceId = resourceType === 'docs' 
    ? `dbs/${database}/colls/${container}` 
    : resourceType; // For other resource types, use as-is without leading slash
  
  // Build the string to sign (must match CosmosDB format exactly)
  // Format: verb\nresourceType\nresourceId\n\nlowercase_date\n
  // Note: date must be lowercase in the signature, resourceId must NOT have leading slash
  // The date comes AFTER an empty line, and ends with single \n (no trailing newline)
  const stringToSign = `${verb.toLowerCase()}\n${resourceType}\n${resourceId}\n\n${date.toLowerCase()}\n`;
  
  // For CosmosDB, the key is base64-encoded and must be decoded to bytes
  // However, Utilities.computeHmacSha256Signature expects a string key
  // Convert byte array to binary string by mapping each byte to a character
  const keyBytes = Utilities.base64Decode(key);
  const keyString = keyBytes.map(function(byte) {
    return String.fromCharCode(byte);
  }).join('');
  
  // Create HMAC SHA256 signature
  const signatureBytes = Utilities.computeHmacSha256Signature(stringToSign, keyString);
  const signature = Utilities.base64Encode(signatureBytes);
  
  // Build authorization header
  const authType = 'master';
  const tokenVersion = '1.0';
  const auth = `type=${authType}&ver=${tokenVersion}&sig=${signature}`;
  
  // Return both auth header and date (date must be added as HTTP header)
  return {
    auth: auth,
    date: date
  };
}

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

/**
 * Validates Azure OpenAI configuration for /chatgpt and /wiki commands.
 * 
 * @returns {Object} { valid: boolean, missing: string[], message: string }
 */
function validateAzureOpenAIConfig() {
  const props = PropertiesService.getScriptProperties();
  const missing = [];
  
  const endpoint = props.getProperty('AZURE_OPENAI_ENDPOINT');
  const model = props.getProperty('AZURE_OPENAI_MODEL');
  const apiKey = props.getProperty('AZURE_OPENAI_KEY');
  const apiVersion = props.getProperty('AZURE_OPENAI_API_VERSION') || '2024-02-01';
  
  if (!endpoint) missing.push('AZURE_OPENAI_ENDPOINT');
  if (!model) missing.push('AZURE_OPENAI_MODEL');
  if (!apiKey) missing.push('AZURE_OPENAI_KEY');
  
  if (missing.length > 0) {
    return {
      valid: false,
      missing: missing,
      message: `Missing Azure OpenAI configuration: ${missing.join(', ')}`
    };
  }
  
  return { valid: true, missing: [], message: 'Azure OpenAI configuration is valid' };
}

/**
 * Validates Azure AI Search configuration for /wiki command.
 * 
 * @returns {Object} { valid: boolean, missing: string[], message: string }
 */
function validateAzureSearchConfig() {
  const props = PropertiesService.getScriptProperties();
  const missing = [];
  
  const searchService = props.getProperty('AZURE_SEARCH_SERVICE');
  const searchIndex = props.getProperty('AZURE_SEARCH_INDEX');
  
  if (!searchService) missing.push('AZURE_SEARCH_SERVICE');
  if (!searchIndex) missing.push('AZURE_SEARCH_INDEX');
  
  if (missing.length > 0) {
    return {
      valid: false,
      missing: missing,
      message: `Missing Azure AI Search configuration: ${missing.join(', ')}`
    };
  }
  
  return { valid: true, missing: [], message: 'Azure AI Search configuration is valid' };
}

/**
 * Validates CosmosDB configuration for /wiki command chat history.
 * 
 * @returns {Object} { valid: boolean, missing: string[], message: string }
 */
function validateCosmosDBConfig() {
  const props = PropertiesService.getScriptProperties();
  const missing = [];
  
  const cosmosAccount = props.getProperty('AZURE_COSMOSDB_ACCOUNT');
  const cosmosDatabase = props.getProperty('AZURE_COSMOSDB_DATABASE');
  const cosmosContainer = props.getProperty('AZURE_COSMOSDB_CONVERSATIONS_CONTAINER');
  const cosmosKey = props.getProperty('AZURE_COSMOSDB_ACCOUNT_KEY');
  
  if (!cosmosAccount) missing.push('AZURE_COSMOSDB_ACCOUNT');
  if (!cosmosDatabase) missing.push('AZURE_COSMOSDB_DATABASE');
  if (!cosmosContainer) missing.push('AZURE_COSMOSDB_CONVERSATIONS_CONTAINER');
  if (!cosmosKey) missing.push('AZURE_COSMOSDB_ACCOUNT_KEY');
  
  if (missing.length > 0) {
    return {
      valid: false,
      missing: missing,
      message: `Missing CosmosDB configuration: ${missing.join(', ')}`
    };
  }
  
  // Test if the key can be decoded (basic validation)
  try {
    const keyBytes = Utilities.base64Decode(cosmosKey);
    if (!keyBytes || keyBytes.length === 0) {
      return {
        valid: false,
        missing: ['AZURE_COSMOSDB_ACCOUNT_KEY'],
        message: 'AZURE_COSMOSDB_ACCOUNT_KEY appears to be invalid (not valid base64)'
      };
    }
  } catch (e) {
    return {
      valid: false,
      missing: ['AZURE_COSMOSDB_ACCOUNT_KEY'],
      message: `AZURE_COSMOSDB_ACCOUNT_KEY is invalid: ${e.message}`
    };
  }
  
  return { valid: true, missing: [], message: 'CosmosDB configuration is valid' };
}

// ============================================================================
// WIKI AND CHATGPT COMMAND HANDLERS
// ============================================================================

/**
 * Handles /wiki command requests with RAG (Retrieval-Augmented Generation).
 * 
 * Uses Azure OpenAI with Azure AI Search to search internal wiki content.
 * Chat history via CosmosDB is temporarily disabled until authentication is fixed.
 * 
 * @param {string} prompt - The user's query/question
 * @param {Object} space - Chat space information
 * @param {Object} user - User information
 * @param {string} conversationId - Optional conversation ID (currently unused)
 * @returns {Object} Response in hostAppDataAction format
 */
function handleWikiRequest(prompt, space, user, conversationId = null) {
  console.log('handleWikiRequest: Processing wiki search request');
  console.log('handleWikiRequest: Prompt:', prompt);
  
  if (!prompt || !prompt.trim()) {
    return createChatResponse("Please provide a question for the wiki search.");
  }
  
  try {
    // Call Azure OpenAI with search enabled (RAG)
    // CosmosDB history is temporarily disabled until authentication is fixed
    const response = callAzureOpenAI(prompt, [], {
      useSearch: true
    });
    
    console.log('handleWikiRequest: Received response from Azure OpenAI');
    console.log('handleWikiRequest: Citations found:', response.citations ? response.citations.length : 0);
    
    // Remove citation markers like [doc 4], [doc4], etc. from the content
    let cleanContent = response.content || '';
    const originalLength = cleanContent.length;
    cleanContent = cleanContent.replace(/\[doc\s*\d+\]/gi, '').trim();
    
    if (originalLength !== cleanContent.length) {
      console.log('handleWikiRequest: Removed citation markers, length changed from', originalLength, 'to', cleanContent.length);
    }
    
    // Format response
    const formattedResponse = `📚 Wiki Response:\n\n${cleanContent}`;
    
    console.log('handleWikiRequest: Returning formatted response (', formattedResponse.length, 'chars)');
    
    return createChatResponse(formattedResponse);
    
  } catch (error) {
    console.error('Error in /wiki command:', error);
    return createChatResponse(`Sorry, I encountered an error with the wiki search: ${error.message}`);
  }
}

/**
 * Handles /chatgpt command requests using Azure OpenAI.
 * 
 * Simple Azure OpenAI chat completion without RAG or chat history.
 * 
 * @param {string} prompt - The user's message
 * @param {Object} space - Chat space information
 * @param {Object} user - User information
 * @returns {Object} Response in hostAppDataAction format
 */
function handleChatGPTRequest(prompt, space, user) {
  console.log('handleChatGPTRequest: Processing ChatGPT request');
  console.log('handleChatGPTRequest: Prompt:', prompt);
  
  if (!prompt || !prompt.trim()) {
    return createChatResponse("Please provide a message for ChatGPT.");
  }
  
  try {
    // Get the model name for logging and verification
    const props = PropertiesService.getScriptProperties();
    const modelName = props.getProperty('AZURE_OPENAI_MODEL') || 'not configured';
    console.log('handleChatGPTRequest: Using model:', modelName);
    
    // Call Azure OpenAI without search or history
    const response = callAzureOpenAI(prompt, [], {
      useSearch: false
    });
    
    console.log('handleChatGPTRequest: Received response from Azure OpenAI');
    console.log('handleChatGPTRequest: Using model:', modelName);
    console.log('handleChatGPTRequest: Response length:', response.content.length, 'characters');
    
    // Format response
    const formattedResponse = `💬 ChatGPT Response:\n\n${response.content}`;
    
    return createChatResponse(formattedResponse);
    
  } catch (error) {
    console.error('Error in /chatgpt command:', error);
    return createChatResponse(`Sorry, I encountered an error with ChatGPT: ${error.message}`);
  }
}