/**
 * Campus Marketplace Dashboard (#1410)
 *
 * Buy/sell listings, textbook exchange, electronics, services,
 * transaction tracking, and marketplace analytics.
 */

import { useMemo, useState } from 'react';

import { getMarketplaceData } from './marketplaceService';
import {
  OverviewStats, ListingCard, TransactionCard, UserCard, InsightCard,
} from './MarketplaceCards';
import {
  BarChart, DonutChart, TrendLine, HorizontalBar, RadarChart,
} from './MarketplaceCharts';
import { CATEGORY_COLORS, CATEGORY_ICONS, formatPrice } from './marketplaceTypes';

const TABS = ['Overview', 'Listings', 'Transactions', 'Users', 'Analytics'];

export default function CampusMarketplaceDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const data = useMemo(() => getMarketplaceData(), []);

  const filteredListings = useMemo(() => {
    return data.listings.filter(l => {
      if (filterCategory !== 'All' && l.category !== filterCategory) return false;
      if (filterStatus !== 'All' && l.status !== filterStatus) return false;
      return true;
    });
  }, [data.listings, filterCategory, filterStatus]);

  // Chart data
  const categoryDonut = data.categoryStats
    .filter(c => c.listingsCount > 0)
    .map(c => ({ label: c.category, value: c.listingsCount, color: CATEGORY_COLORS[c.category] || '#3b82f6' }));

  const statusDonut = [
    { label: 'Active', value: data.summary.activeListings, color: '#22c55e' },
    { label: 'Sold', value: data.summary.soldListings, color: '#6b7280' },
    { label: 'Reserved', value: data.listings.filter(l => l.status === 'Reserved').length, color: '#eab308' },
    { label: 'Expired', value: data.listings.filter(l => l.status === 'Expired').length, color: '#ef4444' },
  ];

  const revenueBar = data.categoryStats
    .filter(c => c.totalRevenue > 0)
    .map(c => ({ label: c.category.slice(0, 8), value: c.totalRevenue, color: CATEGORY_COLORS[c.category] || '#3b82f6' }))
    .sort((a, b) => b.value - a.value);

  const sellTimeBar = data.categoryStats
    .map(c => ({ label: c.category.slice(0, 8), value: c.avgTimeToSell, color: c.avgTimeToSell < 7 ? '#22c55e' : '#eab308' }))
    .sort((a, b) => a.value - b.value);

  const priceRadar = data.categoryStats.slice(0, 6).map(c => ({
    axis: c.category.slice(0, 8), value: Math.min(c.avgPrice / 200, 1),
  }));

  const filterBarStyle = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 12, color: '#374151', background: '#fff', outline: 'none',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
          🛒 Campus Marketplace
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Buy/sell listings, textbook exchange, electronics, services, and transaction tracking.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
            color: activeTab === tab ? '#2563EB' : '#6b7280',
            background: activeTab === tab ? '#eff6ff' : 'transparent',
            borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
            marginBottom: -2,
          }}>{tab}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <OverviewStats summary={data.summary} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <DonutChart data={categoryDonut} title="Listings by Category" />
            <DonutChart data={statusDonut} title="Listings by Status" />
            <BarChart data={revenueBar} title="Revenue by Category ($)" height={200} />
          </div>
          <TrendLine
            trends={data.trends}
            title="Marketplace Trends"
            lines={[
              { key: 'newListings', color: '#3b82f6', label: 'New Listings' },
              { key: 'totalSales', color: '#22c55e', label: 'Sales' },
              { key: 'activeUsers', color: '#8b5cf6', label: 'Active Users' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <HorizontalBar data={sellTimeBar} title="Avg Days to Sell by Category" />
            <RadarChart data={priceRadar} title="Avg Price by Category" />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🧠 Marketplace Insights</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {data.insights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            </div>
          </div>
        </div>
      )}

      {/* Listings Tab */}
      {activeTab === 'Listings' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={filterBarStyle}>
              <option value="All">All Categories</option>
              {['Textbooks','Electronics','Furniture','Clothing','Services','Tutoring','Rideshare','Free Items','Event Tickets','Food & Drinks'].map(c => (
                <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterBarStyle}>
              <option value="All">All Statuses</option>
              {['Active','Sold','Reserved','Expired','Removed'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{filteredListings.length} listings</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
            {filteredListings.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()).map(l => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'Transactions' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart data={revenueBar.slice(0, 6)} title="Revenue by Category" />
            <BarChart data={revenueBar.slice(0, 8)} title="Revenue Distribution ($)" height={200} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
            {data.transactions.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).map(t => (
              <TransactionCard key={t.id} transaction={t} />
            ))}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'Users' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
          {data.users.sort((a, b) => b.listingsCount - a.listingsCount).map(u => (
            <UserCard key={u.id} user={u} />
          ))}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'Analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart data={categoryDonut} title="Listings by Category" />
            <BarChart data={revenueBar.slice(0, 8)} title="Revenue by Category ($)" height={200} />
            <RadarChart data={priceRadar} title="Avg Price by Category" />
          </div>
          <TrendLine
            trends={data.trends}
            title="12-Month Marketplace Trends"
            lines={[
              { key: 'newListings', color: '#3b82f6', label: 'New Listings' },
              { key: 'totalSales', color: '#22c55e', label: 'Sales' },
              { key: 'totalRevenue', color: '#f59e0b', label: 'Revenue' },
            ]}
          />
          <div style={{ marginTop: 16 }}>
            <HorizontalBar data={sellTimeBar} title="Avg Days to Sell by Category" />
          </div>
        </div>
      )}
    </div>
  );
}
