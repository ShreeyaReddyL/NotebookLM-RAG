import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const maxDuration = 120;

const INGEST_VERSION = "pdf-parse-direct-v2";

async function extractPdfText(buffer: Buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const pdfData = new Uint8Array(buffer);
    const parser = new PDFParse({ data: pdfData });

    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown PDF parser error";
    throw new Error(`PDF text extraction failed: ${message}`);
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "api/ingest",
    ingestVersion: INGEST_VERSION,
    pdfParser: "pdf-parse",
    usesWebPDFLoader: false,
  });
}

/**
 * POST /api/ingest
 * Accepts a file upload (PDF or TXT), chunks it, embeds it,
 * and stores it in Qdrant under a unique collectionName.
 * Returns { collectionName, filename, chunkCount } on success.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
    }
    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
      return NextResponse.json({ error: "Qdrant environment variables are not configured." }, { status: 500 });
    }

    const allowedTypes = ["application/pdf", "text/plain"];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".txt") && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF and plain text files are supported." },
        { status: 400 }
      );
    }

    // ── 1. LOAD / EXTRACT TEXT ─────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let rawText = "";

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      rawText = await extractPdfText(buffer);
    } else {
      rawText = buffer.toString("utf-8");
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from the document." },
        { status: 422 }
      );
    }

    // ── 2. CHUNKING STRATEGY — Recursive Character Text Splitter ───────────
    // Strategy: Split on paragraph → sentence → word boundaries, in order.
    // chunk size = 800 tokens worth of chars, overlap = 150 to preserve context
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 150,
      separators: ["\n\n", "\n", ". ", "! ", "? ", " ", ""],
    });

    const langchainDocs = await splitter.createDocuments(
      [rawText],
      [{ source: file.name, filename: file.name }]
    );

    const chunks: Document[] = langchainDocs.map((doc, i) => ({
      pageContent: doc.pageContent,
      metadata: {
        ...doc.metadata,
        chunkIndex: i,
        totalChunks: langchainDocs.length,
      },
    }));

    if (chunks.length === 0) {
      return NextResponse.json({ error: "Document produced no text chunks." }, { status: 422 });
    }

    // ── 3. EMBEDDINGS ──────────────────────────────────────────────────────
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-2",
      modelName: "gemini-embedding-2",
      apiKey: process.env.GEMINI_API_KEY,
    });

    // ── 4. VECTOR STORE — Qdrant Cloud ─────────────────────────────────────
    // Use a unique collection per document so sessions are isolated
    const collectionName = `doc-${uuidv4().slice(0, 8)}`;

    await QdrantVectorStore.fromDocuments(chunks, embeddings, {
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName,
    });

    return NextResponse.json({
      ingestVersion: INGEST_VERSION,
      collectionName,
      filename: file.name,
      chunkCount: chunks.length,
    });
  } catch (err: unknown) {
    console.error("[INGEST ERROR]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Ingestion failed: ${message}` }, { status: 500 });
  }
}
