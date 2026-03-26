# ContextIQ — Complete System Guide, Client Pitch & Architecture

---

## ONE-LINE EXPLANATION

**ContextIQ is a platform that lets businesses create AI chatbots that answer questions using only their own documents — no hallucination, no training required, instant deployment.**

## SIMPLE ANALOGY

**"It's like giving ChatGPT your company's brain — it only knows what you teach it, and it can be embedded on any website in 60 seconds."**

---

---

# PART 1: DEEP UNDERSTANDING — How the System Works End-to-End

---

## The Complete Pipeline: What Happens When a User Sends a Message

### Step-by-Step Flow

```
USER types: "What are your refund policies?"
    |
    v
[1] FRONTEND (React app on Vercel)
    - User types message in chat interface
    - Frontend sends POST request to backend API
    - Shows loading spinner
    |
    v
[2] BACKEND API (NestJS on DigitalOcean)
    - Receives the message
    - Validates JWT token (is user logged in?)
    - Creates/resumes a conversation record in PostgreSQL
    - Saves the USER message to the database
    |
    v
[3] EMBEDDING GENERATION (Ollama on same server)
    - The user's question is converted into a vector
    - "What are your refund policies?" → [0.023, -0.041, 0.089, ..., 0.012] (768 numbers)
    - This vector captures the MEANING of the question, not just the words
    - Runs locally on the server — no external API call, no cost
    |
    v
[4] VECTOR SEARCH (PostgreSQL + pgvector)
    - The question vector is compared against ALL stored document chunk vectors
    - Uses cosine similarity (mathematical measure of meaning closeness)
    - HNSW index makes this fast even with millions of chunks
    - Returns top 5 most relevant chunks (scored 0-1, threshold 0.3)
    - Example: finds chunks about "returns", "refunds", "money back guarantee"
    |
    v
[5] PROMPT CONSTRUCTION (Backend)
    - Builds a structured prompt for the AI:
    
    ┌─────────────────────────────────────────────────────┐
    │ SYSTEM: You are a helpful assistant. Answer based   │
    │ ONLY on the following context. If the context does  │
    │ not contain enough information, say so honestly.    │
    │                                                     │
    │ ---                                                 │
    │ Context:                                            │
    │ [1] Our refund policy allows returns within 30      │
    │     days of purchase with original receipt...       │
    │ [2] For digital products, refunds are processed     │
    │     within 5-7 business days...                     │
    │ [3] Contact support@company.com for refund          │
    │     requests exceeding $500...                      │
    │ ---                                                 │
    │                                                     │
    │ [Previous conversation messages if any]             │
    │                                                     │
    │ USER: What are your refund policies?                │
    └─────────────────────────────────────────────────────┘
    
    |
    v
[6] LLM RESPONSE (Groq Cloud API — Llama 3.3 70B)
    - The prompt is sent to Groq's API
    - Llama 3.3 70B model generates a response
    - Temperature 0.3 (factual, not creative)
    - Max 1024 tokens
    - Groq processes at ~500 tokens/second (very fast)
    - Response: "Based on our policy, you can return items within 
      30 days with your original receipt. Digital product refunds 
      take 5-7 business days. For refunds over $500, please 
      contact support@company.com."
    |
    v
[7] SAVE & RETURN (Backend → Frontend → User)
    - ASSISTANT message saved to PostgreSQL
    - Which context chunks were used is saved as metadata (audit trail)
    - Response sent back to frontend
    - User sees the answer in the chat bubble
    - Total time: 1-3 seconds
```

---

## Where Each Component Runs

| Component | Where it runs | Technology | Cost |
|-----------|--------------|------------|------|
| **Chat Interface** | User's browser | React + Metronic UI | Free (Vercel CDN) |
| **API Server** | DigitalOcean Droplet (Singapore/Bangalore) | NestJS + Node.js | $12/month |
| **Database** | Same Droplet | PostgreSQL 16 + pgvector | Included |
| **Job Queue** | Same Droplet | Redis + BullMQ | Included |
| **Embedding Model** | Same Droplet | Ollama (nomic-embed-text) | Free (runs locally) |
| **Chat AI Model** | Groq Cloud (US) | Llama 3.3 70B | ~$0.05 per 1M tokens |
| **File Storage** | Same Droplet | Local filesystem | Included |

