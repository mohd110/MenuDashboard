import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import MenuCatalog from './views/MenuCatalog';
import Billing from './views/Billing';
import Payments from './views/Payments';
import Reports from './views/Reports';
import Settings from './views/Settings';
import Customers from './views/Customers';
import QRManagement from './views/QRManagement';
import Staff from './views/Staff';
import Orders from './views/Orders';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        
        <main className="main-content">
          <Header />
          
          <div className="scrollable-area">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/menu" element={<MenuCatalog />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/qr-management" element={<QRManagement />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/orders" element={<Orders />} />
              {/* Fallback for other routes */}
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
