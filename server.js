// server.js (offline RAG + simple frontend)

// -----------------------
// Imports
// -----------------------
import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -----------------------
// __dirname for ES modules
// -----------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------
// Create app + middleware
// -----------------------
const app = express();

app.use(bodyParser.json());

// Serve static files from /public (for index.html)
app.use(express.static(path.join(__dirname, "public")));

// -----------------------
// Load JSON data
// -----------------------
const ordersPath = path.join(__dirname, "data", "orders.json");
const productsPath = path.join(__dirname, "data", "products.json");
const policiesPath = path.join(__dirname, "data", "policies.json");

const orders = fs.existsSync(ordersPath)
  ? JSON.parse(fs.readFileSync(ordersPath, "utf-8"))
  : [];

const products = fs.existsSync(productsPath)
  ? JSON.parse(fs.readFileSync(productsPath, "utf-8"))
  : [];

const policies = fs.existsSync(policiesPath)
  ? JSON.parse(fs.readFileSync(policiesPath, "utf-8"))
  : [];

// -----------------------
// Build simple RAG index
// -----------------------
const documents = [];

products.forEach((p) => {
  documents.push({
    id: `product-${p.id}`,
    type: "product",
    text: `Product name: ${p.name}. Description: ${p.description}. Category: ${p.category}. Price: ${p.price}`,
  });
});

policies.forEach((pol, idx) => {
  documents.push({
    id: `policy-${pol.id || idx}`,
    type: "policy",
    text: `Policy title: ${pol.title}. Details: ${pol.text || pol.details || ""}`,
  });
});

console.log(
  `RAG index built with ${documents.length} documents (offline mode).`
);

// -----------------------
// Helper functions
// -----------------------
function tokenize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function similarity(aTokens, bTokens) {
  const aSet = new Set(aTokens);
  let score = 0;
  for (const t of bTokens) {
    if (aSet.has(t)) score++;
  }
  return score;
}

function getTopKDocs(question, k) {
  const qTokens = tokenize(question);
  const scored = documents.map((doc) => {
    const dTokens = tokenize(doc.text);
    const score = similarity(dTokens, qTokens);
    return { ...doc, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((d) => d.score > 0).slice(0, k);
}

function findOrder(orderId) {
  return orders.find((o) => o.orderId === orderId);
}

// -----------------------
// 1) /ask – product/policy Q&A
// -----------------------
app.post("/ask", (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }

    const topDocs = getTopKDocs(question, 5);

    if (!topDocs.length) {
      return res.json({
        answer:
          "I could not find any relevant information in our product and policy data for this question.",
        retrievedDocs: [],
      });
    }

    const answerParts = topDocs.map((d, idx) => {
      return `${idx + 1}. [${d.type.toUpperCase()}] ${d.text}`;
    });

    const answer =
      "Here is the information I found based on your question:\n\n" +
      answerParts.join("\n\n");

    res.json({
      answer,
      retrievedDocs: topDocs.map((d) => ({
        id: d.id,
        type: d.type,
        score: d.score,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// -----------------------
// 2) /order-status – order tracking
// -----------------------
app.post("/order-status", (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const order = findOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const messageParts = [];

    messageParts.push(
      `Order ${order.orderId} for "${order.productName}" is currently in status: ${order.status}.`
    );

    if (order.estimatedDelivery) {
      messageParts.push(
        `The estimated delivery date is ${order.estimatedDelivery}.`
      );
    }

    if (order.trackingId) {
      messageParts.push(
        `Tracking ID: ${order.trackingId}. You can use this to track your shipment on the courier's website.`
      );
    }

    const message = messageParts.join(" ");

    res.json({
      order,
      message,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// -----------------------
// 3) /can-return – return eligibility
// -----------------------
app.post("/can-return", (req, res) => {
  try {
    const { orderId, currentDate } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const order = findOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const today = currentDate ? new Date(currentDate) : new Date();
    const canReturnTill = new Date(order.canReturnTill);

    const eligible = today <= canReturnTill;

    const message = `The order ${order.orderId} is ${
      eligible ? "still eligible" : "no longer eligible"
    } for return. It can be returned till ${order.canReturnTill}.`;

    res.json({
      eligible,
      message,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// -----------------------
// Start server
// -----------------------
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server running (OFFLINE mode) on http://localhost:${port}`);
});