---

## Where Data is Stored

| Data | Storage | Location | Persistence |
|------|---------|----------|-------------|
| **User accounts** | PostgreSQL `users` table | DigitalOcean Droplet | Permanent |
| **Chatbot configs** | PostgreSQL `chatbots` table | DigitalOcean Droplet | Permanent |
| **Uploaded documents** | PostgreSQL `documents` table + filesystem | DigitalOcean Droplet | Permanent |
| **Text chunks + embeddings** | PostgreSQL `document_chunks` table (pgvector) | DigitalOcean Droplet | Permanent |
| **Conversations** | PostgreSQL `conversations` table | DigitalOcean Droplet | Permanent |
| **Chat messages** | PostgreSQL `messages` table | DigitalOcean Droplet | Permanent |
| **Context used per answer** | PostgreSQL `messages.context_chunks` (JSON) | DigitalOcean Droplet | Permanent (audit trail) |
| **Auth tokens** | User's browser localStorage | Client-side | Session-based (7 days) |
| **Processing jobs** | Redis | DigitalOcean Droplet | Temporary (cleared after processing) |

---

## The Document Ingestion Pipeline (How Knowledge Gets Into the System)

```
User uploads PDF or submits URL
    |
    v
[1] ACCEPT & QUEUE
    - Document record created (status: PROCESSING)
    - Job pushed to BullMQ queue (Redis)
    - Response returned immediately (non-blocking)
    |
    v
[2] EXTRACT TEXT (Background Worker)
    - PDF: pdf-parse library reads all pages
    - Website: fetch HTML → cheerio strips tags → clean text
    |
    v
[3] CHUNK TEXT
    - Split into pieces of 500-1000 tokens
    - 2-sentence overlap between chunks (preserves context at boundaries)
    - Short trailing pieces merged into previous chunk
    |
    v
[4] GENERATE EMBEDDINGS
    - Each chunk sent to Ollama (local, free)
    - Each chunk becomes a 768-dimensional vector
    - Vectors capture semantic meaning
    |
    v
[5] STORE IN VECTOR DATABASE
    - Chunks + vectors saved to PostgreSQL via pgvector
    - HNSW index auto-maintained for fast search
    - Transactional batch inserts (50 per transaction)
    |
    v
[6] COMPLETE
    - Document status → COMPLETED
    - Knowledge is immediately searchable
    - If anything fails: status → FAILED with error message
    - Failed jobs retry 3 times (exponential backoff)
```

---

## Hosting Architecture

```
                    INTERNET
                       |
          ┌────────────┼────────────┐
          |            |            |
          v            v            v
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  Vercel  │ │DigitalOcean│ │  Groq   │
    │  (CDN)   │ │ (Droplet)  │ │ (Cloud) │
    │          │ │            │ │         │
    │ React    │ │ NestJS     │ │ Llama   │
    │ Frontend │ │ PostgreSQL │ │ 3.3 70B │
    │          │ │ Redis      │ │         │
    │ Static   │ │ Ollama     │ │ Chat    │
    │ files    │ │ Nginx      │ │ API     │
    └──────────┘ └──────────┘ └──────────┘
    
    Free         $12/month      Pay-per-use
    Global CDN   Single server  ~$0.05/1M tokens
```

---

## Scaling Considerations

### Current Setup (handles ~50-100 concurrent users)
- Single DigitalOcean Droplet ($12/mo)
- Everything on one server
- Good for demos, early customers, small businesses

### Scaling Path

| Users | What to change | Cost |
|-------|---------------|------|
| 1-100 | Current setup | $12/mo |
| 100-500 | Upgrade Droplet to 4GB RAM | $24/mo |
| 500-2000 | Separate DB server, add worker nodes | $50-80/mo |
| 2000+ | Load balancer, multiple backend instances, managed DB | $150-300/mo |
| 10000+ | Kubernetes, auto-scaling, managed everything | $500+/mo |

