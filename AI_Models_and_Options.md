# AI Models Used & Available Options

## What We're Currently Using

**Yes, we ARE using AI models.** The system uses two OpenAI models:

| What | Model | Purpose | Cost |
|------|-------|---------|------|
| **Embeddings** | `text-embedding-3-small` | Converts text chunks into 1,536-dimension vectors (numbers that capture meaning) | ~$0.02 per 1M tokens |
| **Chat responses** | `gpt-4o-mini` | Generates answers based on the retrieved context | ~$0.15 per 1M input tokens |

These are **not optional** — without them, the chatbot can't understand documents or answer questions. The code handles everything else (chunking, storage, search, conversation management), but the actual "intelligence" comes from these models.

**There are no AI agents in the current system** — it's a straightforward RAG (Retrieval-Augmented Generation) pipeline. An "agent" would be something that can reason, use tools, and make multi-step decisions. What we have is simpler: search for relevant text, stuff it into a prompt, get a response.

---

## How the AI Models Are Used

### 1. Embedding Model (text-embedding-3-small)

**When it's called:** Every time a document is processed (once per chunk) and every time someone asks a question (once per query).

**What it does:** Takes a piece of text and converts it into an array of 1,536 numbers. These numbers represent the "meaning" of the text in a mathematical space. Texts with similar meanings will have similar number arrays.

**Example:**
```
Input:  "How do I reset my password?"
Output: [0.023, -0.041, 0.089, ..., 0.012]  (1,536 numbers)
```

**Why we need it:** This is how the system finds relevant document chunks when someone asks a question. It converts the question to numbers, then finds chunks with the most similar numbers (cosine similarity).

### 2. Chat Model (gpt-4o-mini)

**When it's called:** Every time someone sends a chat message (once per message).

**What it does:** Takes a prompt containing the relevant context chunks + the user's question, and generates a human-readable answer.

**The prompt looks like:**
```
SYSTEM: You are a helpful assistant. Answer based ONLY on this context:
---
[1] To reset your password, navigate to Settings > Account > Change Password...
[2] If you forgot your password, click "Forgot Password" on the login page...
---

USER: How do I reset my password?
```

**Why we need it:** This is the "brain" that reads the context and generates a coherent, helpful answer.

---

## Available Alternatives

### Option 1: Other Paid APIs (Drop-in Replacements)

| Provider | Embedding Model | Chat Model | Difficulty to Switch | Pricing |
|----------|----------------|------------|---------------------|---------|
| **OpenAI** (current) | text-embedding-3-small | gpt-4o-mini | Already done | Pay-per-use |
| **Google Gemini** | text-embedding-004 | gemini-2.0-flash | Easy — change API client | Free tier available |
| **Anthropic Claude** | (no embedding model) | claude-3.5-sonnet | Need separate embedding provider | Pay-per-use |
| **Cohere** | embed-english-v3.0 | command-r-plus | Easy — has both models | Free trial available |
| **Mistral** | mistral-embed | mistral-large | Easy — has both models | Pay-per-use |

**Pros:** High quality, fast, reliable, no hardware requirements.
**Cons:** Costs money, data leaves your machine, dependent on external service.

### Option 2: Fully Open-Source / Self-Hosted (Runs Locally)

| Component | Tool | Model | Notes |
|-----------|------|-------|-------|
| **Embeddings** | Ollama | `nomic-embed-text` | Runs on your Mac, completely free, no API key needed |
| **Chat** | Ollama | `llama3` / `mistral` / `phi3` | Runs locally, quality depends on your hardware |

**How it works:** Ollama is a tool that downloads and runs AI models on your own computer. No internet connection needed after download, no API keys, no costs.

**Hardware requirements:**
- Minimum: 8GB RAM (for small models like phi3)
- Recommended: 16GB+ RAM (for larger models like llama3)
- Apple Silicon Macs (M1/M2/M3/M4) work very well

**Pros:** Completely free, full privacy (data never leaves your machine), no API key needed, works offline.
**Cons:** Slower processing, slightly lower quality than GPT-4o, uses your computer's resources.

### Option 3: Hybrid Approach (Best of Both Worlds)

Use **free local embeddings** (Ollama) + **paid chat model** (OpenAI/Gemini).

**Why this makes sense:**
- Embeddings are called **thousands of times** (once per document chunk during processing)
- Chat is called **once per question**
- Most of the API cost comes from embeddings
- This cuts costs by ~90% while keeping high-quality chat responses

| Component | Provider | Cost |
|-----------|----------|------|
| Embeddings | Ollama (local) | Free |
| Chat | OpenAI GPT-4o-mini | ~$0.15 per 1M tokens |

---

## Comparison Summary

| Criteria | OpenAI (Current) | Google Gemini | Fully Local (Ollama) | Hybrid |
|----------|-----------------|---------------|---------------------|--------|
| **Cost** | Pay-per-use | Free tier available | Free | Mostly free |
| **Quality** | Excellent | Very good | Good | Very good |
| **Speed** | Fast | Fast | Slower | Mixed |
| **Privacy** | Data sent to OpenAI | Data sent to Google | Everything local | Embeddings local |
| **Setup** | API key needed | API key needed | Install Ollama | Both |
| **Offline** | No | No | Yes | Partially |
| **Hardware** | Any | Any | 8GB+ RAM | 8GB+ RAM |

---

## What's NOT AI in Our System

Most of the system is pure code with no AI involved:

| Component | AI? | What it does |
|-----------|-----|-------------|
| User authentication (signup/login) | No | bcrypt hashing, JWT tokens |
| Database storage | No | PostgreSQL tables, Prisma ORM |
| File upload handling | No | Multer file processing |
| PDF text extraction | No | pdf-parse library |
| Website text extraction | No | cheerio HTML parsing |
| Text chunking | No | Custom algorithm (sentence splitting, overlap) |
| Job queue (background processing) | No | BullMQ + Redis |
| Vector similarity search | No | pgvector cosine distance (math, not AI) |
| Conversation management | No | CRUD operations in database |
| Embeddable widget | No | Vanilla JavaScript |
| Frontend UI | No | React + Tailwind CSS |
| **Embedding generation** | **YES** | **OpenAI / Ollama converts text → vectors** |
| **Chat response generation** | **YES** | **GPT / Llama generates answers from context** |

**Summary:** Only 2 out of 14 components use AI. Everything else is traditional software engineering.

---

## Recommendation

If you want to get the system working immediately:

1. **Quickest:** Get an OpenAI API key from https://platform.openai.com/api-keys — costs ~$5 to start, pay-as-you-go
2. **Free option:** Install Ollama and use local models — no cost but slower
3. **Best value:** Use Gemini's free tier — Google gives generous free usage

The code is designed to make switching models easy — only two files need to change (`embedding.service.ts` and `chat.service.ts`).
