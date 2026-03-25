# Project Context Document — AI Chatbot SaaS Platform

Use this document to understand the full project. You can copy-paste this entire file into ChatGPT, Claude, or any AI assistant to give them complete context about the project.

---

## What This Project Is

This is a full-stack SaaS (Software as a Service) platform that lets users create custom AI chatbots trained on their own data. Users sign up, create a chatbot, upload PDFs or website URLs, and the system builds a knowledge base. Then users (or website visitors via an embeddable widget) can ask questions and get AI-powered answers grounded strictly in the uploaded content.

The system uses RAG (Retrieval-Augmented Generation) — it doesn't just ask an AI model to answer from general knowledge. Instead, it searches the uploaded documents for relevant content first, then asks the AI to answer based only on that content. This prevents hallucination and ensures answers are factual.

---

## Tech Stack

### Frontend
- React 19 + TypeScript
- Vite 7.3 (build tool)
- Tailwind CSS 4.1
- Metronic v9.4.7 UI component library (Card, Button, Input, Badge, Tabs, Dialog, ScrollArea, etc.)
- React Router 7.13
- Zustand (auth state management, persisted to localStorage)
- Axios (HTTP client with JWT Bearer token interceptor)
- Lucide React (icons)

### Backend
- NestJS 11 + TypeScript (Node.js framework)
- Prisma 6.19 (ORM for PostgreSQL)
- Passport + JWT (authentication)
- bcrypt (password hashing, 12 salt rounds)
- BullMQ + Redis (background job queue)
- class-validator (DTO validation)
- Helmet (security headers)
- Multer (file uploads)

### AI Models
- Groq API with Llama 3.3 70B Versatile (chat completion — generates answers)
- Ollama with nomic-embed-text (local text embeddings for development)
- HuggingFace Inference API with all-MiniLM-L6-v2 (cloud text embeddings for production fallback)

### Database
- PostgreSQL 16 with pgvector extension (stores all data + vector embeddings)
- Redis 8.6 (BullMQ job queue backend)

### Deployment
- Frontend: Vercel (static hosting)
- Backend: Local machine exposed via ngrok (can be deployed to Railway/Render)
- Source code: GitHub (github.com/Imlogesh7/ai-chatbot-saas)

---

## Database Schema (Prisma)

There are 7 tables in PostgreSQL:

### users
- id (UUID, primary key)
- email (unique)
- password (bcrypt hashed)
- firstName, lastName (optional)
- isActive (boolean, default true)
- createdAt, updatedAt

### chatbots
- id (UUID, primary key)
- name (string)
- description (optional)
- publicToken (UUID, unique, auto-generated — used for widget authentication)
- userId (foreign key → users, CASCADE delete)
- createdAt, updatedAt

### documents
- id (UUID, primary key)
- type (enum: PDF | WEBSITE)
- status (enum: PROCESSING | COMPLETED | FAILED)
- fileName (for PDFs)
- sourceUrl (for websites)
- chatbotId (foreign key → chatbots, CASCADE delete)
- error (string, stores failure reason)
- createdAt, updatedAt

### document_chunks
- id (UUID, primary key)
- content (text — the actual chunk of text)
- chunkIndex (integer — position within the document)
- tokenCount (integer — estimated token count)
- embedding (vector type via pgvector — the AI embedding)
- documentId (foreign key → documents, CASCADE delete)
- createdAt

### conversations
- id (UUID, primary key)
- title (auto-generated from first message, max 60 chars)
- chatbotId (foreign key → chatbots, CASCADE delete)
- userId (optional, foreign key → users — for logged-in users)
- visitorId (optional string — for anonymous widget visitors)
- createdAt, updatedAt

### messages
- id (UUID, primary key)
- role (enum: USER | ASSISTANT)
- content (text)
- contextChunks (JSON, optional — stores which chunks were used to generate the answer)
- conversationId (foreign key → conversations, CASCADE delete)
- createdAt

### Indexes
- HNSW vector index on document_chunks.embedding for fast cosine similarity search
- Standard B-tree indexes on all foreign keys

---