### Cost Factors
- **Groq API**: ~$0.05 per 1M tokens (very cheap — a typical chat costs <$0.001)
- **Ollama embeddings**: Free (runs on server)
- **Storage**: PostgreSQL on Droplet (included in $12/mo)
- **Bandwidth**: 1TB included with Droplet

---

---

# PART 2: CLIENT PITCH TRANSCRIPT

---

*[This is a 2-3 minute speaking script. Read it naturally, not word-for-word.]*

---

**Opening:**

"Let me show you ContextIQ — an AI chatbot platform we've built that can transform how your business handles customer support, internal knowledge, and client engagement."

**What it does:**

"In simple terms, ContextIQ lets you create an AI chatbot that's trained exclusively on YOUR data. You upload your documents — product guides, FAQs, policy documents, website content — and within minutes, you have a chatbot that can answer any question about that content. Accurately. Every time."

**Why it matters:**

"The key difference from regular ChatGPT is that our chatbot ONLY answers from your documents. It doesn't make things up. It doesn't hallucinate. If the answer isn't in your data, it honestly says so. This means your customers get reliable, trustworthy answers 24/7."

**How it works (non-technical):**

"The process is straightforward. Your team logs in, creates a chatbot, and feeds it content — PDFs, website URLs, any text-based documents. Our system reads those documents, understands the meaning of every sentence, and stores that understanding. When someone asks a question, the system finds the most relevant parts of your documents, and uses AI to generate a natural, accurate answer based on that specific content."

**Deployment:**

"Once your chatbot is ready, embedding it on your website takes literally one line of code. We give you a script tag — your developer pastes it into your site, and a professional chat widget appears. No app to download, no complex integration. It works on any website — WordPress, Shopify, custom-built, anything."

**Security & Privacy:**

"Your data stays secure. All documents are stored on dedicated infrastructure. The chatbot only accesses your content, never anyone else's. User conversations are encrypted and stored securely. We can deploy this on your own infrastructure if needed for compliance."

**Scalability:**

"The platform is built to scale. Whether you have 10 users or 10,000, the architecture handles it. We can add more capacity as your business grows. And the AI models we use are among the fastest available — responses come back in 1-2 seconds."

**Future integrations:**

"Looking ahead, we can extend this to WhatsApp Business, Slack, Microsoft Teams, or any platform with an API. We can also add analytics dashboards to show you what customers are asking most, where your documentation has gaps, and how the chatbot is performing."

**Closing:**

"So in summary — ContextIQ gives you an AI chatbot that actually knows your business, deploys in minutes, and works 24/7. Would you like to see a live demo?"

---

---

# PART 3: ARCHITECTURE DIAGRAM (Draw.io XML)

---

