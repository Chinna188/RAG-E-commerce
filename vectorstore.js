// vectorStore.js
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// File where we will save embeddings
const storePath = path.join("data", "vectorStore.json");

// Load store
export function loadStore() {
  if (!fs.existsSync(storePath)) return [];
  const raw = fs.readFileSync(storePath, "utf-8");
  return JSON.parse(raw);
}

// Save store
export function saveStore(docs) {
  fs.writeFileSync(storePath, JSON.stringify(docs, null, 2));
}

// Get embedding for a single text
export async function embedText(text) {
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// Cosine similarity
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Retrieve top K most similar docs
export function getTopK(queryEmbedding, k = 5) {
  const store = loadStore();
  const scored = store.map((doc) => ({
    ...doc,
    score: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