## Backend Architecture (NestJS Modules)

The backend is a modular NestJS monolith. Each module has its own controller, service, DTOs, and is cleanly separated:

### Auth Module (src/modules/auth/)
- POST /api/auth/signup — register a new user, returns JWT token
- POST /api/auth/login — authenticate, returns JWT token
- Uses Passport JWT strategy for protecting routes
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens signed with HS256, expire in 7 days

### Users Module (src/modules/users/)
- GET /api/users/me — get current user profile
- PATCH /api/users/me — update profile
- DELETE /api/users/me — delete account
- GET /api/users/:id — get user by ID
- All endpoints strip password from response

### Chatbots Module (src/modules/chatbots/)
- POST /api/chatbots — create chatbot
- GET /api/chatbots — list user's chatbots
- GET /api/chatbots/:id — get single chatbot (ownership enforced)
- DELETE /api/chatbots/:id — delete chatbot (cascades to all data)

### Ingestion Module (src/modules/ingestion/)
- POST /api/ingestion/pdf — upload PDF (multipart, max 20MB)
- POST /api/ingestion/website — submit URL for scraping
- GET /api/ingestion/chatbot/:chatbotId — list documents
- GET /api/ingestion/:id — get single document
- Creates document record with status=PROCESSING, pushes job to BullMQ queue
- Returns immediately (non-blocking)

### Ingestion Worker (inside ingestion module)
- BullMQ processor with concurrency 3
- Pipeline: Extract text → Chunk (500-1000 tokens, 2-sentence overlap) → Embed → Store in pgvector
- PDF extraction: pdf-parse v4 (PDFParse class)
- Website extraction: fetch + cheerio (strips script/style/nav/footer/header)
- Retry: 3 attempts with exponential backoff (5s, 10s, 20s)
- On failure: document status → FAILED with error message

### Embedding Module (src/modules/embedding/)
- Global module, injectable everywhere
- On startup: tries to connect to Ollama; if unavailable, falls back to HuggingFace free API
- embedSingle(text) → number[] (one embedding)
- embedBatch(texts) → number[][] (batch, sequential for Ollama)
- Retry logic: 3 attempts with exponential backoff

### Vector Store Module (src/modules/vector-store/)
- Global module
- On startup: creates pgvector extension and HNSW index if missing
- storeChunks(documentId, chunks, embeddings) — transactional batch insert (50 per transaction)
- similaritySearch(queryEmbedding, chatbotId, limit, minScore) — cosine similarity via pgvector
- deleteByDocument(documentId) — for re-processing

### Search Module (src/modules/search/)
- POST /api/search — standalone similarity search endpoint
- Embeds query → searches pgvector → returns top results with scores

### Chat Module (src/modules/chat/)
- POST /api/chat/message — the main RAG pipeline endpoint
- GET /api/chat/conversations?chatbotId=uuid — list conversations
- GET /api/chat/conversations/:id — get conversation with messages
- DELETE /api/chat/conversations/:id — delete conversation

RAG Pipeline (ChatService.sendMessage):
1. Verify chatbot ownership
2. Create or resume conversation
3. Save USER message to DB
4. Auto-title new conversations from first message
5. Embed the query using EmbeddingService
6. Search for top 5 relevant chunks using VectorStoreService (cosine similarity, min score 0.3)
7. Load last 20 messages as conversation history
8. Build prompt: system instruction ("answer based ONLY on context") + numbered context chunks + history + user message
9. Call Groq API with Llama 3.3 70B (temperature=0.3, max_tokens=1024)
10. Save ASSISTANT response to DB (with chunk metadata as contextChunks JSON)
11. Return response

### Widget Module (src/modules/widget/)
- PUBLIC endpoints (no JWT required)
- GET /api/widget/script — serves the widget.js file
- GET /api/widget/config?token=xxx — returns chatbot name/description
- POST /api/widget/message — processes chat message (auth via publicToken + visitorId)
- Same RAG pipeline as chat module but for anonymous visitors

---

## Frontend Architecture

