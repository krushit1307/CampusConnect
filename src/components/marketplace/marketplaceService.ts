/**
 * Campus Marketplace — Service Layer
 *
 * Mock listings, transactions, users, trends, category stats, and insights.
 */

import {
  Listing, Transaction, UserProfile, MarketplaceTrend,
  CategoryStats, MarketplaceInsight, MarketplaceSummary,
  ListingCategory, ListingStatus, ConditionLevel, PaymentMethod,
  TransactionStatus,
} from './marketplaceTypes';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const round1 = (n: number) => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(36).substring(2, 10);

const FIRST = ['Aisha','Brent','Carmen','David','Elena','Faisal','Grace','Hiroshi','Ines','James','Kavita','Liam','Mei','Nadia','Oscar','Priya','Quinn','Ravi','Sofia','Tariq','Uma','Victor','Wendy','Xavier','Yuki','Zara'];
const LAST = ['Patel','Kim','Mueller','Santos','Nakamura','Okafor','Silva','Singh','Johansson','Tanaka','Chen','Rodriguez','Ali','Nguyen','Kowalski','Ibrahim','Kapoor','Olsen','Sato','Garcia','Das','Brown','Lee'];

// ── Listings ───────────────────────────────────────────────────────────────

function generateListings(): Listing[] {
  const listings: Omit<Listing, 'id'>[] = [
    { title: 'Introduction to Algorithms (CLRS) 4th Ed', description: 'Slight wear on cover, all pages intact. Used for CS201.', category: 'Textbooks', status: 'Active', condition: 'Good', price: 35, originalPrice: 89, currency: 'USD', sellerId: 'U1', sellerName: 'David Mueller', sellerRating: 4.8, images: [], tags: ['CS', 'algorithms', 'textbook'], location: 'Library Drop-off', isNegotiable: true, postedAt: '2026-08-20', expiresAt: '2026-09-20', viewCount: 45, saveCount: 12, inquiryCount: 5 },
    { title: 'MacBook Air M2 2024 — Like New', description: 'Barely used, 512GB SSD, 16GB RAM. Comes with charger and case.', category: 'Electronics', status: 'Active', condition: 'Like New', price: 850, originalPrice: 1299, currency: 'USD', sellerId: 'U2', sellerName: 'Elena Santos', sellerRating: 4.9, images: [], tags: ['laptop', 'macbook', 'apple'], location: 'Engineering Building', isNegotiable: false, postedAt: '2026-08-18', expiresAt: '2026-09-18', viewCount: 120, saveCount: 34, inquiryCount: 18 },
    { title: 'IKEA Desk + Chair Combo', description: 'White desk (120x60cm) + ergonomic chair. Moving out sale.', category: 'Furniture', status: 'Active', condition: 'Good', price: 120, currency: 'USD', sellerId: 'U3', sellerName: 'Grace Kim', sellerRating: 4.6, images: [], tags: ['desk', 'chair', 'IKEA'], location: 'Dorm B', isNegotiable: true, postedAt: '2026-08-22', expiresAt: '2026-09-22', viewCount: 67, saveCount: 18, inquiryCount: 8 },
    { title: 'Calculus Tutoring — $25/hr', description: 'Math major offering Calc I-III tutoring. Free first session.', category: 'Tutoring', status: 'Active', condition: 'New', price: 25, currency: 'USD', sellerId: 'U4', sellerName: 'Priya Patel', sellerRating: 4.9, images: [], tags: ['math', 'tutoring', 'calculus'], location: 'Online / Library', isNegotiable: false, postedAt: '2026-08-15', expiresAt: '2026-12-15', viewCount: 89, saveCount: 22, inquiryCount: 14 },
    { title: 'Vintage Denim Jacket', description: 'Size M, slightly oversized fit. Great condition.', category: 'Clothing', status: 'Active', condition: 'Good', price: 30, currency: 'USD', sellerId: 'U5', sellerName: 'Mei Nakamura', sellerRating: 4.5, images: [], tags: ['jacket', 'denim', 'vintage'], location: 'Student Center', isNegotiable: true, postedAt: '2026-08-21', expiresAt: '2026-09-21', viewCount: 34, saveCount: 8, inquiryCount: 3 },
    { title: 'Free Moving Boxes', description: '20 medium + 10 large boxes. Must pick up by Friday.', category: 'Free Items', status: 'Active', condition: 'Fair', price: 0, currency: 'USD', sellerId: 'U6', sellerName: 'Tariq Khan', sellerRating: 4.7, images: [], tags: ['free', 'boxes', 'moving'], location: 'Dorm A', isNegotiable: false, postedAt: '2026-08-23', expiresAt: '2026-08-26', viewCount: 56, saveCount: 15, inquiryCount: 12 },
    { title: 'Physics 101 Textbook Bundle', description: 'Halliday Resnick + Solutions Manual + Practice Problems.', category: 'Textbooks', status: 'Sold', condition: 'Good', price: 45, originalPrice: 120, currency: 'USD', sellerId: 'U7', sellerName: 'James Singh', sellerRating: 4.4, images: [], tags: ['physics', 'textbook', 'bundle'], location: 'Library Drop-off', isNegotiable: true, postedAt: '2026-08-01', expiresAt: '2026-09-01', viewCount: 78, saveCount: 20, inquiryCount: 9 },
    { title: 'Ride to Airport — Sep 5', description: 'Spare seat in my car going to JFK on Sep 5 at 2pm. $20.', category: 'Rideshare', status: 'Active', condition: 'New', price: 20, currency: 'USD', sellerId: 'U8', sellerName: 'Victor Singh', sellerRating: 4.3, images: [], tags: ['ride', 'airport', 'JFK'], location: 'Campus Parking', isNegotiable: false, postedAt: '2026-08-24', expiresAt: '2026-09-05', viewCount: 42, saveCount: 10, inquiryCount: 6 },
    { title: 'Concert Tickets — Campus Fest', description: '2 tickets for Campus Fest on Sep 20. Face value.', category: 'Event Tickets', status: 'Reserved', condition: 'New', price: 40, currency: 'USD', sellerId: 'U9', sellerName: 'Bella Rodriguez', sellerRating: 4.6, images: [], tags: ['concert', 'tickets', 'campus fest'], location: 'Student Center', isNegotiable: false, postedAt: '2026-08-19', expiresAt: '2026-09-20', viewCount: 95, saveCount: 28, inquiryCount: 15 },
    { title: 'Python for Data Science Book', description: 'Wes McKinney book, barely opened. Perfect for DS students.', category: 'Textbooks', status: 'Active', condition: 'Like New', price: 28, originalPrice: 65, currency: 'USD', sellerId: 'U10', sellerName: 'Nadia Chen', sellerRating: 4.8, images: [], tags: ['python', 'data science', 'textbook'], location: 'CS Building', isNegotiable: true, postedAt: '2026-08-20', expiresAt: '2026-09-20', viewCount: 52, saveCount: 14, inquiryCount: 7 },
    { title: 'Desk Lamp + Power Strip', description: 'LED desk lamp with 3 brightness levels + 6-outlet strip.', category: 'Electronics', status: 'Sold', condition: 'Good', price: 25, currency: 'USD', sellerId: 'U11', sellerName: 'Liam O\'Brien', sellerRating: 4.5, images: [], tags: ['lamp', 'power strip', 'desk'], location: 'Dorm C', isNegotiable: false, postedAt: '2026-08-10', expiresAt: '2026-09-10', viewCount: 38, saveCount: 9, inquiryCount: 4 },
    { title: 'Homemade Cookies — Dozen', description: 'Freshly baked chocolate chip cookies. $8/dozen.', category: 'Food & Drinks', status: 'Active', condition: 'New', price: 8, currency: 'USD', sellerId: 'U12', sellerName: 'Sofia Garcia', sellerRating: 5.0, images: [], tags: ['cookies', 'homemade', 'food'], location: 'Student Center', isNegotiable: false, postedAt: '2026-08-24', expiresAt: '2026-08-25', viewCount: 67, saveCount: 5, inquiryCount: 11 },
    { title: 'Tutoring: Organic Chemistry', description: 'Chem major offering OChem I & II tutoring. $30/hr.', category: 'Tutoring', status: 'Active', condition: 'New', price: 30, currency: 'USD', sellerId: 'U13', sellerName: 'Aisha Patel', sellerRating: 4.7, images: [], tags: ['chemistry', 'tutoring', 'organic'], location: 'Chem Lab / Online', isNegotiable: false, postedAt: '2026-08-17', expiresAt: '2026-12-17', viewCount: 41, saveCount: 11, inquiryCount: 6 },
    { title: 'Ergonomic Keyboard — Logitech MX', description: 'Wireless mechanical keyboard. Great for coding sessions.', category: 'Electronics', status: 'Active', condition: 'Like New', price: 95, originalPrice: 170, currency: 'USD', sellerId: 'U14', sellerName: 'Hiroshi Tanaka', sellerRating: 4.6, images: [], tags: ['keyboard', 'logitech', 'wireless'], location: 'CS Building', isNegotiable: true, postedAt: '2026-08-21', expiresAt: '2026-09-21', viewCount: 73, saveCount: 20, inquiryCount: 9 },
    { title: 'Vintage Vinyl Records — Lot of 15', description: 'Classic rock collection. Pink Floyd, Led Zeppelin, etc.', category: 'Clothing', status: 'Expired', condition: 'Fair', price: 60, currency: 'USD', sellerId: 'U15', sellerName: 'Quinn Davis', sellerRating: 4.2, images: [], tags: ['vinyl', 'records', 'music', 'vintage'], location: 'Dorm A', isNegotiable: true, postedAt: '2026-07-01', expiresAt: '2026-08-01', viewCount: 45, saveCount: 12, inquiryCount: 3 },
  ];
  return listings.map(l => ({ ...l, id: uid() }));
}

