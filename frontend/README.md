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

1. **Login** - Firebase **Email/Password** when `VITE_FIREBASE_*` is set in `.env.local`; otherwise legacy backend/demo login
2. **Dashboard** - Summary cards, weekly activity chart
3. **Inventory** - Table of items with search
4. **Item Detail** - Single item view
5. **Add Item** - Image upload and form
6. **Alerts** - Low-stock notifications

## API Integration

The app uses mock data by default. To connect to a real backend:

1. Copy `.env.example` to `.env.local` and set `VITE_FIREBASE_*` from Firebase Console (Web app). Set `VITE_API_URL=http://localhost:3000/api` if needed.
2. Backend must verify tokens: set `FIREBASE_SERVICE_ACCOUNT_PATH` in the API `.env` to your downloaded service account JSON.
3. In Firebase Console → **Authentication** → **Sign-in method**, enable **Email/Password** (and add users or use **Register** on the login page).
4. Ensure the backend exposes:
   - `POST /api/auth/login`
   - `GET /api/inventory/items`
   - `GET /api/inventory/items/:id`
   - `POST /api/inventory/items`
   - `POST /api/inventory/upload` (multipart)
   - `GET /api/dashboard/summary`
   - `GET /api/alerts`
