# AI Chatbot SaaS Platform — Project Presentation

---

## Slide 1: Project Overview

**What is this?**

A full-stack SaaS platform that lets anyone create custom AI chatbots trained on their own data — PDFs and websites. The chatbot can then be embedded on any website with a single line of code.

**Key Value Proposition:**
- No AI expertise needed
- Upload documents, get a chatbot instantly
- Embed anywhere with one script tag
- Conversations are grounded in YOUR data — no hallucinations

---

## Slide 2: The User Journey

```
Sign Up → Create Chatbot → Upload Documents → Chat → Embed on Website
```

1. **Sign Up** — Create an account with email and password
2. **Create a Chatbot** — Give it a name (e.g., "Customer Support Bot")
3. **Upload Data** — Feed it PDFs or website URLs
4. **Background Processing** — System extracts text, splits into chunks, generates AI embeddings
5. **Chat** — Ask questions, get answers grounded in your documents
6. **Embed** — Copy a script tag, paste into any website — visitors get a floating chat widget

---

## Slide 3: System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│                                                                     │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │   React Frontend     │    │   Embeddable Widget (vanilla JS) │   │
│  │   (Vite + Tailwind)  │    │   Floating chat on any website   │   │
│  └──────────┬───────────┘    └──────────────┬───────────────────┘   │
│             │ JWT Auth                       │ Public Token Auth     │
└─────────────┼───────────────────────────────┼───────────────────────┘
              │                               │
┌─────────────▼───────────────────────────────▼───────────────────────┐
│                     NestJS BACKEND (API)                             │
│                                                                     │
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────────┐ ┌──────┐ ┌──────────┐  │
│  │ Auth │ │Users │ │Chatbots│ │Ingestion │ │ Chat │ │  Widget  │  │
│  └──────┘ └──────┘ └────────┘ └────┬─────┘ └──┬───┘ └────┬─────┘  │
│                                     │          │          │         │
│                              ┌──────▼──────────▼──────────▼──────┐  │
│                              │     AI Services Layer             │  │
│                              │  ┌───────────┐  ┌──────────────┐  │  │
│                              │  │ Embedding  │  │ Vector Store │  │  │
│                              │  │ (OpenAI)   │  │  (pgvector)  │  │  │
│                              │  └───────────┘  └──────────────┘  │  │
│                              └───────────────────────────────────┘  │
└──────────┬──────────────────┬──────────────────────┬────────────────┘
           │                  │                      │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌───────────▼──────────┐
    │ PostgreSQL  │   │   Redis     │   │      OpenAI API      │
    │ + pgvector  │   │  (BullMQ)   │   │ GPT-4o-mini          │
    │             │   │  Job Queue  │   │ text-embedding-3-small│
    └─────────────┘   └─────────────┘   └──────────────────────┘
