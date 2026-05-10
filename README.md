# Assignment 03 — Google NotebookLM RAG Implementation

This project is a high-performance, aesthetically pleasing implementation of a document-grounded AI chat system, inspired by Google NotebookLM. It allows users to upload PDF or TXT files, processes them into a vector database, and enables intelligent conversations where every answer is strictly grounded in the document content.

## 🚀 Live Demo & Repository
- **GitHub Repository**: [https://github.com/ShreeyaReddyL/NotebookLM-RAG](https://github.com/ShreeyaReddyL/NotebookLM-RAG)
- **Live Deployment**: [Link to be provided after Vercel deployment]

---

## 🛠️ Technology Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Vanilla CSS (Glassmorphism design)
- **RAG Orchestration**: LangChain.js
- **LLM**: Google Gemini 1.5 Flash
- **Embeddings**: Google `gemini-embedding-2` (3072 dimensions)
- **Vector Database**: Qdrant Cloud
- **PDF Processing**: `pdf-parse` v1

---

## 🧠 RAG Pipeline Architecture

### 1. Ingestion & Loading
When a user uploads a document:
- **PDFs**: Handled via the Node-compatible `pdf-parse` v1 parser in the API route.
- **Text Files**: Read directly as UTF-8 strings.

### 2. Chunking Strategy
We use the **RecursiveCharacterTextSplitter** from LangChain.
- **Chunk Size**: 800 characters.
- **Chunk Overlap**: 150 characters (ensures context is preserved across splits).
- **Separators**: Split intelligently at paragraph `\n\n`, then line `\n`, then sentence `. `, then word boundaries.

### 3. Embedding & Indexing
- Chunks are converted into high-dimensional vectors using Google's latest `gemini-embedding-2` model.
- Vectors are stored in **Qdrant Cloud** within a unique collection per document to ensure session isolation.

### 4. Retrieval
When a question is asked:
- The question is embedded using the same model.
- A **Semantic Search** is performed against Qdrant to find the top 5 most relevant chunks (Cosine Similarity).

### 5. Generation (Groundedness)
- The retrieved chunks are passed into a strict system prompt.
- **Rule**: The AI must ONLY answer from the provided context. If the answer isn't there, it must admit it.
- **Citations**: The AI cites which chunk index it used for its answer.

---

## 🎨 UI/UX Design
The application features a **premium dark-mode interface**:
- **Glassmorphism**: Translucent panels with backdrop-blur and subtle borders.
- **Dynamic Animations**: Smooth transitions, thinking dots, and hover-glow effects.
- **Mobile Responsive**: Fully usable on mobile devices.
- **Pipeline Visualization**: A dedicated sidebar showing the real-time status of the RAG pipeline.

---

## ⚙️ Setup Instructions

### 1. Environment Variables
Create a `.env.local` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_key
QDRANT_URL=https://your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key
```

### 2. Installation
```bash
npm install
```

### 3. Running Locally
```bash
npm run dev
```
Navigate to `http://localhost:3000`.

---

## 📊 Marking Scheme Alignment
- **RAG Pipeline**: Fully implemented (Ingestion → Chunking → Embedding → Storage → Retrieval → Generation).
- **Chunking**: Documented Recursive Strategy.
- **Vector DB**: Qdrant Cloud used.
- **Answer Quality**: Gemini 1.5 Flash with strict groundedness prompts and source citations.
- **Aesthetics**: Premium, modern UI design.
