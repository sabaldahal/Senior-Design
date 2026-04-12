const nodemailer = require("nodemailer");
const { withSqlRetry, sql } = require("../db");

function getThreshold() {
  const n = Number(process.env.INVENTORY_LOW_THRESHOLD);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

function getCooldownHours() {
  const n = Number(process.env.ALERT_EMAIL_COOLDOWN_HOURS);
  return Number.isFinite(n) && n >= 1 ? n : 24;
}

function getRecipients() {
  const raw = process.env.ALERT_EMAIL_TO || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Finds low-stock items not emailed within cooldown, sends one digest email, updates log.
 * Clears log rows for items that are no longer low (so the next dip can notify again).
 */
async function runLowStockEmailJob() {
  const recipients = getRecipients();
  const transport = createTransport();
  const threshold = getThreshold();
  const cooldownHours = getCooldownHours();

  if (!recipients.length) {
    return { ok: false, reason: "ALERT_EMAIL_TO is not set", itemsNotified: 0 };
  }
  if (!transport) {
    return {
      ok: false,
      reason: "SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)",
      itemsNotified: 0,
    };
  }

  const items = await withSqlRetry(async (pool) => {
    await pool
      .request()
      .input("threshold", sql.Int, threshold)
      .query(`
      DELETE l
      FROM dbo.AlertItemEmailLog l
      INNER JOIN dbo.Items i ON i.item_id = l.item_id
      WHERE i.quantity > @threshold;
    `);

    const result = await pool
      .request()
      .input("threshold", sql.Int, threshold)
      .input("cooldown", sql.Int, cooldownHours)
      .query(`
      SELECT i.item_id, i.name, i.quantity, i.updated_at
      FROM dbo.Items i
      LEFT JOIN dbo.AlertItemEmailLog l ON l.item_id = i.item_id
      WHERE i.quantity <= @threshold
        AND (l.item_id IS NULL OR l.last_sent_at < DATEADD(HOUR, -@cooldown, SYSUTCDATETIME()))
      ORDER BY i.name;
    `);
    return result.recordset;
  });

  if (!items.length) {
    return {
      ok: true,
      itemsNotified: 0,
      message: "No low-stock items need email (none low or still in cooldown).",
    };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject =
    process.env.ALERT_EMAIL_SUBJECT || `[Inventory] Low stock: ${items.length} item(s)`;
  const rows = items
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.name)}</td><td style="text-align:right">${r.quantity}</td><td style="text-align:right">${threshold}</td></tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html><html><body>
<p>These items are at or below the low-stock threshold (<strong>${threshold}</strong>).</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse">
<thead><tr><th>Item</th><th>Quantity</th><th>Threshold</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="color:#666;font-size:12px">Sent by Warehouse Inventory backend.</p>
</body></html>`;
  const text = items
    .map((r) => `${r.name}: quantity ${r.quantity} (threshold ${threshold})`)
    .join("\n");

  await transport.sendMail({
    from,
    to: recipients,
    subject,
    text,
    html,
  });

  await withSqlRetry(async (pool) => {
    for (const row of items) {
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, row.item_id)
        .query(`
        MERGE dbo.AlertItemEmailLog AS t
        USING (SELECT @id AS item_id) AS s ON t.item_id = s.item_id
        WHEN MATCHED THEN UPDATE SET last_sent_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (item_id, last_sent_at) VALUES (s.item_id, SYSUTCDATETIME());
      `);
    }
  });

  return {
    ok: true,
    itemsNotified: items.length,
    recipientCount: recipients.length,
  };
}

module.exports = {
  runLowStockEmailJob,
  getThreshold,
  getCooldownHours,
  getRecipients,
  createTransport,
};
