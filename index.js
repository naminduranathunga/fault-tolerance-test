const express = require("express");
const crypto = require("crypto");
const { version } = require("os");

const PORT = Number(process.env.PORT || 8000);
const PRODUCT_COUNT = Number(process.env.PRODUCT_COUNT || 200);

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randWord(minLen = 3, maxLen = 9) {
  const len = randInt(minLen, maxLen);
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < len; i++) s += letters[randInt(0, letters.length - 1)];
  return s;
}

function randProductName() {
  const parts = [];
  const n = randInt(2, 4);
  for (let i = 0; i < n; i++) parts.push(randWord());
  return parts.join("-");
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

const products = [];
const productById = new Map();
const orders = new Map();
const oomStore = [];

function initProducts() {
  products.length = 0;
  productById.clear();
  for (let i = 0; i < PRODUCT_COUNT; i++) {
    const name = randProductName();
    const id = makeId(name);
    const price = Math.round((Math.random() * (999.99 - 1.0) + 1.0) * 100) / 100;
    const p = { id, name, price };
    products.push(p);
    productById.set(id, p);
  }
}

initProducts();

const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true, products: products.length, orders: orders.size, version: "2" });
});

app.get("/products", (req, res) => {
  // Intentional memory pressure for fault-tolerance testing.
  // Usage:
  //   GET /products?x=1
  //   GET /products?x_bytes=104857600
  //   GET /products?x=true&oom_repeat=10
  const oomBytes = req.query.x_bytes ? Number(req.query.x_bytes) : 0;
  const oomFlag = String(req.query.x ?? req.query.x_flag ?? "").toLowerCase();

  if ((oomFlag === "1" || oomFlag === "true" || oomFlag === "yes") && oomBytes === 0) {
    // Default: allocate 100MB per request unless overridden with env var.
    const envBytes = Number(process.env.OOM_PRODUCTS_BYTES || "104857600");
    if (Number.isFinite(envBytes) && envBytes > 0) {
      // Allocate random bytes and keep references so GC can't free it.
      const repeat = Number(req.query.oom_repeat || "1");
      const r = Number.isFinite(repeat) && repeat > 0 ? repeat : 1;
      for (let i = 0; i < r; i++) {
        oomStore.push(crypto.randomBytes(envBytes));
      }
    }
  } else if (Number.isFinite(oomBytes) && oomBytes > 0) {
    const repeat = Number(req.query.oom_repeat || "1");
    const r = Number.isFinite(repeat) && repeat > 0 ? repeat : 1;
    for (let i = 0; i < r; i++) {
      oomStore.push(crypto.randomBytes(oomBytes));
    }
  }

  res.json(products);
});

app.post("/order", (req, res) => {
  const { product_id, quantity, note, payload_bytes } = req.body || {};

  if (typeof product_id !== "string" || !product_id) {
    return res.status(400).json({ error: "product_id is required" });
  }
  const p = productById.get(product_id);
  if (!p) return res.status(404).json({ error: "product not found" });

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    return res.status(400).json({ error: "quantity must be >= 1" });
  }

  const pb = payload_bytes === undefined ? 0 : Number(payload_bytes);
  if (!Number.isFinite(pb) || pb < 0 || pb > 50_000_000) {
    return res.status(400).json({ error: "payload_bytes must be between 0 and 50,000,000" });
  }

  let payload = null;
  if (pb > 0) payload = "x".repeat(pb);

  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  const created_at_unix_ms = Date.now();
  const total_price = Math.round(p.price * qty * 100) / 100;

  const order = {
    id,
    created_at_unix_ms,
    product_id: p.id,
    quantity: qty,
    unit_price: p.price,
    total_price,
    note: typeof note === "string" ? note : null,
    payload,
  };

  orders.set(id, order);
  res.json(order);
});

app.get("/order/:id", (req, res) => {
  const id = req.params.id;
  const o = orders.get(id);
  if (!o) return res.status(404).json({ error: "order not found" });
  res.json(o);
});

app.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

