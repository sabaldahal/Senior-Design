import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  PlusCircle,
  Camera,
  Bell,
  Images,
  LogOut,
  Warehouse,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/add-item', label: 'Add Item', icon: PlusCircle },
  { to: '/camera', label: 'Camera', icon: Camera },
  { to: '/captures', label: 'Captures', icon: Images },
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
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-200"
              aria-hidden
            >
              <Warehouse size={22} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">Warehouse Inventory</h1>
              <p className="text-xs text-neutral-400 mt-0.5">Operations Console</p>
            </div>
          </div>
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
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 shrink-0 rounded-full bg-neutral-700 flex items-center justify-center text-sm font-medium text-neutral-100">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username || 'User'}</p>
              <p className="text-xs text-neutral-400">Signed in</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-neutral-50">
        <Outlet />
      </main>
    </div>
  );
}
