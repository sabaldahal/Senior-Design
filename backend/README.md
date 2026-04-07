# Senior-Design Backend (Azure SQL)

Express API for the inventory dashboard frontend.

## What this backend provides

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/inventory/items`
- `GET /api/inventory/items/:id`
- `POST /api/inventory/items`
- `PUT /api/inventory/items/:id`
- `DELETE /api/inventory/items/:id`
- `POST /api/inventory/upload` (multipart form-data; stores local image path)
- `POST /api/inventory/inference` (JSON — create or update a row from ML inference output; see below)
- `GET /api/dashboard/summary`
- `GET /api/alerts`
- `POST /api/alerts/send-low-stock-email` — run low-stock digest email (same logic as optional cron)

## Low-stock email alerts

1. Set **`ALERT_EMAIL_TO`** to one or more comma-separated addresses.
2. Configure **SMTP** (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_PORT`, `SMTP_FROM`, `SMTP_SECURE=true` for 465).
3. Optional: **`INVENTORY_LOW_THRESHOLD`** (default `5`), **`ALERT_EMAIL_COOLDOWN_HOURS`** (default `24`) so the same item is not emailed again until cooldown passes or it restocks above the threshold (log row is cleared on restock).
4. Optional cron: **`ENABLE_LOW_STOCK_EMAIL_CRON=true`** and **`LOW_STOCK_CRON`** (default `0 */6 * * *` — every 6 hours).

The job uses table **`dbo.AlertItemEmailLog`** to track last send time per item. Enable **Email/Password** or your SMTP provider’s requirements (e.g. Gmail [app passwords](https://support.google.com/accounts/answer/185833)).

## 1) Setup

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and set your Azure SQL settings.

## 2) Example `.env`

```env
PORT=3000
NODE_ENV=development
DB_SERVER=senior-design.database.windows.net
DB_NAME=Inventory
DB_PORT=1433
DB_AUTH_MODE=aad
CORS_ORIGIN=http://localhost:5173
API_KEY=
```

`API_KEY` is optional (legacy; inventory writes are not gated by it when using Firebase below).

### Firebase Authentication (ID token verification)

When **`FIREBASE_SERVICE_ACCOUNT_PATH`** (or **`FIREBASE_SERVICE_ACCOUNT_JSON`**) is set, the backend initializes **Firebase Admin** and requires a valid **Firebase ID token** on:

- `/api/inventory/*`
- `/api/dashboard/*`
- `/api/alerts/*`

The SPA should send `Authorization: Bearer <Firebase ID token>` (the frontend does this after Email/Password sign-in).

1. Firebase Console → **Project settings** → **Service accounts** → **Generate new private key** → save JSON (do not commit).
2. In `backend/.env`: `FIREBASE_SERVICE_ACCOUNT_PATH=./your-key.json` (path relative to the backend folder, or use an absolute path).

If Admin is **not** configured, those routes stay **open** (useful for local experiments only).

### Entra-only Azure SQL (recommended)

This backend supports Entra token auth for Azure SQL when `DB_AUTH_MODE=aad`.

1. Install Azure CLI
2. Sign in on your machine:

```bash
az login
```

3. If you have multiple tenants/subscriptions, select the right one:

```bash
az account set --subscription "<your-subscription-name-or-id>"
```

4. Ensure your Entra user has SQL database access (mapped user/role in Azure SQL).

### SQL auth fallback

If you ever switch to SQL auth, set:

```env
DB_AUTH_MODE=sql
DB_USER=<sql-login>
DB_PASSWORD=<sql-password>
```

## 3) Run

```bash
npm run dev
```

Server starts at `http://localhost:3000`.

## 4) Frontend integration

Frontend already uses `/api` proxy to `http://localhost:3000` in `vite.config.js`.

- Start backend first
- Then run frontend (`npm run dev` in `frontend`)

## 5) Schema behavior

On startup, backend ensures `dbo.Items` exists and adds missing columns:

- `item_id` (GUID primary key)
- `sku` (unique when not null)
- `name`
- `category`
- `quantity`
- `notes`
- `image_url`
- `created_at`
- `updated_at`
- `ml_confidence` (real, nullable — model confidence score)
- `ml_metadata` (nvarchar(max), nullable — JSON string for any extra inference fields)

This allows you to start with a single-table scope and evolve later.

### Inference → inventory (`POST /api/inventory/inference`)

Same auth as other writes: if `API_KEY` is set, send header `x-api-key`.

**Create** (no `itemId`): body must include **`name`** or **`label`** (inferred product name). Optional: `category`, `quantity` (default `1`), `sku`, `notes`, `imageUrl` / `image_url`, `confidence` → stored in `ml_confidence`, `metadata` (object or JSON string) → `ml_metadata`, `source` (default `inference`).

**Update** (include **`itemId`** or **`item_id`**): send any subset of fields to patch; at least one field must be present.

Example (create after your model runs):

```json
POST /api/inventory/inference
{
  "label": "Widget A",
  "category": "Hardware",
  "confidence": 0.94,
  "quantity": 5,
  "metadata": { "model": "v2", "topK": ["Widget A", "Widget B"] }
}
```

Example (refresh inference fields on an existing row):

```json
POST /api/inventory/inference
{
  "itemId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "confidence": 0.88,
  "metadata": { "reclassifiedAt": "2026-04-06T12:00:00Z" }
}
```
