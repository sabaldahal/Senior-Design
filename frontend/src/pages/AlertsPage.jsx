import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/inventory';
import { mockAlerts } from '../data/mockData';

function formatTimestamp(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await dashboardApi.getAlerts();
        const list = Array.isArray(data) ? data : data?.alerts;
        if (!Array.isArray(list)) {
          throw new Error('Unexpected alerts response format');
        }
        setAlerts(list);
      } catch (err) {
        setError(err.response?.data?.message || 'Backend unavailable. Showing demo data.');
        setAlerts(mockAlerts);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Alerts</h1>
        <p className="text-slate-600 mt-1">Low-stock and system notifications</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          {error} — Showing mock data.
        </div>
      )}

      <div className="space-y-4">
        {loading && !alerts.length ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            No alerts at this time
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  ⚠
                </div>
                <div>
                  <h3 className="font-medium text-slate-800">{alert.itemName}</h3>
                  <p className="text-slate-600 text-sm mt-1">{alert.message}</p>
                  <p className="text-slate-500 text-xs mt-2">
                    Quantity: {alert.quantity} (threshold: {alert.threshold})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500">{formatTimestamp(alert.timestamp)}</span>
                <Link
                  to={`/inventory/${alert.itemId}`}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  View Item
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
