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
- `GET /api/dashboard/summary`
- `GET /api/alerts`

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

`API_KEY` is optional. If set, write endpoints require `x-api-key`.

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

This allows you to start with a single-table scope and evolve later.
