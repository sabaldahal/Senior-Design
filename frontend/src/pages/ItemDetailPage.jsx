import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { inventoryApi } from '../api/inventory';
import { mockItems } from '../data/mockData';

export default function ItemDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchItem = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await inventoryApi.getItem(id);
        const candidate = data?.item || data;
        setItem(
          candidate
            ? {
                ...candidate,
                status: candidate.status || (Number(candidate.quantity) <= 5 ? 'Low' : 'OK'),
              }
            : null
        );
      } catch (err) {
        const found = mockItems.find((i) => i.id === id);
        setItem(found || null);
        setError(err.response?.data?.message || 'Backend unavailable. Showing demo data.');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id]);

  if (loading && !item) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-8">
        {error && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
            {error}
          </div>
        )}
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 text-rose-800">
          Item not found.
        </div>
        <Link to="/inventory" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
          ← Back to Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      {error && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
          {error}
        </div>
      )}
      <Link
        to="/inventory"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
      >
        ← Back to Inventory
      </Link>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:flex md:gap-8">
          <div className="md:w-48 shrink-0 mb-4 md:mb-0">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-32 object-cover rounded-lg border border-slate-200"
              />
            ) : (
              <div className="w-full h-32 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400">
                No image
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">{item.name}</h1>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Category</span>
                <p className="font-medium">{item.category}</p>
              </div>
              <div>
                <span className="text-slate-500">Quantity</span>
                <p className="font-medium">{item.quantity}</p>
              </div>
              <div>
                <span className="text-slate-500">Status</span>
                <p>
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                      item.status === 'Low' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.status}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-slate-500">ID</span>
                <p className="font-mono text-slate-700">{item.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