```

---

## Slide 4: Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | User interface |
| **Styling** | Tailwind CSS v4 | Clean, responsive design |
| **Build Tool** | Vite | Fast development server |
| **State** | Zustand | Auth token management |
| **HTTP Client** | Axios | API calls with JWT interceptors |
| **Backend** | NestJS + TypeScript | REST API server |
| **Database** | PostgreSQL | All application data |
| **Vector DB** | pgvector (PostgreSQL extension) | AI embedding storage and search |
| **Queue** | BullMQ + Redis | Background job processing |
| **AI - Chat** | OpenAI GPT-4o-mini | Generating chat responses |
| **AI - Embeddings** | OpenAI text-embedding-3-small | Converting text to vectors |
| **Auth** | JWT + bcrypt | Secure authentication |
| **File Parsing** | pdf-parse | PDF text extraction |
| **Web Scraping** | cheerio | Website text extraction |

---

## Slide 5: Database Design

**7 tables** in PostgreSQL:

```
users
  │
  ├── chatbots (one user has many chatbots)
  │     │
  │     ├── documents (PDFs and URLs uploaded to this chatbot)
  │     │     │
  │     │     └── document_chunks (text pieces + AI embeddings)
  │     │
  │     └── conversations (chat sessions)
  │           │
  │           └── messages (individual chat messages)
  │
  └── conversations (user's chat sessions)
```

**Key Fields:**

| Table | Important Columns |
|-------|------------------|
| `users` | id, email, password (hashed), firstName, lastName |
| `chatbots` | id, name, description, publicToken (for widget), userId |
| `documents` | id, type (PDF/WEBSITE), status (PROCESSING/COMPLETED/FAILED), chatbotId |
| `document_chunks` | id, content (text), embedding (vector of 1536 floats), documentId |
| `conversations` | id, title, chatbotId, userId (nullable), visitorId (for widget) |
| `messages` | id, role (USER/ASSISTANT), content, contextChunks (JSON), conversationId |

---

## Slide 6: Authentication Flow

```
┌──────────┐         ┌──────────────┐         ┌──────────────┐
│  User    │         │   Frontend   │         │   Backend    │
└────┬─────┘         └──────┬───────┘         └──────┬───────┘
     │                      │                        │
     │  Enter email/pass    │                        │
     │─────────────────────>│                        │
     │                      │  POST /api/auth/signup │
     │                      │───────────────────────>│
     │                      │                        │ Hash password (bcrypt)
     │                      │                        │ Save to DB
     │                      │                        │ Generate JWT token
     │                      │    { accessToken, user }│
     │                      │<───────────────────────│
     │                      │                        │
     │                      │ Store token in         │
     │                      │ localStorage           │
     │                      │                        │
     │  Redirect to         │                        │
     │  Dashboard           │                        │
     │<─────────────────────│                        │
     │                      │                        │
     │  Every API call:     │ Authorization:         │
     │                      │ Bearer <token>         │
     │                      │───────────────────────>│ Verify JWT
     │                      │                        │ Extract userId
```

- Passwords are **never stored in plain text** — hashed with bcrypt (12 salt rounds)
- JWT tokens expire after **7 days**
- If a token expires or is invalid, the frontend automatically logs the user out

---

## Slide 7: Document Ingestion Pipeline

**What happens when you upload a PDF or submit a URL:**

```
Step 1: UPLOAD
  User uploads PDF / submits URL
       │
       ▼
Step 2: RECORD
  Create document record in database
  Status = "PROCESSING"
  Return immediately to user (non-blocking)
       │
       ▼
Step 3: QUEUE
  Push job to BullMQ queue (Redis)
  Worker picks it up in the background
       │
       ▼
Step 4: EXTRACT TEXT
  PDF → pdf-parse library reads all pages
  URL → fetch webpage, cheerio strips HTML tags, keeps body text
       │
       ▼
Step 5: CHUNK
  Split text into pieces of 500-1000 tokens
  2-sentence overlap between chunks (preserves context)
  Short trailing pieces merged into previous chunk
       │
       ▼
Step 6: EMBED
  Send chunks to OpenAI Embedding API (in batches of 100)
  Each chunk → array of 1,536 numbers (a "vector")
  This vector captures the MEANING of the text
       │
       ▼
Step 7: STORE
  Save each chunk + its vector to PostgreSQL (pgvector)
  Inserted in transactional batches of 50
       │
       ▼
Step 8: COMPLETE
  Update document status → "COMPLETED"
  If any step fails: status → "FAILED" + error message
  Failed jobs retry 3 times with exponential backoff
```

---

## Slide 8: RAG (Retrieval-Augmented Generation) Pipeline

**What happens when someone asks a question:**

```
"How do I reset my password?"
            │
            ▼
    ┌───────────────────┐
    │  1. EMBED QUERY   │  Convert question to a 1,536-dimension vector
    │  (OpenAI API)     │  using the same model that embedded the documents
    └───────┬───────────┘
            │
            ▼
    ┌───────────────────┐
    │  2. VECTOR SEARCH │  Compare query vector against ALL stored chunk vectors
    │  (pgvector HNSW)  │  using cosine similarity
    │                   │  Return top 5 most relevant chunks
    │                   │  Filter out chunks with similarity score < 0.3
    └───────┬───────────┘
            │
            ▼
    ┌───────────────────┐
    │  3. BUILD PROMPT  │  SYSTEM: "Answer based ONLY on this context:"
    │                   │  [1] chunk about password reset...
    │                   │  [2] chunk about account settings...
    │                   │  + last 20 messages of conversation history
    │                   │  USER: "How do I reset my password?"
    └───────┬───────────┘
            │
            ▼
    ┌───────────────────┐
    │  4. GENERATE      │  Send prompt to OpenAI GPT-4o-mini
    │  (OpenAI Chat)    │  temperature=0.3 (factual, not creative)
    │                   │  max_tokens=1024
    └───────┬───────────┘
            │
            ▼
    ┌───────────────────┐
    │  5. SAVE & RETURN │  Store both USER and ASSISTANT messages in DB
    │                   │  Also store which chunks were used (audit trail)
    │                   │  Return response to the user
    └───────────────────┘
```

**Why RAG?**
- The AI only answers based on YOUR documents — no hallucination
- If the answer isn't in the data, it says so honestly
- Every answer is traceable to source chunks

---

## Slide 9: Vector Search — How It Works

**The Problem:** How do you find relevant text when the user's question uses different words than the documents?

**The Solution:** Convert everything to vectors (numbers that represent meaning)

```
"How do I reset my password?"  →  [0.023, -0.041, 0.089, ..., 0.012]  (1,536 numbers)

"To change your password,      →  [0.021, -0.039, 0.091, ..., 0.015]  (1,536 numbers)
 navigate to Settings..."          ↑ VERY SIMILAR vectors! (cosine similarity ≈ 0.89)

"Our company was founded       →  [-0.045, 0.072, -0.011, ..., 0.083] (1,536 numbers)
 in 2020..."                       ↑ VERY DIFFERENT vectors! (cosine similarity ≈ 0.12)
```

- **Cosine similarity** measures the angle between two vectors (1.0 = identical meaning, 0.0 = unrelated)
- **HNSW index** makes search fast even with millions of chunks (approximate nearest neighbors)
- PostgreSQL's **pgvector** extension handles all this natively — no separate vector database needed

---

## Slide 10: Embeddable Widget

**For Chatbot Owners:**
1. Go to chatbot detail page → **Embed** tab
2. Copy the script tag
3. Paste into any website's HTML

```html
<script src="https://your-saas.com/api/widget/script"
        data-token="your-chatbot-public-token"
        defer></script>
```

**For Website Visitors:**
- A blue floating chat bubble appears in the bottom-right corner
- Click it → chat window opens
- Type a question → get AI-powered answers from the chatbot's knowledge base
- No login required — visitors are tracked by anonymous session IDs

**How Widget Auth Works:**
- Each chatbot has a unique `publicToken` (UUID)
- The widget sends this token with every request — no JWT needed
- Visitors get a random `visitorId` stored in their browser's localStorage
- Conversations persist across page reloads via this visitorId

---

## Slide 11: API Endpoints Summary

### Public (No Auth)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/widget/script` | Serve widget JS |
| GET | `/api/widget/config` | Get chatbot name |
| POST | `/api/widget/message` | Widget chat message |

### Protected (JWT Required)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/users/me` | Get profile |
| PATCH | `/api/users/me` | Update profile |
| GET/POST/DELETE | `/api/chatbots` | Manage chatbots |
| POST | `/api/ingestion/pdf` | Upload PDF |
| POST | `/api/ingestion/website` | Submit URL |
| GET | `/api/ingestion/chatbot/:id` | List documents |
| POST | `/api/chat/message` | Send chat message |
| GET/DELETE | `/api/chat/conversations` | Manage conversations |
| POST | `/api/search` | Similarity search |

---

## Slide 12: Security Measures

| Measure | Implementation |
|---------|---------------|
| **Password Hashing** | bcrypt with 12 salt rounds |
| **Authentication** | JWT tokens (7-day expiry) |
| **Input Validation** | class-validator on all DTOs |
| **SQL Injection** | Prisma ORM parameterized queries |
| **XSS Protection** | Helmet middleware |
| **CORS** | Configurable origin whitelist |
| **File Upload** | PDF-only filter, 20MB limit |
| **Rate Limiting** | OpenAI retry with exponential backoff |
| **Data Isolation** | Users can only access their own chatbots/conversations |
| **Widget Auth** | Public token per chatbot, visitor session isolation |

---

## Slide 13: Error Handling

- **Global Exception Filter** catches all errors — HTTP exceptions return structured JSON, unexpected errors log stack traces but return generic 500 to clients
- **Validation Pipe** rejects malformed requests with clear error messages
- **Environment Validation** — app refuses to start if required env vars are missing
- **Document Processing** — failed jobs retry 3 times with exponential backoff (5s, 10s, 20s), then mark as FAILED with error message
- **OpenAI API** — retries on 429 (rate limit), 500, 503, and network errors

---

## Slide 14: Project Structure

```
Saas_product_2/
├── backend/                    ← NestJS API Server
│   ├── prisma/
│   │   ├── schema.prisma       ← Database schema (7 models)
│   │   └── migrations/         ← SQL migration files
│   ├── public/
│   │   └── widget.js           ← Embeddable chat widget
│   ├── uploads/                ← Uploaded PDF files
│   ├── src/
│   │   ├── common/             ← Guards, filters, decorators
│   │   ├── config/             ← Environment validation
│   │   ├── prisma/             ← Database service
│   │   └── modules/
│   │       ├── auth/           ← Login, signup, JWT
│   │       ├── users/          ← Profile management
│   │       ├── chatbots/       ← CRUD chatbots
│   │       ├── ingestion/      ← Upload, queue, extract, chunk
│   │       ├── embedding/      ← OpenAI embedding wrapper
│   │       ├── vector-store/   ← pgvector storage + search
│   │       ├── search/         ← Similarity search endpoint
│   │       ├── chat/           ← RAG pipeline + conversations
│   │       └── widget/         ← Public widget API
│   └── .env                    ← Environment variables
│
└── frontend/                   ← React Application
    └── src/
        ├── api/                ← Axios API clients
        ├── stores/             ← Zustand auth store
        ├── components/         ← Layout, ProtectedRoute, Spinner
        └── pages/              ← Login, Signup, Dashboard,
                                   ChatbotList, ChatbotDetail
```

---

## Slide 15: What's Needed to Deploy to Production

| Item | What to do |
|------|-----------|
| **Hosting** | Deploy backend to AWS/GCP/Railway, frontend to Vercel/Netlify |
| **Database** | Use managed PostgreSQL (Supabase, AWS RDS, Neon) with pgvector |
| **Redis** | Managed Redis (Upstash, AWS ElastiCache) |
| **File Storage** | Move uploads from local disk to S3/CloudFlare R2 |
| **OpenAI Key** | Set a real `OPENAI_API_KEY` in production env |
| **Domain** | Point your domain to the deployed services |
| **HTTPS** | SSL certificates (handled automatically by most platforms) |
| **Environment** | Set `NODE_ENV=production`, strong `JWT_SECRET`, proper `CORS_ORIGIN` |

---

## Slide 16: Future Enhancements

- **Streaming Responses** — Show AI typing in real-time using SSE/WebSockets
- **Multiple AI Models** — Support Claude, Gemini, local LLMs
- **Analytics Dashboard** — Track chatbot usage, popular questions, user satisfaction
- **Custom Branding** — Let users customize widget colors, logo, welcome message
- **Rate Limiting** — Per-user and per-chatbot API rate limits
- **Billing Integration** — Stripe for subscription management
- **Team Collaboration** — Multiple users per organization
- **Webhook Notifications** — Notify when documents finish processing
