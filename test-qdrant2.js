import { QdrantClient } from "@qdrant/js-client-rest";
import "dotenv/config";

async function run() {
  try {
    const client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });
    const result = await client.getCollections();
    console.log("SUCCESS:", result);
  } catch (e) {
    console.error("ERROR:", e.message, e.cause);
  }
}
run();
