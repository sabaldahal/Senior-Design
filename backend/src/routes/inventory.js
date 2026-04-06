const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { withSqlRetry, sql } = require("../db");
const { requireApiKey } = require("../middleware/apiKey");

const router = express.Router();

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext && ext.length <= 6 ? ext : ".jpg";
    cb(null, `item_${Date.now()}_${Math.round(Math.random() * 1e6)}${safeExt}`);
  }
});
const upload = multer({ storage });

function mapItem(row) {
  return {
    id: row.item_id,
    item_id: row.item_id,
    sku: row.sku,
    name: row.name,
    category: row.category || "Uncategorized",
    quantity: Number(row.quantity),
    notes: row.notes || "",
    imageUrl: row.image_url || null,
    source: row.source || "manual",
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.get("/items", async (_req, res) => {
  try {
    const result = await withSqlRetry((pool) =>
      pool.request().query(`
      SELECT item_id, sku, name, category, quantity, notes, image_url, source, created_at, updated_at
      FROM dbo.Items
      ORDER BY name ASC;
    `)
    );
    return res.json({ items: result.recordset.map(mapItem) });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch items", error: err.message });
  }
});

router.get("/items/:id", async (req, res) => {
  try {
    const result = await withSqlRetry((pool) =>
      pool
        .request()
        .input("id", sql.UniqueIdentifier, req.params.id)
        .query(`
        SELECT item_id, sku, name, category, quantity, notes, image_url, source, created_at, updated_at
        FROM dbo.Items
        WHERE item_id = @id;
      `)
    );

    if (!result.recordset.length) {
      return res.status(404).json({ message: "Item not found" });
    }
    return res.json({ item: mapItem(result.recordset[0]) });
  } catch (err) {
    const status = /conversion failed|uniqueidentifier/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ message: "Failed to fetch item", error: err.message });
  }
});

router.post("/items", requireApiKey, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const quantity = Number(req.body?.quantity ?? 0);
    const category = String(req.body?.category || "Uncategorized").trim();
    const notes = String(req.body?.notes || "").trim();
    const skuRaw = req.body?.sku;
    const sku = skuRaw ? String(skuRaw).trim() : null;
    const sourceRaw = req.body?.source;
    const source = sourceRaw ? String(sourceRaw).trim() : "manual";

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ message: "quantity must be a non-negative number" });
    }

    const result = await withSqlRetry((pool) =>
      pool
        .request()
        .input("name", sql.NVarChar(200), name)
        .input("sku", sql.NVarChar(64), sku)
        .input("category", sql.NVarChar(100), category || null)
        .input("quantity", sql.Int, Math.round(quantity))
        .input("notes", sql.NVarChar(sql.MAX), notes || null)
        .input("source", sql.NVarChar(32), source || "manual")
        .query(`
        DECLARE @newId uniqueidentifier = NEWID();
        INSERT INTO dbo.Items (item_id, sku, name, category, quantity, notes, source, updated_at)
        VALUES (@newId, @sku, @name, @category, @quantity, @notes, @source, SYSUTCDATETIME());

        SELECT item_id, sku, name, category, quantity, notes, image_url, source, created_at, updated_at
        FROM dbo.Items
        WHERE item_id = @newId;
      `)
    );

    return res.status(201).json({ item: mapItem(result.recordset[0]) });
  } catch (err) {
    const status = /duplicate key|ux_items_sku/i.test(err.message) ? 409 : 500;
    return res.status(status).json({ message: "Failed to create item", error: err.message });
  }
});

