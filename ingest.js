import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load products + policies
const productsPath = path.join("data", "products.json");
const policiesPath = path.join("data", "policies.json");

const products = JSON.parse(fs.readFileSync(productsPath, "utf-8"));
const policies = JSON.parse(fs.readFileSync(policiesPath, "utf-8"));

// Combine all docs
const docs = [];

products.forEach((p) => {
  docs.push({
    id: `product-${p.id}`,
    type: "product",
    text: `Product: ${p.name}\nDescription: ${p.description}\nCategory: ${p.category}`,
  });
});

policies.forEach((p) => {
  docs.push({
    id: `policy-${p.id}`,
    type: "policy",
    text: `Policy: ${p.title}\n${p.text}`,
  });
});

// Create embeddings
async function run() {
  console.log(`Embedding ${docs.length} documents...`);

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: docs.map((d) => d.text),
  });

  const vectors = response.data.map((e, i) => ({
    ...docs[i],
    embedding: e.embedding,
  }));

  fs.writeFileSync("vectorStore.json", JSON.stringify(vectors, null, 2));

  console.log("✔ Embeddings stored in vectorStore.json");
}

run();