// ── Transactions ───────────────────────────────────────────────────────────

function generateTransactions(listings: Listing[]): Transaction[] {
  const txns: Transaction[] = [];
  const soldListings = listings.filter(l => l.status === 'Sold' || (l.status === 'Active' && Math.random() > 0.6));
  for (const listing of soldListings.slice(0, 15)) {
    const status: TransactionStatus = Math.random() > 0.9 ? 'Disputed' : Math.random() > 0.95 ? 'Refunded' : 'Completed';
    txns.push({
      id: uid(), listingId: listing.id, listingTitle: listing.title,
      category: listing.category,
      buyerId: `U${rand(1, 20)}`, buyerName: `${pick(FIRST)} ${pick(LAST)}`,
      sellerId: listing.sellerId, sellerName: listing.sellerName,
      amount: listing.price, paymentMethod: pick(['Cash', 'Venmo', 'Zelle', 'Campus Points'] as PaymentMethod[]),
      status, completedAt: `2026-08-${String(rand(1, 24)).padStart(2, '0')}`,
      rating: status === 'Completed' ? rand(3, 5) : undefined,
      review: status === 'Completed' && Math.random() > 0.5 ? pick(['Great seller!', 'Item as described', 'Fast response', 'Would buy again']) : undefined,
    });
  }
  return txns;
}

