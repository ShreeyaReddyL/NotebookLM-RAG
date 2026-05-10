import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NotebookLM — Chat With Your Documents",
  description:
    "Upload any PDF or text document and have an intelligent AI-powered conversation grounded in your document's actual content. Built with RAG (Retrieval-Augmented Generation).",
  keywords: ["RAG", "AI", "document chat", "NotebookLM", "PDF chat", "vector search"],
  openGraph: {
    title: "NotebookLM — Chat With Your Documents",
    description: "Upload a document, ask questions, get grounded answers powered by AI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
