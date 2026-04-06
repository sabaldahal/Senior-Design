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

const app = express();

// On some Windows setups, Azure CLI is installed but not on PATH for Node processes.
if (process.platform === "win32") {
  const cliBin = "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin";
  if (!process.env.PATH.includes(cliBin)) {
    process.env.PATH = `${process.env.PATH};${cliBin}`;
  }
}

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
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
    });
  } catch (err) {
    console.error("Failed to start backend:", err.message);
    process.exit(1);
  }
}

start();
