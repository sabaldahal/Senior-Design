const sql = require("mssql");
const { DefaultAzureCredential } = require("@azure/identity");

const SQL_SCOPE = "https://database.windows.net/.default";
/** Refresh AAD token this many ms before it expires (Azure SQL rejects expired tokens). */
const TOKEN_REFRESH_MS = 5 * 60 * 1000;
/** Fallback if SDK omits expiry — force new pool + token before this age. */
const POOL_MAX_AGE_MS = 45 * 60 * 1000;

const authMode = String(process.env.DB_AUTH_MODE || "aad").toLowerCase();
const credential = new DefaultAzureCredential();

let tokenCache = null;
let poolPromise = null;
let poolCreatedAt = 0;

function normalizeTokenExpiry(tokenResult) {
  if (!tokenResult) return 0;
  if (typeof tokenResult.expiresOnTimestamp === "number") {
    return tokenResult.expiresOnTimestamp;
  }
  const d = tokenResult.expiresOn;
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return d.getTime();
  }
  return 0;
}

async function getAadAccessToken() {
  if (process.env.AZURE_SQL_ACCESS_TOKEN) {
    return process.env.AZURE_SQL_ACCESS_TOKEN;
  }

  const now = Date.now();
  const exp = tokenCache?.expiresOnTimestamp || 0;
  if (tokenCache?.token && exp - TOKEN_REFRESH_MS > now) {
    return tokenCache.token;
  }

  const raw = await credential.getToken(SQL_SCOPE);
  if (!raw || !raw.token) {
    throw new Error("Failed to acquire Azure SQL access token.");
  }
  let expiresOnTimestamp = normalizeTokenExpiry(raw);
  if (!expiresOnTimestamp) {
    expiresOnTimestamp = now + 50 * 60 * 1000;
  }
  tokenCache = { token: raw.token, expiresOnTimestamp };
  return tokenCache.token;
}

async function buildSqlConfig() {
  const base = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 1433),
    options: {
      encrypt: true,
      trustServerCertificate: false
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  if (authMode === "sql") {
    return {
      ...base,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    };
  }

  const token = await getAadAccessToken();
  return {
    ...base,
    authentication: {
      type: "azure-active-directory-access-token",
      options: { token }
    }
  };
}

async function connectPool() {
  const config = await buildSqlConfig();
  poolCreatedAt = Date.now();
  return sql.connect(config);
}

async function closePool() {
  if (!poolPromise) return;
  try {
    const existing = await poolPromise;
    await existing.close();
  } catch (_e) {
    // ignore close errors while rotating pool
  }
  poolPromise = null;
}

/**
 * True when the cached AAD token is missing or past the refresh window — pool must use a new token.
 */
function aadTokenNeedsRotation() {
  if (authMode !== "aad") return false;
  /** Static token in env — no expiry tracking; keep pool until age limit. */
  if (process.env.AZURE_SQL_ACCESS_TOKEN) return false;
  const now = Date.now();
  const exp = tokenCache?.expiresOnTimestamp || 0;
  if (!tokenCache?.token || !exp) return true;
  return exp - TOKEN_REFRESH_MS <= now;
}

async function getPool() {
  const now = Date.now();
  const poolTooOld = poolPromise && now - poolCreatedAt > POOL_MAX_AGE_MS;
  const rotateForToken = authMode === "aad" && aadTokenNeedsRotation();
  if (!poolPromise || poolTooOld || rotateForToken) {
    await closePool();
    poolPromise = connectPool();
  }

  try {
    return await poolPromise;
  } catch (err) {
    poolPromise = null;
    throw err;
  }
}

function isTokenExpiredSqlError(err) {
  const msg = `${err?.message || ""} ${err?.originalError?.message || ""}`;
  return /Token is expired/i.test(msg) || /expired.*token/i.test(msg);
}

/**
 * Run a DB operation; if Azure SQL rejects an expired AAD token, reset pool + token cache and retry once.
 */