Copy the XML below, go to [app.diagrams.net](https://app.diagrams.net), click File → Import, and paste it.

```xml
<mxfile>
  <diagram name="ContextIQ Architecture" id="arch1">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="900" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <!-- Title -->
        <mxCell id="title" value="ContextIQ — System Architecture" style="text;html=1;fontSize=20;fontStyle=1;align=center;verticalAlign=middle;" vertex="1" parent="1">
          <mxGeometry x="500" y="20" width="400" height="40" as="geometry" />
        </mxCell>

        <!-- User -->
        <mxCell id="user" value="👤 End User&#xa;(Browser / Mobile)" style="shape=ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=12;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="40" y="200" width="140" height="80" as="geometry" />
        </mxCell>

        <!-- Website with Widget -->
        <mxCell id="widget" value="🌐 Any Website&#xa;(Embedded Widget)" style="shape=ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="40" y="360" width="140" height="80" as="geometry" />
        </mxCell>

        <!-- Frontend -->
        <mxCell id="frontend" value="Frontend&#xa;(React + Metronic)&#xa;&#xa;• Login / Signup&#xa;• Dashboard&#xa;• Chat Interface&#xa;• Document Upload&#xa;• Embed Code" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontSize=11;align=left;spacingLeft=10;verticalAlign=top;spacingTop=5;" vertex="1" parent="1">
          <mxGeometry x="260" y="160" width="170" height="160" as="geometry" />
        </mxCell>
        <mxCell id="frontend_host" value="Vercel (CDN) — Free" style="text;html=1;fontSize=9;fontColor=#666666;align=center;" vertex="1" parent="1">
          <mxGeometry x="260" y="325" width="170" height="20" as="geometry" />
        </mxCell>

        <!-- Backend -->
        <mxCell id="backend" value="Backend API&#xa;(NestJS + TypeScript)&#xa;&#xa;• Auth (JWT)&#xa;• Chatbot CRUD&#xa;• Ingestion Pipeline&#xa;• RAG Pipeline&#xa;• Widget API&#xa;• Background Workers" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=11;align=left;spacingLeft=10;verticalAlign=top;spacingTop=5;" vertex="1" parent="1">
          <mxGeometry x="520" y="120" width="180" height="190" as="geometry" />
        </mxCell>
        <mxCell id="backend_host" value="DigitalOcean Droplet — $12/mo" style="text;html=1;fontSize=9;fontColor=#666666;align=center;" vertex="1" parent="1">
          <mxGeometry x="520" y="315" width="180" height="20" as="geometry" />
        </mxCell>

        <!-- PostgreSQL -->
        <mxCell id="postgres" value="PostgreSQL 16&#xa;+ pgvector&#xa;&#xa;• Users&#xa;• Chatbots&#xa;• Documents&#xa;• Chunks + Vectors&#xa;• Conversations&#xa;• Messages" style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;align=left;spacingLeft=10;verticalAlign=top;spacingTop=15;size=10;" vertex="1" parent="1">
          <mxGeometry x="520" y="400" width="160" height="190" as="geometry" />
        </mxCell>

        <!-- Redis -->
        <mxCell id="redis" value="Redis&#xa;(Job Queue)" style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=11;size=10;" vertex="1" parent="1">
          <mxGeometry x="700" y="430" width="100" height="70" as="geometry" />
        </mxCell>

        <!-- Ollama -->
        <mxCell id="ollama" value="Ollama&#xa;(nomic-embed-text)&#xa;&#xa;Local Embeddings&#xa;768 dimensions&#xa;FREE" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontSize=10;fontColor=#333333;align=center;" vertex="1" parent="1">
          <mxGeometry x="800" y="140" width="140" height="100" as="geometry" />
        </mxCell>

        <!-- Groq -->
        <mxCell id="groq" value="Groq Cloud API&#xa;(Llama 3.3 70B)&#xa;&#xa;Chat Completion&#xa;~500 tokens/sec&#xa;~$0.05/1M tokens" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;align=center;" vertex="1" parent="1">
          <mxGeometry x="800" y="280" width="140" height="100" as="geometry" />
        </mxCell>

        <!-- Arrows -->
        <!-- User to Frontend -->
        <mxCell id="a1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#6c8ebf;strokeWidth=2;" edge="1" source="user" target="frontend" parent="1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="a1l" value="HTTPS" style="edgeLabel;html=1;fontSize=9;fontColor=#6c8ebf;" vertex="1" connectable="0" parent="a1">
          <mxGeometry x="-0.2" relative="1" as="geometry" />
        </mxCell>

        <!-- Widget to Backend -->
        <mxCell id="a2" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#6c8ebf;strokeWidth=2;dashed=1;" edge="1" source="widget" target="backend" parent="1">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="110" y="450" />
              <mxPoint x="460" y="450" />
              <mxPoint x="460" y="215" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="a2l" value="Widget API&#xa;(Public Token)" style="edgeLabel;html=1;fontSize=9;fontColor=#6c8ebf;" vertex="1" connectable="0" parent="a2">
          <mxGeometry x="-0.3" relative="1" as="geometry" />
        </mxCell>

        <!-- Frontend to Backend -->
        <mxCell id="a3" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#82b366;strokeWidth=2;" edge="1" source="frontend" target="backend" parent="1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="a3l" value="REST API&#xa;(JWT Auth)" style="edgeLabel;html=1;fontSize=9;fontColor=#82b366;" vertex="1" connectable="0" parent="a3">
          <mxGeometry x="-0.2" relative="1" as="geometry" />
        </mxCell>

        <!-- Backend to PostgreSQL -->
        <mxCell id="a4" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#d6b656;strokeWidth=2;" edge="1" source="backend" target="postgres" parent="1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="a4l" value="Prisma ORM" style="edgeLabel;html=1;fontSize=9;fontColor=#d6b656;" vertex="1" connectable="0" parent="a4">
          <mxGeometry x="-0.2" relative="1" as="geometry" />
        </mxCell>

        <!-- Backend to Redis -->
        <mxCell id="a5" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#b85450;strokeWidth=1;dashed=1;" edge="1" source="backend" target="redis" parent="1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="a5l" value="BullMQ&#xa;Jobs" style="edgeLabel;html=1;fontSize=9;fontColor=#b85450;" vertex="1" connectable="0" parent="a5">
          <mxGeometry x="-0.2" relative="1" as="geometry" />
        </mxCell>

        <!-- Backend to Ollama -->
        <mxCell id="a6" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#666666;strokeWidth=2;" edge="1" source="backend" target="ollama" parent="1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="a6l" value="Embed&#xa;Query/Chunks" style="edgeLabel;html=1;fontSize=9;fontColor=#666666;" vertex="1" connectable="0" parent="a6">
          <mxGeometry x="-0.2" relative="1" as="geometry" />
        </mxCell>

        <!-- Backend to Groq -->
        <mxCell id="a7" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#d6b656;strokeWidth=2;" edge="1" source="backend" target="groq" parent="1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="a7l" value="Chat&#xa;Completion" style="edgeLabel;html=1;fontSize=9;fontColor=#d6b656;" vertex="1" connectable="0" parent="a7">
          <mxGeometry x="-0.2" relative="1" as="geometry" />
        </mxCell>

        <!-- Vector Search Label -->
        <mxCell id="vsearch" value="🔍 Vector Similarity Search&#xa;(Cosine Distance + HNSW Index)" style="text;html=1;fontSize=10;fontStyle=2;fontColor=#d6b656;align=center;" vertex="1" parent="1">
          <mxGeometry x="480" y="365" width="230" height="30" as="geometry" />
        </mxCell>

        <!-- RAG Flow Box -->
        <mxCell id="ragbox" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#FF6666;strokeWidth=2;dashed=1;" vertex="1" parent="1">
          <mxGeometry x="500" y="100" width="460" height="310" as="geometry" />
        </mxCell>
        <mxCell id="raglabel" value="RAG Pipeline (Retrieval-Augmented Generation)" style="text;html=1;fontSize=11;fontStyle=1;fontColor=#FF6666;align=left;" vertex="1" parent="1">
          <mxGeometry x="510" y="100" width="350" height="20" as="geometry" />
        </mxCell>

        <!-- Legend -->
        <mxCell id="legend" value="Legend:&#xa;Purple = Frontend (Vercel, Free)&#xa;Green = Backend (DigitalOcean, $12/mo)&#xa;Yellow = Database / AI Models&#xa;Red dashed = RAG Pipeline boundary" style="text;html=1;fontSize=10;align=left;verticalAlign=top;fillColor=#f5f5f5;strokeColor=#cccccc;rounded=1;spacingLeft=10;spacingTop=5;" vertex="1" parent="1">
          <mxGeometry x="40" y="500" width="280" height="100" as="geometry" />
        </mxCell>

      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

---

---

# PART 4: BONUS

## One-Line Explanation
**"ContextIQ turns your documents into an AI chatbot that can be embedded on any website in 60 seconds."**

## Simple Analogy
**"Think of it as ChatGPT, but it only knows YOUR company's information. It reads your documents, understands them, and answers customer questions — accurately, 24/7, without making things up."**

## Elevator Pitch (30 seconds)
"We built a platform where you upload your company documents — product guides, FAQs, policies — and get an AI chatbot that answers customer questions based only on that content. No hallucination. It deploys on any website with one line of code. Your customers get instant, accurate answers 24/7, and your support team handles only the complex cases."

## Key Differentiators to Mention to Clients
1. **No hallucination** — answers come only from your documents
2. **60-second deployment** — one script tag on any website
3. **No training required** — upload docs, chatbot is ready
4. **Full conversation history** — see what customers are asking
5. **Multi-chatbot support** — different bots for different use cases
6. **Privacy** — your data stays on dedicated infrastructure
7. **Audit trail** — every answer traces back to source documents
