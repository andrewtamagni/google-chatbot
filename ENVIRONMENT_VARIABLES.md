# Environment Variables for Google Apps Script Project

This document lists all environment variables (Script Properties) that need to be configured in your Google Apps Script project.

## Gemini AI Configuration (Existing)

These are already configured for the basic Gemini functionality:

| Property Name | Required | Default | Description |
|--------------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Your Google Gemini API key from Google AI Studio |
| `GEMINI_API_URL` | Yes | - | Gemini API endpoint URL (e.g., `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`) |

## Azure OpenAI Configuration (For /wiki and /chatgpt commands)

These are required for both `/wiki` and `/chatgpt` commands:

| Property Name | Required | Default | Description |
|--------------|----------|---------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Yes* | - | Full Azure OpenAI endpoint URL (e.g., `https://your-resource.openai.azure.com`). *Required if `AZURE_OPENAI_RESOURCE` is not set |
| `AZURE_OPENAI_RESOURCE` | Yes* | - | Azure OpenAI resource name. *Required if `AZURE_OPENAI_ENDPOINT` is not set (endpoint will be constructed as `https://{resource}.openai.azure.com`) |
| `AZURE_OPENAI_KEY` | Yes | - | Azure OpenAI API key |
| `AZURE_OPENAI_MODEL` | Yes | - | Model deployment name for `/chatgpt` command (e.g., `gpt-5.1`, `gpt-4o`). **Used for GPT-5 models** |
| `AZURE_SEARCH_OPENAI_MODEL` | Yes (for /wiki) | - | Model deployment name for `/wiki` command with data_sources (e.g., `gpt-4o`, `gpt-4o-mini`). **Must be a GPT-4 model that supports data_sources** |
| `AZURE_OPENAI_API_VERSION` | No | `2024-12-01-preview` | API version to use. **For gpt-5.1, use 2024-12-01-preview or later** |
| `AZURE_OPENAI_TEMPERATURE` | No | `0` | Sampling temperature (0-2) |
| `AZURE_OPENAI_MAX_TOKENS` | No | `1000` | Maximum tokens in response. **For gpt-5.1, this is used as max_completion_tokens** |
| `AZURE_OPENAI_TOP_P` | No | `1.0` | Nucleus sampling parameter |
| `AZURE_OPENAI_SYSTEM_MESSAGE` | No | `You are an AI assistant that helps people find information.` | System message for the AI |

## Azure AI Search Configuration (For /wiki command only)

These are required for the `/wiki` command to enable RAG (Retrieval Augmented Generation):

| Property Name | Required | Default | Description |
|--------------|----------|---------|-------------|
| `AZURE_SEARCH_SERVICE` | Yes (for /wiki) | - | Azure AI Search service name |
| `AZURE_SEARCH_INDEX` | Yes (for /wiki) | - | Azure AI Search index name |
| `AZURE_SEARCH_KEY` | Yes* (for /wiki) | - | Azure AI Search admin key. *Required if not using managed identity |
| `AZURE_SEARCH_QUERY_TYPE` | No | `simple` | Query type: `simple`, `semantic`, `vector`, `vectorSimpleHybrid`, `vectorSemanticHybrid` |
| `AZURE_SEARCH_TOP_K` | No | `5` | Number of documents to retrieve |
| `AZURE_SEARCH_STRICTNESS` | No | `3` | Strictness level (1-5) for limiting responses to your data |
| `AZURE_SEARCH_ENABLE_IN_DOMAIN` | No | `true` | Limit responses to queries relating to your data |
| `AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG` | No | - | Semantic search configuration name (required if using semantic search) |
| `AZURE_SEARCH_CONTENT_COLUMNS` | No | - | Content field names, pipe-separated (e.g., `content|description`) |
| `AZURE_SEARCH_VECTOR_COLUMNS` | No | - | Vector field names, pipe-separated (e.g., `contentVector|titleVector`) - Required for vector search |
| `AZURE_SEARCH_TITLE_COLUMN` | No | - | Field name for document title |
| `AZURE_SEARCH_URL_COLUMN` | No | - | Field name for document URL |
| `AZURE_SEARCH_FILENAME_COLUMN` | No | - | Field name for document filename/path |
| `AZURE_OPENAI_EMBEDDING_NAME` | Yes* (for vector search) | - | Embedding model deployment name (e.g., `text-embedding-ada-002`). *Required if using vector search types |
| `AZURE_SEARCH_INCLUDE_CONTEXTS` | No | `citations,intent` | Comma-separated list of contexts to include. Must include `intent` for proper RAG responses. Default: `citations,intent` |

## CosmosDB Configuration (For /wiki command chat history)

**Note**: Chat history via CosmosDB is currently disabled in the code until authentication is fixed. These properties are documented for future use:

