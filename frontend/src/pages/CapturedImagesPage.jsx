import { useEffect, useMemo, useState } from 'react';
import { inventoryApi } from '../api/inventory';

function formatTimestamp(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}

function makeImageSrc(imageUrl) {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;

  const apiBase = import.meta.env.VITE_API_URL || '/api';
  if (/^https?:\/\//i.test(apiBase)) {
    try {
      const origin = new URL(apiBase).origin;
      return `${origin}${imageUrl}`;
    } catch {
      return imageUrl;
    }
  }
  return `http://localhost:3000${imageUrl}`;
}

export default function CapturedImagesPage() {
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchCaptures() {
      setLoading(true);
      setError('');
      try {
        const { data } = await inventoryApi.getCaptures();
        const list = Array.isArray(data?.captures) ? data.captures : [];
        setCaptures(list);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch captures');
      } finally {
        setLoading(false);
      }
    }
    fetchCaptures();
  }, []);

  const rows = useMemo(
    () =>
      captures.map((c) => ({
        ...c,
        previewSrc: makeImageSrc(c.imageUrl),
      })),
    [captures],
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Captured Images</h1>
        <p className="text-slate-600 mt-1">
          Images saved from camera capture.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading captures...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No captures yet. Use Camera page and click "Save Capture Anyway" or "Classify Item".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-slate-600">
                  <th className="py-3 px-4">Preview</th>
                  <th className="py-3 px-4">Object ID</th>
                  <th className="py-3 px-4">Object Name</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Path</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id || row.image_id} className="border-b border-slate-100 align-top">
                    <td className="py-3 px-4">
                      {row.previewSrc ? (
                        <img
                          src={row.previewSrc}
                          alt={row.object_name || row.object_id || 'capture'}
                          className="h-16 w-24 object-cover rounded border border-slate-200"
                        />
                      ) : (
                        <span className="text-slate-400">No image</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{row.object_id || '-'}</td>
                    <td className="py-3 px-4 text-slate-700">{row.object_name || '-'}</td>
                    <td className="py-3 px-4 text-slate-700">{row.source || '-'}</td>
                    <td className="py-3 px-4 text-slate-700">{formatTimestamp(row.created_at)}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-xs">{row.imageUrl || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