### Entry Point
- main.tsx → App.tsx → ThemeProvider → HelmetProvider → BrowserRouter → AppRoutingSetup

### Routing (src/routing/app-routing-setup.tsx)
- /login → LoginPage (public)
- /signup → SignupPage (public)
- /dashboard → DashboardPage (protected, inside AppLayout)
- /chatbots → ChatbotListPage (protected, inside AppLayout)
- /chatbots/:id → ChatbotDetailPage (protected, inside AppLayout)
- /* → redirect to /dashboard

### Auth Guard (src/routing/require-auth.tsx)
- Checks Zustand store for token
- If no token → redirect to /login
- Uses React Router's Outlet pattern

### Layout (src/components/app-layout.tsx)
- Dark sidebar (slate-900) with Dashboard and Chatbots navigation
- Header with dark mode toggle and user email
- Mobile-responsive with hamburger menu overlay
- Uses NavLink for active state highlighting

### API Layer (src/api/)
- client.ts — Axios instance with baseURL from VITE_API_URL env var, JWT interceptor, 401 auto-logout, ngrok-skip-browser-warning header
- auth.ts — login(), signup() functions with typed request/response
- chatbots.ts — listChatbots(), getChatbot(), createChatbot(), deleteChatbot()
- ingestion.ts — uploadPdf(), submitUrl(), listDocuments()
- chat.ts — sendMessage(), getConversations(), getConversation(), deleteConversation()

### Auth Store (src/stores/auth.ts)
- Zustand with persist middleware
- State: token (string|null), user (AuthUser|null)
- Actions: setAuth(token, user), logout()
- Persisted to localStorage under key "auth-storage"

### Pages
- Login/Signup — Metronic Card components, form validation, API integration
- Dashboard — stat cards (chatbot count), quick-create action
- ChatbotList — grid of cards, Dialog modal for creating, delete with confirm
- ChatbotDetail — Tabs component with three tabs:
  - Documents: PDF upload (file picker), URL submit, document list with status badges
  - Chat: conversation sidebar, message bubbles (user=primary, assistant=muted), auto-scroll, loading spinner
  - Embed: copyable script tag, configuration reference

---

## Embeddable Widget (backend/public/widget.js)

- Self-contained vanilla JavaScript IIFE (~180 lines)
- Injects its own CSS (no external stylesheet needed)
- Creates a floating chat bubble (56px round button, bottom-right, max z-index)
- Opens a 380x520px chat panel
- Authenticates via chatbot's publicToken (no JWT needed)
- Generates and persists visitorId in localStorage
- Maintains conversationId for multi-turn conversation
- Fetches chatbot name from /api/widget/config on load
- Configurable via data attributes: data-token (required), data-host (optional), data-color (optional)

Usage:
```html
<script src="https://your-backend.com/api/widget/script" data-token="CHATBOT_PUBLIC_TOKEN" defer></script>
```

---

## Environment Variables

### Backend (.env)
- NODE_ENV — development | production | test
- PORT — server port (default 3000)
- DATABASE_URL — PostgreSQL connection string
- JWT_SECRET — secret for signing JWT tokens (min 16 chars)
- JWT_EXPIRATION — token expiry (e.g., "7d")
- REDIS_HOST — Redis hostname (for local dev)
- REDIS_PORT — Redis port (for local dev)
- REDIS_URL — Redis connection string (for production, e.g., Railway)
- GROQ_API_KEY — Groq API key for Llama 3.3 chat completion
- OLLAMA_URL — Ollama server URL (optional, defaults to http://localhost:11434)
- CORS_ORIGIN — allowed CORS origin (defaults to *)

### Frontend (.env)
- VITE_API_URL — backend API base URL (defaults to /api for local proxy, set to full URL for production)

---

## Key Design Decisions

1. RAG over fine-tuning — documents are chunked and searched at query time, not used to fine-tune a model. This means new documents are instantly searchable without retraining.

2. pgvector over separate vector DB — keeps everything in one PostgreSQL database instead of adding Pinecone/Weaviate/Qdrant. Simpler deployment, ACID transactions, and the HNSW index provides fast similarity search.

3. BullMQ for async processing — document ingestion returns immediately. The heavy work (text extraction, embedding generation) happens in background workers. Users see real-time status updates (processing → completed/failed).

4. Dual embedding providers — Ollama for local development (free, fast, no API key), HuggingFace free API as production fallback. The service auto-detects which is available on startup.

5. Groq over OpenAI for chat — Groq serves Llama 3.3 70B at ~500 tokens/sec, much faster than OpenAI. The OpenAI SDK is used with a custom baseURL pointing to Groq's API.

6. Widget authentication via publicToken — each chatbot gets a unique UUID token. No JWT needed for widget visitors. Visitor sessions tracked via random visitorId in localStorage.

7. Conversation userId is nullable — allows both authenticated users (via dashboard) and anonymous visitors (via widget) to have conversations.

---

## File Structure

```
Saas_product_2/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema (7 models)
│   │   ├── migrations/            # SQL migrations
│   │   └── sql/setup_pgvector.sql # Manual pgvector setup script
│   ├── public/
│   │   └── widget.js              # Embeddable chat widget
│   ├── uploads/                   # Uploaded PDF files
│   ├── src/
│   │   ├── main.ts                # Bootstrap (helmet, cors, validation pipe, exception filter)
│   │   ├── app.module.ts          # Root module (ConfigModule, BullModule, all feature modules)
│   │   ├── config/
│   │   │   └── env.validation.ts  # Startup env var validation
│   │   ├── prisma/
│   │   │   ├── prisma.service.ts  # PrismaClient wrapper with connect/disconnect lifecycle
│   │   │   └── prisma.module.ts   # Global Prisma module
│   │   ├── common/
│   │   │   ├── guards/jwt-auth.guard.ts
│   │   │   ├── decorators/current-user.decorator.ts
│   │   │   └── filters/http-exception.filter.ts
│   │   └── modules/
│   │       ├── auth/              # Login, signup, JWT strategy
│   │       ├── users/             # User CRUD
│   │       ├── chatbots/          # Chatbot CRUD
│   │       ├── ingestion/         # Upload, queue, extract, chunk, process
│   │       ├── embedding/         # Ollama / HuggingFace embedding wrapper
│   │       ├── vector-store/      # pgvector storage and similarity search
│   │       ├── search/            # Standalone search endpoint
│   │       ├── chat/              # RAG pipeline + conversation management
│   │       └── widget/            # Public widget API
│   ├── .env                       # Environment variables (not in git)
│   ├── .env.example               # Template
│   ├── Dockerfile                 # Multi-stage Docker build
│   ├── railway.json               # Railway deployment config
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx               # Entry point
│   │   ├── App.tsx                # Providers + router
│   │   ├── api/                   # Axios API clients (auth, chatbots, ingestion, chat)
│   │   ├── stores/                # Zustand auth store
│   │   ├── components/
│   │   │   ├── app-layout.tsx     # Sidebar + header layout
│   │   │   └── ui/               # Metronic UI components (50+ components)
│   │   ├── pages/
│   │   │   ├── auth/             # Login, Signup
│   │   │   ├── dashboard/        # Dashboard with stats
│   │   │   └── chatbots/         # List + Detail (Documents, Chat, Embed tabs)
│   │   ├── routing/              # Routes + auth guard
│   │   └── styles/               # Tailwind globals + Metronic theme
│   ├── vercel.json                # Vercel deployment config
│   └── package.json
│
├── DOCUMENTATION.md               # Full technical documentation
├── PRESENTATION.md                # 16-slide project presentation
├── AI_Models_and_Options.md       # AI model comparison document
└── PROJECT_CONTEXT.md             # This file
```

---

## Current State

- 14 registered users
- 14 chatbots created
- 11 documents processed (PDFs and websites)
- 39 text chunks with embeddings stored
- 11 conversations with 50 messages
- Frontend live on Vercel: https://frontend-ten-hazel-61.vercel.app
- Backend running locally, exposed via ngrok
- GitHub repo: https://github.com/Imlogesh7/ai-chatbot-saas