| Property Name | Required | Default | Description |
|--------------|----------|---------|-------------|
| `AZURE_COSMOSDB_ACCOUNT` | Yes (for /wiki history) | - | CosmosDB account name |
| `AZURE_COSMOSDB_DATABASE` | Yes (for /wiki history) | - | CosmosDB database name |
| `AZURE_COSMOSDB_CONVERSATIONS_CONTAINER` | Yes (for /wiki history) | - | CosmosDB container name for conversations |
| `AZURE_COSMOSDB_ACCOUNT_KEY` | Yes (for /wiki history) | - | CosmosDB account master key (base64 encoded) |

## Configuration Summary by Command

### /gemini command
- Requires: `GEMINI_API_KEY`, `GEMINI_API_URL`

### /chatgpt command
- Requires: `AZURE_OPENAI_ENDPOINT` (or `AZURE_OPENAI_RESOURCE`), `AZURE_OPENAI_KEY`, `AZURE_OPENAI_MODEL`
- Uses: `AZURE_OPENAI_MODEL` (GPT-5.1 or other GPT-5 models)
- Optional: `AZURE_OPENAI_TEMPERATURE`, `AZURE_OPENAI_MAX_TOKENS`, `AZURE_OPENAI_TOP_P`, `AZURE_OPENAI_SYSTEM_MESSAGE`
- **Note**: GPT-5.1 models are used for `/chatgpt` as they provide the latest capabilities for general chat

### /wiki command
- Requires all `/chatgpt` variables PLUS:
  - `AZURE_SEARCH_OPENAI_MODEL` - **Required for /wiki** (must be a GPT-4 model that supports data_sources, e.g., `gpt-4o`, `gpt-4o-mini`)
  - `AZURE_SEARCH_SERVICE`, `AZURE_SEARCH_INDEX`, `AZURE_SEARCH_KEY`
  - `AZURE_SEARCH_INCLUDE_CONTEXTS` (optional, defaults to `citations,intent`)
  - CosmosDB variables are optional (chat history is currently disabled)
- Uses: `AZURE_SEARCH_OPENAI_MODEL` for the model (falls back to `AZURE_OPENAI_MODEL` if not set)
- Optional: All other `AZURE_SEARCH_*` and `AZURE_OPENAI_*` variables for fine-tuning
- **Important**: `/wiki` uses GPT-4 models because GPT-5 models (including GPT-5.1) do not currently support `data_sources` for RAG functionality. This is a limitation of the Azure OpenAI API at the time of development.

## Notes

1. **Model Selection**: 
   - `/chatgpt` command uses `AZURE_OPENAI_MODEL` (GPT-5.1 or other GPT-5 models) for the latest general chat capabilities
   - `/wiki` command uses `AZURE_SEARCH_OPENAI_MODEL` (must be a GPT-4 model that supports data_sources, e.g., `gpt-4o`, `gpt-4o-mini`)
   - **Important**: GPT-5 models (including GPT-5.1) do not currently support `data_sources` in the Azure OpenAI API, so GPT-4 models are required for `/wiki` command's RAG functionality. This is a current limitation of the Azure OpenAI API.
   - If `AZURE_SEARCH_OPENAI_MODEL` is not set, `/wiki` will fall back to `AZURE_OPENAI_MODEL` (which may not work if it's a GPT-5 model)

2. **CosmosDB Key**: The `AZURE_COSMOSDB_ACCOUNT_KEY` should be the base64-encoded master key from your CosmosDB account.

3. **Vector Search**: If using vector search types (`vector`, `vectorSimpleHybrid`, `vectorSemanticHybrid`), you must also configure:
   - `AZURE_OPENAI_EMBEDDING_NAME` - The embedding model deployment name
   - `AZURE_SEARCH_VECTOR_COLUMNS` - The vector field names in your index

4. **Semantic Search**: If using semantic search, configure:
   - `AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG` - Your semantic configuration name
   - Set `AZURE_SEARCH_QUERY_TYPE` to include `semantic` (e.g., `semantic`, `vectorSemanticHybrid`)

5. **Managed Identity**: If using Azure managed identity instead of keys, leave `AZURE_SEARCH_KEY` unset (not supported in Apps Script - keys are required).

6. **Chat History**: The `/wiki` command will automatically create and manage conversations in CosmosDB. Each user's conversations are stored separately using their email/name as the user ID.

## Setting Script Properties

1. Open your Google Apps Script project
2. Go to **Project Settings** (gear icon)
3. Click **Script Properties** tab
4. Add each property as a new row:
   - **Property**: The property name (e.g., `AZURE_OPENAI_ENDPOINT`)
   - **Value**: The property value (e.g., `https://your-resource.openai.azure.com`)
5. Click **Save script**

## Testing Configuration

After setting properties, test each command:
- `/gemini test` - Should use Gemini
- `/chatgpt test` - Should use Azure OpenAI (if configured)
- `/wiki test` - Should use Azure OpenAI with search and history (if configured)