// ── User Profiles ──────────────────────────────────────────────────────────

function generateUsers(): UserProfile[] {
  return Array.from({ length: 15 }, () => ({
    id: uid(), name: `${pick(FIRST)} ${pick(LAST)}`,
    email: `${pick(FIRST).toLowerCase()}@campus.edu`,
    listingsCount: rand(1, 8), purchasesCount: rand(0, 5),
    rating: round1(4 + Math.random()),
    totalEarnings: rand(50, 800), totalSpent: rand(30, 400),
    joinDate: `2025-${String(rand(9, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
    isVerified: Math.random() > 0.3,
  }));
}

// ── Trends ─────────────────────────────────────────────────────────────────

function generateTrends(): MarketplaceTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let listings = 30, sales = 18, revenue = 1500, users = 40;
  return months.map((month) => {
    listings = Math.max(20, Math.min(50, listings + rand(-4, 6)));
    sales = Math.max(10, Math.min(35, sales + rand(-3, 4)));
    revenue = Math.max(800, Math.min(3000, revenue + rand(-200, 300)));
    users = Math.max(30, Math.min(60, users + rand(-3, 5)));
    return { month, newListings: listings, totalSales: sales, totalRevenue: revenue, avgPrice: Math.round(revenue / sales), activeUsers: users };
  });
}

// ── Category Stats ─────────────────────────────────────────────────────────

function generateCategoryStats(listings: Listing[]): CategoryStats[] {
  const cats: ListingCategory[] = ['Textbooks', 'Electronics', 'Furniture', 'Clothing', 'Services', 'Tutoring', 'Rideshare', 'Free Items', 'Event Tickets', 'Food & Drinks'];
  return cats.map(category => {
    const catListings = listings.filter(l => l.category === category);
    const sold = catListings.filter(l => l.status === 'Sold');
    return {
      category, listingsCount: catListings.length || rand(1, 5),
      soldCount: sold.length || rand(0, 3),
      avgPrice: Math.round(catListings.reduce((s, l) => s + l.price, 0) / Math.max(catListings.length, 1)) || rand(10, 100),
      totalRevenue: sold.reduce((s, l) => s + l.price, 0) || rand(50, 300),
      avgTimeToSell: rand(3, 14),
    };
  }).sort((a, b) => b.listingsCount - a.listingsCount);
}

// ── Insights ───────────────────────────────────────────────────────────────

function generateInsights(): MarketplaceInsight[] {
  return [
    { id: uid(), title: 'Textbooks most traded category', description: '35% of all listings are textbooks. Start of semester drives demand.', type: 'positive', metric: 'Share', value: '35%', trend: 'up' },
    { id: uid(), title: 'Electronics selling fastest', description: 'Electronics avg 5 days to sell vs 10 days for other categories.', type: 'positive', metric: 'Time to Sell', value: '5 days', trend: 'down' },
    { id: uid(), title: '3 listings expiring soon', description: 'Free Moving Boxes, Concert Tickets, and Cookies expire within 48h.', type: 'info', metric: 'Expiring', value: '3', trend: 'stable' },
    { id: uid(), title: 'Repeat buyer rate at 22%', description: '22% of buyers have made 2+ purchases. Loyalty program could boost retention.', type: 'warning', metric: 'Repeat Rate', value: '22%', trend: 'stable' },
    { id: uid(), title: 'Avg listing price $52', description: 'Down 8% from last month. End-of-semester sales driving prices down.', type: 'info', metric: 'Avg Price', value: '$52', trend: 'down' },
    { id: uid(), title: '1 dispute pending', description: 'MacBook listing dispute over charger compatibility. Needs resolution.', type: 'critical', metric: 'Disputes', value: '1', trend: 'stable' },
  ];
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export function getMarketplaceData() {
  const listings = generateListings();
  const transactions = generateTransactions(listings);
  const users = generateUsers();
  const trends = generateTrends();
  const categoryStats = generateCategoryStats(listings);
  const insights = generateInsights();

  const summary: MarketplaceSummary = {
    totalListings: listings.length,
    activeListings: listings.filter(l => l.status === 'Active').length,
    soldListings: listings.filter(l => l.status === 'Sold').length,
    totalTransactions: transactions.length,
    totalRevenue: transactions.filter(t => t.status === 'Completed').reduce((s, t) => s + t.amount, 0),
    avgListingPrice: Math.round(listings.reduce((s, l) => s + l.price, 0) / listings.length),
    avgTimeToSell: Math.round(categoryStats.reduce((s, c) => s + c.avgTimeToSell, 0) / categoryStats.length),
    topCategory: 'Textbooks' as ListingCategory,
    activeSellers: users.filter(u => u.listingsCount > 0).length,
    repeatBuyers: Math.round(users.filter(u => u.purchasesCount > 1).length / Math.max(users.filter(u => u.purchasesCount > 0).length, 1) * 100),
  };

  return { listings, transactions, users, trends, categoryStats, insights, summary };
}
