"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./page.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { content: string; chunkIndex: number | string }[];
  timestamp: Date;
}

interface DocInfo {
  collectionName: string;
  filename: string;
  chunkCount: number;
}

async function readApiResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();
  const titleMatch = text.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch?.[1]?.trim();
  const fallback = title || text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const message = fallback || `Request failed with status ${res.status}`;

  throw new Error(`Server returned ${res.status}: ${message}`);
}

export default function Home() {
  const [docInfo, setDocInfo] = useState<DocInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showSources, setShowSources] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    const validTypes = ["application/pdf", "text/plain"];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".txt")) {
      setError("Please upload a PDF or .txt file.");
      return;
    }

    setUploading(true);
    setError(null);
    setDocInfo(null);
    setMessages([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ingest", { method: "POST", body: formData });
      const data = await readApiResponse(res);

      if (!res.ok) throw new Error(data.error || "Upload failed");

      setDocInfo(data);
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `✅ **"${data.filename}"** has been processed!\n\n📄 I split it into **${data.chunkCount} chunks**, embedded each one, and stored them in the vector database.\n\nYou can now ask me anything about this document. I'll retrieve the most relevant passages and give you a grounded answer.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSend = async () => {
    if (!input.trim() || chatLoading || !docInfo) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    const historyForAPI = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setChatLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          collectionName: docInfo.collectionName,
          history: historyForAPI,
        }),
      });

      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error || "Chat failed");

      const assistantMessage: Message = {
        id: Date.now().toString() + "-ai",
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^#{1,3}\s(.+)$/gm, "<h4>$1</h4>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br />")
      .replace(/^/, "<p>")
      .replace(/$/, "</p>");
  };

  return (
    <div className={styles.root}>
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className={styles.logoText}>NotebookLM</span>
            <span className={styles.logoBadge}>RAG</span>
          </div>
          {docInfo && (
            <div className={styles.docBadge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{docInfo.filename}</span>
              <span className={styles.chunkPill}>{docInfo.chunkCount} chunks</span>
            </div>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {/* ── LEFT PANEL — UPLOAD ────────────────────────────────────────── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarContent}>
            <h2 className={styles.sidebarTitle}>
              <span className={styles.gradientText}>Your Source</span>
            </h2>
            <p className={styles.sidebarDesc}>
              Upload a PDF or text file. The system will chunk, embed, and index it — then you can chat with it.
            </p>

            {/* Upload Zone */}
            <div
              className={`${styles.uploadZone} ${dragOver ? styles.dragActive : ""} ${uploading ? styles.uploadLoading : ""} ${docInfo ? styles.uploaded : ""}`}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              id="upload-zone"
              role="button"
              tabIndex={0}
              aria-label="Upload document"
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                id="file-input"
                aria-label="File upload input"
              />

              {uploading ? (
                <div className={styles.uploadingState}>
                  <div className={styles.spinner} />
                  <p>Processing document…</p>
                  <p className={styles.uploadHint}>Chunking → Embedding → Indexing</p>
                </div>
              ) : docInfo ? (
                <div className={styles.uploadedState}>
                  <div className={styles.successIcon}>✓</div>
                  <p className={styles.uploadedName}>{docInfo.filename}</p>
                  <p className={styles.uploadHint}>{docInfo.chunkCount} chunks indexed</p>
                  <button className={styles.reuploadBtn} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    Upload Another
                  </button>
                </div>
              ) : (
                <div className={styles.uploadIdleState}>
                  <div className={styles.uploadIconWrap}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className={styles.uploadTitle}>Drop your document here</p>
                  <p className={styles.uploadHint}>PDF or TXT · Click to browse</p>
                </div>
              )}
            </div>

            {error && (
              <div className={styles.errorBanner} role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            {/* RAG Pipeline Info */}
            <div className={styles.pipelineCard}>
              <h3 className={styles.pipelineTitle}>RAG Pipeline</h3>
              <div className={styles.pipelineSteps}>
                {[
                  { icon: "📄", label: "Ingest", desc: "PDF / TXT loader" },
                  { icon: "✂️", label: "Chunk", desc: "Recursive splitter · 800 chars · 150 overlap" },
                  { icon: "🔢", label: "Embed", desc: "text-embedding-004 (Gemini)" },
                  { icon: "🗄️", label: "Store", desc: "Qdrant Cloud vector DB" },
                  { icon: "🔍", label: "Retrieve", desc: "Top-5 semantic search" },
                  { icon: "🤖", label: "Generate", desc: "Gemini 2.5 Flash · context-only" },
                ].map((step, i) => (
                  <div key={i} className={styles.pipelineStep}>
                    <span className={styles.pipelineIcon}>{step.icon}</span>
                    <div>
                      <div className={styles.pipelineLabel}>{step.label}</div>
                      <div className={styles.pipelineDesc}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ── RIGHT PANEL — CHAT ─────────────────────────────────────────── */}
        <section className={styles.chatPanel}>
          {/* Messages */}
          <div className={styles.messagesArea}>
            {messages.length === 0 && !docInfo && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIconWrap} style={{ animation: "float 3s ease-in-out infinite" }}>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="url(#grad1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <defs>
                      <linearGradient id="grad1" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#6366f1"/>
                        <stop offset="1" stopColor="#ec4899"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <h1 className={styles.emptyTitle}>
                  Chat with <span className={styles.gradientText}>any document</span>
                </h1>
                <p className={styles.emptySubtitle}>
                  Upload a PDF or text file on the left to get started. Ask questions and get answers grounded in your document's actual content.
                </p>
                <div className={styles.featureGrid}>
                  {[
                    { icon: "🎯", text: "Context-grounded answers" },
                    { icon: "🔗", text: "Source citations included" },
                    { icon: "🧠", text: "Semantic vector search" },
                    { icon: "💬", text: "Multi-turn conversation" },
                  ].map((f, i) => (
                    <div key={i} className={styles.featureChip}>{f.icon} {f.text}</div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`${styles.messageRow} ${msg.role === "user" ? styles.userRow : styles.assistantRow}`}>
                {msg.role === "assistant" && (
                  <div className={styles.avatar}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <div className={`${styles.bubble} ${msg.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
                  <div
                    className={styles.bubbleContent}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                  {msg.sources && msg.sources.length > 0 && (
                    <div className={styles.sourcesSection}>
                      <button
                        className={styles.sourcesToggle}
                        onClick={() => setShowSources(showSources === msg.id ? null : msg.id)}
                        aria-expanded={showSources === msg.id}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""} used
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none"
                          style={{ transform: showSources === msg.id ? "rotate(180deg)" : "rotate(0deg)", transition: "0.2s" }}
                        >
                          <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                      {showSources === msg.id && (
                        <div className={styles.sourcesList}>
                          {msg.sources.map((src, i) => (
                            <div key={i} className={styles.sourceItem}>
                              <span className={styles.sourceLabel}>Chunk #{src.chunkIndex}</span>
                              <p className={styles.sourceText}>{src.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <span className={styles.timestamp}>
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className={`${styles.messageRow} ${styles.assistantRow}`}>
                <div className={styles.avatar}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className={`${styles.bubble} ${styles.assistantBubble}`}>
                  <div className={styles.thinkingDots}>
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className={styles.inputArea}>
            {!docInfo && (
              <div className={styles.inputHint}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Upload a document to start chatting
              </div>
            )}
            <div className={`${styles.inputBox} ${!docInfo ? styles.inputDisabled : ""}`}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                placeholder={docInfo ? "Ask anything about your document…" : "Upload a document first…"}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                onKeyDown={handleKeyDown}
                disabled={!docInfo || chatLoading}
                rows={1}
                id="chat-input"
                aria-label="Chat input"
              />
              <button
                className={`${styles.sendBtn} ${(!input.trim() || !docInfo || chatLoading) ? styles.sendDisabled : ""}`}
                onClick={handleSend}
                disabled={!input.trim() || !docInfo || chatLoading}
                id="send-button"
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <line x1="22" y1="2" x2="11" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white"/>
                </svg>
              </button>
            </div>
            <p className={styles.inputFooter}>Press Enter to send · Shift+Enter for newline · Answers are grounded in your document</p>
          </div>
        </section>
      </main>
    </div>
  );
}
