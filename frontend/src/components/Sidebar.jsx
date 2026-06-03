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
  Users,
  LogOut,
  Thermometer
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const role = user?.role;

  const links = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  ];

  if (role === 'admin') {
    links.push(
      { to: '/sites', icon: <Building2 size={18} />, label: 'Sites' },
      { to: '/rooms', icon: <DoorOpen size={18} />, label: 'Rooms' },
      { to: '/nodes', icon: <Cpu size={18} />, label: 'Nodes' },
    );
  }

  if (role === 'admin' || role === 'site_manager') {
    links.push(
      { to: '/reports', icon: <BarChart3 size={18} />, label: 'Reports' },
      { to: '/scheduled-reports', icon: <Calendar size={18} />, label: 'Scheduled Reports' },
    );
  }

  links.push({ to: '/alerts', icon: <Bell size={18} />, label: 'Alerts' });

  if (role === 'admin') {
    links.push(
      { to: '/users', icon: <Users size={18} />, label: 'User Management' },
      { to: '/settings', icon: <Settings size={18} />, label: 'System Settings' },
    );
  }

  const roleBadge = {
    admin: { label: 'ADMIN', color: '#3b82f6' },
    site_manager: { label: 'SITE MANAGER', color: '#f59e0b' },
    customer: { label: 'CUSTOMER', color: '#64748b' },
  };
  const badge = roleBadge[role] || roleBadge.customer;

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
          <div style={{ fontSize: '10px', color: badge.color, marginTop: '2px', fontWeight: 700, letterSpacing: '0.5px' }}>
            {badge.label}
          </div>
        </div>
        <button className="nav-item" onClick={logout}>
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
