import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  PlusCircle,
  Camera,
  Bell,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/add-item', label: 'Add Item', icon: PlusCircle },
  { to: '/camera', label: 'Camera', icon: Camera },
  { to: '/alerts', label: 'Alerts', icon: Bell },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <aside className="w-64 bg-neutral-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-neutral-700">
          <h1 className="text-lg font-semibold tracking-tight">Warehouse Inventory</h1>
          <p className="text-xs text-neutral-400 mt-1">Operations Console</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive ? 'bg-primary-700/70 text-white' : 'text-neutral-300 hover:bg-neutral-800'
                }`
              }
            >
              <Icon size={18} strokeWidth={2} />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-neutral-700">
          <div className="flex items-center gap-3 px-4 py-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-medium">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username || 'User'}</p>
              <p className="text-xs text-neutral-400">Signed in</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-neutral-50">
        <Outlet />
      </main>
    </div>
  );
}
