import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Plus, X, User, Phone, Users, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [availableTables, setAvailableTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    guests: 2,
    tableId: ''
  });

  const getTitle = () => {
    switch(location.pathname) {
      case '/dashboard': return 'Table Dashboard';
      case '/menu': return 'Menu Catalog';
      case '/billing': return 'Billing & Invoice';
      case '/reports': return 'Business Reports';
      default: return 'Golden Saffron';
    }
  };

  const handleOpenModal = async () => {
    setShowModal(true);
    setLoadingTables(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('status', 'available')
        .order('table_number');
      if (!error && data) {
        setAvailableTables(data);
        if (data.length > 0) {
          setCustomerData(prev => ({ ...prev, tableId: data[0].id }));
        } else {
          setCustomerData(prev => ({ ...prev, tableId: '' }));
        }
      }
    } catch (err) {
      console.error('Error fetching available tables:', err);
    } finally {
      setLoadingTables(false);
    }
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!customerData.tableId) {
      alert('Please select a table.');
      return;
    }
    try {
      // 1. Create Customer Session
      const { data: session, error: sessionError } = await supabase
        .from('customer_sessions')
        .insert([{
          table_id: customerData.tableId,
          customer_name: customerData.name,
          phone_number: customerData.phone,
          guest_count: customerData.guests,
          session_status: 'active'
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 2. Update Table Status
      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', customerData.tableId);

      if (tableError) throw tableError;

      // 3. Navigate to Menu
      setShowModal(false);
      // Reset form
      setCustomerData({
        name: '',
        phone: '',
        guests: 2,
        tableId: ''
      });
      navigate(`/menu?sessionId=${session.id}&tableId=${session.table_id}`);
    } catch (error) {
      alert('Error starting session: ' + error.message);
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <h2 className="main-title">{getTitle()}</h2>
        <div className="search-bar">
          <Search size={18} color="#8E7F71" />
          <input type="text" placeholder="Search tables, items, or orders..." />
        </div>
      </div>

      <div className="header-right">
        <button className="new-order-btn" onClick={handleOpenModal}>
          <Plus size={18} />
          <span>New Order</span>
        </button>

        <div className="shift-badge">
          <div className="status-dot"></div>
          <span>Shift Active</span>
        </div>
        
        <button className="icon-btn">
          <Bell size={20} color="#2D241E" />
        </button>

        <button className="icon-btn">
          <div className="help-circle">?</div>
        </button>
      </div>

      {/* New Order Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Table - New Order</h2>
              <button className="close-modal" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleStartSession} className="modal-form">
              <div className="form-group">
                <label>Select Table</label>
                {loadingTables ? (
                  <p style={{ fontSize: '0.9rem', color: '#888' }}>Loading tables...</p>
                ) : availableTables.length === 0 ? (
                  <p style={{ color: '#e74c3c', fontSize: '0.9rem', fontWeight: 600 }}>No available tables. Complete or clean a table first.</p>
                ) : (
                  <select 
                    value={customerData.tableId}
                    onChange={(e) => setCustomerData({...customerData, tableId: e.target.value})}
                    required
                  >
                    {availableTables.map(t => (
                      <option key={t.id} value={t.id}>
                        Table {t.table_number} ({t.capacity} Seats)
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="form-group">
                <label><User size={16} /> Customer Name</label>
                <input 
                  type="text" 
                  placeholder="Enter name..." 
                  value={customerData.name}
                  onChange={(e) => setCustomerData({...customerData, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label><Phone size={16} /> Phone Number</label>
                <input 
                  type="tel" 
                  placeholder="Enter phone..." 
                  value={customerData.phone}
                  onChange={(e) => setCustomerData({...customerData, phone: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label><Users size={16} /> Guest Count</label>
                <div className="guest-selector">
                  {[1, 2, 3, 4, 5, 6, 8].map(n => (
                    <button 
                      type="button"
                      key={n} 
                      className={customerData.guests === n ? 'active' : ''}
                      onClick={() => setCustomerData({...customerData, guests: n})}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="start-btn" disabled={!customerData.tableId}>
                  Assign Table & Start Order <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .header {
          height: 80px;
          padding: 0 2.5rem;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
        }

        .header-left {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        .main-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-primary);
          white-space: nowrap;
        }

        .search-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: #F4EFEA;
          border: none;
          padding: 0.85rem 1.5rem;
          border-radius: 14px;
          width: 100%;
          max-width: 440px;
        }

        .search-bar input {
          border: none;
          background: transparent;
          outline: none;
          width: 100%;
          font-size: 0.95rem;
          color: var(--color-primary);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .new-order-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--color-primary);
          color: white;
          padding: 0.85rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          margin-right: 0.5rem;
          border: none;
          cursor: pointer;
        }

        .shift-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1rem;
          background: #EDE8E3;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: #8E7F71;
          border-radius: 50%;
        }

        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          color: var(--color-primary);
          background: none;
          border: none;
          cursor: pointer;
        }

        .help-circle {
          width: 20px;
          height: 20px;
          border: 1.5px solid var(--color-primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-container {
          background: white;
          width: 440px;
          border-radius: 24px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          overflow: hidden;
        }

        .modal-header {
          padding: 1.5rem 2rem;
          background: var(--color-sidebar);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--color-border);
        }

        .modal-header h2 { font-size: 1.25rem; font-weight: 700; color: var(--color-primary); }
        .close-modal { color: var(--color-text-muted); background: none; border: none; cursor: pointer; }

        .modal-form { padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }

        .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-group label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 700; color: var(--color-text-muted); }
        
        .form-group input, .form-group select {
          padding: 0.85rem 1rem;
          border-radius: 12px;
          border: 1.5px solid var(--color-border);
          font-size: 1rem;
          color: var(--color-primary);
          font-weight: 600;
          background: white;
          outline: none;
        }

        .guest-selector { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
        .guest-selector button {
          padding: 0.75rem;
          border: 1.5px solid var(--color-border);
          border-radius: 10px;
          font-weight: 700;
          color: var(--color-text-muted);
          background: white;
          cursor: pointer;
        }
        .guest-selector button.active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .modal-footer { margin-top: 1rem; }
        .start-btn {
          width: 100%;
          background: var(--color-primary);
          color: white;
          padding: 1.1rem;
          border-radius: 16px;
          font-weight: 700;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          border: none;
          cursor: pointer;
        }
        .start-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </header>
  );
};

export default Header;
