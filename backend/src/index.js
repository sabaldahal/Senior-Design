require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { ensureSchema } = require("./db");

const authRoutes = require("./routes/auth");
const inventoryRoutes = require("./routes/inventory");
const dashboardRoutes = require("./routes/dashboard");
const alertsRoutes = require("./routes/alerts");
const { initFirebaseAdmin, requireFirebaseAuth } = require("./middleware/firebaseAuth");
const cron = require("node-cron");
const { runLowStockEmailJob } = require("./services/lowStockAlerts");

const firebaseAuthEnabled = initFirebaseAdmin();

const app = express();

// On some Windows setups, Azure CLI is installed but not on PATH for Node processes.
if (process.platform === "win32") {
  const cliBin = "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin";
  if (!process.env.PATH.includes(cliBin)) {
    process.env.PATH = `${process.env.PATH};${cliBin}`;
  }
}

// Default allows common Vite dev ports (5173/5174) and loopback — set CORS_ORIGIN in .env to override.
const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
)
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "inventory-api" });
});

app.use("/api/auth", authRoutes);

if (firebaseAuthEnabled) {
  app.use("/api/inventory", requireFirebaseAuth);
  app.use("/api/dashboard", requireFirebaseAuth);
  app.use("/api/alerts", requireFirebaseAuth);
}

app.use("/api/inventory", inventoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/alerts", alertsRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

const port = Number(process.env.PORT || 3000);

async function start() {
  try {
    await ensureSchema();
    app.listen(port, () => {
      console.log(`Backend listening on http://localhost:${port}`);
      if (process.env.ENABLE_LOW_STOCK_EMAIL_CRON === "true") {
        const schedule = process.env.LOW_STOCK_CRON || "0 */6 * * *";
        cron.schedule(schedule, () => {
          runLowStockEmailJob()
            .then((r) => console.log("[low-stock-email]", JSON.stringify(r)))
            .catch((e) => console.error("[low-stock-email]", e.message));
        });
        console.log(`Low-stock email cron enabled: ${schedule}`);
      }
    });
  } catch (err) {
    console.error("Failed to start backend:", err.message);
    process.exit(1);
  }
}

start();
