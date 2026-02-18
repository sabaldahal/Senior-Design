import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi } from '../api/inventory';
import { mockSummary, mockChartData } from '../data/mockData';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await dashboardApi.getSummary();
        const normalizedSummary = data?.summary || data || {};
        const normalizedChart = data?.weeklyActivity || data?.chartData || mockChartData;

        setSummary({
          totalItems: normalizedSummary.totalItems ?? 0,
          lowStockCount: normalizedSummary.lowStockCount ?? 0,
          alertsCount: normalizedSummary.alertsCount ?? 0,
          categories: normalizedSummary.categories ?? 0,
        });
        setChartData(Array.isArray(normalizedChart) ? normalizedChart : mockChartData);
      } catch (err) {
        setError(err.response?.data?.message || 'Backend unavailable. Showing demo data.');
        setSummary(mockSummary);
        setChartData(mockChartData);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading && !summary) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const cards = [
    { label: 'Total Items', value: summary?.totalItems ?? 0, color: 'bg-primary-500' },
    { label: 'Low Stock', value: summary?.lowStockCount ?? 0, color: 'bg-amber-500' },
    { label: 'Active Alerts', value: summary?.alertsCount ?? 0, color: 'bg-rose-500' },
    { label: 'Categories', value: summary?.categories ?? 0, color: 'bg-emerald-500' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-600 mt-1">Inventory overview</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          {error} — Showing mock data.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <p className="text-slate-600 text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
            <div className={`mt-2 h-1 w-12 rounded-full ${color}`} />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Weekly Activity</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Bar dataKey="items" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
