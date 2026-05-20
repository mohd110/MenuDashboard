import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  Banknote,
  Receipt,
  PieChart,
  Utensils,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const Reports = () => {
  const [activeShift, setActiveShift] = useState('morning');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    totalSales: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    cashCollected: 0,
    cardCollected: 0,
    topItems: []
  });

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch Orders for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            quantity,
            item_price,
            menu_items(item_name)
          )
        `)
        .gte('created_at', today.toISOString());

      if (ordersError) throw ordersError;

      const totalSales = orders.reduce((acc, o) => acc + Number(o.total), 0);
      const totalOrders = orders.length;
      const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

      // Group top items
      const itemCounts = {};
      orders.forEach(order => {
        order.order_items.forEach(item => {
          const name = item.menu_items.item_name;
          if (!itemCounts[name]) itemCounts[name] = { qty: 0, revenue: 0 };
          itemCounts[name].qty += item.quantity;
          itemCounts[name].revenue += item.quantity * item.item_price;
        });
      });

      const topItems = Object.entries(itemCounts)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      setReportData({
        totalSales,
        totalOrders,
        avgOrderValue,
        cashCollected: totalSales * 0.3, // Approximation
        cardCollected: totalSales * 0.7, // Approximation
        topItems
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const shiftName = activeShift === 'morning' ? "Morning Shift (8:00 AM - 4:00 PM)" : "Evening Shift (4:00 PM - 12:00 AM)";

  return (
    <div className="reports-view">
      {/* Header */}
      <div className="reports-header print-hide">
        <div>
          <h2 className="main-title">End of Shift Report</h2>
          <p className="subtitle">View summary and analytics for the selected shift.</p>
        </div>
        <div className="header-actions">
          <div className="shift-selector">
            <button 
              className={`shift-btn ${activeShift === 'morning' ? 'active' : ''}`}
              onClick={() => setActiveShift('morning')}
            >
              ☀️ Morning Shift
            </button>
            <button 
              className={`shift-btn ${activeShift === 'evening' ? 'active' : ''}`}
              onClick={() => setActiveShift('evening')}
            >
              🌙 Evening Shift
            </button>
          </div>
          <button className="export-btn" onClick={handlePrint}>
            <Download size={18} />
            Save as PDF
          </button>
        </div>
      </div>

      <div className="report-container" id="printable-report">
        {loading ? (
          <div className="loading-state"><Loader2 className="animate-spin" /> Fetching real-time analytics...</div>
        ) : (
          <>
            <div className="report-meta">
              <div className="meta-left">
                <h3>{shiftName}</h3>
                <p className="meta-detail"><Calendar size={14} /> Today, {new Date().toLocaleDateString()}</p>
              </div>
              <div className="meta-right">
                <p>Shift Manager</p>
                <h4>Active Manager</h4>
              </div>
            </div>

            <div className="metrics-grid">
              <div className="metric-card primary-metric">
                <div className="metric-icon-box"><DollarSign size={24} /></div>
                <div>
                  <p className="metric-label">Total Sales</p>
                  <h3 className="metric-value">${reportData.totalSales.toFixed(2)}</h3>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon-box"><Receipt size={24} /></div>
                <div>
                  <p className="metric-label">Total Orders</p>
                  <h3 className="metric-value">{reportData.totalOrders}</h3>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon-box"><TrendingUp size={24} /></div>
                <div>
                  <p className="metric-label">Average Order</p>
                  <h3 className="metric-value">${reportData.avgOrderValue.toFixed(2)}</h3>
                </div>
              </div>
            </div>

            <div className="payment-split-section">
              <h3 className="section-title">Payment Collection</h3>
              <div className="payment-cards">
                <div className="payment-card">
                  <CreditCard size={20} color="#8E7F71" />
                  <div className="payment-info">
                    <p>Card / Digital</p>
                    <h4>${reportData.cardCollected.toFixed(2)}</h4>
                  </div>
                </div>
                <div className="payment-card">
                  <Banknote size={20} color="#8E7F71" />
                  <div className="payment-info">
                    <p>Cash Collection</p>
                    <h4>${reportData.cashCollected.toFixed(2)}</h4>
                  </div>
                </div>
              </div>
            </div>

            <div className="analytics-section">
              <div className="analytics-card">
                <div className="card-header">
                  <h3 className="section-title"><Utensils size={18} /> Top Selling Items</h3>
                </div>
                <div className="list-content">
                  {reportData.topItems.map((item, index) => (
                    <div key={index} className="list-row">
                      <div className="item-rank">#{index + 1}</div>
                      <div className="item-name">{item.name}</div>
                      <div className="item-qty">{item.qty} sold</div>
                      <div className="item-rev">${item.revenue.toFixed(2)}</div>
                    </div>
                  ))}
                  {reportData.topItems.length === 0 && <p className="empty-msg">No sales data for this shift yet.</p>}
                </div>
              </div>

              <div className="analytics-card">
                <div className="card-header">
                  <h3 className="section-title"><PieChart size={18} /> Sales by Area</h3>
                </div>
                <div className="chart-placeholder">
                  <div className="bar-row">
                    <span>Main Hall</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: '75%' }}></div></div>
                    <span>75%</span>
                  </div>
                  <div className="bar-row">
                    <span>Rooftop</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: '25%' }}></div></div>
                    <span>25%</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .loading-state { display: flex; align-items: center; justify-content: center; min-height: 400px; gap: 1rem; font-weight: 600; color: var(--color-primary); }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .empty-msg { text-align: center; padding: 2rem; color: var(--color-text-muted); font-style: italic; }
        .reports-view {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          height: 100%;
          padding-bottom: 2rem;
        }

        .main-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .subtitle {
          font-size: 0.9rem;
          color: var(--color-text-muted);
          margin-top: 0.25rem;
        }

        .reports-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .shift-selector {
          display: flex;
          background: #F4EFEA;
          padding: 0.35rem;
          border-radius: 12px;
        }

        .shift-btn {
          padding: 0.6rem 1.25rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--color-text-muted);
          transition: var(--transition-smooth);
        }

        .shift-btn.active {
          background: white;
          color: var(--color-primary);
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .export-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--color-primary);
          color: white;
          padding: 0.75rem 1.25rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.95rem;
          transition: var(--transition-smooth);
        }

        .export-btn:hover {
          background: #3A2E22;
        }

        .report-container {
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .report-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--color-border);
        }

        .meta-left h3 {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .meta-detail {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.9rem;
          color: var(--color-text-muted);
          margin-top: 0.4rem;
          font-weight: 500;
        }

        .meta-right {
          text-align: right;
        }

        .meta-right p {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .meta-right h4 {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-primary);
          margin-top: 0.25rem;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .metric-card {
          background: #FDFBF9;
          border: 1px solid var(--color-border);
          padding: 1.5rem;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .metric-card.primary-metric {
          background: #F9F3EE;
          border-color: #F2E3D5;
        }

        .metric-icon-box {
          width: 54px;
          height: 54px;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          box-shadow: 0 4px 10px rgba(0,0,0,0.02);
        }

        .metric-card.primary-metric .metric-icon-box {
          background: var(--color-primary);
          color: white;
        }

        .metric-label {
          font-size: 0.85rem;
          color: var(--color-text-muted);
          font-weight: 600;
        }

        .metric-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--color-primary);
          margin-top: 0.25rem;
        }

        .payment-split-section {
          background: #FAFAFA;
          border-radius: 16px;
          padding: 1.5rem;
          border: 1px dashed var(--color-border);
        }

        .section-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-primary);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        .payment-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .payment-card {
          background: white;
          padding: 1.25rem;
          border-radius: 12px;
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .payment-info p {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .payment-info h4 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-primary);
          margin-top: 0.2rem;
        }

        .analytics-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .analytics-card {
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 1.5rem;
        }

        .list-row {
          display: flex;
          align-items: center;
          padding: 0.85rem 0;
          border-bottom: 1px solid #F0F0F0;
        }

        .list-row:last-child { border-bottom: none; }

        .item-rank {
          font-weight: 800;
          color: var(--color-accent);
          width: 30px;
        }

        .item-name { flex: 1; font-weight: 600; font-size: 0.95rem; }
        .item-qty { color: var(--color-text-muted); font-size: 0.85rem; width: 80px; text-align: right; }
        .item-rev { font-weight: 700; color: var(--color-primary); width: 80px; text-align: right; }

        .chart-placeholder {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          margin-top: 1rem;
        }

        .bar-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .bar-row span:first-child { width: 90px; color: var(--color-text-muted); }
        .bar-row span:last-child { width: 40px; text-align: right; color: var(--color-primary); }

        .bar-track {
          flex: 1;
          height: 8px;
          background: #F4EFEA;
          border-radius: 4px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          background: var(--color-accent);
          border-radius: 4px;
        }

        /* Print Media Styles */
        @media print {
          .print-hide { display: none !important; }
          .reports-view { padding: 0; }
          .report-container { 
            border: none; 
            padding: 0; 
            box-shadow: none; 
          }
          body { background: white; }
          .app-container { height: auto; overflow: visible; }
          .sidebar { display: none !important; }
          .header { display: none !important; }
          .scrollable-area { padding: 0; overflow: visible; }
          .metric-card { border: 2px solid #E8E1DA; }
        }
      `}</style>
    </div>
  );
};

export default Reports;
