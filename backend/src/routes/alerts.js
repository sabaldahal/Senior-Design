const express = require("express");
const { getPool } = require("../db");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        item_id,
        name,
        quantity,
        5 AS threshold,
        updated_at
      FROM dbo.Items
      WHERE quantity <= 5
      ORDER BY updated_at DESC;
    `);

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

module.exports = router;
