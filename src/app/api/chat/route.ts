import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";

/**
 * POST /api/chat
 * Body: { question: string, collectionName: string, history: {role, content}[] }
 * Returns: { answer: string, sources: { content, chunkIndex }[] }
 *
 * RAG Pipeline:
 *  1. Embed the user question using Gemini
 *  2. Retrieve top-k relevant chunks from Qdrant
 *  3. Build system prompt with retrieved context
 *  4. Generate grounded answer via Gemini Flash
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, collectionName, history = [] } = body;

    if (!question?.trim()) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }
    if (!collectionName?.trim()) {
      return NextResponse.json({ error: "No document indexed yet." }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
    }
    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
      return NextResponse.json({ error: "Qdrant environment variables are not configured." }, { status: 500 });
    }

    // ── 1. RETRIEVAL ───────────────────────────────────────────────────────
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-2",
      modelName: "gemini-embedding-2",
      apiKey: process.env.GEMINI_API_KEY,
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName,
    });

    const retriever = vectorStore.asRetriever({ k: 5 });
    const searchedChunks = await retriever.invoke(question);

    if (searchedChunks.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find relevant information in the document to answer that question.",
        sources: [],
      });
    }

    // ── 2. GENERATION ──────────────────────────────────────────────────────
    const contextBlocks = searchedChunks
      .map(
        (doc, i) =>
          `[Chunk ${i + 1}${doc.metadata?.chunkIndex !== undefined ? ` (block #${doc.metadata.chunkIndex})` : ""}]:\n${doc.pageContent}`
      )
      .join("\n\n---\n\n");

    const systemPrompt = `You are a helpful document assistant for NotebookLM. You answer user questions STRICTLY based on the document chunks provided below. 

Rules:
1. Only use information from the provided context chunks — never from your general knowledge.
2. If the answer is not present in the context, say: "This information is not available in the uploaded document."
3. Always cite which chunk(s) you used (e.g., "According to Chunk 2...").
4. Be concise, accurate, and helpful. Use markdown formatting where appropriate.

--- DOCUMENT CONTEXT ---
${contextBlocks}
--- END CONTEXT ---`;

    const llm = new ChatGoogleGenerativeAI({
      model: CHAT_MODEL,
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.2,
      maxOutputTokens: 1500,
    });

    // Include last 6 history messages for multi-turn context
    const recentHistory = history.slice(-6).map((msg: any) => {
      if (msg.role === "assistant") return new AIMessage(msg.content);
      return new HumanMessage(msg.content);
    });

    const messages = [
      new SystemMessage(systemPrompt),
      ...recentHistory,
      new HumanMessage(question),
    ];

    const response = await llm.invoke(messages);
    const answer = response.content.toString();

    const sources = searchedChunks.map((doc) => ({
      content: doc.pageContent.slice(0, 200) + (doc.pageContent.length > 200 ? "…" : ""),
      chunkIndex: doc.metadata?.chunkIndex ?? "?",
    }));

    return NextResponse.json({ answer, sources });
  } catch (err: unknown) {
    console.error("[CHAT ERROR]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Chat failed: ${message}` }, { status: 500 });
  }
}
