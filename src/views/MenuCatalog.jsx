import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Utensils, 
  Coffee, 
  Soup, 
  Pizza, 
  IceCream, 
  Salad, 
  Clock, 
  Plus, 
  Trash2,
  ChevronRight,
  Beef,
  Croissant,
  Wine,
  Sandwich,
  Cookie
} from 'lucide-react';

// Map category names to icons
const CATEGORY_ICONS = {
  'Beverages': Coffee,
  'Drinks': Coffee,
  'Desserts': IceCream,
  'Sweets': IceCream,
  'Main Course': Beef,
  'Mains': Beef,
  'Pizza & Pasta': Pizza,
  'Pizza': Pizza,
  'Pasta': Pizza,
  'Soups': Soup,
  'Starters': Salad,
  'Appetizers': Salad,
  'Snacks': Sandwich,
  'Bakery': Croissant,
  'Cocktails': Wine,
};

const getCategoryIcon = (name) => {
  if (!name) return Utensils;
  const match = Object.keys(CATEGORY_ICONS).find(k => name.toLowerCase().includes(k.toLowerCase()));
  return match ? CATEGORY_ICONS[match] : Utensils;
};

// Fallback gradient placeholder as data URI
const FOOD_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%23F9EBE0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' opacity='0.35'%3E%F0%9F%8D%BD%EF%B8%8F%3C/text%3E%3C/svg%3E`;