router.put("/items/:id", requireApiKey, async (req, res) => {
  try {
    const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
    const hasSku = Object.prototype.hasOwnProperty.call(req.body || {}, "sku");
    const hasCategory = Object.prototype.hasOwnProperty.call(req.body || {}, "category");
    const hasQuantity = Object.prototype.hasOwnProperty.call(req.body || {}, "quantity");
    const hasNotes = Object.prototype.hasOwnProperty.call(req.body || {}, "notes");
    const hasSource = Object.prototype.hasOwnProperty.call(req.body || {}, "source");

    const updates = {};
    if (hasName) updates.name = String(req.body.name || "").trim();
    if (hasSku) updates.sku = req.body.sku ? String(req.body.sku).trim() : null;
    if (hasCategory) updates.category = String(req.body.category || "").trim() || null;
    if (hasNotes) updates.notes = String(req.body.notes || "").trim() || null;
    if (hasSource) updates.source = String(req.body.source || "").trim() || null;
    if (hasQuantity) updates.quantity = Number(req.body.quantity);

    if (hasName && !updates.name) {
      return res.status(400).json({ message: "name cannot be empty" });
    }
    if (hasQuantity && (!Number.isFinite(updates.quantity) || updates.quantity < 0)) {
      return res.status(400).json({ message: "quantity must be a non-negative number" });
    }

    const updated = await withSqlRetry(async (pool) => {
      const reqSql = pool
        .request()
        .input("id", sql.UniqueIdentifier, req.params.id)
        .input("name", sql.NVarChar(200), hasName ? updates.name : null)
        .input("sku", sql.NVarChar(64), hasSku ? updates.sku : null)
        .input("category", sql.NVarChar(100), hasCategory ? updates.category : null)
        .input("quantity", sql.Int, hasQuantity ? Math.round(updates.quantity) : null)
        .input("notes", sql.NVarChar(sql.MAX), hasNotes ? updates.notes : null)
        .input("source", sql.NVarChar(32), hasSource ? updates.source : null)
        .input("hasName", sql.Bit, hasName)
        .input("hasSku", sql.Bit, hasSku)
        .input("hasCategory", sql.Bit, hasCategory)
        .input("hasQuantity", sql.Bit, hasQuantity)
        .input("hasNotes", sql.Bit, hasNotes)
        .input("hasSource", sql.Bit, hasSource);

      await reqSql.query(`
      UPDATE dbo.Items
      SET
        name = CASE WHEN @hasName = 1 THEN @name ELSE name END,
        sku = CASE WHEN @hasSku = 1 THEN @sku ELSE sku END,
        category = CASE WHEN @hasCategory = 1 THEN @category ELSE category END,
        quantity = CASE WHEN @hasQuantity = 1 THEN @quantity ELSE quantity END,
        notes = CASE WHEN @hasNotes = 1 THEN @notes ELSE notes END,
        source = CASE WHEN @hasSource = 1 THEN @source ELSE source END,
        updated_at = SYSUTCDATETIME()
      WHERE item_id = @id;
    `);

      return pool
        .request()
        .input("id", sql.UniqueIdentifier, req.params.id)
        .query(`
        SELECT item_id, sku, name, category, quantity, notes, image_url, source, created_at, updated_at
        FROM dbo.Items
        WHERE item_id = @id;
      `);
    });

    if (!updated.recordset.length) {
      return res.status(404).json({ message: "Item not found" });
    }
    return res.json({ item: mapItem(updated.recordset[0]) });
  } catch (err) {
    const status = /duplicate key|ux_items_sku/i.test(err.message)
      ? 409
      : /conversion failed|uniqueidentifier/i.test(err.message)
        ? 400
        : 500;
    return res.status(status).json({ message: "Failed to update item", error: err.message });
  }
});

router.delete("/items/:id", requireApiKey, async (req, res) => {
  try {
    const result = await withSqlRetry((pool) =>
      pool
        .request()
        .input("id", sql.UniqueIdentifier, req.params.id)
        .query(`
        DELETE FROM dbo.Items
        WHERE item_id = @id;

        SELECT @@ROWCOUNT AS deletedCount;
      `)
    );

    const deletedCount = result.recordset[0]?.deletedCount || 0;
    if (!deletedCount) {
      return res.status(404).json({ message: "Item not found" });
    }
    return res.json({ ok: true });
  } catch (err) {
    const status = /conversion failed|uniqueidentifier/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ message: "Failed to delete item", error: err.message });
  }
});

router.post("/upload", requireApiKey, upload.single("image"), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const quantity = Number(req.body?.quantity ?? 0);
    const category = String(req.body?.category || "Uncategorized").trim();
    const notes = String(req.body?.notes || "").trim();
    const skuRaw = req.body?.sku;
    const sku = skuRaw ? String(skuRaw).trim() : null;
    const sourceRaw = req.body?.source;
    const source = sourceRaw ? String(sourceRaw).trim() : "manual";
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ message: "quantity must be a non-negative number" });
    }

    const result = await withSqlRetry((pool) =>
      pool
        .request()
        .input("name", sql.NVarChar(200), name)
        .input("sku", sql.NVarChar(64), sku)
        .input("category", sql.NVarChar(100), category || null)
        .input("quantity", sql.Int, Math.round(quantity))
        .input("notes", sql.NVarChar(sql.MAX), notes || null)
        .input("source", sql.NVarChar(32), source || "manual")
        .input("imageUrl", sql.NVarChar(1024), imageUrl)
        .query(`
        DECLARE @newId uniqueidentifier = NEWID();
        INSERT INTO dbo.Items (item_id, sku, name, category, quantity, notes, source, image_url, updated_at)
        VALUES (@newId, @sku, @name, @category, @quantity, @notes, @source, @imageUrl, SYSUTCDATETIME());

        SELECT item_id, sku, name, category, quantity, notes, image_url, source, created_at, updated_at
        FROM dbo.Items
        WHERE item_id = @newId;
      `)
    );

    return res.status(201).json({ item: mapItem(result.recordset[0]) });
  } catch (err) {
    const status = /duplicate key|ux_items_sku/i.test(err.message) ? 409 : 500;
    return res.status(status).json({ message: "Failed to upload item image", error: err.message });
  }
});

module.exports = router;
