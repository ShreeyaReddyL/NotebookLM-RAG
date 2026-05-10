const { GoogleGenerativeAI } = require("@google/generative-ai");

async function run() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    const models = data.models.filter(m => m.supportedGenerationMethods.includes("embedContent")).map(m => m.name);
    console.log("AVAILABLE EMBEDDING MODELS:", models);
  } catch(e) {
    console.error("ERROR directly:", e.message);
  }
}
run();
