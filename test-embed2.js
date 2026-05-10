const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");

async function run() {
  try {
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-2",
      apiKey: process.env.GEMINI_API_KEY,
    });
    console.log("Calling embedQuery with text-embedding-004...");
    const res = await embeddings.embedQuery("hello world");
    console.log("SUCCESS, vector length:", res.length);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
run();
