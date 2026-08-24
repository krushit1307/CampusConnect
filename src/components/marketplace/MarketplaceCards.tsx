/**
 * Campus Marketplace — Card Components
 *
 * StatCard, ListingCard, TransactionCard, UserCard,
 * InsightCard, OverviewStats.
 */

import React from 'react';
import {
  Listing, Transaction, UserProfile, MarketplaceInsight,
  MarketplaceSummary,
  CATEGORY_COLORS, CONDITION_COLORS, STATUS_COLORS, CATEGORY_ICONS,
  formatPrice, formatTimeAgo,
  ListingStatus, TransactionStatus,
} from './marketplaceTypes';

// ── Stat Card ──────────────────────────────────────────────────────────────

export const StatCard: React.FC<{
  label: string; value: string | number; icon?: string;
  color?: string; subtitle?: string;
}> = ({ label, value, icon, color = '#2563EB', subtitle }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    flex: '1 1 180px', minWidth: 160,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
    <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
    {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
  </div>
);

// ── Overview Stats ─────────────────────────────────────────────────────────

export const OverviewStats: React.FC<{ summary: MarketplaceSummary }> = ({ summary }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    <StatCard label="Total Listings" value={summary.totalListings} icon="📦" />
    <StatCard label="Active" value={summary.activeListings} icon="🟢" color="#22c55e" />
    <StatCard label="Sold" value={summary.soldListings} icon="✅" color="#6b7280" />
    <StatCard label="Revenue" value={`$${summary.totalRevenue}`} icon="💰" color="#22c55e" />
    <StatCard label="Avg Price" value={`$${summary.avgListingPrice}`} icon="💲" />
    <StatCard label="Avg Sell Time" value={`${summary.avgTimeToSell}d`} icon="⏱️" />
    <StatCard label="Active Sellers" value={summary.activeSellers} icon="👥" />
    <StatCard label="Repeat Buyers" value={`${summary.repeatBuyers}%`} icon="🔄" color="#8b5cf6" />
  </div>
);

// ── Status Badge ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: ListingStatus }> = ({ status }) => (
  <span style={{
    padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
    color: STATUS_COLORS[status], background: `${STATUS_COLORS[status]}15`,
    border: `1px solid ${STATUS_COLORS[status]}30`,
  }}>{status}</span>
);

const TxnStatusBadge: React.FC<{ status: TransactionStatus }> = ({ status }) => {
  const colors: Record<TransactionStatus, string> = { 'Pending': '#eab308', 'Completed': '#22c55e', 'Disputed': '#ef4444', 'Refunded': '#8b5cf6' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: colors[status], background: `${colors[status]}15` }}>{status}</span>
  );
};

// ── Listing Card ───────────────────────────────────────────────────────────

export const ListingCard: React.FC<{ listing: Listing }> = ({ listing }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 16,
    borderLeft: `4px solid ${CATEGORY_COLORS[listing.category]}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        {CATEGORY_ICONS[listing.category]} {listing.title}
      </div>
      <StatusBadge status={listing.status} />
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{listing.description}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 6 }}>
      <div>💲 <b style={{ color: listing.price === 0 ? '#22c55e' : '#111827' }}>{formatPrice(listing.price)}</b>
        {listing.originalPrice && <span style={{ textDecoration: 'line-through', color: '#9ca3af', marginLeft: 4 }}>${listing.originalPrice}</span>}
      </div>
      <div>📦 {listing.condition}</div>
      <div>📍 {listing.location}</div>
      <div>👤 {listing.sellerName}</div>
      <div>👁️ {listing.viewCount} views</div>
      <div>💾 {listing.saveCount} saves</div>
    </div>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
      {listing.tags.slice(0, 3).map(t => (
        <span key={t} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#f3f4f6', color: '#6b7280' }}>{t}</span>
      ))}
      {listing.isNegotiable && <span style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#eff6ff', color: '#3b82f6' }}>🤝 Negotiable</span>}
    </div>
    <div style={{ fontSize: 10, color: '#9ca3af' }}>
      📅 Posted {formatTimeAgo(listing.postedAt)} · {listing.inquiryCount} inquiries
    </div>
  </div>
);

// ── Transaction Card ───────────────────────────────────────────────────────

export const TransactionCard: React.FC<{ transaction: Transaction }> = ({ transaction }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 14,
    border: '1px solid #e5e7eb',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{transaction.listingTitle}</div>
      <TxnStatusBadge status={transaction.status} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, marginBottom: 4 }}>
      <div>💰 <b>{formatPrice(transaction.amount)}</b></div>
      <div>💳 {transaction.paymentMethod}</div>
      <div>🛒 Buyer: {transaction.buyerName}</div>
      <div>🏪 Seller: {transaction.sellerName}</div>
    </div>
    {transaction.rating && (
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>
        ⭐ {transaction.rating}/5
        {transaction.review && <span> — "{transaction.review}"</span>}
      </div>
    )}
    <div style={{ fontSize: 10, color: '#9ca3af' }}>
      {CATEGORY_ICONS[transaction.category]} {transaction.category} · {transaction.completedAt}
    </div>
  </div>
);

// ── User Card ──────────────────────────────────────────────────────────────

export const UserCard: React.FC<{ user: UserProfile }> = ({ user }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        👤 {user.name} {user.isVerified && <span style={{ color: '#3b82f6' }}>✓</span>}
      </div>
      <span style={{ fontSize: 11, color: '#f59e0b' }}>⭐ {user.rating}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
      <div>Listings: <b>{user.listingsCount}</b></div>
      <div>Purchases: <b>{user.purchasesCount}</b></div>
      <div>Earned: <b style={{ color: '#22c55e' }}>${user.totalEarnings}</b></div>
      <div>Spent: <b>${user.totalSpent}</b></div>
    </div>
  </div>
);

// ── Insight Card ───────────────────────────────────────────────────────────

export const InsightCard: React.FC<{ insight: MarketplaceInsight }> = ({ insight }) => {
  const colors = { positive: '#22c55e', warning: '#eab308', critical: '#ef4444', info: '#3b82f6' };
  const color = colors[insight.type];
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{insight.title}</div>
        <span style={{ fontSize: 12 }}>{insight.trend === 'up' ? '📈' : insight.trend === 'down' ? '📉' : '➡️'}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{insight.description}</div>
      <div style={{ fontSize: 11, color }}><b>{insight.metric}:</b> {insight.value}</div>
    </div>
  );
};
