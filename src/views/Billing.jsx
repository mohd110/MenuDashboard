import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  FileText, 
  Printer, 
  Split, 
  ArrowLeftRight, 
  Edit3, 
  CheckCircle2, 
  CreditCard, 
  Banknote, 
  QrCode,
  Tag,
  X,
  Plus,
  Minus,
  Trash2,
  Check,
  LayoutGrid,
  RefreshCw,
  Clock,
  ArrowRight,
  User,
  Phone,
  Users,
  Activity,
  Globe,
  Sliders
} from 'lucide-react';

const Billing = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // URL parameters
  const sessionId = searchParams.get('sessionId');
  const queryTab = searchParams.get('tab') || 'tables'; // 'tables' | 'running-orders' | 'online' | 'actions'

  // General State
  const [activeTab, setActiveTab] = useState(queryTab);
  const [activeArea, setActiveArea] = useState('all');
  const [tables, setTables] = useState([]);
  const [sections, setSections] = useState([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);

  // Billing details state (active session)
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isPaid, setIsPaid] = useState(false);

  // Modals / Actions
  const [loadingAction, setLoadingAction] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTableForNewOrder, setSelectedTableForNewOrder] = useState(null);
  const [customerData, setCustomerData] = useState({ name: '', phone: '', guests: 2 });
  
  // Split Bill Modal state
  const [showSplitBillModal, setShowSplitBillModal] = useState(false);
  const [splitTab, setSplitTab] = useState('equal'); // 'equal' | 'items'
  const [splitWays, setSplitWays] = useState(2);
  const [itemAssignments, setItemAssignments] = useState({}); // { itemId: 'A' | 'B' }
  const [printType, setPrintType] = useState('bill'); // 'bill', 'kot', 'split-equal', 'split-items-a', 'split-items-b'
  const [printSplitInfo, setPrintSplitInfo] = useState(null);

  // Move/Merge Modals
  const [showMoveTableModal, setShowMoveTableModal] = useState(false);
  const [availableTables, setAvailableTables] = useState([]);
  const [selectedMoveTableId, setSelectedMoveTableId] = useState('');
  const [showMergeOrderModal, setShowMergeOrderModal] = useState(false);
  const [occupiedSessions, setOccupiedSessions] = useState([]);
  const [selectedMergeSessionId, setSelectedMergeSessionId] = useState('');

  // Inline qty editor toggle
  const [isEditingQuantities, setIsEditingQuantities] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [selectedEditItem, setSelectedEditItem] = useState(null);
  const [editQty, setEditQty] = useState(1);

  // Aggregator toggles for "Store Actions" tab
  const [aggregators, setAggregators] = useState({
    swiggy: true,
    zomato: true,
    direct: true
  });

  // Track if URL tab updates
  useEffect(() => {
    setActiveTab(queryTab);
  }, [queryTab]);

  // Load tables & sections
  useEffect(() => {
    fetchWorkspaceData();
    
    // Subscribe to realtime updates for tables
    const tableSubscription = supabase
      .channel('tables-realtime-billing')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        fetchWorkspaceData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tableSubscription);
    };
  }, []);

  // Load session data if sessionId exists
  useEffect(() => {
    if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
      fetchSessionData();
    } else {
      setSession(null);
      setItems([]);
    }
  }, [sessionId]);

  const fetchWorkspaceData = async () => {
    try {
      setLoadingWorkspace(true);
      // Fetch sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('restaurant_sections')
        .select('*')
        .order('section_name');
      if (sectionsError) throw sectionsError;
      setSections(sectionsData);

      // Fetch tables with active sessions
      const { data: tablesData, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select(`
          *,
          customer_sessions(id, customer_name, guest_count, started_at, session_status, ended_at)
        `)
        .order('table_number');
      if (tablesError) throw tablesError;

      const processedTables = tablesData.map(table => ({
        ...table,
        active_session: table.customer_sessions?.find(s => s.session_status === 'active' || s.session_status === 'billing')
      }));

      setTables(processedTables);
    } catch (err) {
      console.error('Error fetching tables list:', err);
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const fetchSessionData = async () => {
    try {
      setLoadingSession(true);
      const { data: sessionData, error: sessionError } = await supabase
        .from('customer_sessions')
        .select(`
          *,
          restaurant_tables(table_number),
          orders(
            id,
            total,
            subtotal,
            tax,
            order_items(
              id,
              menu_item_id,
              quantity,
              item_price,
              menu_items(item_name)
            )
          )
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      const allItems = sessionData.orders?.flatMap(order => 
        order.order_items.map(item => ({
          id: item.id,
          orderId: order.id,
          name: item.menu_items?.item_name || 'Unknown Item',
          qty: item.quantity,
          price: item.item_price
        }))
      ) || [];
      setItems(allItems);

      // Reset assignments
      const newAssignments = {};
      allItems.forEach(item => {
        newAssignments[item.id] = 'A';
      });
      setItemAssignments(newAssignments);
      
      setIsPaid(sessionData.session_status === 'completed');
    } catch (error) {
      console.error('Error loading session:', error);
      setSession(null);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleTableClick = (table) => {
    if (table.status === 'available') {
      setSelectedTableForNewOrder(table);
      setCustomerData({ name: '', phone: '', guests: table.capacity || 2 });
      setShowAssignModal(true);
    } else if (table.active_session) {
      setSearchParams({ sessionId: table.active_session.id, tab: activeTab });
    }
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!selectedTableForNewOrder) return;
    try {
      setLoadingAction(true);
      const { data: newSession, error: sessionError } = await supabase
        .from('customer_sessions')
        .insert([{
          table_id: selectedTableForNewOrder.id,
          customer_name: customerData.name || 'Walk-in Guest',
          phone_number: customerData.phone,
          guest_count: customerData.guests,
          session_status: 'active'
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', selectedTableForNewOrder.id);

      if (tableError) throw tableError;

      setShowAssignModal(false);
      await fetchWorkspaceData();
      navigate(`/menu?sessionId=${newSession.id}&tableId=${selectedTableForNewOrder.id}`);
    } catch (err) {
      alert('Error starting session: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      setLoadingAction(true);
      const { error: sessionError } = await supabase
        .from('customer_sessions')
        .update({ 
          session_status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ status: 'cleaning' })
        .eq('id', session.table_id);

      if (tableError) throw tableError;

      setIsPaid(true);
      alert('Payment marked as successful! Table cleaning phase started.');
      setSearchParams({ tab: activeTab });
      await fetchWorkspaceData();
    } catch (error) {
      alert('Payment processing error: ' + error.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUpdateItemQty = async (itemId, orderId, newQty) => {
    try {
      if (newQty <= 0) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('id', itemId);
        if (deleteError) throw deleteError;
      } else {
        const itemToUpdate = items.find(i => i.id === itemId);
        const totalPrice = itemToUpdate.price * newQty;
        
        const { error: updateError } = await supabase
          .from('order_items')
          .update({ quantity: newQty, total_price: totalPrice })
          .eq('id', itemId);
        if (updateError) throw updateError;
      }

      // Update order parent total
      const { data: remainingItems, error: fetchError } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', orderId);
      
      if (fetchError) throw fetchError;

      if (!remainingItems || remainingItems.length === 0) {
        await supabase.from('orders').delete().eq('id', orderId);
      } else {
        const orderSubtotal = remainingItems.reduce((sum, item) => sum + Number(item.total_price), 0);
        const orderTax = orderSubtotal * 0.1;
        const orderTotal = orderSubtotal + orderTax;

        await supabase.from('orders').update({
          subtotal: orderSubtotal,
          tax: orderTax,
          total: orderTotal
        }).eq('id', orderId);
      }

      await fetchSessionData();
    } catch (error) {
      alert('Error updating quantity: ' + error.message);
    }
  };

  // Move table implementation
  const handleOpenMoveTable = async () => {
    setShowMoveTableModal(true);
    setLoadingAction(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('status', 'available')
        .order('table_number');
      if (!error && data) {
        setAvailableTables(data);
        if (data.length > 0) setSelectedMoveTableId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleConfirmMoveTable = async () => {
    if (!selectedMoveTableId) return;
    setLoadingAction(true);
    try {
      const oldTableId = session.table_id;
      const newTableId = selectedMoveTableId;

      await supabase.from('customer_sessions').update({ table_id: newTableId }).eq('id', sessionId);
      await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', newTableId);
      await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', oldTableId);
      await supabase.from('orders').update({ table_id: newTableId }).eq('session_id', sessionId);

      setShowMoveTableModal(false);
      await fetchSessionData();
      await fetchWorkspaceData();
      alert('Table moved successfully!');
    } catch (err) {
      alert('Error moving table: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // Merge order implementation
  const handleOpenMergeOrder = async () => {
    setShowMergeOrderModal(true);
    setLoadingAction(true);
    try {
      const { data, error } = await supabase
        .from('customer_sessions')
        .select('id, customer_name, restaurant_tables(table_number)')
        .eq('session_status', 'active')
        .neq('id', sessionId);
      if (!error && data) {
        setOccupiedSessions(data);
        if (data.length > 0) setSelectedMergeSessionId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleConfirmMergeOrder = async () => {
    if (!selectedMergeSessionId) return;
    setLoadingAction(true);
    try {
      const { data: targetSession, error: targetSessionError } = await supabase
        .from('customer_sessions')
        .select('table_id')
        .eq('id', selectedMergeSessionId)
        .single();
      if (targetSessionError) throw targetSessionError;

      await supabase.from('orders').update({ session_id: sessionId }).eq('session_id', selectedMergeSessionId);
      await supabase.from('customer_sessions').update({ session_status: 'completed', ended_at: new Date().toISOString() }).eq('id', selectedMergeSessionId);
      await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', targetSession.table_id);

      setShowMergeOrderModal(false);
      await fetchSessionData();
      await fetchWorkspaceData();
      alert('Orders merged successfully!');
    } catch (err) {
      alert('Error merging: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const subtotal = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const handlePrint = (type) => {
    setPrintType(type);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Calculations for tab data
  const dineInCount = tables.filter(t => t.status === 'occupied').length;
  const billingCount = tables.filter(t => t.status === 'billing').length;
  const cleaningCount = tables.filter(t => t.status === 'cleaning').length;

  const runningOrdersCount = dineInCount + 6 + 14; // Dine-in + Mock pickup/delivery counts from video
  const pendingOrdersCount = 14;

  const filteredTables = activeArea === 'all' 
    ? tables 
    : tables.filter(t => t.section_id === activeArea);

  return (
    <div className="pos-billing-layout">
      {/* Left Operations Workspace Pane */}
      <div className="pos-workspace-pane">
        
        {/* Sub-Navigation Tabs */}
        <div className="pos-subtabs">
          <button 
            className={`subtab-btn ${activeTab === 'tables' ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: 'tables' })}
          >
            Running Tables <span className="tab-badge">{tables.filter(t => t.status !== 'available').length}</span>
          </button>
          <button 
            className={`subtab-btn ${activeTab === 'running-orders' ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: 'running-orders' })}
          >
            Running Orders <span className="tab-badge">{runningOrdersCount}</span>
          </button>
          <button 
            className={`subtab-btn ${activeTab === 'online' ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: 'online' })}
          >
            Online Orders <span className="tab-badge">2</span>
          </button>
          <button 
            className={`subtab-btn ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: 'actions' })}
          >
            Store Actions
          </button>
        </div>

        {/* Tab 1: Running Tables */}
        {activeTab === 'tables' && (
          <div className="tables-tab-content">
            <div className="area-selector">
              <button 
                className={`area-btn ${activeArea === 'all' ? 'active' : ''}`}
                onClick={() => setActiveArea('all')}
              >
                All Areas
              </button>
              {sections.map(s => (
                <button 
                  key={s.id}
                  className={`area-btn ${activeArea === s.id ? 'active' : ''}`}
                  onClick={() => setActiveArea(s.id)}
                >
                  {s.section_name}
                </button>
              ))}
            </div>

            {loadingWorkspace ? (
              <div className="tab-loading"><RefreshCw className="spinner" /> Loading tables layout...</div>
            ) : (
              <div className="tables-grid">
                {filteredTables.map(t => {
                  const isSelected = sessionId && session?.table_id === t.id;
                  return (
                    <div 
                      key={t.id} 
                      className={`table-pos-card status-${t.status} ${isSelected ? 'selected-table' : ''}`}
                      onClick={() => handleTableClick(t)}
                    >
                      <div className="table-header">
                        <span className="table-num">T - {t.table_number}</span>
                        <span className="table-capacity">{t.capacity} Pax</span>
                      </div>
                      
                      {t.active_session ? (
                        <div className="table-body">
                          <p className="guest-name">{t.active_session.customer_name || 'Guest'}</p>
                          <div className="time-elapsed">
                            <Clock size={12} />
                            <span>
                              {Math.floor((new Date() - new Date(t.active_session.started_at)) / 60000)} mins
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="table-body vacant">
                          <p>Vacant</p>
                        </div>
                      )}
                      
                      <div className="status-label">{t.status.toUpperCase()}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Running Orders (Exactly like Petpooja layout in video) */}
        {activeTab === 'running-orders' && (
          <div className="running-orders-tab">
            <div className="orders-breakdown-grid">
              
              {/* Left Box: Running Orders */}
              <div className="orders-summary-card">
                <div className="card-top">
                  <div>
                    <h5>Running Orders</h5>
                    <h2>28</h2>
                  </div>
                  <span className="monetary-total">₹ 13,583.35</span>
                </div>
                <div className="card-list">
                  <div className="list-row">
                    <span>Dine in</span>
                    <strong>8 orders</strong>
                    <span className="row-val">₹ 3,533.35</span>
                  </div>
                  <div className="list-row">
                    <span>Pick up</span>
                    <strong>6 orders</strong>
                    <span className="row-val">₹ 3,267.00</span>
                  </div>
                  <div className="list-row">
                    <span>Delivery</span>
                    <strong>14 orders</strong>
                    <span className="row-val">₹ 6,783.00</span>
                  </div>
                </div>
              </div>

              {/* Right Box: Pending Orders */}
              <div className="orders-summary-card pending-card">
                <div className="card-top">
                  <div>
                    <h5>Pending Orders</h5>
                    <h2>14</h2>
                  </div>
                  <span className="monetary-total">₹ 6,783.00</span>
                </div>
                <div className="card-list">
                  <div className="list-row">
                    <span>In Preparation</span>
                    <strong>14 orders</strong>
                    <span className="row-val">₹ 3,533.00</span>
                  </div>
                  <div className="list-row">
                    <span>Waiting for Pickup</span>
                    <strong>0 orders</strong>
                    <span className="row-val">₹ 0.00</span>
                  </div>
                  <div className="list-row">
                    <span>Out For Delivery</span>
                    <strong>0 orders</strong>
                    <span className="row-val">₹ 3,430.00</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: Online Orders (Aggregators list table) */}
        {activeTab === 'online' && (
          <div className="online-orders-tab">
            <div className="online-header-row">
              <h4>Aggregator Delivery Feed</h4>
              <div className="aggregator-pills">
                <span className="pill swiggy">Swiggy</span>
                <span className="pill zomato">Zomato</span>
              </div>
            </div>
            
            <table className="online-orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Source</th>
                  <th>Customer</th>
                  <th>Order Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>#SW-9082</td>
                  <td><span className="source-tag swiggy-bg">Swiggy</span></td>
                  <td><strong>Ritesh K.</strong><br/>+91 908** **982</td>
                  <td>2x Butter Chicken, 4x Butter Naan</td>
                  <td>₹ 680.00</td>
                  <td><span className="status-indicator preparing">Preparing</span></td>
                  <td>
                    <button className="pos-table-btn reject">Reject</button>
                    <button className="pos-table-btn accept">Ready</button>
                  </td>
                </tr>
                <tr>
                  <td>#ZO-4521</td>
                  <td><span className="source-tag zomato-bg">Zomato</span></td>
                  <td><strong>Ananya S.</strong><br/>+91 887** **341</td>
                  <td>1x Veg Biryani, 1x Paneer Tikka</td>
                  <td>₹ 410.00</td>
                  <td><span className="status-indicator ready">Out for Delivery</span></td>
                  <td>
                    <button className="pos-table-btn print"><Printer size={12} /> Print</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Store Actions */}
        {activeTab === 'actions' && (
          <div className="store-actions-tab">
            <h4>Aggregators Integrations & Status</h4>
            <div className="actions-switches">
              <div className="switch-row">
                <div className="switch-label">
                  <strong>Zomato Integration</strong>
                  <p>Turn ON/OFF visibility on Zomato platform</p>
                </div>
                <button 
                  className={`toggle-switch ${aggregators.zomato ? 'active' : ''}`}
                  onClick={() => setAggregators({...aggregators, zomato: !aggregators.zomato})}
                >
                  {aggregators.zomato ? 'ONLINE' : 'OFFLINE'}
                </button>
              </div>
              <div className="switch-row">
                <div className="switch-label">
                  <strong>Swiggy Integration</strong>
                  <p>Turn ON/OFF visibility on Swiggy platform</p>
                </div>
                <button 
                  className={`toggle-switch ${aggregators.swiggy ? 'active' : ''}`}
                  onClick={() => setAggregators({...aggregators, swiggy: !aggregators.swiggy})}
                >
                  {aggregators.swiggy ? 'ONLINE' : 'OFFLINE'}
                </button>
              </div>
            </div>

            <h4 style={{ marginTop: '2.5rem' }}>Out of Stock Alerts</h4>
            <div className="stock-alerts">
              <p className="no-data">All menu items are currently in stock.</p>
            </div>
          </div>
        )}

      </div>

      {/* Right Billing Details Settlement Pane */}
      <div className="pos-billing-pane">
        {sessionId ? (
          loadingSession ? (
            <div className="tab-loading"><RefreshCw className="spinner" /> Loading session bill details...</div>
          ) : session ? (
            <div className="billing-details-wrapper">
              
              {/* Session Context Header */}
              <div className="session-header">
                <div>
                  <span className="session-label">BILLING CONTEXT</span>
                  <h2>Table {session.restaurant_tables?.table_number}</h2>
                  <p className="customer-meta">{session.customer_name} • {session.guest_count} Guests</p>
                </div>
                <div className="header-actions">
                  <button className="action-pill" onClick={handleOpenMoveTable}>
                    <ArrowLeftRight size={14} /> Move Table
                  </button>
                  <button className="action-pill" onClick={() => { setShowSplitBillModal(true); setSplitTab('equal'); }}>
                    <Split size={14} /> Split
                  </button>
                  <button className="action-pill close-btn" onClick={() => setSearchParams({ tab: activeTab })}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="bill-items-list">
                {items.length === 0 ? (
                  <div className="empty-order-msg">
                    No items punched for this session yet.
                    <button className="add-items-link" onClick={() => navigate(`/menu?sessionId=${sessionId}&tableId=${session.table_id}`)}>
                      Go to Menu Catalog
                    </button>
                  </div>
                ) : (
                  items.map((item, i) => (
                    <div key={i} className="bill-item-card">
                      {isEditingQuantities ? (
                        <div className="inline-qty-control">
                          <button className="inline-qty-btn" onClick={() => handleUpdateItemQty(item.id, item.orderId, item.qty - 1)}>
                            <Minus size={10} />
                          </button>
                          <span className="inline-qty-val">{item.qty}x</span>
                          <button className="inline-qty-btn" onClick={() => handleUpdateItemQty(item.id, item.orderId, item.qty + 1)}>
                            <Plus size={10} />
                          </button>
                        </div>
                      ) : (
                        <div className="item-qty-box">{item.qty}x</div>
                      )}
                      
                      <div className="item-main-info">
                        <h4>{item.name}</h4>
                        <p>Standard preparation</p>
                      </div>
                      
                      <div className="item-meta">
                        <span className="item-price">₹ {(item.price * item.qty).toFixed(2)}</span>
                      </div>

                      {isEditingQuantities ? (
                        <button className="inline-delete-btn" onClick={() => handleUpdateItemQty(item.id, item.orderId, 0)}>
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <button className="edit-btn" onClick={() => { setSelectedEditItem(item); setEditQty(item.qty); setShowEditItemModal(true); }}>
                          <Edit3 size={16} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Operations Footer */}
              <div className="session-footer-actions">
                <button className="footer-btn" onClick={handleOpenMergeOrder}>
                  <FileText size={18} />
                  <span>Merge Bill</span>
                </button>
                <button className="footer-btn" onClick={() => handlePrint('kot')}>
                  <Printer size={18} />
                  <span>Print KOT</span>
                </button>
                <button 
                  className={`footer-btn ${isEditingQuantities ? 'active-edit' : ''}`}
                  onClick={() => setIsEditingQuantities(!isEditingQuantities)}
                >
                  {isEditingQuantities ? <Check size={18} /> : <Edit3 size={18} />}
                  <span>{isEditingQuantities ? 'Finish Qty' : 'Edit Qty'}</span>
                </button>
              </div>

              {/* Settlement Block */}
              <div className="invoice-settlement-block">
                <div className="invoice-header">
                  <h3>Bill Invoice {isPaid && <span className="paid-badge">● PAID</span>}</h3>
                </div>

                {/* Print Invoice Frame */}
                <div className="invoice-paper">
                  <div className="receipt-logo">
                    <h4>Lumiere Bistro</h4>
                    <p>123 Downtown St, Metro</p>
                    <p>Tel: +91 90812 01234</p>
                  </div>
                  
                  <div className="receipt-meta">
                    <div><p>Table</p><strong>T-{session.restaurant_tables?.table_number}</strong></div>
                    <div><p>Bill #</p><strong>{sessionId.slice(0, 4).toUpperCase()}</strong></div>
                    <div><p>Date</p><strong>{new Date(session.started_at).toLocaleDateString()}</strong></div>
                  </div>

                  <div className="receipt-items">
                    {items.map((item, idx) => (
                      <div key={idx} className="receipt-row">
                        <span>{item.qty}x {item.name}</span>
                        <span>₹ {(item.price * item.qty).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="receipt-totals">
                    <div className="receipt-row"><span>Subtotal</span><span>₹ {subtotal.toFixed(2)}</span></div>
                    <div className="receipt-row"><span>Tax (10%)</span><span>₹ {tax.toFixed(2)}</span></div>
                    <div className="receipt-row total"><span>Grand Total</span><span>₹ {total.toFixed(2)}</span></div>
                  </div>
                </div>

                {/* Payment Selection & Pay Action */}
                <div className="payment-action-block">
                  <div className="payment-options">
                    <button 
                      className={`pay-opt ${paymentMethod === 'card' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('card')}
                    >
                      <CreditCard size={16} /> Card
                    </button>
                    <button 
                      className={`pay-opt ${paymentMethod === 'cash' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('cash')}
                    >
                      <Banknote size={16} /> Cash
                    </button>
                    <button 
                      className={`pay-opt ${paymentMethod === 'qr' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('qr')}
                    >
                      <QrCode size={16} /> UPI QR
                    </button>
                  </div>

                  <button 
                    className="pay-settle-btn"
                    onClick={handleMarkAsPaid}
                    disabled={isPaid || items.length === 0 || loadingAction}
                  >
                    <CheckCircle2 size={18} /> {isPaid ? 'PAID & COMPLETED' : `SETTLE ₹ ${total.toFixed(2)}`}
                  </button>
                  
                  <div className="print-sub-actions">
                    <button className="sub-btn" onClick={() => handlePrint('bill')}>
                      <Printer size={14} /> Print Bill
                    </button>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="no-session-details">Active Session could not be loaded.</div>
          )
        ) : (
          <div className="no-session-details">
            <LayoutGrid size={40} strokeWidth={1} />
            <h4>Select an active table on the left</h4>
            <p>Select any table or order to display item details and process invoice settlements</p>
          </div>
        )}
      </div>

      {/* Modal: New Order Table Assignment */}
      {showAssignModal && selectedTableForNewOrder && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Open Table {selectedTableForNewOrder.table_number}</h2>
              <button className="close-modal" onClick={() => setShowAssignModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleStartSession} className="modal-form">
              <div className="form-group">
                <label><User size={14} /> Guest Name</label>
                <input 
                  type="text"
                  placeholder="Enter guest name..." 
                  value={customerData.name}
                  onChange={(e) => setCustomerData({...customerData, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label><Phone size={14} /> Phone Number</label>
                <input 
                  type="tel"
                  placeholder="Enter phone number..." 
                  value={customerData.phone}
                  onChange={(e) => setCustomerData({...customerData, phone: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label><Users size={14} /> Guest Count</label>
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
                <button type="submit" className="start-btn" disabled={loadingAction}>
                  Open Table & Order <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Move Table */}
      {showMoveTableModal && (
        <div className="modal-overlay" onClick={() => setShowMoveTableModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Move Table</h2>
              <button className="close-modal" onClick={() => setShowMoveTableModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label>Select Target Table</label>
                {loadingAction ? (
                  <p>Loading available tables...</p>
                ) : availableTables.length === 0 ? (
                  <p style={{ color: '#d9534f', fontWeight: 700 }}>No available tables to move to.</p>
                ) : (
                  <select 
                    value={selectedMoveTableId}
                    onChange={(e) => setSelectedMoveTableId(e.target.value)}
                  >
                    {availableTables.map(t => (
                      <option key={t.id} value={t.id}>
                        Table {t.table_number} ({t.capacity} Seats)
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button 
                className="start-btn" 
                onClick={handleConfirmMoveTable}
                disabled={availableTables.length === 0 || loadingAction}
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Merge Bill */}
      {showMergeOrderModal && (
        <div className="modal-overlay" onClick={() => setShowMergeOrderModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Merge Order</h2>
              <button className="close-modal" onClick={() => setShowMergeOrderModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label>Select Table Session to Merge Into This Bill</label>
                {loadingAction ? (
                  <p>Loading sessions...</p>
                ) : occupiedSessions.length === 0 ? (
                  <p style={{ color: '#888', fontWeight: 600 }}>No other occupied tables to merge.</p>
                ) : (
                  <select 
                    value={selectedMergeSessionId}
                    onChange={(e) => setSelectedMergeSessionId(e.target.value)}
                  >
                    {occupiedSessions.map(s => (
                      <option key={s.id} value={s.id}>
                        Table {s.restaurant_tables?.table_number} ({s.customer_name || 'Guest'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button 
                className="start-btn" 
                onClick={handleConfirmMergeOrder}
                disabled={occupiedSessions.length === 0 || loadingAction}
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Split Bill */}
      {showSplitBillModal && (
        <div className="modal-overlay" onClick={() => setShowSplitBillModal(false)}>
          <div className="modal-container" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Split Bill</h2>
              <button className="close-modal" onClick={() => setShowSplitBillModal(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div className="modal-tabs">
                <button className={`modal-tab ${splitTab === 'equal' ? 'active' : ''}`} onClick={() => setSplitTab('equal')}>
                  Split Equally
                </button>
                <button className={`modal-tab ${splitTab === 'items' ? 'active' : ''}`} onClick={() => setSplitTab('items')}>
                  Split by Items
                </button>
              </div>

              {splitTab === 'equal' && (
                <div>
                  <div className="split-ways-selector">
                    <span>Split into:</span>
                    <input 
                      type="number" 
                      min="2" 
                      max="6" 
                      value={splitWays} 
                      onChange={(e) => setSplitWays(Math.max(2, parseInt(e.target.value) || 2))} 
                    />
                    <span>ways</span>
                  </div>

                  <div className="split-results">
                    {Array.from({ length: splitWays }).map((_, i) => (
                      <div key={i} className="split-card">
                        <div>
                          <h5>Share {i + 1} of {splitWays}</h5>
                          <p>₹ {(total / splitWays).toFixed(2)}</p>
                        </div>
                        <button className="split-print-btn" onClick={() => handlePrintSplitEqual(i + 1, splitWays)}>
                          Print Share
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {splitTab === 'items' && (
                <div>
                  <div className="split-items-list">
                    {items.map((item) => (
                      <div key={item.id} className="split-item-row">
                        <div className="split-item-info">
                          <h5>{item.name}</h5>
                          <p>{item.qty}x • ₹ {(item.price * item.qty).toFixed(2)}</p>
                        </div>
                        <div className="split-assignment">
                          <button 
                            className={`split-assign-btn ${itemAssignments[item.id] === 'A' ? 'active' : ''}`}
                            onClick={() => setItemAssignments({...itemAssignments, [item.id]: 'A'})}
                          >
                            Bill A
                          </button>
                          <button 
                            className={`split-assign-btn ${itemAssignments[item.id] === 'B' ? 'active' : ''}`}
                            onClick={() => setItemAssignments({...itemAssignments, [item.id]: 'B'})}
                          >
                            Bill B
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Item Quantity */}
      {showEditItemModal && selectedEditItem && (
        <div className="modal-overlay" onClick={() => setShowEditItemModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Quantity: {selectedEditItem.name}</h2>
              <button className="close-modal" onClick={() => setShowEditItemModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-form">
              <div className="form-group" style={{ alignItems: 'center', margin: '1rem 0' }}>
                <p style={{ fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Adjust Quantity</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <button 
                    type="button"
                    className="inline-qty-btn" 
                    onClick={() => setEditQty(Math.max(0, editQty - 1))}
                    style={{ width: '40px', height: '40px', fontSize: '1.25rem' }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{editQty}</span>
                  <button 
                    type="button"
                    className="inline-qty-btn" 
                    onClick={() => setEditQty(editQty + 1)}
                    style={{ width: '40px', height: '40px', fontSize: '1rem' }}
                  >
                    +
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  type="button" 
                  className="start-btn" 
                  onClick={() => {
                    handleUpdateItemQty(selectedEditItem.id, selectedEditItem.orderId, 0);
                    setShowEditItemModal(false);
                  }}
                  style={{ background: '#d9534f' }}
                >
                  <Trash2 size={16} /> Delete Item
                </button>
                <button 
                  type="button" 
                  className="start-btn"
                  onClick={() => {
                    handleUpdateItemQty(selectedEditItem.id, selectedEditItem.orderId, editQty);
                    setShowEditItemModal(false);
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .pos-billing-layout {
          display: flex;
          height: calc(100vh - 70px);
          overflow: hidden;
          background: var(--color-bg);
        }

        .pos-workspace-pane {
          flex: 1.4;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--color-border);
          overflow: hidden;
        }

        .pos-billing-pane {
          flex: 1;
          background: white;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        /* Subtabs menu styling like Petpooja tabs */
        .pos-subtabs {
          display: flex;
          background: var(--color-sidebar);
          border-bottom: 1px solid var(--color-border);
          padding: 0.5rem 1rem 0;
          gap: 0.5rem;
        }

        .subtab-btn {
          padding: 0.75rem 1.25rem;
          font-weight: 700;
          font-size: 0.85rem;
          color: var(--color-text-muted);
          border-radius: 8px 8px 0 0;
          border: 1px solid transparent;
          border-bottom: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          transition: var(--transition-smooth);
        }

        .subtab-btn:hover {
          color: var(--color-primary);
          background: rgba(197, 168, 128, 0.05);
        }

        .subtab-btn.active {
          color: var(--color-primary);
          background: var(--color-bg);
          border-color: var(--color-border);
          box-shadow: 0 -2px 8px rgba(0,0,0,0.02);
        }

        .tab-badge {
          background: var(--color-primary);
          color: white;
          font-size: 0.65rem;
          padding: 0.1rem 0.35rem;
          border-radius: 6px;
          font-weight: 800;
        }

        /* Tables Grid Styling */
        .tables-tab-content {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          overflow-y: auto;
          flex: 1;
        }

        .area-selector {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .area-btn {
          padding: 0.45rem 1rem;
          border-radius: 20px;
          border: 1px solid var(--color-border);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-text-muted);
          background: white;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .area-btn:hover {
          background: var(--color-accent-soft);
          color: var(--color-primary);
        }

        .area-btn.active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .tables-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 1rem;
        }

        .table-pos-card {
          background: white;
          border: 1px solid var(--color-border);
          border-radius: 14px;
          padding: 1rem;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 120px;
          position: relative;
          box-shadow: var(--shadow-soft);
          transition: var(--transition-smooth);
        }

        .table-pos-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.06);
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .table-num {
          font-size: 1rem;
          font-weight: 800;
          color: var(--color-primary);
        }

        .table-capacity {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-text-muted);
        }

        .table-body {
          margin-top: 0.5rem;
          flex: 1;
        }

        .guest-name {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100px;
        }

        .time-elapsed {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.7rem;
          color: var(--color-text-muted);
          margin-top: 0.15rem;
          font-weight: 600;
        }

        .table-body.vacant {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #bdbdbd;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .status-label {
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-align: right;
          margin-top: auto;
        }

        /* Status color styles based on original dashboard colors */
        .status-available {
          background: white;
        }
        .status-available .status-label { color: #888; }
        
        .status-occupied {
          background: rgba(197, 168, 128, 0.08);
          border-color: var(--color-accent);
        }
        .status-occupied .status-label { color: var(--color-accent); }
        
        .status-billing {
          background: #FFF9C4;
          border-color: #FBC02D;
        }
        .status-billing .status-label { color: #F57F17; }
        
        .status-cleaning {
          background: #E0F2F1;
          border-color: #4DB6AC;
        }
        .status-cleaning .status-label { color: #00796B; }

        .selected-table {
          outline: 2.5px solid var(--color-primary);
          outline-offset: -1px;
        }

        /* Tab 2: Running Orders summary (mirrors the video layout) */
        .running-orders-tab {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .orders-breakdown-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .orders-summary-card {
          background: white;
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: var(--shadow-soft);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid var(--color-bg);
          padding-bottom: 1rem;
          margin-bottom: 1rem;
        }

        .card-top h5 {
          font-size: 0.85rem;
          color: var(--color-text-muted);
          font-weight: 700;
          text-transform: uppercase;
        }

        .card-top h2 {
          font-size: 2.2rem;
          font-weight: 800;
          color: var(--color-primary);
          margin-top: 0.15rem;
          line-height: 1;
        }

        .monetary-total {
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--color-primary);
          background: var(--color-accent-soft);
          padding: 0.4rem 0.85rem;
          border-radius: 8px;
        }

        .card-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .list-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
          color: var(--color-text);
        }

        .list-row span {
          font-weight: 700;
          min-width: 80px;
        }

        .list-row strong {
          color: var(--color-text-muted);
          font-weight: 600;
          font-size: 0.8rem;
        }

        .list-row .row-val {
          font-weight: 800;
          color: var(--color-primary);
          text-align: right;
        }

        .pending-card .monetary-total {
          background: #FFE0B2;
          color: #E65100;
        }
        .pending-card h2 {
          color: #E65100;
        }

        /* Tab 3: Online Orders (Aggregator feed) */
        .online-orders-tab {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .online-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .online-header-row h4 {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .aggregator-pills {
          display: flex;
          gap: 0.5rem;
        }

        .pill {
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          text-transform: uppercase;
        }

        .pill.swiggy { background: #FF6F00; color: white; }
        .pill.zomato { background: #CB202D; color: white; }

        .online-orders-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--color-border);
        }

        .online-orders-table th {
          background: var(--color-sidebar);
          padding: 0.85rem 1rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-muted);
          text-align: left;
          text-transform: uppercase;
        }

        .online-orders-table td {
          padding: 1rem;
          font-size: 0.85rem;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text);
          vertical-align: middle;
        }

        .source-tag {
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }

        .swiggy-bg { background: #FFE0B2; color: #E65100; }
        .zomato-bg { background: #FFCDD2; color: #B71C1C; }

        .status-indicator {
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }

        .status-indicator.preparing { background: #E8F5E9; color: #2E7D32; }
        .status-indicator.ready { background: #E1F5FE; color: #0288D1; }

        .pos-table-btn {
          border: none;
          padding: 0.4rem 0.75rem;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.75rem;
          cursor: pointer;
          margin-right: 0.35rem;
          transition: var(--transition-smooth);
        }

        .pos-table-btn.reject { background: #FFEBEE; color: #C62828; }
        .pos-table-btn.accept { background: var(--color-primary); color: white; }
        .pos-table-btn.print { background: var(--color-accent-soft); color: var(--color-primary); }

        /* Tab 4: Store Actions */
        .store-actions-tab {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .actions-switches {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-width: 440px;
          margin-top: 1rem;
        }

        .switch-row {
          background: white;
          border: 1px solid var(--color-border);
          padding: 1rem;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .switch-label strong {
          font-size: 0.9rem;
          color: var(--color-primary);
        }

        .switch-label p {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin-top: 0.15rem;
        }

        .toggle-switch {
          border: none;
          padding: 0.5rem 1.25rem;
          border-radius: 20px;
          font-weight: 800;
          font-size: 0.75rem;
          cursor: pointer;
          background: #EEEEEE;
          color: #666;
        }

        .toggle-switch.active {
          background: #E8F5E9;
          color: #2E7D32;
        }

        /* Settlement details wrapper */
        .no-session-details {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 4rem 2rem;
          color: var(--color-text-muted);
          height: 100%;
          gap: 0.5rem;
        }

        .no-session-details h4 {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--color-primary);
          margin-top: 0.5rem;
        }

        .no-session-details p {
          font-size: 0.8rem;
          max-width: 240px;
          line-height: 1.4;
        }

        .billing-details-wrapper {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 1.5rem;
        }

        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 1rem;
        }

        .session-header h2 {
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--color-primary);
        }

        .header-actions {
          display: flex;
          gap: 0.35rem;
        }

        .action-pill {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.45rem 0.75rem;
          border: 1px solid var(--color-border);
          background: white;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-primary);
          cursor: pointer;
        }

        .action-pill.close-btn {
          color: var(--color-text-muted);
        }

        .bill-items-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .empty-order-msg {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          color: var(--color-text-muted);
          font-size: 0.85rem;
          padding: 3rem 1rem;
        }

        .add-items-link {
          background: var(--color-primary);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .bill-item-card {
          border: 1px solid var(--color-border);
          border-radius: 10px;
          padding: 0.75rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .item-qty-box {
          width: 32px;
          height: 32px;
          background: var(--color-accent-soft);
          color: var(--color-primary);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.85rem;
        }

        .item-main-info h4 {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .item-main-info p {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .item-meta {
          margin-left: auto;
        }

        .item-price {
          font-size: 0.9rem;
          font-weight: 800;
          color: var(--color-primary);
        }

        .edit-btn {
          color: var(--color-text-muted);
          cursor: pointer;
          background: none;
          border: none;
        }

        .session-footer-actions {
          display: flex;
          gap: 0.5rem;
        }

        .footer-btn {
          flex: 1;
          background: var(--color-sidebar);
          color: var(--color-primary);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 0.6rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .footer-btn.active-edit {
          background: #E8F5E9;
          color: #2E7D32;
          border-color: #2E7D32;
        }

        .invoice-settlement-block {
          background: var(--color-sidebar);
          border-radius: 16px;
          padding: 1rem;
          border: 1px solid var(--color-border);
        }

        .invoice-settlement-block h3 {
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--color-primary);
          margin-bottom: 0.75rem;
        }

        .invoice-paper {
          background: white;
          border-radius: 10px;
          padding: 1.25rem;
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .receipt-logo { text-align: center; }
        .receipt-logo h4 { font-size: 1.05rem; font-weight: 800; color: var(--color-primary); }
        .receipt-logo p { font-size: 0.7rem; color: var(--color-text-muted); }

        .receipt-meta {
          display: flex;
          justify-content: space-between;
          border-top: 1px dashed var(--color-border);
          border-bottom: 1px dashed var(--color-border);
          padding: 0.5rem 0;
        }
        .receipt-meta div p { font-size: 0.65rem; color: var(--color-text-muted); }
        .receipt-meta div strong { font-size: 0.75rem; color: var(--color-primary); }

        .receipt-items { display: flex; flex-direction: column; gap: 0.45rem; }
        .receipt-row { display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; }
        
        .receipt-totals {
          border-top: 1px dashed var(--color-border);
          padding-top: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .receipt-totals .receipt-row.total {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--color-primary);
          margin-top: 0.25rem;
        }

        .payment-action-block {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .payment-options {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.35rem;
        }

        .pay-opt {
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: white;
          padding: 0.5rem;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          cursor: pointer;
        }

        .pay-opt.active {
          background: var(--color-accent-soft);
          color: var(--color-primary);
          border-color: var(--color-primary);
        }

        .pay-settle-btn {
          background: var(--color-primary);
          color: white;
          border: none;
          padding: 0.85rem;
          border-radius: 10px;
          font-weight: 800;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          cursor: pointer;
        }

        .pay-settle-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .print-sub-actions {
          display: flex;
        }

        .print-sub-actions .sub-btn {
          flex: 1;
          background: white;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          cursor: pointer;
        }

        /* Loading wrapper */
        .tab-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 4rem;
          font-weight: 700;
          color: var(--color-text-muted);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        /* Modal styling */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-container {
          background: white;
          width: 420px;
          border-radius: 20px;
          box-shadow: var(--shadow-soft);
          overflow: hidden;
          border: 1px solid var(--color-border);
        }

        .modal-header {
          padding: 1.25rem 1.5rem;
          background: var(--color-sidebar);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--color-border);
        }

        .modal-header h2 { font-size: 1.1rem; font-weight: 700; color: var(--color-primary); }
        .close-modal { color: var(--color-text-muted); background: none; border: none; cursor: pointer; }

        .modal-form { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

        .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
        .form-group label { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); }
        
        .form-group input, .form-group select {
          padding: 0.75rem 0.85rem;
          border-radius: 10px;
          border: 1px solid var(--color-border);
          font-size: 0.9rem;
          color: var(--color-primary);
          font-weight: 600;
          background: white;
          outline: none;
        }

        .guest-selector { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; }
        .guest-selector button {
          padding: 0.6rem;
          border: 1px solid var(--color-border);
          border-radius: 8px;
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

        .modal-footer { margin-top: 0.75rem; }
        .start-btn {
          width: 100%;
          background: var(--color-primary);
          color: white;
          padding: 0.95rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border: none;
          cursor: pointer;
        }

        /* Qty Inline Editor inside split billing panel */
        .inline-qty-control {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: var(--color-bg);
          padding: 0.2rem 0.4rem;
          border-radius: 6px;
        }
        .inline-qty-btn {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: white;
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: var(--color-primary);
          cursor: pointer;
        }
        .inline-qty-val {
          font-weight: 700;
          font-size: 0.85rem;
          min-width: 20px;
          text-align: center;
        }
        .inline-delete-btn {
          color: #d9534f;
          margin-left: auto;
          cursor: pointer;
          background: none;
          border: none;
        }

        /* Split modal */
        .modal-tabs {
          display: flex;
          border-bottom: 2px solid var(--color-border);
          margin-bottom: 1rem;
        }
        .modal-tab {
          flex: 1;
          padding: 0.6rem;
          text-align: center;
          font-weight: 700;
          color: var(--color-text-muted);
          border-bottom: 3px solid transparent;
          background: none;
          border: none;
          cursor: pointer;
        }
        .modal-tab.active {
          color: var(--color-primary);
          border-bottom-color: var(--color-primary);
        }

        .split-ways-selector {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          font-weight: 700;
        }
        .split-ways-selector input {
          width: 60px;
          padding: 0.45rem;
          border-radius: 6px;
          border: 1px solid var(--color-border);
          text-align: center;
          font-weight: 700;
        }

        .split-results {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 200px;
          overflow-y: auto;
        }
        .split-card {
          background: var(--color-bg);
          padding: 0.85rem 1.25rem;
          border-radius: 10px;
          border: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .split-card h5 { font-size: 0.85rem; font-weight: 700; color: var(--color-text-muted); }
        .split-card p { font-size: 1.1rem; font-weight: 800; color: var(--color-primary); margin-top: 0.15rem; }
        .split-print-btn {
          background: var(--color-primary);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media print {
          /* Printable invoice styles (hide everything else) */
          .pos-workspace-pane,
          .session-header,
          .session-footer-actions,
          .payment-action-block,
          .invoice-header,
          .close-btn {
            display: none !important;
            visibility: hidden !important;
          }

          body, .pos-billing-layout, .pos-billing-pane, .billing-details-wrapper, .invoice-settlement-block {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
          }

          .invoice-paper {
            border: none !important;
            box-shadow: none !important;
            padding: 20px !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Billing;
