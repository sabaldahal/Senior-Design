# AI Inventory Management - Frontend

React + Tailwind frontend for the AI-powered inventory management system.

## Stack

- **React 18** - Component-based UI
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Charts for dashboard
- **React Router** - Navigation
- **Axios** - API client

## Setup

```bash
npm install
npm run dev
```

Runs at `http://localhost:5173`.

## Build

```bash
npm run build
```

## Pages

1. **Login** - Username/password (demo: any credentials work)
2. **Dashboard** - Summary cards, weekly activity chart
3. **Inventory** - Table of items with search
4. **Item Detail** - Single item view
5. **Add Item** - Image upload and form
6. **Alerts** - Low-stock notifications

## API Integration

The app uses mock data by default. To connect to a real backend:

1. Create `.env` with `VITE_API_URL=http://localhost:3000/api` (or your API base URL)
2. Ensure the backend exposes:
   - `POST /api/auth/login`
   - `GET /api/inventory/items`
   - `GET /api/inventory/items/:id`
   - `POST /api/inventory/items`
   - `POST /api/inventory/upload` (multipart)
   - `GET /api/dashboard/summary`
   - `GET /api/alerts`
