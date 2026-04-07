const express = require("express");
const { withSqlRetry, sql } = require("../db");
const { getThreshold, runLowStockEmailJob } = require("../services/lowStockAlerts");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const threshold = getThreshold();
    const result = await withSqlRetry((pool) =>
      pool.request().input("threshold", sql.Int, threshold).query(`
      SELECT
        item_id,
        name,
        quantity,
        @threshold AS threshold,
        updated_at
      FROM dbo.Items
      WHERE quantity <= @threshold
      ORDER BY updated_at DESC;
    `)
    );

    const alerts = result.recordset.map((row) => ({
      id: row.item_id,
      itemId: row.item_id,
      itemName: row.name,
      quantity: Number(row.quantity),
      threshold: Number(row.threshold),
      message: `${row.name} is low on stock`,
      timestamp: row.updated_at
    }));

    return res.json({ alerts });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch alerts", error: err.message });
  }
});

/**
 * Manually run the same job as the cron: email recipients about low-stock items (respects cooldown).
 */
router.post("/send-low-stock-email", async (_req, res) => {
  try {
    const out = await runLowStockEmailJob();
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ message: "Failed to send low-stock email", error: err.message });
  }
});

module.exports = router;
