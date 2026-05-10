const { GoogleGenerativeAI } = require("@google/generative-ai");

async function run() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent("Hello world");
    console.log("SUCCESS length:", result.embedding.values.length);
  } catch(e) {
    console.error("ERROR directly:", e.message);
  }
}
run();
