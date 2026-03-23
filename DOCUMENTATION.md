# AI Chatbot SaaS Platform — Technical Documentation

## Table of Contents

1. [Introduction](#1-introduction)
2. [Prerequisites](#2-prerequisites)
3. [Project Setup](#3-project-setup)
4. [Architecture Overview](#4-architecture-overview)
5. [Backend — Module by Module](#5-backend--module-by-module)
6. [Frontend — Page by Page](#6-frontend--page-by-page)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Data Flow Walkthroughs](#9-data-flow-walkthroughs)
10. [Embeddable Widget](#10-embeddable-widget)
11. [Security](#11-security)
12. [Configuration](#12-configuration)
13. [Deployment Guide](#13-deployment-guide)

---

## 1. Introduction

### What is this platform?

This is a SaaS (Software as a Service) application that allows users to create AI-powered chatbots trained on their own documents. The chatbots answer questions based strictly on the uploaded content, preventing AI hallucination.

### Core Features

- **User Authentication** — Secure signup/login with JWT tokens
- **Chatbot Management** — Create and manage multiple chatbots
- **Document Ingestion** — Upload PDFs or submit website URLs as knowledge sources
- **Background Processing** — Documents are processed asynchronously via a job queue
- **AI-Powered Chat** — Retrieval-Augmented Generation (RAG) pipeline for accurate answers
- **Embeddable Widget** — Deploy chatbots on any website with one script tag
- **Conversation History** — All conversations and messages are persisted

### How it works (Simple Version)

1. You sign up and create a chatbot
2. You feed it documents (PDFs, website URLs)
3. The system reads those documents, breaks them into small pieces, and converts each piece into a mathematical representation called an "embedding" (a vector of 1,536 numbers that captures the meaning of the text)
4. When someone asks a question, the system converts the question into the same type of vector, finds the document pieces with the most similar meaning, gives those to GPT along with the question, and returns an answer grounded in the actual documents

---

## 2. Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | >= 18 | Runtime for backend and frontend |
| PostgreSQL | >= 14 | Database (with pgvector extension) |
| Redis | >= 6 | Job queue for background processing |
| npm | >= 9 | Package manager |

### Installing pgvector

pgvector is a PostgreSQL extension that adds vector similarity search. It must be installed on your PostgreSQL instance:

```bash
# macOS (Homebrew)
brew install pgvector

# Ubuntu/Debian
sudo apt install postgresql-16-pgvector

# Or compile from source
git clone https://github.com/pgvector/pgvector.git
cd pgvector && make && sudo make install
```

---

## 3. Project Setup

### 3.1 Clone and Install

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your database URL, JWT secret, and OpenAI key

# Frontend
cd frontend
npm install
```

### 3.2 Configure Environment Variables

Edit `backend/.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://username@localhost:5432/saas_db?schema=public"
JWT_SECRET="a-strong-random-secret-at-least-32-chars"
JWT_EXPIRATION="7d"
REDIS_HOST="localhost"
REDIS_PORT=6379
OPENAI_API_KEY="sk-your-real-openai-api-key"
```

### 3.3 Setup Database

```bash
cd backend

# Create database
createdb saas_db

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate
```

### 3.4 Start the Application

```bash
# Terminal 1: Start Redis (if not running)
redis-server

# Terminal 2: Start backend
cd backend
npm run start:dev

# Terminal 3: Start frontend
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 4. Architecture Overview

### 4.1 High-Level Architecture

The system follows a **modular monolith** pattern on the backend — all modules run in a single NestJS process but are cleanly separated by domain responsibility.

```
Client Browser
    │
    ├── React Frontend (port 5173)
    │       Communicates with backend via REST API
    │       JWT token stored in localStorage
    │       Vite proxy forwards /api/* to backend
    │
    └── Embeddable Widget (any website)
            Self-contained vanilla JS
            Communicates directly with backend
            Auth via public token (no JWT)

Backend Server (port 3000)
    │
    ├── NestJS Application
    │   ├── Auth Module ──────── JWT strategy, login/signup
    │   ├── Users Module ─────── Profile management
    │   ├── Chatbots Module ──── CRUD for chatbots
    │   ├── Ingestion Module ─── File upload, URL submit, BullMQ queue
    │   ├── Embedding Module ─── OpenAI embedding API wrapper
    │   ├── Vector Store Module ─ pgvector CRUD and search
    │   ├── Search Module ────── Standalone similarity search
    │   ├── Chat Module ──────── RAG pipeline, conversation management
    │   └── Widget Module ────── Public API for embeddable widget
    │
    ├── PostgreSQL (port 5432)
    │   └── pgvector extension for vector similarity search
    │
    ├── Redis (port 6379)
    │   └── BullMQ job queue for async document processing
    │
    └── OpenAI API (external)
        ├── text-embedding-3-small (1,536 dimensions)
        └── gpt-4o-mini (chat completion)
```

### 4.2 Request Flow

Every authenticated request follows this path:

```
Browser → Vite Dev Server (proxy) → NestJS → JwtAuthGuard → Controller → Service → Database
```

The Vite dev server proxies all `/api/*` requests to `http://localhost:3000`, avoiding CORS issues during development.

---

## 5. Backend — Module by Module

### 5.1 Auth Module (`src/modules/auth/`)

**Files:** `auth.controller.ts`, `auth.service.ts`, `auth.module.ts`, `strategies/jwt.strategy.ts`, `dto/login.dto.ts`, `dto/signup.dto.ts`, `dto/auth-response.dto.ts`

**What it does:**
- Handles user registration and login
- Hashes passwords with bcrypt (12 salt rounds)
- Issues JWT tokens signed with `JWT_SECRET`
- Validates JWT tokens on every protected request via Passport strategy

**Signup flow:**
1. Check if email already exists → 409 Conflict if so
2. Hash password with bcrypt
3. Create user record in database
4. Generate JWT token with payload `{ sub: userId, email }`
5. Return `{ accessToken, user }`

**Login flow:**
1. Find user by email → 401 if not found
2. Compare password hash with bcrypt → 401 if wrong
3. Check `isActive` flag → 401 if deactivated
4. Generate and return JWT token

### 5.2 Users Module (`src/modules/users/`)

**What it does:**
- CRUD operations on user profiles
- `excludePassword()` utility strips the password hash from all responses

**Key design:** The `password` field is never returned to the client — every controller method calls `excludePassword()` before responding.

### 5.3 Chatbots Module (`src/modules/chatbots/`)

**What it does:**
- Create, list, get, and delete chatbots
- Each chatbot belongs to one user (enforced via `findOneByUser` ownership check)
- Each chatbot gets a unique `publicToken` (auto-generated UUID) used for the embeddable widget

### 5.4 Ingestion Module (`src/modules/ingestion/`)

**Files:** `ingestion.controller.ts`, `ingestion.service.ts`, `ingestion.processor.ts`, `chunker.ts`, `extractors/pdf.extractor.ts`, `extractors/website.extractor.ts`, `ingestion.constants.ts`

**What it does:**
- Accepts PDF file uploads (multer, max 20MB, PDF-only filter)
- Accepts website URLs for scraping
- Creates a document record with `status: PROCESSING`
- Pushes a job to the BullMQ `ingestion` queue
- Returns immediately (non-blocking)

**The Processor (Worker):**
The `IngestionProcessor` class extends BullMQ's `WorkerHost`. It runs with concurrency 3 (processes up to 3 documents simultaneously). For each job:

1. **Extract text:** PDF uses `pdf-parse` (PDFParse class in v4). Website uses `fetch` + `cheerio` — fetches the HTML, removes script/style/nav/footer/header/noscript/iframe/svg tags, extracts body text.

2. **Chunk text:** The `chunkText()` function splits by sentence boundaries, accumulates until 500-1000 tokens, then starts a new chunk with 2-sentence overlap. Short trailing chunks are merged into the previous one to avoid tiny orphans. Token count is estimated at ~4 characters per token.

3. **Generate embeddings:** Sends chunks to OpenAI in batches of 100. Each chunk becomes a 1,536-dimensional vector. The service includes retry logic (3 attempts, exponential backoff) for rate limits and transient errors.

4. **Store vectors:** Inserts chunks with their embeddings into `document_chunks` table via raw SQL (Prisma doesn't natively support pgvector types). Inserts are batched in transactions of 50.

5. **Update status:** Sets document status to `COMPLETED` (or `FAILED` with error message on failure).

### 5.5 Embedding Module (`src/modules/embedding/`)

**What it does:**
- Wraps the OpenAI Embeddings API
- `embedSingle(text)` — embed one text, returns `number[]`
- `embedBatch(texts)` — embed many texts, auto-batches at 100
- Input sanitization: collapses whitespace, truncates to ~32K chars (8191 token limit)
- Retry with exponential backoff on 429/500/503/network errors
- Startup warning if API key is unconfigured

### 5.6 Vector Store Module (`src/modules/vector-store/`)

**What it does:**
- Stores chunk text + embedding vectors in PostgreSQL using pgvector
- Performs cosine similarity search
- Auto-creates the `vector` extension and HNSW index on startup

**Similarity search query:**
```sql
SELECT dc.content, 1 - (dc.embedding <=> $1::vector) AS score
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
WHERE d.chatbot_id = $2
  AND d.status = 'COMPLETED'
  AND dc.embedding IS NOT NULL
  AND 1 - (dc.embedding <=> $1::vector) >= $3  -- min score threshold
ORDER BY dc.embedding <=> $1::vector
LIMIT $4
```

The `<=>` operator is pgvector's cosine distance. `1 - distance = similarity`. The HNSW index (`m=16, ef_construction=64`) makes this fast even with millions of rows.

### 5.7 Chat Module (`src/modules/chat/`)

**What it does:**
- Implements the full RAG pipeline
- Manages conversations and messages
- Two services: `ChatService` (RAG pipeline) and `ConversationService` (CRUD)

**RAG pipeline (`ChatService.sendMessage()`):**
1. Verify chatbot ownership
2. Create or resume conversation
3. Save user message to DB
4. Auto-title new conversations from the first message
5. Embed the query using `EmbeddingService`
6. Search for top 5 relevant chunks using `VectorStoreService`
7. Load last 20 messages as conversation history
8. Build system prompt with context + history
9. Call OpenAI GPT-4o-mini (temperature=0.3, max_tokens=1024)
10. Save assistant response to DB (with chunk metadata as `contextChunks` JSON)
11. Return response

### 5.8 Widget Module (`src/modules/widget/`)

**What it does:**
- Provides a public API (no JWT required) for the embeddable chat widget
- Authentication via chatbot `publicToken` instead of user JWT
- Tracks anonymous visitors via `visitorId`

**Endpoints:**
- `GET /api/widget/script` — serves the `widget.js` file
- `GET /api/widget/config?token=xxx` — returns chatbot name/description
- `POST /api/widget/message` — processes a chat message (same RAG pipeline)

### 5.9 Common Utilities (`src/common/`)

- **JwtAuthGuard** — Passport guard that validates JWT tokens
- **CurrentUser decorator** — Extracts user data from the request (set by Passport)
- **AllExceptionsFilter** — Global error handler that catches all exceptions and returns structured JSON responses

---

## 6. Frontend — Page by Page

### 6.1 Login Page (`/login`)

Centered card with email and password fields. On submit, calls `POST /api/auth/login`. On success, stores token and user in Zustand store (persisted to `localStorage`), redirects to `/dashboard`. Shows inline error on failure.

### 6.2 Signup Page (`/signup`)

Same layout as login but with first name, last name, email, and password fields. Calls `POST /api/auth/signup`. Password has a minimum length of 8 characters enforced by the backend.

### 6.3 Dashboard (`/dashboard`)

Shows:
- Greeting with the user's first name (or email prefix)
- Card with total chatbot count (fetched from `GET /api/chatbots`)
- Quick-create card that navigates to the chatbot list with the create form pre-opened

### 6.4 Chatbot List (`/chatbots`)

- Grid of chatbot cards (name, description, creation date)
- Inline create form (name + optional description) that appears when clicking "New chatbot"
- Click a card → navigates to `/chatbots/:id`
- Delete button (visible on hover) with `confirm()` dialog
- Supports receiving `openCreate: true` in location state (from Dashboard's "New chatbot" button)

### 6.5 Chatbot Detail (`/chatbots/:id`)

Three-tab layout:

**Documents tab:**
- PDF upload: hidden file input triggered by a dashed-border click area
- URL submit: text input + submit button
- Document list: table with name/URL, type badge, status badge (color-coded: yellow=processing, green=completed, red=failed), error display for failed documents

**Chat tab:**
- Left sidebar: conversation list with "New chat" button, each conversation shows title, delete button on hover
- Right pane: message bubbles (user=blue right-aligned, assistant=gray left-aligned), auto-scroll to bottom, loading spinner during AI response, text input + send button at bottom
- Sends to `POST /api/chat/message`, creates new conversation if none selected

**Embed tab:**
- Shows the ready-to-copy `<script>` tag with the chatbot's public token
- Copy button with "Copied!" confirmation
- Configuration reference table (data-token, data-color, data-host)

### 6.6 Core Components

- **Layout.tsx** — Sidebar navigation (Dashboard, Chatbots) + user email + sign out button. Responsive: sidebar on desktop, top bar on mobile.
- **ProtectedRoute.tsx** — Checks Zustand store for token, redirects to `/login` if absent.
- **Spinner.tsx** — SVG-based animated loading spinner.

### 6.7 API Client (`src/api/client.ts`)

Axios instance with:
- **Request interceptor:** reads `auth-storage` from localStorage, attaches `Authorization: Bearer <token>` header
- **Response interceptor:** catches 401 responses, clears auth storage, redirects to `/login`

### 6.8 Auth Store (`src/stores/auth.ts`)

Zustand store with `persist` middleware:
- **State:** `token: string | null`, `user: AuthUser | null`
- **Actions:** `setAuth(token, user)`, `logout()`
- **Persistence:** automatically saved to/loaded from `localStorage` under key `auth-storage`

---

## 7. Database Schema

### Entity Relationship Diagram

```
┌──────────────┐       ┌───────────────┐       ┌───────────────────┐
│    users     │       │   chatbots    │       │    documents      │
├──────────────┤       ├───────────────┤       ├───────────────────┤
│ id       (PK)│──┐    │ id        (PK)│──┐    │ id            (PK)│
│ email        │  │    │ name          │  │    │ type (PDF/WEBSITE)│
│ password     │  │    │ description   │  │    │ status            │
│ first_name   │  ├───>│ public_token  │  │    │ file_name         │
│ last_name    │  │    │ user_id   (FK)│  ├───>│ source_url        │
│ is_active    │  │    │ created_at    │  │    │ chatbot_id    (FK)│
│ created_at   │  │    │ updated_at    │  │    │ error             │
│ updated_at   │  │    └───────────────┘  │    │ created_at        │
└──────────────┘  │                       │    │ updated_at        │
                  │    ┌───────────────┐  │    └─────────┬─────────┘
                  │    │conversations  │  │              │
                  │    ├───────────────┤  │    ┌─────────▼─────────┐
                  │    │ id        (PK)│  │    │ document_chunks   │
                  │    │ title         │  │    ├───────────────────┤
                  ├───>│ user_id   (FK)│  │    │ id            (PK)│
                  │    │ visitor_id    │  │    │ content           │
                  │    │ chatbot_id(FK)│<─┘    │ chunk_index       │
                  │    │ created_at    │       │ token_count       │
                  │    │ updated_at    │       │ embedding (vec)   │
                  │    └──────┬────────┘       │ document_id   (FK)│
                  │           │                │ created_at        │
                  │    ┌──────▼────────┐       └───────────────────┘
                  │    │   messages    │
                  │    ├───────────────┤
                  │    │ id        (PK)│
                  │    │ role          │
                  │    │ content       │
                  │    │ context_chunks│
                  │    │ conversation_id│
                  │    │ created_at    │
                  │    └───────────────┘
```

### Key Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `chatbots` | `user_id` | Fast lookup of user's chatbots |
| `documents` | `chatbot_id` | Fast lookup of chatbot's documents |
| `document_chunks` | `document_id` | Fast lookup of document's chunks |
| `document_chunks` | `embedding` (HNSW) | Fast vector similarity search |
| `conversations` | `chatbot_id`, `user_id`, `visitor_id` | Fast conversation lookups |
| `messages` | `conversation_id` | Fast message history retrieval |

---

## 8. API Reference

### Auth Endpoints

#### POST /api/auth/signup
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "mypassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### POST /api/auth/login
Sign in to an existing account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**Response (200):** Same as signup.

---

### Chatbot Endpoints (JWT Required)

#### POST /api/chatbots
Create a new chatbot.

**Request:**
```json
{
  "name": "Support Bot",
  "description": "Answers customer questions"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Support Bot",
  "description": "Answers customer questions",
  "publicToken": "uuid",
  "userId": "uuid",
  "createdAt": "2026-03-19T...",
  "updatedAt": "2026-03-19T..."
}
```

#### GET /api/chatbots
List all chatbots for the authenticated user. Returns array of chatbot objects.

#### GET /api/chatbots/:id
Get a specific chatbot. Returns 403 if not owned by the user.

#### DELETE /api/chatbots/:id
Delete a chatbot and all its data (documents, chunks, conversations). Returns 204.

---

### Ingestion Endpoints (JWT Required)

#### POST /api/ingestion/pdf
Upload a PDF file.

**Request:** `multipart/form-data` with fields:
- `file` — PDF file (max 20MB)
- `chatbotId` — UUID of the chatbot

**Response (201):**
```json
{
  "id": "uuid",
  "type": "PDF",
  "status": "PROCESSING",
  "fileName": "manual.pdf",
  "chatbotId": "uuid",
  "createdAt": "2026-03-19T..."
}
```

#### POST /api/ingestion/website
Submit a URL for scraping.

**Request:**
```json
{
  "chatbotId": "uuid",
  "url": "https://docs.example.com/getting-started"
}
```

**Response (201):** Same structure as PDF with `type: "WEBSITE"` and `sourceUrl` field.

#### GET /api/ingestion/chatbot/:chatbotId
List all documents for a chatbot. Returns array ordered by creation date (newest first).

---

### Chat Endpoints (JWT Required)

#### POST /api/chat/message
Send a message and receive an AI response.

**Request:**
```json
{
  "chatbotId": "uuid",
  "message": "How do I reset my password?",
  "conversationId": "uuid"
}
```

`conversationId` is optional. Omit it to start a new conversation.

**Response (201):**
```json
{
  "conversationId": "uuid",
  "message": {
    "id": "uuid",
    "role": "ASSISTANT",
    "content": "Based on the documentation, you can reset...",
    "createdAt": "2026-03-19T..."
  },
  "contextUsed": 3
}
```

#### GET /api/chat/conversations?chatbotId=uuid
List conversations for a chatbot. Returns array with last message included.

#### GET /api/chat/conversations/:id
Get a conversation with full message history.

#### DELETE /api/chat/conversations/:id
Delete a conversation and all its messages. Returns 204.

---

### Widget Endpoints (Public — No Auth)

#### GET /api/widget/script
Returns the `widget.js` file with `Content-Type: application/javascript`.

#### GET /api/widget/config?token=xxx
Returns chatbot name and description for the widget header.

#### POST /api/widget/message
Process a chat message from the widget.

**Request:**
```json
{
  "token": "chatbot-public-token",
  "visitorId": "v_abc123",
  "message": "What are your opening hours?",
  "conversationId": "uuid"
}
```

**Response:**
```json
{
  "conversationId": "uuid",
  "reply": "Our opening hours are..."
}
```

---

## 9. Data Flow Walkthroughs

### 9.1 User Signs Up and Creates a Chatbot

```
1. User fills signup form → frontend calls POST /api/auth/signup
2. Backend hashes password, creates user record, generates JWT
3. Frontend stores JWT in localStorage, redirects to /dashboard
4. User clicks "New Chatbot", enters name → frontend calls POST /api/chatbots
5. Backend creates chatbot record (with auto-generated publicToken)
6. Frontend refreshes list, shows the new chatbot card
```

### 9.2 User Uploads a PDF

```
1. User clicks "Upload PDF", selects file
2. Frontend sends multipart POST /api/ingestion/pdf
3. Backend:
   a. Saves file to uploads/ directory
   b. Creates document record (status=PROCESSING)
   c. Pushes job to Redis queue
   d. Returns document record immediately
4. Frontend shows document with "processing" badge
5. Background worker picks up job:
   a. Reads PDF file, extracts text
   b. Splits into chunks (500-1000 tokens each)
   c. Sends chunks to OpenAI → gets embeddings
   d. Stores chunks + embeddings in PostgreSQL
   e. Updates document status to COMPLETED
6. User refreshes page → sees "completed" badge
```

### 9.3 User Asks a Question

```
1. User types "How do I configure SSO?" in chat
2. Frontend calls POST /api/chat/message
3. Backend:
   a. Creates conversation (if new)
   b. Saves user message to DB
   c. Sends question to OpenAI Embedding API → 1,536-dim vector
   d. Searches pgvector for top 5 similar chunks (cosine similarity)
   e. Builds prompt: system instructions + context chunks + chat history + question
   f. Sends to OpenAI GPT-4o-mini → gets response
   g. Saves assistant message to DB
   h. Returns response
4. Frontend shows AI response in chat bubble
```

### 9.4 Website Visitor Uses Widget

```
1. Third-party website has <script data-token="xxx"> tag
2. Widget script loads, creates floating chat bubble
3. Fetches chatbot name from GET /api/widget/config?token=xxx
4. Visitor clicks bubble, types question
5. Widget sends POST /api/widget/message with token + visitorId
6. Backend validates token, runs same RAG pipeline
7. Widget shows response in chat window
8. conversationId is maintained for multi-turn conversation
```

---

## 10. Embeddable Widget

### Integration

Add this to any HTML page:

```html
<script
  src="https://your-domain.com/api/widget/script"
  data-token="CHATBOT_PUBLIC_TOKEN"
  defer
></script>
```

### Configuration Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-token` | Yes | Chatbot's public token (UUID) |
| `data-host` | No | Backend URL. Defaults to the script's origin. |
| `data-color` | No | Hex color for theme. Default: `#2563eb` (blue) |

### Widget Behavior

- **Floating button:** 56px round button in bottom-right corner (z-index: max)
- **Chat panel:** 380x520px, opens above the button
- **Visitor tracking:** Random visitor ID generated and stored in `localStorage`
- **Conversation persistence:** `conversationId` maintained in memory per session
- **Auto-fetch:** Bot name loaded from `/api/widget/config` on script load
- **Error handling:** Shows "Sorry, something went wrong" on API failure
- **Loading state:** "Thinking..." message shown while waiting for AI response

---

## 11. Security

### Authentication
- **Password storage:** bcrypt hash with 12 salt rounds — computationally expensive to brute-force
- **JWT tokens:** signed with HS256, 7-day expiry, contain only `sub` (userId) and `email`
- **Token validation:** Passport strategy verifies token on every request, checks user exists and `isActive === true`

### Input Validation
- All request bodies validated with `class-validator` decorators
- `ValidationPipe` with `whitelist: true` strips unknown fields
- `forbidNonWhitelisted: true` rejects requests with extra fields

### Data Isolation
- Every database query scopes to the authenticated user's ID
- `findOneByUser()` pattern: fetch record, compare `userId`, throw 403 if mismatch
- Widget conversations scoped to `visitorId` — cannot access other visitors' conversations

### HTTP Security
- **Helmet:** sets security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- **CORS:** configurable origin whitelist via `CORS_ORIGIN` env var
- **File upload:** PDF-only MIME type filter, 20MB size limit

### Error Handling
- Global exception filter catches all errors
- HTTP exceptions return structured JSON with status code, message, timestamp, path
- Unexpected errors log full stack trace but return generic 500 to clients

---

## 12. Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | — | `development`, `production`, or `test` |
| `PORT` | Yes | — | Server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret for signing JWT tokens (min 16 chars) |
| `JWT_EXPIRATION` | Yes | — | Token expiry (e.g., `7d`, `24h`) |
| `REDIS_HOST` | Yes | — | Redis hostname |
| `REDIS_PORT` | Yes | — | Redis port |
| `OPENAI_API_KEY` | Yes | — | OpenAI API key for embeddings and chat |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin |

### Startup Validation

All environment variables are validated at startup using `class-validator`. The app will refuse to start if any required variable is missing or invalid. The validation is defined in `src/config/env.validation.ts`.

---

## 13. Deployment Guide

### Production Checklist

1. **Set `NODE_ENV=production`**
2. **Use a strong `JWT_SECRET`** — at least 32 random characters
3. **Set `CORS_ORIGIN`** to your frontend's domain (not `*`)
4. **Use managed services:**
   - PostgreSQL: Supabase, Neon, AWS RDS (with pgvector)
   - Redis: Upstash, AWS ElastiCache
5. **Move file uploads to object storage** (S3, CloudFlare R2)
6. **Set a real `OPENAI_API_KEY`**
7. **Build the frontend:** `cd frontend && npm run build` → deploy `dist/` to a CDN
8. **Build the backend:** `cd backend && npm run build` → run `node dist/main.js`
9. **Run migrations:** `npx prisma migrate deploy`

### Recommended Hosting

| Component | Service | Why |
|-----------|---------|-----|
| Backend | Railway, Render, AWS ECS | Easy Node.js hosting |
| Frontend | Vercel, Netlify, CloudFlare Pages | Static site hosting with CDN |
| Database | Supabase, Neon | Managed PostgreSQL with pgvector |
| Redis | Upstash | Serverless Redis |
| Files | AWS S3, CloudFlare R2 | Object storage for PDFs |
