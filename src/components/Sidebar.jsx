import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ClipboardList,
  Table2, 
  Utensils, 
  Wallet,
  BarChart3,
  Settings, 
  LogOut
} from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Utensils, label: 'Menu', path: '/menu' },
    { icon: Wallet, label: 'Billing', path: '/billing' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
  ];

  const handleSettings = () => {
    alert('Settings panel coming soon!');
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      window.location.href = '/';
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon-mark">🍽️</div>
        <div className="logo-text">
          <h1>Lumiere Bistro</h1>
          <span>Downtown Branch</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink 
            key={item.path} 
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item settings-item" onClick={handleSettings}>
          <Settings size={20} />
          <span>Settings</span>
        </button>
        
        <div className="user-card">
          <div className="avatar-small">AR</div>
          <div className="user-info">
            <p className="user-name">Alex Rivera</p>
            <p className="user-role">Manager</p>
          </div>
        </div>

        <button className="nav-item logout" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>

      <style jsx>{`
        .sidebar {
          width: 260px;
          height: 100vh;
          background: var(--color-sidebar);
          color: var(--color-primary);
          display: flex;
          flex-direction: column;
          padding: 2.5rem 1.25rem;
          border-right: 1px solid var(--color-border);
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 3rem;
          padding-left: 0.25rem;
        }

        .logo-icon-mark {
          font-size: 1.75rem;
          line-height: 1;
        }

        .logo-text h1 {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--color-primary);
          line-height: 1.2;
          white-space: nowrap;
        }

        .logo-text span {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          font-weight: 500;
          display: block;
          margin-top: 0.1rem;
        }

        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-top: 1rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.85rem 1.25rem;
          border-radius: var(--radius-md);
          color: var(--color-text-muted);
          font-size: 1rem;
          font-weight: 500;
          transition: var(--transition-smooth);
          text-decoration: none;
        }

        .nav-item:hover {
          background: rgba(78, 62, 47, 0.03);
          color: var(--color-primary);
        }

        .nav-item.active {
          background: var(--color-primary);
          color: white;
          font-weight: 600;
        }

        .sidebar-footer {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .settings-item {
          margin-bottom: 0.5rem;
        }

        .user-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: white;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          margin: 0.5rem 0;
        }

        .avatar-small {
          width: 36px;
          height: 36px;
          background: var(--color-primary);
          border-radius: 8px;
          color: white;
          font-size: 0.7rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }

        .user-name {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .user-role {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .logout:hover {
          color: #ff6b6b;
          background: rgba(255, 107, 107, 0.05);
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
