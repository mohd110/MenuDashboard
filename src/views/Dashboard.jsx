import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { X, User, Users, Phone, ArrowRight } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeArea, setActiveArea] = useState('all');
  const [activeMode, setActiveMode] = useState('Dine In');
  const [tables, setTables] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waiterCalls, setWaiterCalls] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    guests: 2
  });

  useEffect(() => {
    fetchData();
    fetchWaiterCalls();
    
    // Subscribe to changes
    const tablesSubscription = supabase
      .channel('restaurant_tables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, fetchData)
      .subscribe();

    const waiterSubscription = supabase
      .channel('waiter_calls_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, (payload) => {
        fetchWaiterCalls();
        if (payload.eventType === 'INSERT' && payload.new.request_status === 'pending') {
          setToastMessage(`New Waiter Call from ${payload.new.customer_name || 'a table'}!`);
          setTimeout(() => setToastMessage(null), 5000);
        }
      })
      .subscribe();

    // Check every 10 seconds if any cleaning tables have expired (2 mins after payment)
    const interval = setInterval(() => {
      setTables(currentTables => {
        const now = new Date();
        let needsUpdate = false;
        const tablesToUpdate = [];

        const nextTables = currentTables.map(t => {
          if (t.status === 'cleaning') {
            const completed = t.customer_sessions
              ?.filter(s => s.session_status === 'completed' && s.ended_at)
              ?.sort((a, b) => new Date(b.ended_at) - new Date(a.ended_at));
            
            if (completed && completed.length > 0) {
              const diff = now - new Date(completed[0].ended_at);
              if (diff >= 120000) { // 2 minutes
                needsUpdate = true;
                tablesToUpdate.push(t.id);
                return { ...t, status: 'available' };
              }
            }
          }
          return t;
        });

        if (needsUpdate) {
          tablesToUpdate.forEach(async (id) => {
            try {
              await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', id);
            } catch (e) {
              console.error('Failed to auto-update table status', e);
            }
          });
          return nextTables;
        }
        return currentTables;
      });
    }, 10000);

    return () => {
      supabase.removeChannel(tablesSubscription);
      supabase.removeChannel(waiterSubscription);
      clearInterval(interval);
    };
  }, []);

  const fetchWaiterCalls = async () => {
    try {
      const { data, error } = await supabase
        .from('waiter_calls')
        .select('*')
        .eq('request_status', 'pending');
      if (!error && data) {
        setWaiterCalls(data);
      }
    } catch (err) {
      console.error('Error fetching waiter calls:', err);
    }
  };

  const handleResolveWaiterCall = async (callId) => {
    try {
      await supabase.from('waiter_calls').update({ request_status: 'completed' }).eq('id', callId);
      fetchWaiterCalls();
    } catch (err) {
      console.error('Error resolving call:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('restaurant_sections')
        .select('*')
        .order('section_name');
        
      if (sectionsError) throw sectionsError;
      setSections(sectionsData);
      if (sectionsData.length > 0 && activeArea === 'all') {
        // We keep it as 'all' or set it to the first one if preferred, but 'all' is safer
      }

      // Fetch Tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select(`
          *,
          customer_sessions(id, customer_name, guest_count, started_at, session_status, ended_at)
        `)
        .order('table_number');

      if (tablesError) throw tablesError;
      
      // Filter sessions manually to ensure we only get the active/billing one per table
      const processedTables = tablesData.map(table => ({
        ...table,
        active_session: table.customer_sessions?.find(s => s.session_status === 'active' || s.session_status === 'billing')
      }));

      setTables(processedTables);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrderClick = (table) => {
    setSelectedTable(table);
    setShowModal(true);
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    try {
      // 1. Create Customer Session
      const { data: session, error: sessionError } = await supabase
        .from('customer_sessions')
        .insert([{
          table_id: selectedTable.id,
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
        .eq('id', selectedTable.id);

      if (tableError) throw tableError;

      // 3. Navigate to Menu
      setShowModal(false);
      navigate(`/menu?sessionId=${session.id}&tableId=${selectedTable.id}`);
    } catch (error) {
      alert('Error starting session: ' + error.message);
    }
  };

  const stats = [
    { label: 'TOTAL TABLES', value: tables.length },
    { label: 'OCCUPIED', value: tables.filter(t => t.status === 'occupied').length },
    { label: 'AVAILABLE', value: tables.filter(t => t.status === 'available').length },
    { label: 'BILLING', value: tables.filter(t => t.status === 'billing').length },
  ];

  const modes = [
    { label: 'Dine In', icon: '🍴' },
    { label: 'Take Away', icon: '🥡' },
    { label: 'Delivery', icon: '🛵' },
    { label: 'Pickup', icon: '🚶' },
  ];

  const filteredTables = activeArea === 'all' 
    ? tables 
    : tables.filter(t => t.section_id === activeArea);

  if (loading && tables.length === 0) {
    return <div className="loading-state">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-view">
      {/* Stats Bar */}
      <div className="stats-bar">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <span className="stat-label">{stat.label}</span>
            <span className="stat-value">{stat.value}</span>
          </div>
        ))}
        
        <div className="service-modes">
          {modes.map((mode) => (
            <div 
              key={mode.label} 
              className={`mode-card ${activeMode === mode.label ? 'active' : ''}`}
              onClick={() => setActiveMode(mode.label)}
              style={{ cursor: 'pointer' }}
            >
              <div className="mode-icon">{mode.icon}</div>
              <span>{mode.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation & Legend */}
      <div className="content-nav">
        <div className="area-tabs">
          <button 
            className={`area-tab ${activeArea === 'all' ? 'active' : ''}`}
            onClick={() => setActiveArea('all')}
          >
            All Tables
          </button>
          {sections.map((section) => (
            <button 
              key={section.id} 
              className={`area-tab ${activeArea === section.id ? 'active' : ''}`}
              onClick={() => setActiveArea(section.id)}
            >
              {section.section_name}
            </button>
          ))}
        </div>
        
        <div className="legend">
          <span className="legend-label">Legend:</span>
          <div className="legend-item"><div className="dot available"></div> Available</div>
          <div className="legend-item"><div className="dot occupied"></div> Occupied</div>
          <div className="legend-item"><div className="dot billing"></div> Billing</div>
        </div>
      </div>

      {/* Table Grid */}
      <div className="table-grid">
        {filteredTables.map((table) => {
          const session = table.active_session;
          return (
            <div key={table.id} className={`table-card ${table.status}`}>
              <div className="table-card-header">
                <div>
                  <h3 className="table-id">{table.table_number}</h3>
                  <p className="table-meta">👤 {table.capacity} Seats</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <span className={`status-tag ${table.status}`}>
                    <div className="dot"></div>
                    {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                  </span>
                  {waiterCalls.filter(c => c.table_id === table.id).map(call => (
                    <button key={call.id} className="blinking-waiter-btn" onClick={(e) => { e.stopPropagation(); handleResolveWaiterCall(call.id); }}>
                      🔔 Waiter Called
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-card-body">
                {table.status === 'occupied' && (
                  <div className="status-info">
                    <div className="info-row">
                      <span>{session?.customer_name || 'Guest'}</span>
                      <span className="amount">Active Session</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="action-btn outline" 
                        onClick={() => navigate(`/menu?sessionId=${session?.id}&tableId=${table.id}`)}
                        disabled={!session}
                        style={{ opacity: !session ? 0.5 : 1, cursor: !session ? 'not-allowed' : 'pointer', flex: 1 }}
                      >
                        Create Order
                      </button>
                      <button 
                        className="action-btn primary" 
                        onClick={() => navigate(`/billing?sessionId=${session?.id}`)}
                        disabled={!session}
                        style={{ opacity: !session ? 0.5 : 1, cursor: !session ? 'not-allowed' : 'pointer', flex: 1 }}
                      >
                        Generate Bill
                      </button>
                    </div>
                  </div>
                )}
                
                {table.status === 'available' && (
                  <div className="status-info centered">
                    <p className="empty-msg">Table is currently empty</p>
                    <button className="action-btn outline" onClick={() => handleCreateOrderClick(table)}>➕ Assign Table</button>
                  </div>
                )}

                {table.status === 'billing' && (
                  <div className="status-info">
                    <div className="info-row">
                      <span>{session?.customer_name || 'Guest'}</span>
                      <span className="amount">Ready to Pay</span>
                    </div>
                    <button 
                      className="action-btn primary" 
                      onClick={() => navigate(`/billing?sessionId=${session?.id}`)}
                      disabled={!session}
                      style={{ opacity: !session ? 0.5 : 1, cursor: !session ? 'not-allowed' : 'pointer' }}
                    >
                      Generate Bill
                    </button>
                  </div>
                )}

                {table.status === 'cleaning' && (
                  <div className="status-info centered">
                    <div className="restricted-icon">🧹</div>
                    <p className="restricted-text">Restricted</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Order Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>Assign Table - Table {selectedTable?.table_number}</h2>
              <button className="close-modal" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleStartSession} className="modal-form">
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
                <button type="submit" className="start-btn">
                  Assign Table <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="waiter-toast">
          🔔 {toastMessage}
        </div>
      )}

      <style jsx>{`
        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          font-weight: 600;
          color: var(--color-text-muted);
        }

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
        .close-modal { color: var(--color-text-muted); }

        .modal-form { padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }

        .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-group label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 700; color: var(--color-text-muted); }
        
        .form-group input {
          padding: 0.85rem 1rem;
          border-radius: 12px;
          border: 1.5px solid var(--color-border);
          font-size: 1rem;
          color: var(--color-primary);
          font-weight: 600;
        }

        .guest-selector { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
        .guest-selector button {
          padding: 0.75rem;
          border: 1.5px solid var(--color-border);
          border-radius: 10px;
          font-weight: 700;
          color: var(--color-text-muted);
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
        }

        .dashboard-view { height: 100%; }
        .stats-bar { display: flex; gap: 1rem; margin-bottom: 2.5rem; }
        .stat-card { flex: 1; background: #F9F3EE; padding: 1.25rem; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 0.5rem; }
        .stat-label { font-size: 0.7rem; font-weight: 700; color: var(--color-text-muted); letter-spacing: 1px; }
        .stat-value { font-size: 1.75rem; font-weight: 700; color: var(--color-primary); }
        .service-modes { flex: 3; background: #F9EBE0; padding: 0.5rem; border-radius: var(--radius-md); display: flex; gap: 0.5rem; }
        .mode-card { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.25rem; border-radius: 12px; color: var(--color-primary); font-size: 0.75rem; font-weight: 600; opacity: 0.6; }
        .mode-card.active { background: white; opacity: 1; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .mode-icon { font-size: 1.25rem; }
        .content-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--color-border); }
        .area-tabs { display: flex; gap: 2rem; }
        .area-tab { padding: 1rem 0; font-size: 1rem; font-weight: 600; color: var(--color-text-muted); border-bottom: 2px solid transparent; }
        .area-tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
        .legend { display: flex; align-items: center; gap: 1.5rem; font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
        .legend-item { display: flex; align-items: center; gap: 0.5rem; }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot.available { background: #4CAF50; }
        .dot.occupied { background: var(--color-primary); }
        .dot.billing { background: #F59E0B; }
        .table-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
        .table-card { background: white; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; transition: var(--transition-smooth); position: relative; overflow: hidden; }
        .table-card.occupied { background: #F9F3EE; border-left: 6px solid var(--color-status-occupied); }
        .table-card.billing { background: #FFF5EE; border: 1.5px solid #F2E3D5; }
        .table-card.cleaning { opacity: 0.6; background: #F8F8F8; }
        .table-id { font-size: 1.5rem; font-weight: 700; }
        .table-meta { font-size: 0.85rem; color: var(--color-text-muted); font-weight: 600; }
        .table-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .status-tag { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.75rem; background: #F0F0F0; border-radius: 100px; font-size: 0.75rem; font-weight: 700; }
        .status-tag.occupied { background: #EDE4DC; color: var(--color-primary); }
        .status-tag.available { background: #E8F5E9; color: #2E7D32; }
        .status-tag.billing { background: #FFF3E0; color: #E65100; }
        .info-row { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); margin-bottom: 1rem; background: white; padding: 1rem; border-radius: 12px; border: 1px dashed var(--color-border); }
        .amount { color: var(--color-primary); font-weight: 700; }
        .action-btn { width: 100%; padding: 0.85rem; border-radius: 12px; font-weight: 700; font-size: 0.9rem; }
        .action-btn.primary { background: var(--color-primary); color: white; }
        .action-btn.outline { background: white; border: 1.5px solid #E8E1DA; color: var(--color-primary); }
        .centered { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 120px; }
        .empty-msg { font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 1rem; background: #FDFBF9; width: 100%; padding: 1rem; border-radius: 12px; border: 1px dashed var(--color-border); }
        .restricted-text { font-size: 0.85rem; font-weight: 600; color: #888; margin-top: 0.5rem; }

        .blinking-waiter-btn {
          background: #e74c3c;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          animation: blink 1s infinite;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        @keyframes blink {
          0% { opacity: 1; box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
          50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(231, 76, 60, 0); }
          100% { opacity: 1; box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
        }

        .waiter-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #e74c3c;
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(231,76,60,0.3);
          font-weight: 600;
          z-index: 9999;
          animation: slideIn 0.3s ease-out forwards;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
