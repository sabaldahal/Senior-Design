import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi, inventoryApi } from '../api/inventory';
import { mockSummary, mockChartData, mockItems } from '../data/mockData';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [weeklyChartData, setWeeklyChartData] = useState([]);
  const [itemQuantityData, setItemQuantityData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const categoryColors = ['#0ea5e9', '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#a855f7'];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ data: summaryData }, { data: itemsData }] = await Promise.all([
          dashboardApi.getSummary(),
          inventoryApi.getItems(),
        ]);

        const normalizedSummary = summaryData?.summary || summaryData || {};
        const normalizedWeekly = summaryData?.weeklyActivity || summaryData?.chartData || mockChartData;
        const rawItems = Array.isArray(itemsData) ? itemsData : itemsData?.items || [];
        const normalizedItems = rawItems.map((item) => ({
          id: item.id || item.item_id,
          name: item.name,
          quantity: Number(item.quantity) || 0,
          category: item.category || 'Uncategorized',
          updatedAt: item.updated_at || item.updatedAt || null,
          source: item.source || 'manual',
        }));
        const totalUnits = normalizedItems.reduce((acc, item) => acc + item.quantity, 0);
        const topItem = normalizedItems.reduce(
          (best, item) => (item.quantity > (best?.quantity || -1) ? item : best),
          null
        );
        const topByQuantity = [...normalizedItems]
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 8)
          .map((item) => ({
            name: item.name.length > 18 ? `${item.name.slice(0, 18)}…` : item.name,
            quantity: item.quantity,
          }));
        const lowStock = [...normalizedItems]
          .filter((item) => item.quantity <= 5)
          .sort((a, b) => a.quantity - b.quantity)
          .slice(0, 5)
          .map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            threshold: 5,
            updatedAt: item.updatedAt,
          }));
        const categoryMap = normalizedItems.reduce((acc, item) => {
          const key = item.category || 'Uncategorized';
          acc[key] = (acc[key] || 0) + item.quantity;
          return acc;
        }, {});
        const categoryChart = Object.entries(categoryMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);
        const updates = [...normalizedItems]
          .filter((item) => item.updatedAt)
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          .slice(0, 6)
          .map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            source: item.source === 'robot_scan' ? 'robot_scan' : 'manual',
            updatedAt: item.updatedAt,
          }));

        setSummary({
          totalItems: normalizedSummary.totalItems ?? 0,
          lowStockCount: normalizedSummary.lowStockCount ?? 0,
          alertsCount: normalizedSummary.alertsCount ?? 0,
          categories: normalizedSummary.categories ?? 0,
          totalUnits,
          topItemName: topItem?.name || 'N/A',
          topItemQty: topItem?.quantity ?? 0,
        });
        setWeeklyChartData(Array.isArray(normalizedWeekly) ? normalizedWeekly : mockChartData);
        setItemQuantityData(topByQuantity);
        setLowStockItems(lowStock);
        setCategoryData(categoryChart);
        setRecentUpdates(updates);
      } catch (err) {
        setError(err.response?.data?.message || 'Backend unavailable. Showing demo data.');
        const fallbackItems = mockItems.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: Number(item.quantity) || 0,
          category: item.category || 'Uncategorized',
          updatedAt: item.updated_at || new Date().toISOString(),
          source: item.source || 'manual',
        }));
        const fallbackTotalUnits = fallbackItems.reduce((acc, item) => acc + item.quantity, 0);
        const fallbackTop = fallbackItems.reduce(
          (best, item) => (item.quantity > (best?.quantity || -1) ? item : best),
          null
        );

        setSummary({
          ...mockSummary,
          totalUnits: fallbackTotalUnits,
          topItemName: fallbackTop?.name || 'N/A',
          topItemQty: fallbackTop?.quantity ?? 0,
        });
        setWeeklyChartData(mockChartData);
        setItemQuantityData(
          [...fallbackItems]
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 8)
            .map((item) => ({
              name: item.name.length > 18 ? `${item.name.slice(0, 18)}…` : item.name,
              quantity: item.quantity,
            }))
        );
        setLowStockItems(
          [...fallbackItems]
            .filter((item) => item.quantity <= 5)
            .sort((a, b) => a.quantity - b.quantity)
            .slice(0, 5)
            .map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              threshold: 5,
              updatedAt: item.updatedAt,
            }))
        );
        const fallbackCategoryMap = fallbackItems.reduce((acc, item) => {
          const key = item.category || 'Uncategorized';
          acc[key] = (acc[key] || 0) + item.quantity;
          return acc;
        }, {});
        setCategoryData(
          Object.entries(fallbackCategoryMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
        );
        setRecentUpdates(
          [...fallbackItems]
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 6)
            .map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              source: item.source,
              updatedAt: item.updatedAt,
            }))
        );
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
    { label: 'Total Units', value: summary?.totalUnits ?? 0, color: 'bg-indigo-500' },
    { label: 'Low Stock', value: summary?.lowStockCount ?? 0, color: 'bg-amber-500' },
    { label: 'Top Item Qty', value: summary?.topItemQty ?? 0, color: 'bg-emerald-500' },
  ];

  const formatTime = (ts) => {
    if (!ts) return 'N/A';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString();
  };

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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Top Items by Quantity</h2>
            <span className="text-sm text-slate-500">
              Highest on-hand stock
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemQuantityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Bar dataKey="quantity" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-slate-600 mt-3">
            Top item right now: <span className="font-semibold text-slate-800">{summary?.topItemName ?? 'N/A'}</span>
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Weekly Activity</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Bar dataKey="items" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-slate-600 mt-3">
            Categories tracked: <span className="font-semibold text-slate-800">{summary?.categories ?? 0}</span> | Active alerts: <span className="font-semibold text-slate-800">{summary?.alertsCount ?? 0}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Category Distribution (Units)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {categoryData.map((entry, idx) => (
                    <Cell key={`${entry.name}-${idx}`} fill={categoryColors[idx % categoryColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Low-stock Table (Top 5 Critical)</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-sm font-semibold text-slate-700">Item</th>
                  <th className="text-left py-2 text-sm font-semibold text-slate-700">Qty</th>
                  <th className="text-left py-2 text-sm font-semibold text-slate-700">Threshold</th>
                  <th className="text-left py-2 text-sm font-semibold text-slate-700">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 text-sm text-slate-800">{item.name}</td>
                    <td className="py-2 text-sm font-semibold text-rose-700">{item.quantity}</td>
                    <td className="py-2 text-sm text-slate-700">{item.threshold}</td>
                    <td className="py-2 text-sm text-slate-600">{formatTime(item.updatedAt)}</td>
                  </tr>
                ))}
                {!lowStockItems.length && (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-slate-500">
                      No low-stock items right now.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent Updates</h2>
        <div className="space-y-3">
          {recentUpdates.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <p className="text-sm font-medium text-slate-800">{entry.name}</p>
                <p className="text-xs text-slate-600">Qty: {entry.quantity}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-600">{formatTime(entry.updatedAt)}</p>
                <span
                  className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    entry.source === 'robot_scan'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {entry.source}
                </span>
              </div>
            </div>
          ))}
          {!recentUpdates.length && (
            <p className="text-sm text-slate-500">No recent updates available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