const MenuCatalog = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId');
  const tableId = searchParams.get('tableId');

  const [activeCategory, setActiveCategory] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMenuData();
  }, []);

  const fetchMenuData = async () => {
    try {
      setLoading(true);
      
      const { data: catsData, error: catsError } = await supabase
        .from('menu_categories')
        .select('*')
        .order('category_name');
      if (catsError) throw catsError;
      setCategories(catsData);
      if (catsData.length > 0) setActiveCategory(catsData[0].id);

      const { data: itemsData, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true);
      if (itemsError) throw itemsError;
      setMenuItems(itemsData);
    } catch (error) {
      console.error('Error fetching menu data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToOrder = (item) => {
    const existing = orderItems.find(i => i.id === item.id);
    if (existing) {
      setOrderItems(orderItems.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setOrderItems([...orderItems, { 
        id: item.id, 
        name: item.item_name, 
        price: item.price, 
        notes: '', 
        qty: 1 
      }]);
    }
  };

  const updateQty = (id, delta) => {
    setOrderItems(orderItems.map(i => {
      if (i.id === id) {
        const newQty = Math.max(0, i.qty + delta);
        return newQty === 0 ? null : { ...i, qty: newQty };
      }
      return i;
    }).filter(Boolean));
  };

  const clearOrder = () => {
    if (confirm('Clear entire order?')) {
      setOrderItems([]);
    }
  };

  const createOrder = async () => {
    if (orderItems.length === 0) return;

    const validSessionId = (sessionId && sessionId !== 'undefined' && sessionId !== 'null') ? sessionId : null;
    const validTableId = (tableId && tableId !== 'undefined' && tableId !== 'null') ? tableId : null;

    if (!validSessionId) {
      alert("No active session found. Please assign a table from the Dashboard first.");
      return;
    }
    
    try {
      const subtotal = orderItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
      const tax = subtotal * 0.1;
      const total = subtotal + tax;

      const orderPayload = {
        session_id: validSessionId,
        order_status: 'preparing',
        subtotal,
        tax,
        total
      };

      if (validTableId) {
        orderPayload.table_id = validTableId;
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItemsToInsert = orderItems.map(item => ({
        order_id: order.id,
        menu_item_id: item.id,
        quantity: item.qty,
        item_price: item.price,
        total_price: item.price * item.qty
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsError) throw itemsError;

      alert('Order placed successfully!');
      setOrderItems([]);
      navigate('/dashboard');
    } catch (error) {
      alert('Error creating order: ' + error.message);
    }
  };

  const subtotal = orderItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const filteredItems = menuItems.filter(item => {
    return item.category_id === activeCategory;
  });

  if (loading) return <div className="loading-state">Loading menu...</div>;

  return (
    <div className="menu-view">
      <div className="category-sidebar">
        {categories.map((cat) => {
          const IconComponent = getCategoryIcon(cat.category_name);
          return (
            <div 
              key={cat.id} 
              className={`category-item ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <div className="cat-icon-box">
                <IconComponent size={22} />
              </div>
              <span>{cat.category_name}</span>
            </div>
          );
        })}
      </div>

      <div className="catalog-area">
        <div className="catalog-header">
          <h2 className="section-title">Menu Selection</h2>
          <div className="catalog-filters">
            {['All', 'Vegetarian', 'Spicy'].map(filter => (
              <button 
                key={filter} 
                className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="menu-grid">
          {filteredItems.map((item) => (
            <div key={item.id} className="food-card">
              <div className="food-image-container">
                <img 
                  src={item.image_url || FOOD_PLACEHOLDER} 
                  alt={item.item_name}
                  onError={(e) => { e.target.onerror = null; e.target.src = FOOD_PLACEHOLDER; }}
                />
                <div className="price-badge">${Number(item.price).toFixed(2)}</div>
              </div>
              <div className="food-info">
                <h3>{item.item_name}</h3>
                <p className="food-desc">{item.description || 'Freshly prepared with care.'}</p>
                <div className="food-footer">
                  <div className="prep-time">
                    <Clock size={14} />
                    <span>20 mins</span>
                  </div>
                  <button className="add-btn" onClick={() => addToOrder(item)}>
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="order-panel">
        <div className="order-header">
          <div>
            <h3>Current Order</h3>
            <p>Order Items: {orderItems.length}</p>
          </div>
          <button className="clear-btn" onClick={clearOrder}>Clear All</button>
        </div>

        <div className="order-items">
          {orderItems.map((item, i) => (
            <div key={i} className="order-item">
              <div className="item-main">
                <div className="item-details">
                  <h4>{item.name}</h4>
                  <p>{item.notes || 'No notes'}</p>
                </div>
                <div className="item-price">${(item.price * item.qty).toFixed(2)}</div>
              </div>
              <div className="item-controls">
                <div className="qty-picker">
                  <button onClick={() => updateQty(item.id, -1)}>-</button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)}>+</button>
                </div>
                <button className="delete-item" onClick={() => updateQty(item.id, -item.qty)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {orderItems.length === 0 && (
            <div className="empty-order-msg">Your order is empty.</div>
          )}
        </div>

        <div className="order-summary">
          <div className="summary-row">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Tax (10%)</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <button 
            className="create-order-btn" 
            onClick={createOrder}
            disabled={orderItems.length === 0}
            style={{ opacity: orderItems.length === 0 ? 0.5 : 1, cursor: orderItems.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            Create Order <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <style jsx>{`
        .loading-state { display: flex; align-items: center; justify-content: center; height: 100%; font-weight: 600; color: var(--color-text-muted); }
        .menu-view { display: flex; height: 100%; gap: 2rem; }
        .category-sidebar { width: 100px; display: flex; flex-direction: column; gap: 1.5rem; padding-top: 1rem; }
        .category-item { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; cursor: pointer; transition: var(--transition-smooth); }
        .cat-icon-box { width: 56px; height: 56px; background: #F4EFEA; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--color-primary); }
        .category-item span { font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted); text-align: center; }
        .category-item.active .cat-icon-box { background: var(--color-primary); color: white; }
        .category-item.active span { color: var(--color-primary); }
        .catalog-area { flex: 1; display: flex; flex-direction: column; gap: 2rem; overflow-y: auto; padding-right: 1rem; }
        .catalog-header { display: flex; justify-content: space-between; align-items: center; }
        .section-title { font-size: 1.5rem; font-weight: 700; }
        .catalog-filters { display: flex; gap: 0.5rem; background: #EDE8E3; padding: 0.4rem; border-radius: 10px; }
        .filter-btn { padding: 0.4rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); }
        .filter-btn.active { background: white; color: var(--color-primary); box-shadow: 0 2px 6px rgba(0,0,0,0.05); }
        .menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; padding-bottom: 2rem; }
        .food-card { background: white; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--color-border); transition: var(--transition-smooth); }
        .food-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-soft); }
        .food-image-container { height: 160px; position: relative; }
        .food-image-container img { width: 100%; height: 100%; object-fit: cover; }
        .price-badge { position: absolute; top: 12px; right: 12px; background: white; padding: 0.4rem 0.85rem; border-radius: 8px; font-weight: 700; font-size: 0.9rem; color: var(--color-primary); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .food-info { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .food-info h3 { font-size: 1.1rem; font-weight: 700; }
        .food-desc { font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.4; height: 2.8rem; overflow: hidden; }
        .food-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; }
        .prep-time { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--color-text-muted); font-weight: 600; }
        .add-btn { width: 36px; height: 36px; background: var(--color-primary); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .order-panel { width: 340px; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-border); display: flex; flex-direction: column; overflow: hidden; }
        .order-header { padding: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--color-border); }
        .order-header h3 { font-size: 1.25rem; font-weight: 700; }
        .order-header p { font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0.25rem; }
        .clear-btn { font-size: 0.8rem; font-weight: 700; color: #E53935; }
        .order-items { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
        .order-item { background: #FFF5EE; padding: 1rem; border-radius: 14px; display: flex; flex-direction: column; gap: 0.75rem; }
        .item-main { display: flex; justify-content: space-between; align-items: flex-start; }
        .item-details h4 { font-size: 0.95rem; font-weight: 700; }
        .item-details p { font-size: 0.8rem; color: var(--color-text-muted); }
        .item-price { font-weight: 700; color: var(--color-primary); }
        .item-controls { display: flex; justify-content: space-between; align-items: center; }
        .qty-picker { display: flex; align-items: center; gap: 1rem; background: white; padding: 0.25rem 0.75rem; border-radius: 8px; border: 1px solid var(--color-border); }
        .qty-picker button { font-weight: 700; font-size: 1.1rem; color: var(--color-primary); }
        .qty-picker span { font-weight: 700; font-size: 0.95rem; min-width: 20px; text-align: center; }
        .delete-item { color: #8E7F71; opacity: 0.6; }
        .order-summary { padding: 1.5rem; background: #FDFBF9; border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 1rem; }
        .summary-row { display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 600; color: var(--color-text-muted); }
        .summary-total { display: flex; justify-content: space-between; font-size: 1.5rem; font-weight: 800; color: var(--color-primary); margin-top: 0.5rem; border-top: 1px dashed var(--color-border); padding-top: 1rem; }
        .create-order-btn { width: 100%; background: var(--color-primary); color: white; padding: 1.1rem; border-radius: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 0.5rem; }
        .empty-order-msg { text-align: center; padding: 2rem; color: var(--color-text-muted); font-weight: 600; }
      `}</style>
    </div>
  );
};

export default MenuCatalog;
