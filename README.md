# ContextIQ — AI Chatbot SaaS Platform

An AI-powered chatbot platform that lets businesses create custom chatbots trained on their own documents. Upload PDFs or website URLs, and get a chatbot that answers questions accurately using only your content. Embed it on any website with one script tag.

**Live Demo:** [https://frontend-ten-hazel-61.vercel.app](https://frontend-ten-hazel-61.vercel.app)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, Metronic v9.4.7, Zustand, Axios |
| Backend | NestJS 11, TypeScript, Prisma 6, Passport JWT, BullMQ |
| Database | PostgreSQL 16 + pgvector (vector similarity search) |
| Queue | Redis + BullMQ (background job processing) |
| AI - Chat | Groq API (Llama 3.3 70B) |
| AI - Embeddings | Ollama (nomic-embed-text, runs locally) |
| Deployment | Vercel (frontend) + DigitalOcean (backend) |

---

## Prerequisites

Install these before starting:

| Software | Version | Install Command (macOS) |
|----------|---------|------------------------|
| **Node.js** | >= 18 | `brew install node` |
| **PostgreSQL** | >= 14 | `brew install postgresql@16 && brew services start postgresql` |
| **Redis** | >= 6 | `brew install redis && brew services start redis` |
| **Ollama** | Latest | `brew install ollama && brew services start ollama` |
| **Git** | Latest | `brew install git` |

---

## Setup — Step by Step

### 1. Clone the repository

```bash
git clone https://github.com/Imlogesh7/ai-chatbot-saas.git
cd ai-chatbot-saas
```

### 2. Set up PostgreSQL database

```bash
# Create the database
createdb saas_db

# Install pgvector extension
psql -d saas_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

If your PostgreSQL requires a specific user:

```bash
psql -d postgres -c "CREATE USER saasapp WITH PASSWORD 'yourpassword';"
psql -d postgres -c "CREATE DATABASE saas_db OWNER saasapp;"
psql -d postgres -c "ALTER USER saasapp WITH SUPERUSER;"
psql -d saas_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. Pull the Ollama embedding model

```bash
ollama pull nomic-embed-text
```

This downloads ~274MB. Verify it's ready:

```bash
ollama list
# Should show: nomic-embed-text
```

### 4. Get a Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free)
3. Go to **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_`)

### 5. Set up the Backend

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `backend/.env` with your values:

```env
NODE_ENV=development
PORT=3000

# PostgreSQL — update with your credentials
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/saas_db?schema=public"

# JWT — change the secret to something random
JWT_SECRET="your-secret-key-at-least-32-characters-long"
JWT_EXPIRATION="7d"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# Groq — paste your API key here
GROQ_API_KEY="gsk_your_actual_key_here"

# Ollama
OLLAMA_URL="http://localhost:11434"
```

Run database migrations:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Start the backend:

```bash
npm run start:dev
```

You should see:

```
[Bootstrap] Application running on port 3000
```

### 6. Set up the Frontend

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

You should see:

```
VITE ready in 245 ms
➜ Local: http://localhost:5173/
```

### 7. Open the app

Go to **http://localhost:5173** in your browser.

- Sign up with any email/password
- Create a chatbot
- Upload a PDF or submit a website URL
- Wait for processing to complete
- Start chatting!

---

## Project Structure

```
ai-chatbot-saas/
├── backend/                        # NestJS API Server
│   ├── prisma/
│   │   └── schema.prisma           # Database schema (7 models)
│   ├── public/
│   │   └── widget.js               # Embeddable chat widget
│   ├── uploads/                    # Uploaded PDF files
│   ├── src/
│   │   ├── main.ts                 # App bootstrap
│   │   ├── app.module.ts           # Root module
│   │   ├── common/                 # Guards, filters, decorators
│   │   ├── config/                 # Environment validation
│   │   ├── prisma/                 # Database service
│   │   └── modules/
│   │       ├── auth/               # Login, signup, JWT
│   │       ├── users/              # User profile
│   │       ├── chatbots/           # Chatbot CRUD
│   │       ├── ingestion/          # Upload, extract, chunk, process
│   │       ├── embedding/          # Ollama / HuggingFace embeddings
│   │       ├── vector-store/       # pgvector storage + similarity search
│   │       ├── search/             # Standalone search endpoint
│   │       ├── chat/               # RAG pipeline + conversations
│   │       └── widget/             # Public widget API
│   ├── .env                        # Environment variables (not in git)
│   └── package.json
│
├── frontend/                       # React Application
│   ├── src/
│   │   ├── api/                    # Axios API clients
│   │   ├── stores/                 # Zustand auth store
│   │   ├── components/             # Layout, ErrorBoundary
│   │   ├── pages/                  # Login, Signup, Dashboard, Chatbots
│   │   ├── routing/                # Routes + auth guard
│   │   └── styles/                 # Tailwind + Metronic theme
│   ├── vercel.json                 # Vercel deployment config
│   └── package.json
│
└── README.md
```

---

## API Endpoints

All endpoints are prefixed with `/api`.

### Auth (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Sign in |

### Chatbots (JWT Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chatbots` | Create chatbot |
| GET | `/api/chatbots` | List user's chatbots |
| GET | `/api/chatbots/:id` | Get chatbot |
| DELETE | `/api/chatbots/:id` | Delete chatbot |

### Ingestion (JWT Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingestion/pdf` | Upload PDF (multipart, max 20MB) |
| POST | `/api/ingestion/website` | Submit URL for scraping |
| GET | `/api/ingestion/chatbot/:chatbotId` | List documents |

### Chat (JWT Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/message` | Send message, get AI response |
| GET | `/api/chat/conversations?chatbotId=uuid` | List conversations |
| GET | `/api/chat/conversations/:id` | Get conversation with messages |
| DELETE | `/api/chat/conversations/:id` | Delete conversation |

### Widget (Public — no auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/widget/script` | Serve widget.js |
| GET | `/api/widget/config?token=xxx` | Get chatbot name |
| POST | `/api/widget/message` | Widget chat message |

---

## Embedding the Chat Widget

Add this one line to any website:

```html
<script src="YOUR_BACKEND_URL/api/widget/script" data-token="CHATBOT_PUBLIC_TOKEN" defer></script>
```

For local development:

```html
<script src="http://localhost:3000/api/widget/script" data-token="YOUR_TOKEN" data-host="http://localhost:3000" defer></script>
```

Get the token from the **Embed** tab on the chatbot detail page.

---

## Common Issues

### "Signup failed" in the browser
- Check if the backend is running (`http://localhost:3000`)
- Check browser console for CORS errors
- Make sure the Vite proxy is configured in `frontend/vite.config.ts`

### Documents stuck on "processing"
- Check if Redis is running: `redis-cli ping` (should say `PONG`)
- Check if Ollama is running: `curl http://localhost:11434/api/tags`
- Check backend logs for errors

### "Invalid API key" when chatting
- Verify your Groq API key in `backend/.env`
- Get a new key from [console.groq.com/keys](https://console.groq.com/keys)

### pgvector extension not found
- Install pgvector: `brew install pgvector` (macOS)
- Or: `sudo apt install postgresql-16-pgvector` (Ubuntu)
- Then: `psql -d saas_db -c "CREATE EXTENSION vector;"`

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | Yes | Backend server port (default: 3000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT tokens (min 16 chars) |
| `JWT_EXPIRATION` | Yes | Token expiry (e.g., `7d`) |
| `REDIS_HOST` | Yes* | Redis hostname (for local dev) |
| `REDIS_PORT` | Yes* | Redis port (for local dev) |
| `REDIS_URL` | Yes* | Redis connection URL (for production) |
| `GROQ_API_KEY` | Yes | Groq API key for chat completion |
| `OLLAMA_URL` | No | Ollama URL (default: `http://localhost:11434`) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: `*`) |

*Either `REDIS_HOST`+`REDIS_PORT` or `REDIS_URL` is required.

---

## Deployment

### Frontend → Vercel (Free)

```bash
cd frontend
npm install -g vercel
vercel --prod
```

### Backend → DigitalOcean / Any VPS

1. SSH into your server
2. Install Node.js 20, PostgreSQL 16, Redis, Ollama
3. Clone the repo and set up `.env`
4. Build and run:

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
node dist/main.js
```

Use `systemd` or `pm2` to keep it running.

---

## License

Private — All rights reserved.
