// Mock data for development when backend is not available
export const mockSummary = {
  totalItems: 127,
  lowStockCount: 8,
  alertsCount: 5,
  categories: 12,
};

export const mockItems = [
  { id: '1', name: 'Widget A', quantity: 45, category: 'Electronics', status: 'OK', imageUrl: null },
  { id: '2', name: 'Gear B', quantity: 3, category: 'Hardware', status: 'Low', imageUrl: null },
  { id: '3', name: 'Cable Set', quantity: 120, category: 'Electronics', status: 'OK', imageUrl: null },
  { id: '4', name: 'Bolt Pack', quantity: 2, category: 'Hardware', status: 'Low', imageUrl: null },
  { id: '5', name: 'Sensor Unit', quantity: 28, category: 'Components', status: 'OK', imageUrl: null },
  { id: '6', name: 'Display Panel', quantity: 1, category: 'Electronics', status: 'Low', imageUrl: null },
  { id: '7', name: 'Adapter XL', quantity: 67, category: 'Electronics', status: 'OK', imageUrl: null },
  { id: '8', name: 'Tool Kit', quantity: 4, category: 'Hardware', status: 'Low', imageUrl: null },
];

export const mockAlerts = [
  { id: 'a1', itemId: '2', itemName: 'Gear B', message: 'Low stock', quantity: 3, threshold: 5, timestamp: '2026-02-14T10:30:00Z' },
  { id: 'a2', itemId: '4', itemName: 'Bolt Pack', message: 'Low stock', quantity: 2, threshold: 5, timestamp: '2026-02-14T09:15:00Z' },
  { id: 'a3', itemId: '6', itemName: 'Display Panel', message: 'Critical low stock', quantity: 1, threshold: 3, timestamp: '2026-02-14T08:00:00Z' },
  { id: 'a4', itemId: '8', itemName: 'Tool Kit', message: 'Low stock', quantity: 4, threshold: 5, timestamp: '2026-02-13T16:45:00Z' },
];

export const mockChartData = [
  { name: 'Mon', items: 65 },
  { name: 'Tue', items: 72 },
  { name: 'Wed', items: 58 },
  { name: 'Thu', items: 84 },
  { name: 'Fri', items: 91 },
  { name: 'Sat', items: 77 },
  { name: 'Sun', items: 68 },
];
