# RAG AI Chatbot - Danish Personal Assistant

A sophisticated Retrieval-Augmented Generation (RAG) AI chatbot built on Cloudflare Workers, featuring personalized assistance, conversation history, and automatic knowledge extraction from URLs.

## You can explore my personalised Chatbot using the following link:

## Link: https://danish-assistant.syeddanishhussain230.workers.dev/


## 🌟 Features

- **RAG (Retrieval-Augmented Generation)**: Intelligent context retrieval from a vector database
- **Personalized Assistant**: Customized responses for specific users with stored user information
- **Conversation History**: Maintains context across multiple interactions
- **Automatic URL Extraction**: Automatically extracts and learns from URLs shared in conversations
- **Vector Search**: Uses Cloudflare Vectorize for semantic search
- **Multiple AI Models**: Supports both Mistral AI and Cloudflare's AI models
- **Modern UI**: Beautiful, responsive chat interface with smooth animations
- **Workflow Integration**: Uses Cloudflare Workflows for efficient text processing

## 🏗️ Architecture

This chatbot is built using:

- **Cloudflare Workers**: Serverless runtime for the application
- **Cloudflare D1**: SQLite database for storing notes, conversations, and user info
- **Cloudflare Vectorize**: Vector database for semantic search
- **Cloudflare AI**: For embeddings and AI model inference
- **Cloudflare Workflows**: For processing and indexing documents
- **Hono**: Fast web framework for routing
- **Mistral AI** (optional): Alternative AI model provider

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Cloudflare account
- Wrangler CLI (installed via npm)

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Cloudflare Resources

Before deploying, you need to set up the following Cloudflare resources:

#### D1 Database

Create a D1 database and update the `database_id` in `wrangler.jsonc`:

```bash
npx wrangler d1 create database
```

Then run the schema:

```bash
npx wrangler d1 execute database --file=./schema.sql
```

#### Vectorize Index

Create a Vectorize index:

```bash
npx wrangler vectorize create vector-index --dimensions=768 --metric=cosine
```

#### Workflow

The workflow is automatically configured in `wrangler.jsonc`. Make sure your Cloudflare account has Workflows enabled.

### 3. Configure Environment Variables

Create a `.dev.vars` file for local development (this file is gitignored):

```env
MISTRAL_API_KEY=your_mistral_api_key_here
```

**Note**: If `MISTRAL_API_KEY` is not set, the chatbot will use Cloudflare's AI models instead.

### 4. Run Locally

```bash
npm run dev
```

The application will be available at `http://localhost:8787`

### 5. Deploy to Cloudflare

```bash
npm run deploy
```

## 📁 Project Structure

```
rag-ai-tutorial/
├── src/
│   └── index.js          # Main application code
├── test/
│   └── index.spec.js     # Test files
├── schema.sql            # Database schema
├── wrangler.jsonc        # Cloudflare Workers configuration
├── package.json          # Dependencies and scripts
├── vitest.config.js      # Test configuration
└── README.md             # This file
```

## 🔧 Configuration

### Wrangler Configuration

The `wrangler.jsonc` file contains all the necessary bindings:

- **AI Binding**: For embeddings and AI model inference
- **Vectorize Binding**: For vector search
- **D1 Database Binding**: For data storage
- **Workflow Binding**: For document processing

### Database Schema

The application uses three main tables:

1. **notes**: Stores text chunks for RAG retrieval
2. **conversation_history**: Maintains conversation context
3. **user_info**: Stores personalized user information

See `schema.sql` for the complete schema.

## 🎯 API Endpoints

### `GET /`
Serves the chat UI interface.

### `POST /api/chat`
Main chat endpoint that processes user queries.

**Request Body:**
```json
{
  "text": "Your question here",
  "conversationId": "optional-conversation-id",
  "userId": "optional-user-id"
}
```

**Response:**
```json
{
  "response": "AI response text",
  "conversationId": "conversation-id",
  "contextUsed": true,
  "urlsExtracted": 0
}
```

### `POST /api/user-info`
Store or update user information for personalization.

**Request Body:**
```json
{
  "userId": "user-id",
  "info": "User information text"
}
```

### `POST /notes`
Add a note to the knowledge base.

**Request Body:**
```json
{
  "text": "Text to add to knowledge base"
}
```

### `DELETE /notes/:id`
Delete a note from the knowledge base.

## 🔍 How It Works

1. **User Query**: User sends a message through the chat interface
2. **URL Detection**: System automatically detects URLs in the message
3. **Content Extraction**: If URLs are found, content is extracted and added to the knowledge base
4. **Vector Search**: Query is converted to embeddings and searched in Vectorize
5. **Context Retrieval**: Relevant context is retrieved from the knowledge base
6. **Conversation History**: Previous messages are loaded for context
7. **AI Response**: AI model generates a response using context and history
8. **Storage**: Conversation is saved to the database

## 🧪 Testing

Run tests using:

```bash
npm test
```

## 📝 Features in Detail

### RAG Workflow

The `RAGWorkflow` class handles document processing:

1. Splits text into chunks using `RecursiveCharacterTextSplitter`
2. Stores chunks in D1 database
3. Generates embeddings using Cloudflare AI
4. Stores embeddings in Vectorize for semantic search

### Conversation Management

- Each conversation has a unique `conversationId`
- Messages are stored with roles (user/assistant/system)
- Last 10 messages are used for context
- Supports multi-turn conversations

### URL Processing

- Automatically detects URLs in messages
- Extracts content from HTML pages
- Processes and indexes extracted content
- Provides feedback to users about processed URLs

## 🔐 Security Notes

- Never commit `.dev.vars` or `.env` files
- API keys should be stored as Cloudflare secrets in production:
  ```bash
  npx wrangler secret put MISTRAL_API_KEY
  ```
- The `.gitignore` file already excludes sensitive files

## 🛠️ Development

### Adding New Features

1. Modify `src/index.js` for new endpoints or functionality
2. Update the database schema in `schema.sql` if needed
3. Run migrations: `npx wrangler d1 execute database --file=./schema.sql`
4. Test locally with `npm run dev`

### Debugging

- Use `console.log()` for debugging (visible in Wrangler dev console)
- Check Cloudflare Workers dashboard for production logs
- Use Wrangler's observability features (enabled in config)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is private and proprietary.

## 👤 Author

Syed Danish Hussain

## 🙏 Acknowledgments

- Built with Cloudflare Workers
- Uses Mistral AI and Cloudflare AI models
- Powered by Hono framework

---

**Note**: This is a personal assistant chatbot configured for specific use cases. Modify the user ID and personalization settings as needed for your deployment.

