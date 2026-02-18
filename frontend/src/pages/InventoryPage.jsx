import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../api/inventory';
import { mockItems } from '../data/mockData';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await inventoryApi.getItems();
        const list = Array.isArray(data) ? data : data?.items;
        if (!Array.isArray(list)) {
          throw new Error('Unexpected inventory response format');
        }
        setItems(
          list.map((item) => ({
            ...item,
            status: item.status || (Number(item.quantity) <= 5 ? 'Low' : 'OK'),
          }))
        );
      } catch (err) {
        setError(err.response?.data?.message || 'Backend unavailable. Showing demo data.');
        setItems(mockItems);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(filter.toLowerCase()) ||
      item.category.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-slate-600 mt-1">View and manage all items</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          {error} — Showing mock data.
        </div>
      )}

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name or category..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-md px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && !items.length ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Item</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Category</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Quantity</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Status</th>
                  <th className="text-right py-4 px-6 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-4 px-6">
                      <Link
                        to={`/inventory/${item.id}`}
                        className="font-medium text-primary-600 hover:text-primary-700"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="py-4 px-6 text-slate-600">{item.category}</td>
                    <td className="py-4 px-6 font-medium">{item.quantity}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          item.status === 'Low'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        to={`/inventory/${item.id}`}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filteredItems.length === 0 && !loading && (
          <div className="p-12 text-center text-slate-500">No items found</div>
        )}
      </div>
    </div>
  );
}
