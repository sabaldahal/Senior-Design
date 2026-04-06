const sql = require("mssql");
const { DefaultAzureCredential } = require("@azure/identity");

const SQL_SCOPE = "https://database.windows.net/.default";
const TOKEN_REFRESH_MS = 5 * 60 * 1000;
const POOL_MAX_AGE_MS = 50 * 60 * 1000;

const authMode = String(process.env.DB_AUTH_MODE || "aad").toLowerCase();
const credential = new DefaultAzureCredential();

let tokenCache = null;
let poolPromise = null;
let poolCreatedAt = 0;

async function getAadAccessToken() {
  if (process.env.AZURE_SQL_ACCESS_TOKEN) {
    return process.env.AZURE_SQL_ACCESS_TOKEN;
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresOnTimestamp - TOKEN_REFRESH_MS > now) {
    return tokenCache.token;
  }

  tokenCache = await credential.getToken(SQL_SCOPE);
  if (!tokenCache || !tokenCache.token) {
    throw new Error("Failed to acquire Azure SQL access token.");
  }
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

async function getPool() {
  const now = Date.now();
  const poolTooOld = poolPromise && now - poolCreatedAt > POOL_MAX_AGE_MS;
  if (!poolPromise || poolTooOld) {
    if (poolTooOld) {
      try {
        const existing = await poolPromise;
        await existing.close();
      } catch (_e) {
        // ignore close errors while rotating pool
      }
    }
    poolPromise = connectPool();
  }

  try {
    return await poolPromise;
  } catch (err) {
    poolPromise = null;
    throw err;
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

    IF COL_LENGTH('dbo.Items', 'created_at') IS NULL
      ALTER TABLE dbo.Items ADD created_at datetime2 NOT NULL
        CONSTRAINT DF_Items_created_at DEFAULT (SYSUTCDATETIME());

    IF COL_LENGTH('dbo.Items', 'updated_at') IS NULL
      ALTER TABLE dbo.Items ADD updated_at datetime2 NOT NULL
        CONSTRAINT DF_Items_updated_at DEFAULT (SYSUTCDATETIME());

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
  ensureSchema
};