async function withSqlRetry(fn) {
  try {
    return await fn(await getPool());
  } catch (err) {
    if (!isTokenExpiredSqlError(err)) throw err;
    tokenCache = null;
    await closePool();
    return await fn(await getPool());
  }
}

async function ensureSchema() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.Items', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Items (
        item_id uniqueidentifier NOT NULL
          CONSTRAINT PK_Items PRIMARY KEY
          DEFAULT NEWID(),
        name nvarchar(200) NOT NULL,
        quantity int NOT NULL
          CONSTRAINT DF_Items_quantity DEFAULT (0)
      );
    END;

    IF COL_LENGTH('dbo.Items', 'sku') IS NULL
      ALTER TABLE dbo.Items ADD sku nvarchar(64) NULL;

    IF COL_LENGTH('dbo.Items', 'category') IS NULL
      ALTER TABLE dbo.Items ADD category nvarchar(100) NULL;

    IF COL_LENGTH('dbo.Items', 'notes') IS NULL
      ALTER TABLE dbo.Items ADD notes nvarchar(max) NULL;

    IF COL_LENGTH('dbo.Items', 'image_url') IS NULL
      ALTER TABLE dbo.Items ADD image_url nvarchar(1024) NULL;

    IF COL_LENGTH('dbo.Items', 'source') IS NULL
      ALTER TABLE dbo.Items ADD source nvarchar(32) NOT NULL
        CONSTRAINT DF_Items_source DEFAULT ('manual');

    IF COL_LENGTH('dbo.Items', 'created_at') IS NULL
      ALTER TABLE dbo.Items ADD created_at datetime2 NOT NULL
        CONSTRAINT DF_Items_created_at DEFAULT (SYSUTCDATETIME());

    IF COL_LENGTH('dbo.Items', 'updated_at') IS NULL
      ALTER TABLE dbo.Items ADD updated_at datetime2 NOT NULL
        CONSTRAINT DF_Items_updated_at DEFAULT (SYSUTCDATETIME());

    IF COL_LENGTH('dbo.Items', 'ml_confidence') IS NULL
      ALTER TABLE dbo.Items ADD ml_confidence real NULL;

    IF COL_LENGTH('dbo.Items', 'ml_metadata') IS NULL
      ALTER TABLE dbo.Items ADD ml_metadata nvarchar(max) NULL;

    IF OBJECT_ID('dbo.AlertItemEmailLog', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AlertItemEmailLog (
        item_id uniqueidentifier NOT NULL
          CONSTRAINT PK_AlertItemEmailLog PRIMARY KEY,
        last_sent_at datetime2 NOT NULL
          CONSTRAINT DF_AlertItemEmailLog_last_sent DEFAULT (SYSUTCDATETIME())
      );
    END;

    IF OBJECT_ID('dbo.CapturedImages', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.CapturedImages (
        image_id uniqueidentifier NOT NULL
          CONSTRAINT PK_CapturedImages PRIMARY KEY
          DEFAULT NEWID(),
        image_url nvarchar(1024) NOT NULL,
        object_id nvarchar(128) NULL,
        object_name nvarchar(200) NULL,
        bbox nvarchar(max) NULL,
        metadata nvarchar(max) NULL,
        source nvarchar(32) NOT NULL
          CONSTRAINT DF_CapturedImages_source DEFAULT ('camera_capture'),
        created_at datetime2 NOT NULL
          CONSTRAINT DF_CapturedImages_created_at DEFAULT (SYSUTCDATETIME())
      );
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'UX_Items_sku'
        AND object_id = OBJECT_ID('dbo.Items')
    )
    CREATE UNIQUE INDEX UX_Items_sku
    ON dbo.Items(sku)
    WHERE sku IS NOT NULL;
  `);
}

module.exports = {
  sql,
  getPool,
  withSqlRetry,
  ensureSchema
};
