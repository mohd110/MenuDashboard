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
  Check
} from 'lucide-react';

const Billing = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId');

  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isPaid, setIsPaid] = useState(false);
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Print state
  const [printType, setPrintType] = useState('bill'); // 'bill', 'kot', 'split-equal', 'split-items-a', 'split-items-b'
  const [printSplitInfo, setPrintSplitInfo] = useState(null); // { index: 1, count: 2 }

  // Inline quantity edit toggle
  const [isEditingQuantities, setIsEditingQuantities] = useState(false);

  // Edit Item Modal state
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [selectedEditItem, setSelectedEditItem] = useState(null);
  const [editQty, setEditQty] = useState(1);

  // Move Table Modal state
  const [showMoveTableModal, setShowMoveTableModal] = useState(false);
  const [availableTables, setAvailableTables] = useState([]);
  const [selectedMoveTableId, setSelectedMoveTableId] = useState('');

  // Merge Order Modal state
  const [showMergeOrderModal, setShowMergeOrderModal] = useState(false);
  const [occupiedSessions, setOccupiedSessions] = useState([]);
  const [selectedMergeSessionId, setSelectedMergeSessionId] = useState('');

  // Split Bill Modal state
  const [showSplitBillModal, setShowSplitBillModal] = useState(false);
  const [splitTab, setSplitTab] = useState('equal'); // 'equal' | 'items'
  const [splitWays, setSplitWays] = useState(2);
  const [itemAssignments, setItemAssignments] = useState({}); // { itemId: 'A' | 'B' }

  // Loading spinner state for modals
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
      fetchSessionData();
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  // Reset print overrides when the print dialog closes
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintType('bill');
      setPrintSplitInfo(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      
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

      // Initialize split assignments for items if they aren't assigned yet
      const newAssignments = {};
      allItems.forEach(item => {
        newAssignments[item.id] = itemAssignments[item.id] || 'A';
      });
      setItemAssignments(newAssignments);
      
      if (sessionData.session_status === 'completed') {
        setIsPaid(true);
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    try {
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

      // Auto-update table to available after 2 minutes
      setTimeout(async () => {
        try {
          await supabase
            .from('restaurant_tables')
            .update({ status: 'available' })
            .eq('id', session.table_id);
        } catch (e) {
          console.error('Error auto-updating table status:', e);
        }
      }, 120000);

      setIsPaid(true);
      alert('Payment successful! Table marked for cleaning. It will be available in 2 minutes.');
      navigate('/dashboard');
    } catch (error) {
      alert('Error processing payment: ' + error.message);
    }
  };

  // Recalculates total values in Supabase when a quantity is edited or deleted
  const handleUpdateItemQty = async (itemId, orderId, newQty) => {
    try {
      if (newQty <= 0) {
        // Delete the item
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('id', itemId);
        if (deleteError) throw deleteError;
      } else {
        // Update the item quantity and total_price
        const itemToUpdate = items.find(i => i.id === itemId);
        const totalPrice = itemToUpdate.price * newQty;
        
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            quantity: newQty,
            total_price: totalPrice
          })
          .eq('id', itemId);
        if (updateError) throw updateError;
      }

      // Update parent order totals
      const { data: remainingItems, error: fetchError } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', orderId);
      
      if (fetchError) throw fetchError;

      if (!remainingItems || remainingItems.length === 0) {
        // Delete the empty order
        const { error: deleteOrderError } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId);
        if (deleteOrderError) throw deleteOrderError;
      } else {
        // Recalculate
        const orderSubtotal = remainingItems.reduce((sum, item) => sum + Number(item.total_price), 0);
        const orderTax = orderSubtotal * 0.1;
        const orderTotal = orderSubtotal + orderTax;

        const { error: updateOrderError } = await supabase
          .from('orders')
          .update({
            subtotal: orderSubtotal,
            tax: orderTax,
            total: orderTotal
          })
          .eq('id', orderId);
        if (updateOrderError) throw updateOrderError;
      }

      // Refresh page
      await fetchSessionData();
    } catch (error) {
      alert('Error updating quantity: ' + error.message);
    }
  };

  // Move Table actions
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
        if (data.length > 0) {
          setSelectedMoveTableId(data[0].id);
        }
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

      const { error: sessionError } = await supabase
        .from('customer_sessions')
        .update({ table_id: newTableId })
        .eq('id', sessionId);
      if (sessionError) throw sessionError;

      const newStatus = session.session_status === 'billing' ? 'billing' : 'occupied';
      const { error: newTableError } = await supabase
        .from('restaurant_tables')
        .update({ status: newStatus })
        .eq('id', newTableId);
      if (newTableError) throw newTableError;

      const { error: oldTableError } = await supabase
        .from('restaurant_tables')
        .update({ status: 'available' })
        .eq('id', oldTableId);
      if (oldTableError) throw oldTableError;

      // Update orders if table_id exists
      await supabase
        .from('orders')
        .update({ table_id: newTableId })
        .eq('session_id', sessionId);

      setShowMoveTableModal(false);
      await fetchSessionData();
      alert('Table moved successfully!');
    } catch (err) {
      alert('Error moving table: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // Merge Order actions
  const handleOpenMergeOrder = async () => {
    setShowMergeOrderModal(true);
    setLoadingAction(true);
    try {
      const { data, error } = await supabase
        .from('customer_sessions')
        .select(`
          id,
          customer_name,
          started_at,
          restaurant_tables(table_number)
        `)
        .eq('session_status', 'active')
        .neq('id', sessionId);
      if (!error && data) {
        setOccupiedSessions(data);
        if (data.length > 0) {
          setSelectedMergeSessionId(data[0].id);
        }
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

      const { error: transferError } = await supabase
        .from('orders')
        .update({ session_id: sessionId })
        .eq('session_id', selectedMergeSessionId);
      if (transferError) throw transferError;

      const { error: closeSessionError } = await supabase
        .from('customer_sessions')
        .update({ session_status: 'completed', ended_at: new Date().toISOString() })
        .eq('id', selectedMergeSessionId);
      if (closeSessionError) throw closeSessionError;

      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ status: 'available' })
        .eq('id', targetSession.table_id);
      if (tableError) throw tableError;

      setShowMergeOrderModal(false);
      await fetchSessionData();
      alert('Orders merged successfully!');
    } catch (err) {
      alert('Error merging orders: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // Print triggers
  const handlePrintBill = () => {
    setPrintType('bill');
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintKOT = () => {
    setPrintType('kot');
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintSplitEqual = (index, count) => {
    setPrintType('split-equal');
    setPrintSplitInfo({ index, count });
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintSplitItems = (target) => {
    setPrintType(target === 'A' ? 'split-items-a' : 'split-items-b');
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Calculations
  const subtotal = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  // Filter items and calculate totals dynamically based on the current print type
  const getFilteredPrintItems = () => {
    if (printType === 'split-items-a') {
      return items.filter(item => itemAssignments[item.id] === 'A');
    }
    if (printType === 'split-items-b') {
      return items.filter(item => itemAssignments[item.id] === 'B');
    }
    return items;
  };

  const getPrintTotals = () => {
    if (printType === 'split-items-a') {
      const itemsA = items.filter(item => itemAssignments[item.id] === 'A');
      const sub = itemsA.reduce((acc, item) => acc + (item.price * item.qty), 0);
      const t = sub * 0.1;
      return { subtotal: sub, tax: t, total: sub + t };
    }
    if (printType === 'split-items-b') {
      const itemsB = items.filter(item => itemAssignments[item.id] === 'B');
      const sub = itemsB.reduce((acc, item) => acc + (item.price * item.qty), 0);
      const t = sub * 0.1;
      return { subtotal: sub, tax: t, total: sub + t };
    }
    if (printType === 'split-equal' && printSplitInfo) {
      return {
        subtotal: subtotal / printSplitInfo.count,
        tax: tax / printSplitInfo.count,
        total: total / printSplitInfo.count
      };
    }
    return { subtotal, tax, total };
  };

  // Helper for edit modal
  const handleOpenEditItem = (item) => {
    setSelectedEditItem(item);
    setEditQty(item.qty);
    setShowEditItemModal(true);
  };

  const handleSaveEditItem = async (e) => {
    e.preventDefault();
    if (!selectedEditItem) return;
    await handleUpdateItemQty(selectedEditItem.id, selectedEditItem.orderId, editQty);
    setShowEditItemModal(false);
  };

  const printItems = getFilteredPrintItems();
  const { subtotal: printSubtotal, tax: printTax, total: printTotal } = getPrintTotals();

  // Split tab calculations
  const itemsA = items.filter(item => itemAssignments[item.id] === 'A');
  const itemsB = items.filter(item => itemAssignments[item.id] === 'B');
  const subtotalA = itemsA.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const subtotalB = itemsB.reduce((acc, item) => acc + (item.price * item.qty), 0);

  if (loading) return <div className="loading-state">Loading invoice...</div>;
  if (!session) return <div className="error-state">Session not found.</div>;

  return (
    <div className="billing-view">
      <div className="session-area">
        <div className="session-header">
          <div>
            <p className="session-label">CURRENT SESSION</p>
            <h2 className="table-title">Table {session.restaurant_tables?.table_number}</h2>
            <p className="customer-meta">{session.customer_name} • {session.guest_count} Guests</p>
          </div>
          <div className="header-actions">
            <button className="action-pill" onClick={handleOpenMoveTable}>
              <ArrowLeftRight size={16} /> Move Table
            </button>
            <button className="action-pill" onClick={() => { setShowSplitBillModal(true); setSplitTab('equal'); }}>
              <Split size={16} /> Split Bill
            </button>
          </div>
        </div>

        <div className="bill-items-list">
          {items.length === 0 ? (
            <div className="empty-order-msg" style={{ gridColumn: 'span 2', textAlign: 'center', padding: '3rem', color: '#888' }}>
              No items ordered in this session yet.
            </div>
          ) : (
            items.map((item, i) => (
              <div key={i} className="bill-item-card">
                {isEditingQuantities ? (
                  <div className="inline-qty-control">
                    <button className="inline-qty-btn" onClick={() => handleUpdateItemQty(item.id, item.orderId, item.qty - 1)}>
                      <Minus size={12} />
                    </button>
                    <span className="inline-qty-val">{item.qty}x</span>
                    <button className="inline-qty-btn" onClick={() => handleUpdateItemQty(item.id, item.orderId, item.qty + 1)}>
                      <Plus size={12} />
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
                  <span className="item-price">${(item.price * item.qty).toFixed(2)}</span>
                  <span className="item-status served">Served</span>
                </div>
                {isEditingQuantities ? (
                  <button className="inline-delete-btn" onClick={() => handleUpdateItemQty(item.id, item.orderId, 0)}>
                    <Trash2 size={18} />
                  </button>
                ) : (
                  <button className="edit-btn" onClick={() => handleOpenEditItem(item)}>
                    <Edit3 size={18} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="session-footer-actions">
          <button className="footer-btn" onClick={handleOpenMergeOrder}>
            <FileText size={20} /> Merge Order
          </button>
          <button className="footer-btn" onClick={handlePrintKOT}>
            <Printer size={20} /> Print KOT
          </button>
          <button 
            className={`footer-btn ${isEditingQuantities ? 'active-edit' : ''}`} 
            onClick={() => setIsEditingQuantities(!isEditingQuantities)}
            style={{ background: isEditingQuantities ? '#e8f5e9' : '', color: isEditingQuantities ? '#2e7d32' : '' }}
          >
            {isEditingQuantities ? <Check size={20} /> : <Edit3 size={20} />}
            {isEditingQuantities ? 'Finish Editing' : 'Change Quantity'}
          </button>
        </div>
      </div>

      <div className="billing-details-area">
        <div className="invoice-preview">
          <div className="invoice-header">
            <h3>Invoice Preview {isPaid && <span className="paid-badge">● PAID</span>}</h3>
          </div>
          
          <div className={`invoice-paper ${printType === 'kot' ? 'kot-print' : 'bill-print'}`}>
            {/* KOT specific header (hidden normally via CSS, visible only on KOT print) */}
            <div className="kot-header" style={{ display: 'none' }}>
              <h2>KITCHEN ORDER TICKET</h2>
              <p style={{ margin: '4px 0', fontSize: '1rem', fontWeight: 'bold' }}>
                Table {session.restaurant_tables?.table_number}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid black', paddingBottom: '6px', marginBottom: '10px' }}>
                <span>Date: {new Date().toLocaleDateString()}</span>
                <span>Session: {sessionId.slice(0, 4).toUpperCase()}</span>
              </div>
            </div>

            {/* Receipt logo/header (hidden on KOT print) */}
            <div className="receipt-logo">
              <h4>Lumiere Bistro</h4>
              <p>123 Downtown St, Metropolis</p>
              <p>Tel: +1 (555) 0123 456</p>
            </div>

            {/* Split equal header */}
            {printType === 'split-equal' && printSplitInfo && (
              <div className="split-badge-print" style={{ textAlign: 'center', border: '1px solid black', padding: '4px', margin: '10px 0', fontWeight: 'bold', fontSize: '0.9rem' }}>
                SHARE {printSplitInfo.index} OF {printSplitInfo.count}
              </div>
            )}

            {/* Split items header */}
            {printType === 'split-items-a' && (
              <div className="split-badge-print" style={{ textAlign: 'center', border: '1px solid black', padding: '4px', margin: '10px 0', fontWeight: 'bold', fontSize: '0.9rem' }}>
                BILL SHARE A
              </div>
            )}
            {printType === 'split-items-b' && (
              <div className="split-badge-print" style={{ textAlign: 'center', border: '1px solid black', padding: '4px', margin: '10px 0', fontWeight: 'bold', fontSize: '0.9rem' }}>
                BILL SHARE B
              </div>
            )}
            
            <div className="receipt-meta">
              <div><p>Table</p><strong>{session.restaurant_tables?.table_number}</strong></div>
              <div><p>Bill #</p><strong>{sessionId.slice(0, 4).toUpperCase()}</strong></div>
              <div><p>Date</p><strong>{new Date(session.started_at).toLocaleDateString()}</strong></div>
            </div>

            <div className="receipt-items">
              {printItems.map((item, i) => (
                <div key={i} className="receipt-row">
                  <span>{item.qty}x {item.name}</span>
                  <span className="item-price">${(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="receipt-totals">
              <div className="receipt-row"><span>Subtotal</span><span>${printSubtotal.toFixed(2)}</span></div>
              <div className="receipt-row"><span>Tax (10%)</span><span>${printTax.toFixed(2)}</span></div>
              <div className="receipt-row total"><span>Grand Total</span><span>${printTotal.toFixed(2)}</span></div>
            </div>

            <div className="receipt-footer">
              <p>{isPaid ? 'Thank you! Come again soon.' : 'Thank you for dining with us!'}</p>
              <div className="barcode">|| ||| || ||| ||</div>
            </div>
          </div>
        </div>

        <div className="payment-section">
          <div className="payment-methods">
            <div className={`method-card ${paymentMethod === 'card' ? 'active' : ''}`} onClick={() => setPaymentMethod('card')}>
              <CreditCard size={20} />
              <span>Credit / Debit Card</span>
              {paymentMethod === 'card' && <div className="check-dot">✓</div>}
            </div>
            <div className={`method-card ${paymentMethod === 'cash' ? 'active' : ''}`} onClick={() => setPaymentMethod('cash')}>
              <Banknote size={20} />
              <span>Cash</span>
              {paymentMethod === 'cash' && <div className="check-dot">✓</div>}
            </div>
            <div className={`method-card ${paymentMethod === 'qr' ? 'active' : ''}`} onClick={() => setPaymentMethod('qr')}>
              <QrCode size={20} />
              <span>Digital Wallet / QR</span>
              {paymentMethod === 'qr' && <div className="check-dot">✓</div>}
            </div>
          </div>

          <div className="loyalty-badge">
            <Tag size={18} />
            <div>
              <p>Loyalty Member Applied</p>
              <span>10% Member discount automatically calculated.</span>
            </div>
            <button className="change-link">Change Card</button>
          </div>

          <div className="final-actions">
            <button 
              className="pay-btn" 
              onClick={handleMarkAsPaid}
              disabled={isPaid}
              style={{ opacity: isPaid ? 0.5 : 1, cursor: isPaid ? 'not-allowed' : 'pointer', background: isPaid ? '#4CAF50' : '' }}
            >
              <CheckCircle2 size={20} /> {isPaid ? 'Paid & Completed' : 'Mark as Paid'}
            </button>
            <div className="sub-actions">
              <button className="sub-btn" onClick={handlePrintBill}>Generate Bill</button>
              <button className="sub-btn" onClick={handlePrintBill}><Printer size={16} /> Print Bill</button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Item Modal */}
      {showEditItemModal && selectedEditItem && (
        <div className="modal-overlay" onClick={() => setShowEditItemModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Quantity: {selectedEditItem.name}</h2>
              <button className="close-modal" onClick={() => setShowEditItemModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEditItem} className="modal-form">
              <div className="form-group" style={{ alignItems: 'center', margin: '1rem 0' }}>
                <p style={{ fontWeight: 600, color: '#888', marginBottom: '0.5rem' }}>Adjust Quantity</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <button 
                    type="button"
                    className="inline-qty-btn" 
                    onClick={() => setEditQty(Math.max(0, editQty - 1))}
                    style={{ width: '40px', height: '40px', fontSize: '1.5rem' }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{editQty}</span>
                  <button 
                    type="button"
                    className="inline-qty-btn" 
                    onClick={() => setEditQty(editQty + 1)}
                    style={{ width: '40px', height: '40px', fontSize: '1.25rem' }}
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
                  style={{ background: '#e74c3c' }}
                >
                  <Trash2 size={18} /> Delete Item
                </button>
                <button type="submit" className="start-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Table Modal */}
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
                  <p style={{ color: '#e74c3c', fontWeight: 600 }}>No available tables to move to.</p>
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

      {/* Merge Order Modal */}
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

      {/* Split Bill Modal */}
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
                          <p>${(total / splitWays).toFixed(2)}</p>
                        </div>
                        <button className="split-print-btn" onClick={() => handlePrintSplitEqual(i + 1, splitWays)}>
                          Print Share {i + 1}
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
                          <p>{item.qty}x • ${(item.price * item.qty).toFixed(2)}</p>
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

                  <div className="split-totals-summary">
                    <div className="bill-summary-col">
                      <h5>Bill A ({itemsA.length} items)</h5>
                      <p>${(subtotalA * 1.1).toFixed(2)}</p>
                      <button onClick={() => handlePrintSplitItems('A')} disabled={itemsA.length === 0} style={{ opacity: itemsA.length === 0 ? 0.5 : 1 }}>
                        Print Bill A
                      </button>
                    </div>
                    <div className="bill-summary-col" style={{ borderLeft: '1px dashed var(--color-border)', paddingLeft: '1rem' }}>
                      <h5>Bill B ({itemsB.length} items)</h5>
                      <p>${(subtotalB * 1.1).toFixed(2)}</p>
                      <button onClick={() => handlePrintSplitItems('B')} disabled={itemsB.length === 0} style={{ opacity: itemsB.length === 0 ? 0.5 : 1 }}>
                        Print Bill B
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .loading-state, .error-state { display: flex; align-items: center; justify-content: center; height: 100%; font-weight: 600; color: var(--color-text-muted); }
        .billing-view { display: flex; height: 100%; gap: 2rem; }
        .session-area { flex: 1.2; display: flex; flex-direction: column; gap: 2rem; }
        .session-header { display: flex; justify-content: space-between; align-items: flex-end; }
        .session-label { font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted); letter-spacing: 1px; }
        .table-title { font-size: 2rem; font-weight: 700; }
        .customer-meta { font-size: 0.9rem; color: var(--color-text-muted); font-weight: 600; margin-top: 0.25rem; }
        .header-actions { display: flex; gap: 0.75rem; }
        .action-pill { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; background: white; border: 1px solid var(--color-border); border-radius: 10px; font-size: 0.85rem; font-weight: 600; color: var(--color-primary); cursor: pointer; }
        .bill-items-list { display: flex; flex-direction: column; gap: 1rem; flex: 1; overflow-y: auto; }
        .bill-item-card { background: white; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; align-items: center; gap: 1.5rem; box-shadow: var(--shadow-soft); position: relative; }
        .item-qty-box { width: 44px; height: 44px; background: var(--color-accent-soft); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--color-primary); }
        .item-main-info { flex: 1; }
        .item-main-info h4 { font-size: 1.05rem; font-weight: 700; }
        .item-main-info p { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.25rem; }
        .item-meta { text-align: right; margin-right: 1rem; }
        .item-price { display: block; font-weight: 700; font-size: 1.1rem; }
        .item-status { font-size: 0.75rem; font-weight: 700; }
        .item-status.served { color: #4CAF50; }
        .edit-btn { color: var(--color-text-muted); opacity: 0.5; cursor: pointer; background: none; border: none; }
        .session-footer-actions { display: flex; gap: 1rem; }
        .footer-btn { flex: 1; background: #F4EFEA; color: var(--color-primary); padding: 1.25rem; border-radius: var(--radius-md); font-weight: 700; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer; border: none; }
        .billing-details-area { flex: 0.8; display: flex; flex-direction: column; gap: 1.5rem; }
        .invoice-preview { background: #F9EBE0; padding: 1.5rem; border-radius: var(--radius-lg); flex: 1; display: flex; flex-direction: column; gap: 1rem; }
        .invoice-header h3 { font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: space-between; }
        .paid-badge { color: #4CAF50; font-size: 0.8rem; }
        .invoice-paper { background: white; border-radius: var(--radius-md); padding: 2rem; flex: 1; display: flex; flex-direction: column; gap: 1.5rem; box-shadow: 0 10px 30px rgba(78, 62, 47, 0.05); }
        .receipt-logo { text-align: center; }
        .receipt-logo h4 { font-size: 1.25rem; font-weight: 800; }
        .receipt-logo p { font-size: 0.75rem; color: var(--color-text-muted); }
        .receipt-meta { display: flex; justify-content: space-between; border-top: 1px solid #F0F0F0; border-bottom: 1px solid #F0F0F0; padding: 1rem 0; }
        .receipt-meta div p { font-size: 0.7rem; color: #888; text-transform: uppercase; }
        .receipt-meta div strong { font-size: 0.9rem; }
        .receipt-items { display: flex; flex-direction: column; gap: 0.75rem; }
        .receipt-row { display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600; }
        .receipt-totals { margin-top: auto; border-top: 2px solid #F0F0F0; padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .receipt-row.total { font-size: 1.5rem; font-weight: 800; color: var(--color-primary); margin-top: 0.5rem; }
        .receipt-footer { text-align: center; margin-top: 1rem; }
        .receipt-footer p { font-size: 0.8rem; font-weight: 600; color: #888; }
        .barcode { font-family: monospace; font-size: 1.25rem; letter-spacing: 2px; margin-top: 0.5rem; }
        .payment-methods { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
        .method-card { background: white; border: 1.5px solid var(--color-border); padding: 1rem 1.5rem; border-radius: 12px; display: flex; align-items: center; gap: 1rem; font-weight: 700; cursor: pointer; position: relative; }
        .method-card.active { background: #F9F3EE; border-color: var(--color-primary); }
        .check-dot { position: absolute; right: 1.5rem; width: 20px; height: 20px; background: var(--color-primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; }
        .loyalty-badge { background: #FFF5EE; border: 1px solid #F2E3D5; padding: 1rem; border-radius: 12px; display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .loyalty-badge p { font-size: 0.85rem; font-weight: 700; color: var(--color-primary); }
        .loyalty-badge span { font-size: 0.75rem; color: var(--color-text-muted); }
        .change-link { margin-left: auto; font-size: 0.8rem; font-weight: 700; color: #8E7F71; border-bottom: 1px solid; background: none; border: none; cursor: pointer; }
        .final-actions { display: flex; flex-direction: column; gap: 0.75rem; }
        .pay-btn { width: 100%; background: var(--color-primary); color: white; padding: 1.25rem; border-radius: 14px; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; gap: 0.75rem; border: none; cursor: pointer; }
        .sub-actions { display: flex; gap: 0.75rem; }
        .sub-btn { flex: 1; padding: 1rem; border-radius: 12px; background: #F4EFEA; color: var(--color-primary); font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; border: none; cursor: pointer; }

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

        /* Inline editing styles */
        .inline-qty-control {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #F4EFEA;
          padding: 0.25rem 0.5rem;
          border-radius: 8px;
        }
        .inline-qty-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
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
          font-size: 0.95rem;
          min-width: 24px;
          text-align: center;
        }
        .inline-delete-btn {
          color: #E53935;
          margin-left: auto;
          cursor: pointer;
          background: none;
          border: none;
        }

        /* Split modal styles */
        .modal-tabs {
          display: flex;
          border-bottom: 2px solid var(--color-border);
          margin-bottom: 1.5rem;
        }
        .modal-tab {
          flex: 1;
          padding: 0.75rem;
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
          gap: 1rem;
          margin-bottom: 1.5rem;
          font-weight: 700;
          color: var(--color-primary);
        }
        .split-ways-selector input {
          width: 70px;
          padding: 0.6rem;
          border-radius: 8px;
          border: 1.5px solid var(--color-border);
          text-align: center;
          font-weight: 700;
          outline: none;
        }

        .split-results {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-height: 250px;
          overflow-y: auto;
        }
        .split-card {
          background: #FDFBF9;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          border: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .split-card h5 {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--color-text-muted);
        }
        .split-card p {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--color-primary);
          margin-top: 0.25rem;
        }
        .split-print-btn {
          background: var(--color-primary);
          color: white;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
        }

        /* Split by item styles */
        .split-items-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-height: 220px;
          overflow-y: auto;
          margin-bottom: 1.5rem;
          padding-right: 0.5rem;
        }
        .split-item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: #FDFBF9;
          border-radius: 10px;
          border: 1px solid var(--color-border);
        }
        .split-item-info h5 {
          font-size: 0.95rem;
          font-weight: 700;
        }
        .split-item-info p {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          margin-top: 0.15rem;
        }
        .split-assignment {
          display: flex;
          gap: 0.25rem;
          background: #EDE8E3;
          padding: 0.25rem;
          border-radius: 8px;
        }
        .split-assign-btn {
          border: none;
          padding: 0.35rem 0.75rem;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.8rem;
          background: transparent;
          color: var(--color-text-muted);
          cursor: pointer;
        }
        .split-assign-btn.active {
          background: white;
          color: var(--color-primary);
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .split-totals-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          background: #F9EBE0;
          padding: 1.25rem;
          border-radius: 12px;
        }
        .bill-summary-col {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .bill-summary-col h5 {
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--color-primary);
        }
        .bill-summary-col p {
          font-size: 1.25rem;
          font-weight: 800;
          margin-top: 0.25rem;
        }
        .bill-summary-col button {
          margin-top: 0.75rem;
          background: var(--color-primary);
          color: white;
          border: none;
          padding: 0.6rem;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
        }

        @media print {
          /* Hide non-printable elements */
          .sidebar,
          .header,
          .session-area,
          .payment-section,
          .invoice-header,
          .session-footer-actions,
          .final-actions,
          .header-actions {
            display: none !important;
            visibility: hidden !important;
          }

          /* Force ancestors to be display: block with no padding/margins */
          .app-container,
          .main-content,
          .scrollable-area,
          .billing-view,
          .billing-details-area,
          .invoice-preview {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            box-shadow: none !important;
            background: white !important;
            border: none !important;
          }

          .invoice-paper {
            display: block !important;
            margin: 0 !important;
            padding: 20px !important;
            border: none !important;
            width: 100% !important;
            box-shadow: none !important;
            background: white !important;
          }

          /* Print overrides for KOT */
          .invoice-paper.kot-print .receipt-logo,
          .invoice-paper.kot-print .receipt-totals,
          .invoice-paper.kot-print .receipt-footer,
          .invoice-paper.kot-print .barcode,
          .invoice-paper.kot-print .item-price,
          .invoice-paper.kot-print .paid-badge,
          .invoice-paper.kot-print .receipt-row span:last-child {
            display: none !important;
            visibility: hidden !important;
          }

          .invoice-paper.kot-print .kot-header {
            display: block !important;
            visibility: visible !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Billing;
