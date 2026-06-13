import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV !== "production") {
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

import express from "express";
import cors from "cors";
import { createStore } from "./store.js";
import { loadKB } from "./kb.js";
import { makeProjectsRouter } from "./routes/projects.js";
import { makeTransactionsRouter } from "./routes/transactions.js";
import { makeHistoryRouter } from "./routes/history.js";
import { makeChatRouter } from "./routes/chat.js";
import { makeAdminRouter } from "./routes/admin.js";
import { makeDebugRouter } from "./routes/debug.js";
import { makeCardsRouter, ensureCardsSeedded } from "./routes/cards.js";

const PORT = process.env.PORT ?? 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, version: "v2" }));

const store = await createStore();
let kbContent = await loadKB();
await ensureCardsSeedded();
const getKB = () => kbContent;
const reloadKB = async () => {
  kbContent = await loadKB();
  console.log("[kb] reloaded in-memory");
};

app.use("/api/projects", makeProjectsRouter(store));
app.use("/api/projects", makeTransactionsRouter(store));
app.use("/api/projects", makeHistoryRouter(store));
app.use("/api/projects", makeChatRouter(store, getKB));
app.use("/api/admin", makeAdminRouter(reloadKB));
app.use("/api/cards", makeCardsRouter());  // GET /definitions, POST /seed
app.use("/api/debug", makeDebugRouter(store, getKB));

// Serve built client in production (same container, no CORS needed)
const DIST = path.resolve(__dirname, "../../apps/client/dist");
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));
}

function listen(retries = 5): void {
  const srv = app
    .listen(PORT, () => {
      console.log(`✅ CoPPER v2 server → http://localhost:${PORT}`);
    })
    .on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && retries > 0) {
        console.log(`[server] port ${PORT} in use, retrying… (${retries} left)`);
        setTimeout(() => listen(retries - 1), 500);
      } else {
        console.error(`[server] fatal: ${err.message}`);
        process.exit(1);
      }
    });
  srv.timeout = 330000;
  srv.keepAliveTimeout = 340000;
}

listen();
