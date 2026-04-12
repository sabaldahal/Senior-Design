const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { withSqlRetry, sql } = require("../db");

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
    const prefix = file.fieldname === "capture" ? "capture" : "item";
    cb(null, `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e6)}${safeExt}`);
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
    ml_confidence:
      row.ml_confidence != null && row.ml_confidence !== undefined ? Number(row.ml_confidence) : null,
    ml_metadata: row.ml_metadata || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function serializeMlMetadata(metadata) {
  if (metadata === undefined || metadata === null) return null;
  if (typeof metadata === "object") {
    try {
      return JSON.stringify(metadata);
    } catch {
      return null;
    }
  }
  if (typeof metadata === "string") return metadata.trim() || null;
  return String(metadata);
}

function mapCapture(row) {
  return {
    id: row.image_id,
    image_id: row.image_id,
    imageUrl: row.image_url,
    object_id: row.object_id || null,
    object_name: row.object_name || null,
    bbox: row.bbox || null,
    metadata: row.metadata || null,
    source: row.source || "camera_capture",
    created_at: row.created_at,
  };
}

router.get("/items", async (_req, res) => {
  try {
    const result = await withSqlRetry((pool) =>
      pool.request().query(`
      SELECT item_id, sku, name, category, quantity, notes, image_url, source, ml_confidence, ml_metadata, created_at, updated_at
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
        SELECT item_id, sku, name, category, quantity, notes, image_url, source, ml_confidence, ml_metadata, created_at, updated_at
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

router.post("/items", async (req, res) => {
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

        SELECT item_id, sku, name, category, quantity, notes, image_url, source, ml_confidence, ml_metadata, created_at, updated_at
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

router.put("/items/:id", async (req, res) => {
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
        SELECT item_id, sku, name, category, quantity, notes, image_url, source, ml_confidence, ml_metadata, created_at, updated_at
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

router.delete("/items/:id", async (req, res) => {
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

/**
 * Store a camera-captured image on the backend and register it in SQL for later inference.
 * Multipart fields:
 * - image (required file)
 * - object_id / objectId (optional)
 * - object_name / objectName (optional)
 * - bbox / bounding_box / boundingBox (optional, object/array/string)
 * - metadata (optional, object/string)
 */
router.post("/captures", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "image file is required" });
    }

    const objectIdRaw = req.body?.object_id ?? req.body?.objectId ?? null;
    const objectNameRaw = req.body?.object_name ?? req.body?.objectName ?? null;
    const objectId = objectIdRaw ? String(objectIdRaw).trim() : null;
    const objectName = objectNameRaw ? String(objectNameRaw).trim() : null;
    const bboxRaw = req.body?.bbox ?? req.body?.bounding_box ?? req.body?.boundingBox ?? null;
    const bboxStr = serializeMlMetadata(bboxRaw);
    const metadataStr = serializeMlMetadata(req.body?.metadata ?? null);
    const imageUrl = `/uploads/${req.file.filename}`;

    const result = await withSqlRetry((pool) =>
      pool
        .request()
        .input("imageUrl", sql.NVarChar(1024), imageUrl)
        .input("objectId", sql.NVarChar(128), objectId)
        .input("objectName", sql.NVarChar(200), objectName)
        .input("bbox", sql.NVarChar(sql.MAX), bboxStr)
        .input("metadata", sql.NVarChar(sql.MAX), metadataStr)
        .input("source", sql.NVarChar(32), "camera_capture")
        .query(`
        DECLARE @newId uniqueidentifier = NEWID();
        INSERT INTO dbo.CapturedImages (
          image_id, image_url, object_id, object_name, bbox, metadata, source
        )
        VALUES (
          @newId, @imageUrl, @objectId, @objectName, @bbox, @metadata, @source
        );

        SELECT image_id, image_url, object_id, object_name, bbox, metadata, source, created_at
        FROM dbo.CapturedImages
        WHERE image_id = @newId;
      `)
    );

    return res.status(201).json({ capture: mapCapture(result.recordset[0]) });
  } catch (err) {
    return res.status(500).json({ message: "Failed to store captured image", error: err.message });
  }
});

router.get("/captures", async (_req, res) => {
  try {
    const result = await withSqlRetry((pool) =>
      pool.request().query(`
      SELECT image_id, image_url, object_id, object_name, bbox, metadata, source, created_at
      FROM dbo.CapturedImages
      ORDER BY created_at DESC;
    `)
    );
    return res.json({ captures: result.recordset.map(mapCapture) });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch captured images", error: err.message });
  }
});

/**
 * Apply ML / inference output to inventory.
 *
 * Create: POST body without itemId — requires name or label (object_name also accepted); optional category, quantity,
 *         sku, notes, imageUrl, confidence (stored as ml_confidence), metadata (JSON object
 *         or string → ml_metadata), source (default "inference"), object_id/object_name aliases.
 *
 * Update: POST body with itemId (or item_id) — patch any provided fields onto that row.
 *
 * Auth: same as other writes — optional X-API-Key when API_KEY is set in env.
 */
router.post("/inference", async (req, res) => {
  try {
    const body = req.body || {};
    const itemId = body.itemId || body.item_id || null;

    const hasLabel = Object.prototype.hasOwnProperty.call(body, "label");
    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasObjectName =
      Object.prototype.hasOwnProperty.call(body, "object_name") ||
      Object.prototype.hasOwnProperty.call(body, "objectName");
    const rawObjectName = body.object_name ?? body.objectName ?? "";
    const nameCandidate =
      hasName || hasLabel || hasObjectName
        ? String(
            (hasName ? body.name : hasLabel ? body.label : rawObjectName) || "",
          ).trim()
        : null;

    const hasCategory = Object.prototype.hasOwnProperty.call(body, "category");
    const categoryVal = hasCategory ? String(body.category || "").trim() || null : null;

    const hasConfidence = Object.prototype.hasOwnProperty.call(body, "confidence");
    const confidenceVal = hasConfidence ? Number(body.confidence) : null;

    const hasQuantity = Object.prototype.hasOwnProperty.call(body, "quantity");
    const quantityVal = hasQuantity ? Number(body.quantity) : null;

    const hasObjectId =
      Object.prototype.hasOwnProperty.call(body, "object_id") ||
      Object.prototype.hasOwnProperty.call(body, "objectId");
    const hasSku = Object.prototype.hasOwnProperty.call(body, "sku");
    const rawObjectId = body.object_id ?? body.objectId ?? null;
    const skuVal = hasSku
      ? (body.sku ? String(body.sku).trim() : null)
      : hasObjectId
        ? (rawObjectId ? String(rawObjectId).trim() : null)
        : null;

    const hasNotes = Object.prototype.hasOwnProperty.call(body, "notes");
    const notesVal = hasNotes ? String(body.notes || "").trim() || null : null;

    const hasImageUrl =
      Object.prototype.hasOwnProperty.call(body, "imageUrl") ||
      Object.prototype.hasOwnProperty.call(body, "image_url");
    const imageUrlVal = hasImageUrl
      ? String(body.imageUrl ?? body.image_url ?? "").trim() || null
      : null;

    const hasBoundingBox =
      Object.prototype.hasOwnProperty.call(body, "bounding_box") ||
      Object.prototype.hasOwnProperty.call(body, "boundingBox") ||
      Object.prototype.hasOwnProperty.call(body, "bbox");
    const hasMetadata = Object.prototype.hasOwnProperty.call(body, "metadata");
    const rawBoundingBox = body.bounding_box ?? body.boundingBox ?? body.bbox ?? null;
    let metadataPayload = hasMetadata ? body.metadata : null;
    if (hasBoundingBox) {
      if (!metadataPayload || typeof metadataPayload !== "object" || Array.isArray(metadataPayload)) {
        metadataPayload = { bounding_box: rawBoundingBox };
      } else {
        metadataPayload = { ...metadataPayload, bounding_box: rawBoundingBox };
      }
    }
    const metadataStr = hasMetadata || hasBoundingBox ? serializeMlMetadata(metadataPayload) : null;

    const hasSource = Object.prototype.hasOwnProperty.call(body, "source");
    const sourceVal = hasSource ? String(body.source || "").trim() || "inference" : null;

    if (itemId) {
      const anyUpdate =
        hasName ||
        hasLabel ||
        hasObjectName ||
        hasCategory ||
        hasConfidence ||
        hasQuantity ||
        hasSku ||
        hasObjectId ||
        hasNotes ||
        hasImageUrl ||
        hasMetadata ||
        hasBoundingBox ||
        hasSource;
      if (!anyUpdate) {
        return res.status(400).json({ message: "Provide at least one field to update" });
      }

      if ((hasName || hasLabel || hasObjectName) && !nameCandidate) {
        return res.status(400).json({ message: "name/label/object_name cannot be empty" });
      }
      if (hasQuantity && (!Number.isFinite(quantityVal) || quantityVal < 0)) {
        return res.status(400).json({ message: "quantity must be a non-negative number" });
      }
      if (hasConfidence && !Number.isFinite(confidenceVal)) {
        return res.status(400).json({ message: "confidence must be a finite number" });
      }

      const updated = await withSqlRetry(async (pool) => {
        await pool
          .request()
          .input("id", sql.UniqueIdentifier, itemId)
          .input("name", sql.NVarChar(200), hasName || hasLabel || hasObjectName ? nameCandidate : null)
          .input("category", sql.NVarChar(100), hasCategory ? categoryVal : null)
          .input("quantity", sql.Int, hasQuantity ? Math.round(quantityVal) : null)
          .input("sku", sql.NVarChar(64), hasSku || hasObjectId ? skuVal : null)
          .input("notes", sql.NVarChar(sql.MAX), hasNotes ? notesVal : null)
          .input("imageUrl", sql.NVarChar(1024), hasImageUrl ? imageUrlVal : null)
          .input("mlConfidence", sql.Real, hasConfidence ? confidenceVal : null)
          .input("mlMetadata", sql.NVarChar(sql.MAX), hasMetadata || hasBoundingBox ? metadataStr : null)
          .input("source", sql.NVarChar(32), hasSource ? sourceVal : null)
          .input("hName", sql.Bit, !!(hasName || hasLabel || hasObjectName))
          .input("hCategory", sql.Bit, hasCategory)
          .input("hQuantity", sql.Bit, hasQuantity)
          .input("hSku", sql.Bit, hasSku || hasObjectId)
          .input("hNotes", sql.Bit, hasNotes)
          .input("hImageUrl", sql.Bit, hasImageUrl)
          .input("hConf", sql.Bit, hasConfidence)
          .input("hMeta", sql.Bit, hasMetadata || hasBoundingBox)
          .input("hSource", sql.Bit, hasSource)
          .query(`
        UPDATE dbo.Items
        SET
          name = CASE WHEN @hName = 1 THEN @name ELSE name END,
          category = CASE WHEN @hCategory = 1 THEN @category ELSE category END,
          quantity = CASE WHEN @hQuantity = 1 THEN @quantity ELSE quantity END,
          sku = CASE WHEN @hSku = 1 THEN @sku ELSE sku END,
          notes = CASE WHEN @hNotes = 1 THEN @notes ELSE notes END,
          image_url = CASE WHEN @hImageUrl = 1 THEN @imageUrl ELSE image_url END,
          ml_confidence = CASE WHEN @hConf = 1 THEN @mlConfidence ELSE ml_confidence END,
          ml_metadata = CASE WHEN @hMeta = 1 THEN @mlMetadata ELSE ml_metadata END,
          source = CASE WHEN @hSource = 1 THEN @source ELSE source END,
          updated_at = SYSUTCDATETIME()
        WHERE item_id = @id;
      `);

        return pool
          .request()
          .input("id", sql.UniqueIdentifier, itemId)
          .query(`
        SELECT item_id, sku, name, category, quantity, notes, image_url, source, ml_confidence, ml_metadata, created_at, updated_at
        FROM dbo.Items
        WHERE item_id = @id;
      `);
      });

      if (!updated.recordset.length) {
        return res.status(404).json({ message: "Item not found" });
      }
      return res.json({ item: mapItem(updated.recordset[0]) });
    }

    const newName = String(body.name || body.label || body.object_name || body.objectName || "").trim();
    if (!newName) {
      return res.status(400).json({ message: "name, label, or object_name is required for new items" });
    }

    const quantity = Number(body.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ message: "quantity must be a non-negative number" });
    }

    const category = String(body.category || "Uncategorized").trim();
    const sku = body.sku
      ? String(body.sku).trim()
      : body.object_id || body.objectId
        ? String(body.object_id || body.objectId).trim()
        : null;
    const notes = body.notes != null ? String(body.notes).trim() || null : null;
    const imageUrl =
      body.imageUrl != null || body.image_url != null
        ? String(body.imageUrl ?? body.image_url ?? "").trim() || null
        : null;
    const mlConfidence = body.confidence != null ? Number(body.confidence) : null;
    if (body.confidence != null && !Number.isFinite(mlConfidence)) {
      return res.status(400).json({ message: "confidence must be a finite number" });
    }
    let createMetadataPayload = body.metadata ?? null;
    if (body.bounding_box != null || body.boundingBox != null || body.bbox != null) {
      const createBoundingBox = body.bounding_box ?? body.boundingBox ?? body.bbox;
      if (
        !createMetadataPayload ||
        typeof createMetadataPayload !== "object" ||
        Array.isArray(createMetadataPayload)
      ) {
        createMetadataPayload = { bounding_box: createBoundingBox };
      } else {
        createMetadataPayload = { ...createMetadataPayload, bounding_box: createBoundingBox };
      }
    }
    const mlMetadata = serializeMlMetadata(createMetadataPayload);
    const source = String(body.source || "inference").trim();

    const result = await withSqlRetry((pool) =>
      pool
        .request()
        .input("name", sql.NVarChar(200), newName)
        .input("sku", sql.NVarChar(64), sku)
        .input("category", sql.NVarChar(100), category || null)
        .input("quantity", sql.Int, Math.round(quantity))
        .input("notes", sql.NVarChar(sql.MAX), notes)
        .input("source", sql.NVarChar(32), source || "inference")
        .input("imageUrl", sql.NVarChar(1024), imageUrl)
        .input("mlConfidence", sql.Real, mlConfidence)
        .input("mlMetadata", sql.NVarChar(sql.MAX), mlMetadata)
        .query(`
        DECLARE @newId uniqueidentifier = NEWID();
        INSERT INTO dbo.Items (
          item_id, sku, name, category, quantity, notes, source, image_url,
          ml_confidence, ml_metadata, updated_at
        )
        VALUES (
          @newId, @sku, @name, @category, @quantity, @notes, @source, @imageUrl,
          @mlConfidence, @mlMetadata, SYSUTCDATETIME()
        );

        SELECT item_id, sku, name, category, quantity, notes, image_url, source, ml_confidence, ml_metadata, created_at, updated_at
        FROM dbo.Items
        WHERE item_id = @newId;
      `)
    );

    return res.status(201).json({ item: mapItem(result.recordset[0]) });
  } catch (err) {
    const status = /duplicate key|ux_items_sku/i.test(err.message)
      ? 409
      : /conversion failed|uniqueidentifier/i.test(err.message)
        ? 400
        : 500;
    return res.status(status).json({ message: "Failed to apply inference to inventory", error: err.message });
  }
});

router.post("/upload", upload.single("image"), async (req, res) => {
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

        SELECT item_id, sku, name, category, quantity, notes, image_url, source, ml_confidence, ml_metadata, created_at, updated_at
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
