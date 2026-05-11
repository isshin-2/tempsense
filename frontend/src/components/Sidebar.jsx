import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Cpu,
  BarChart3,
  Bell,
  Settings,
  Calendar,
  LogOut,
  Thermometer
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();

  const links = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/sites', icon: <Building2 size={18} />, label: 'Sites' },
    { to: '/rooms', icon: <DoorOpen size={18} />, label: 'Rooms' },
    { to: '/nodes', icon: <Cpu size={18} />, label: 'Nodes' },
    { to: '/reports', icon: <BarChart3 size={18} />, label: 'Reports' },
    { to: '/alerts', icon: <Bell size={18} />, label: 'Alerts' },
  ];

  // Admin only links
  if (user?.role === 'super_admin' || user?.role === 'site_admin') {
    links.push({ to: '/scheduled-reports', icon: <Calendar size={18} />, label: 'Scheduled Reports' });
  }
  
  if (user?.role === 'super_admin') {
    links.push({ to: '/settings', icon: <Settings size={18} />, label: 'System Settings' });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Thermometer size={24} style={{ color: '#3b82f6' }} />
          <div>
            <h1>TEMPSENSE</h1>
            <span>Maxworth Techserv</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{user?.name}</div>
          <div>{user?.email}</div>
          <div style={{ textTransform: 'uppercase', fontSize: '10px', color: 'var(--accent-blue)', marginTop: '2px' }}>{user?.role?.replace('_', ' ')}</div>
        </div>
        <button className="nav-item" onClick={logout}>
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
