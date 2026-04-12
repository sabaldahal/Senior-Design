const express = require("express");
const { withSqlRetry } = require("../db");

const router = express.Router();

router.get("/summary", async (_req, res) => {
  try {
    const { totals, weekly } = await withSqlRetry(async (pool) => {
      const [totalsResult, weeklyResult] = await Promise.all([
        pool.request().query(`
        SELECT
          COUNT(*) AS totalItems,
          SUM(CASE WHEN quantity <= 5 THEN 1 ELSE 0 END) AS lowStockCount,
          SUM(CASE WHEN quantity <= 5 THEN 1 ELSE 0 END) AS alertsCount,
          COUNT(DISTINCT NULLIF(category, '')) AS categories
        FROM dbo.Items;
      `),
        pool.request().query(`
        ;WITH last7 AS (
          SELECT CAST(DATEADD(day, -v.n, CAST(SYSUTCDATETIME() AS date)) AS date) AS d
          FROM (VALUES (0),(1),(2),(3),(4),(5),(6)) v(n)
        )
        SELECT
          DATENAME(WEEKDAY, d) AS name,
          (
            SELECT COUNT(*)
            FROM dbo.Items i
            WHERE CAST(i.updated_at AS date) = d
          ) AS items
        FROM last7
        ORDER BY d;
      `)
      ]);
      return { totals: totalsResult, weekly: weeklyResult };
    });

    const summary = totals.recordset[0] || {
      totalItems: 0,
      lowStockCount: 0,
      alertsCount: 0,
      categories: 0
    };

    return res.json({
      summary,
      weeklyActivity: weekly.recordset
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch dashboard summary", error: err.message });
  }
});

module.exports = router;
