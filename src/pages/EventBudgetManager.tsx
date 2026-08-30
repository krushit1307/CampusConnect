import React, { useState, useMemo, useCallback } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, PieChart, BarChart3, Plus, Minus,
  CheckCircle2, XCircle, AlertTriangle, Clock, Calendar, Search, Filter,
  Download, Share2, Eye, EyeOff, ChevronDown, ChevronUp, ArrowUpRight,
  ArrowDownRight, CreditCard, Wallet, Receipt, FileText, Users, Target,
  Zap, Star, Bookmark, MoreHorizontal, Edit3, Trash2, Copy, Lock,
  Unlock, Settings, RefreshCw, Bell, Tag, Hash, Building2, MapPin,
  ShoppingCart, Package, Truck, Coffee, Music, Mic, Camera, Palette,
  PaintBucket, Lightbulb, Megaphone, Heart, Sparkles, Award, Trophy,
  Flame, Shield, CircleDot, Layers, Grid, List, ArrowRight, ExternalLink,
  Info, CalendarDays, Timer, Percent, Calculator, Coins, Banknote,
} from "lucide-react";

/* ─────────────── Types ─────────────── */

type BudgetStatus = "draft" | "active" | "under_review" | "approved" | "completed" | "cancelled";
type ExpenseCategory = "venue" | "catering" | "equipment" | "marketing" | "decoration" | "entertainment" | "transport" | "printing" | "merchandise" | "miscellaneous" | "speaker" | "security";
type PaymentMethod = "upi" | "card" | "bank_transfer" | "cash" | "petty_cash" | "sponsor";
type Priority = "critical" | "high" | "medium" | "low";
type ApprovalStage = "pending_club" | "pending_dept" | "pending_finance" | "approved" | "rejected";

interface BudgetEvent {
  id: string;
  name: string;
  description: string;
  organizer: string;
  club: string;
  department: string;
  date: string;
  endDate: string;
  venue: string;
  expectedAttendees: number;
  actualAttendees: number;
  totalBudget: number;
  totalSpent: number;
  totalCommitted: number;
  status: BudgetStatus;
  priority: Priority;
  approvalStage: ApprovalStage;
  approvedBy: string | null;
  fundingSources: FundingSource[];
  expenses: Expense[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isRecurring: boolean;
  recurrencePattern: string | null;
}

interface Expense {
  id: string;
  eventId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  vendor: string;
  paymentMethod: PaymentMethod;
  receiptUrl: string | null;
  approved: boolean;
  approvedBy: string | null;
  invoiceNumber: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  notes: string;
  recurring: boolean;
  priority: Priority;
  status: "pending" | "approved" | "paid" | "rejected" | "reimbursed";
}

interface FundingSource {
  id: string;
  name: string;
  type: "club_fund" | "department" | "sponsor" | "ticket_sales" | "donation" | "grant";
  amount: number;
  received: boolean;
  receivedDate: string | null;
  conditions: string;
}

interface Vendor {
  id: string;
  name: string;
  category: ExpenseCategory;
  rating: number;
  totalSpend: number;
  transactions: number;
  contactEmail: string;
  phone: string;
  lastInvoice: string;
  paymentTerms: string;
  reliability: number;
}

interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  categories: { category: ExpenseCategory; suggestedAmount: number; percentage: number }[];
  totalBudget: number;
  eventType: string;
  popular: boolean;
  uses: number;
}

interface MonthlySpend {
  month: string;
  budgeted: number;
  actual: number;
  savings: number;
}

/* ─────────────── Constants ─────────────── */

const CATEGORY_CONFIG: Record<ExpenseCategory, { icon: React.ReactNode; color: string; label: string }> = {
  venue: { icon: <Building2 size={14} />, color: "#3B82F6", label: "Venue" },
  catering: { icon: <Coffee size={14} />, color: "#10B981", label: "Catering" },
  equipment: { icon: <Package size={14} />, color: "#8B5CF6", label: "Equipment" },
  marketing: { icon: <Megaphone size={14} />, color: "#F59E0B", label: "Marketing" },
  decoration: { icon: <Palette size={14} />, color: "#EC4899", label: "Decoration" },
  entertainment: { icon: <Music size={14} />, color: "#06B6D4", label: "Entertainment" },
  transport: { icon: <Truck size={14} />, color: "#F97316", label: "Transport" },
  printing: { icon: <FileText size={14} />, color: "#6366F1", label: "Printing" },
  merchandise: { icon: <ShoppingCart size={14} />, color: "#14B8A6", label: "Merchandise" },
  miscellaneous: { icon: <MoreHorizontal size={14} />, color: "#6B7280", label: "Misc" },
  speaker: { icon: <Mic size={14} />, color: "#EF4444", label: "Speaker" },
  security: { icon: <Shield size={14} />, color: "#A855F7", label: "Security" },
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI", card: "Card", bank_transfer: "Bank Transfer", cash: "Cash",
  petty_cash: "Petty Cash", sponsor: "Sponsor",
};

const STATUS_CONFIG: Record<BudgetStatus, { color: string; bg: string; label: string }> = {
  draft: { color: "text-gray-400", bg: "bg-gray-500/20", label: "Draft" },
  active: { color: "text-green-400", bg: "bg-green-500/20", label: "Active" },
  under_review: { color: "text-yellow-400", bg: "bg-yellow-500/20", label: "Under Review" },
  approved: { color: "text-blue-400", bg: "bg-blue-500/20", label: "Approved" },
  completed: { color: "text-purple-400", bg: "bg-purple-500/20", label: "Completed" },
  cancelled: { color: "text-red-400", bg: "bg-red-500/20", label: "Cancelled" },
};

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/20" },
  high: { color: "text-orange-400", bg: "bg-orange-500/20" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/20" },
  low: { color: "text-gray-400", bg: "bg-gray-500/20" },
};

const APPROVAL_STAGES: { key: ApprovalStage; label: string; icon: React.ReactNode }[] = [
  { key: "pending_club", label: "Club Approval", icon: <Users size={14} /> },
  { key: "pending_dept", label: "Dept Approval", icon: <Building2 size={14} /> },
  { key: "pending_finance", label: "Finance Review", icon: <Calculator size={14} /> },
  { key: "approved", label: "Approved", icon: <CheckCircle2 size={14} /> },
  { key: "rejected", label: "Rejected", icon: <XCircle size={14} /> },
];

/* ─────────────── Sample Data ─────────────── */

const EVENTS: BudgetEvent[] = [
  {
    id: "e1", name: "Annual Tech Fest 'Innovision'", description: "3-day technology festival with hackathons, workshops, and keynote speakers",
    organizer: "Arjun Mehta", club: "Tech Club", department: "Computer Science",
    date: "2026-09-15", endDate: "2026-09-17", venue: "Main Auditorium + Open Air Theater",
    expectedAttendees: 1200, actualAttendees: 1085, totalBudget: 450000, totalSpent: 387500, totalCommitted: 32000,
    status: "active", priority: "critical", approvalStage: "approved", approvedBy: "Dr. Suresh Kumar (HOD CS)",
    fundingSources: [
      { id: "f1", name: "CS Department Fund", type: "department", amount: 200000, received: true, receivedDate: "2026-08-20", conditions: "Must include academic workshops" },
      { id: "f2", name: "Sponsor: TechCorp", type: "sponsor", amount: 150000, received: true, receivedDate: "2026-09-01", conditions: "Logo on all materials, booth space" },
      { id: "f3", name: "Ticket Sales", type: "ticket_sales", amount: 100000, received: false, receivedDate: null, conditions: "Expected from 1000+ registrations" },
    ],
    expenses: [
      { id: "x1", eventId: "e1", description: "Main Auditorium Rental (3 days)", category: "venue", amount: 75000, date: "2026-09-15", vendor: "University Events Dept", paymentMethod: "bank_transfer", receiptUrl: null, approved: true, approvedBy: "Dr. Suresh Kumar", invoiceNumber: "AUD-2026-451", quantity: 3, unitPrice: 25000, tax: 0, notes: "Includes sound system", recurring: false, priority: "critical", status: "paid" },
      { id: "x2", eventId: "e1", description: "Sound & Light Equipment Rental", category: "equipment", amount: 45000, date: "2026-09-14", vendor: "AV Pro Rentals", paymentMethod: "upi", receiptUrl: null, approved: true, approvedBy: "Arjun Mehta", invoiceNumber: "AVP-7823", quantity: 1, unitPrice: 45000, tax: 0, notes: "Professional PA system + stage lights", recurring: false, priority: "high", status: "paid" },
      { id: "x3", eventId: "e1", description: "Catering — Day 1 (Lunch + Snacks)", category: "catering", amount: 52000, date: "2026-09-15", vendor: "Campus Café", paymentMethod: "card", receiptUrl: null, approved: true, approvedBy: "Priya Nair", invoiceNumber: "CC-1190", quantity: 1, unitPrice: 52000, tax: 0, notes: "Veg + Non-veg options, 400 pax", recurring: false, priority: "high", status: "paid" },
      { id: "x4", eventId: "e1", description: "Catering — Day 2 (Lunch + Snacks)", category: "catering", amount: 52000, date: "2026-09-16", vendor: "Campus Café", paymentMethod: "card", receiptUrl: null, approved: true, approvedBy: "Priya Nair", invoiceNumber: "CC-1191", quantity: 1, unitPrice: 52000, tax: 0, notes: "Same menu as Day 1", recurring: false, priority: "high", status: "approved" },
      { id: "x5", eventId: "e1", description: "Keynote Speaker Travel + Stay", category: "speaker", amount: 38000, date: "2026-09-13", vendor: "MakeMyTrip", paymentMethod: "card", receiptUrl: null, approved: true, approvedBy: "Dr. Suresh Kumar", invoiceNumber: "MMT-9984", quantity: 2, unitPrice: 19000, tax: 0, notes: "Flight + Hotel for 2 speakers", recurring: false, priority: "critical", status: "paid" },
      { id: "x6", eventId: "e1", description: "Social Media Campaign (Instagram + LinkedIn)", category: "marketing", amount: 15000, date: "2026-09-01", vendor: "Digital Boost Agency", paymentMethod: "upi", receiptUrl: null, approved: true, approvedBy: "Arjun Mehta", invoiceNumber: "DB-334", quantity: 1, unitPrice: 15000, tax: 0, notes: "2-week campaign, reach 50K+", recurring: false, priority: "medium", status: "paid" },
      { id: "x7", eventId: "e1", description: "Flex Banners + Standees (20 units)", category: "printing", amount: 12000, date: "2026-09-10", vendor: "PrintHub", paymentMethod: "cash", receiptUrl: null, approved: true, approvedBy: "Arjun Mehta", invoiceNumber: "PH-556", quantity: 20, unitPrice: 600, tax: 0, notes: "3x2ft standees + 10x3ft flex", recurring: false, priority: "medium", status: "paid" },
      { id: "x8", eventId: "e1", description: "Stage Decoration & Props", category: "decoration", amount: 22000, date: "2026-09-14", vendor: "EventCraft", paymentMethod: "bank_transfer", receiptUrl: null, approved: true, approvedBy: "Priya Nair", invoiceNumber: "EC-891", quantity: 1, unitPrice: 22000, tax: 0, notes: "Tech-themed backdrop + LED strips", recurring: false, priority: "medium", status: "paid" },
      { id: "x9", eventId: "e1", description: "Security Personnel (3 days)", category: "security", amount: 18000, date: "2026-09-15", vendor: "SafeGuard Services", paymentMethod: "bank_transfer", receiptUrl: null, approved: true, approvedBy: "Dr. Suresh Kumar", invoiceNumber: "SG-223", quantity: 6, unitPrice: 3000, tax: 0, notes: "6 guards, 12-hr shifts", recurring: false, priority: "high", status: "paid" },
      { id: "x10", eventId: "e1", description: "Transport — Volunteer Shuttle", category: "transport", amount: 8500, date: "2026-09-15", vendor: "Campus Transport", paymentMethod: "petty_cash", receiptUrl: null, approved: true, approvedBy: "Arjun Mehta", invoiceNumber: "CT-009", quantity: 3, unitPrice: 2833, tax: 0, notes: "3 days × mini-bus", recurring: false, priority: "low", status: "paid" },
      { id: "x11", eventId: "e1", description: "T-Shirts for Volunteers (80 units)", category: "merchandise", amount: 16000, date: "2026-09-08", vendor: "TeeFactory", paymentMethod: "upi", receiptUrl: null, approved: true, approvedBy: "Priya Nair", invoiceNumber: "TF-445", quantity: 80, unitPrice: 200, tax: 0, notes: "Custom printed, innovision branding", recurring: false, priority: "low", status: "paid" },
      { id: "x12", eventId: "e1", description: "Photography + Videography Team", category: "entertainment", amount: 25000, date: "2026-09-15", vendor: "SnapStudio", paymentMethod: "card", receiptUrl: null, approved: true, approvedBy: "Arjun Mehta", invoiceNumber: "SS-678", quantity: 1, unitPrice: 25000, tax: 0, notes: "3-day coverage, edited album + highlight reel", recurring: false, priority: "medium", status: "approved" },
    ],
    tags: ["tech", "hackathon", "annual", "large-scale"],
    createdAt: "2026-07-15", updatedAt: "2026-09-14", isRecurring: true, recurrencePattern: "Annual (September)",
  },
  {
    id: "e2", name: "Cultural Night 'Rangmanch'", description: "Evening of music, dance, drama, and poetry performances",
    organizer: "Sneha Gupta", club: "Cultural Club", department: "Student Affairs",
    date: "2026-10-05", endDate: "2026-10-05", venue: "Open Air Theater",
    expectedAttendees: 600, actualAttendees: 0, totalBudget: 120000, totalSpent: 45000, totalCommitted: 35000,
    status: "active", priority: "high", approvalStage: "approved", approvedBy: "Prof. Meena Desai",
    fundingSources: [
      { id: "f4", name: "Student Affairs Fund", type: "department", amount: 80000, received: true, receivedDate: "2026-09-20", conditions: "Must be open to all students" },
      { id: "f5", name: "Sponsor: Radio City", type: "sponsor", amount: 40000, received: false, receivedDate: null, conditions: "Branding + MC slots" },
    ],
    expenses: [
      { id: "x13", eventId: "e2", description: "OAT Setup & Seating", category: "venue", amount: 15000, date: "2026-10-04", vendor: "University Events", paymentMethod: "bank_transfer", receiptUrl: null, approved: true, approvedBy: "Prof. Meena Desai", invoiceNumber: "UOV-112", quantity: 1, unitPrice: 15000, tax: 0, notes: "500 chairs + stage prep", recurring: false, priority: "high", status: "paid" },
      { id: "x14", eventId: "e2", description: "Cultural Performer Fees", category: "entertainment", amount: 20000, date: "2026-10-05", vendor: "Various Artists", paymentMethod: "upi", receiptUrl: null, approved: true, approvedBy: "Sneha Gupta", invoiceNumber: "ART-001", quantity: 10, unitPrice: 2000, tax: 0, notes: "10 performers × ₹2000", recurring: false, priority: "critical", status: "paid" },
      { id: "x15", eventId: "e2", description: "Refreshments", category: "catering", amount: 10000, date: "2026-10-05", vendor: "Campus Café", paymentMethod: "card", receiptUrl: null, approved: true, approvedBy: "Sneha Gupta", invoiceNumber: "CC-1205", quantity: 1, unitPrice: 10000, tax: 0, notes: "Snacks + chai for 600", recurring: false, priority: "medium", status: "approved" },
    ],
    tags: ["cultural", "music", "dance", "annual"],
    createdAt: "2026-08-10", updatedAt: "2026-09-25", isRecurring: true, recurrencePattern: "Annual (October)",
  },
  {
    id: "e3", name: "Guest Lecture: AI in Healthcare", description: "Guest lecture by Dr. Priya from AIIMS on AI applications in healthcare",
    organizer: "Vikram Singh", club: "AI Club", department: "Computer Science",
    date: "2026-09-20", endDate: "2026-09-20", venue: "Seminar Hall B",
    expectedAttendees: 150, actualAttendees: 142, totalBudget: 25000, totalSpent: 18500, totalCommitted: 0,
    status: "completed", priority: "medium", approvalStage: "approved", approvedBy: "Dr. Suresh Kumar",
    fundingSources: [
      { id: "f6", name: "CS Department Small Events", type: "department", amount: 15000, received: true, receivedDate: "2026-09-10", conditions: "Academic event only" },
      { id: "f7", name: "Registration Fees", type: "ticket_sales", amount: 10000, received: true, receivedDate: "2026-09-20", conditions: "₹100 × 100 students" },
    ],
    expenses: [
      { id: "x16", eventId: "e3", description: "Speaker Honorarium", category: "speaker", amount: 10000, date: "2026-09-20", vendor: "Dr. Priya AIIMS", paymentMethod: "bank_transfer", receiptUrl: null, approved: true, approvedBy: "Dr. Suresh Kumar", invoiceNumber: "SPK-044", quantity: 1, unitPrice: 10000, tax: 0, notes: "1-hour lecture + Q&A", recurring: false, priority: "critical", status: "paid" },
      { id: "x17", eventId: "e3", description: "Speaker Travel reimbursement", category: "transport", amount: 3500, date: "2026-09-20", vendor: "Uber/Ola", paymentMethod: "upi", receiptUrl: null, approved: true, approvedBy: "Vikram Singh", invoiceNumber: "UB-223", quantity: 2, unitPrice: 1750, tax: 0, notes: "Airport pickup + drop", recurring: false, priority: "medium", status: "paid" },
      { id: "x18", eventId: "e3", description: "Printed Handouts + Certificates", category: "printing", amount: 2000, date: "2026-09-19", vendor: "Campus Xerox", paymentMethod: "cash", receiptUrl: null, approved: true, approvedBy: "Vikram Singh", invoiceNumber: "CX-881", quantity: 150, unitPrice: 13, tax: 0, notes: "150 handouts + 150 certs", recurring: false, priority: "low", status: "paid" },
      { id: "x19", eventId: "e3", description: "Light Refreshments", category: "catering", amount: 3000, date: "2026-09-20", vendor: "Campus Café", paymentMethod: "petty_cash", receiptUrl: null, approved: true, approvedBy: "Vikram Singh", invoiceNumber: "CC-1180", quantity: 1, unitPrice: 3000, tax: 0, notes: "Tea + cookies for 150", recurring: false, priority: "medium", status: "paid" },
    ],
    tags: ["guest-lecture", "AI", "healthcare", "academic"],
    createdAt: "2026-09-01", updatedAt: "2026-09-20", isRecurring: false, recurrencePattern: null,
  },
  {
    id: "e4", name: "Freshers' Welcome Party", description: "Welcome party for incoming first-year students with DJ, games, and food",
    organizer: "Rahul Verma", club: "Student Council", department: "Student Affairs",
    date: "2026-08-25", endDate: "2026-08-25", venue: "College Lawn",
    expectedAttendees: 400, actualAttendees: 380, totalBudget: 80000, totalSpent: 72000, totalCommitted: 0,
    status: "completed", priority: "high", approvalStage: "approved", approvedBy: "Dean Student Affairs",
    fundingSources: [
      { id: "f8", name: "Student Council Fund", type: "club_fund", amount: 50000, received: true, receivedDate: "2026-08-10", conditions: "Annual party budget" },
      { id: "f9", name: "Entry Tickets", type: "ticket_sales", amount: 30000, received: true, receivedDate: "2026-08-25", conditions: "₹100 × 300 tickets" },
    ],
    expenses: [
      { id: "x20", eventId: "e4", description: "DJ + Sound System", category: "entertainment", amount: 25000, date: "2026-08-25", vendor: "BeatBox DJ Services", paymentMethod: "upi", receiptUrl: null, approved: true, approvedBy: "Rahul Verma", invoiceNumber: "BB-441", quantity: 1, unitPrice: 25000, tax: 0, notes: "6-hour DJ set + speakers", recurring: false, priority: "critical", status: "paid" },
      { id: "x21", eventId: "e4", description: "Food Stalls Setup", category: "catering", amount: 30000, date: "2026-08-25", vendor: "FoodieHub Stalls", paymentMethod: "cash", receiptUrl: null, approved: true, approvedBy: "Rahul Verma", invoiceNumber: "FH-112", quantity: 5, unitPrice: 6000, tax: 0, notes: "5 food stalls — chaat, grill, momos, drinks, dessert", recurring: false, priority: "high", status: "paid" },
      { id: "x22", eventId: "e4", description: "Decoration — Balloons, Fairy Lights", category: "decoration", amount: 8000, date: "2026-08-24", vendor: "PartyNation", paymentMethod: "card", receiptUrl: null, approved: true, approvedBy: "Rahul Verma", invoiceNumber: "PN-567", quantity: 1, unitPrice: 8000, tax: 0, notes: "Lawn decoration theme: Neon Night", recurring: false, priority: "medium", status: "paid" },
      { id: "x23", eventId: "e4", description: "Photography Team", category: "entertainment", amount: 5000, date: "2026-08-25", vendor: "CampusSnaps", paymentMethod: "upi", receiptUrl: null, approved: true, approvedBy: "Rahul Verma", invoiceNumber: "CS-88", quantity: 1, unitPrice: 5000, tax: 0, notes: "2 photographers, 4 hours", recurring: false, priority: "low", status: "paid" },
      { id: "x24", eventId: "e4", description: "Prizes for Games", category: "miscellaneous", amount: 4000, date: "2026-08-25", vendor: "Amazon", paymentMethod: "card", receiptUrl: null, approved: true, approvedBy: "Rahul Verma", invoiceNumber: "AZ-9012", quantity: 10, unitPrice: 400, tax: 0, notes: "10 prizes — powerbanks, headphones, mugs", recurring: false, priority: "low", status: "paid" },
    ],
    tags: ["party", "freshers", "social", "annual"],
    createdAt: "2026-07-20", updatedAt: "2026-08-25", isRecurring: true, recurrencePattern: "Annual (August)",
  },
  {
    id: "e5", name: "Hackathon 'CodeStorm 4.0'", description: "24-hour coding hackathon with industry mentors and prizes",
    organizer: "Ankit Patel", club: "Tech Club", department: "Computer Science",
    date: "2026-10-20", endDate: "2026-10-21", venue: "CS Lab Block + Seminar Hall",
    expectedAttendees: 200, actualAttendees: 0, totalBudget: 180000, totalSpent: 25000, totalCommitted: 45000,
    status: "active", priority: "high", approvalStage: "pending_finance", approvedBy: null,
    fundingSources: [
      { id: "f10", name: "CS Department Innovation Fund", type: "grant", amount: 100000, received: false, receivedDate: null, conditions: "Must have industry mentors" },
      { id: "f11", name: "Sponsor: CodeLab Inc", type: "sponsor", amount: 50000, received: true, receivedDate: "2026-10-01", conditions: "Logo + mentor booth + hiring rights" },
      { id: "f12", name: "Registration", type: "ticket_sales", amount: 30000, received: false, receivedDate: null, conditions: "₹200 × 150 teams" },
    ],
    expenses: [
      { id: "x25", eventId: "e5", description: "Prize Pool", category: "miscellaneous", amount: 60000, date: "2026-10-21", vendor: "Cash Prizes", paymentMethod: "bank_transfer", receiptUrl: null, approved: true, approvedBy: "Dr. Suresh Kumar", invoiceNumber: "PRZ-001", quantity: 3, unitPrice: 20000, tax: 0, notes: "1st: ₹20K, 2nd: ₹15K, 3rd: ₹10K + 5K special", recurring: false, priority: "critical", status: "pending" },
      { id: "x26", eventId: "e5", description: "Meals — Dinner + Breakfast + Lunch (24hr)", category: "catering", amount: 35000, date: "2026-10-20", vendor: "Campus Café (bulk)", paymentMethod: "card", receiptUrl: null, approved: true, approvedBy: "Ankit Patel", invoiceNumber: "CC-1250", quantity: 1, unitPrice: 35000, tax: 0, notes: "200 participants × 3 meals", recurring: false, priority: "high", status: "pending" },
      { id: "x27", eventId: "e5", description: "Swag Bags (T-shirts + Stickers + Notebooks)", category: "merchandise", amount: 20000, date: "2026-10-15", vendor: "SwagStudio", paymentMethod: "upi", receiptUrl: null, approved: false, approvedBy: null, invoiceNumber: "SW-221", quantity: 200, unitPrice: 100, tax: 0, notes: "Custom branded swag for all participants", recurring: false, priority: "medium", status: "pending" },
    ],
    tags: ["hackathon", "coding", "24-hour", "annual"],
    createdAt: "2026-09-01", updatedAt: "2026-10-10", isRecurring: true, recurrencePattern: "Annual (October)",
  },
];

const VENDORS: Vendor[] = [
  { id: "v1", name: "Campus Café", category: "catering", rating: 4.5, totalSpend: 95000, transactions: 12, contactEmail: "cafe@campus.edu", phone: "+91 98765 43210", lastInvoice: "2026-09-20", paymentTerms: "Net 7 days", reliability: 95 },
  { id: "v2", name: "AV Pro Rentals", category: "equipment", rating: 4.2, totalSpend: 45000, transactions: 3, contactEmail: "info@avpro.com", phone: "+91 87654 32109", lastInvoice: "2026-09-14", paymentTerms: "Advance 50%", reliability: 88 },
  { id: "v3", name: "PrintHub", category: "printing", rating: 4.0, totalSpend: 12000, transactions: 5, contactEmail: "orders@printhub.in", phone: "+91 76543 21098", lastInvoice: "2026-09-10", paymentTerms: "Cash on delivery", reliability: 90 },
  { id: "v4", name: "EventCraft", category: "decoration", rating: 4.3, totalSpend: 22000, transactions: 2, contactEmail: "hello@eventcraft.co", phone: "+91 65432 10987", lastInvoice: "2026-09-14", paymentTerms: "Net 15 days", reliability: 85 },
  { id: "v5", name: "SafeGuard Services", category: "security", rating: 4.1, totalSpend: 18000, transactions: 3, contactEmail: "ops@safeguard.in", phone: "+91 54321 09876", lastInvoice: "2026-09-15", paymentTerms: "Net 30 days", reliability: 92 },
  { id: "v6", name: "Digital Boost Agency", category: "marketing", rating: 4.6, totalSpend: 15000, transactions: 1, contactEmail: "team@digitalboost.in", phone: "+91 43210 98765", lastInvoice: "2026-09-01", paymentTerms: "Advance 100%", reliability: 97 },
];

const TEMPLATES: BudgetTemplate[] = [
  { id: "t1", name: "Tech Conference", description: "3-day tech fest with hackathons, workshops, and talks", totalBudget: 450000, eventType: "conference",
    categories: [{ category: "venue", suggestedAmount: 75000, percentage: 17 }, { category: "catering", suggestedAmount: 104000, percentage: 23 }, { category: "equipment", suggestedAmount: 45000, percentage: 10 }, { category: "speaker", suggestedAmount: 38000, percentage: 8 }, { category: "marketing", suggestedAmount: 30000, percentage: 7 }, { category: "decoration", suggestedAmount: 22000, percentage: 5 }, { category: "security", suggestedAmount: 18000, percentage: 4 }, { category: "printing", suggestedAmount: 12000, percentage: 3 }, { category: "transport", suggestedAmount: 8500, percentage: 2 }, { category: "merchandise", suggestedAmount: 16000, percentage: 4 }, { category: "entertainment", suggestedAmount: 25000, percentage: 6 }, { category: "miscellaneous", suggestedAmount: 56500, percentage: 11 }],
    popular: true, uses: 24 },
  { id: "t2", name: "Guest Lecture", description: "Single-session academic lecture with speaker", totalBudget: 25000, eventType: "lecture",
    categories: [{ category: "speaker", suggestedAmount: 10000, percentage: 40 }, { category: "transport", suggestedAmount: 3500, percentage: 14 }, { category: "catering", suggestedAmount: 3000, percentage: 12 }, { category: "printing", suggestedAmount: 2000, percentage: 8 }, { category: "miscellaneous", suggestedAmount: 6500, percentage: 26 }],
    popular: true, uses: 45 },
  { id: "t3", name: "Cultural Night", description: "Evening of performances with music, dance, and drama", totalBudget: 120000, eventType: "cultural",
    categories: [{ category: "entertainment", suggestedAmount: 40000, percentage: 33 }, { category: "venue", suggestedAmount: 15000, percentage: 13 }, { category: "catering", suggestedAmount: 20000, percentage: 17 }, { category: "decoration", suggestedAmount: 15000, percentage: 13 }, { category: "marketing", suggestedAmount: 10000, percentage: 8 }, { category: "miscellaneous", suggestedAmount: 20000, percentage: 16 }],
    popular: true, uses: 18 },
  { id: "t4", name: "Hackathon", description: "24-hour coding event with mentors and prizes", totalBudget: 180000, eventType: "hackathon",
    categories: [{ category: "miscellaneous", suggestedAmount: 60000, percentage: 33 }, { category: "catering", suggestedAmount: 35000, percentage: 19 }, { category: "merchandise", suggestedAmount: 20000, percentage: 11 }, { category: "equipment", suggestedAmount: 25000, percentage: 14 }, { category: "marketing", suggestedAmount: 15000, percentage: 8 }, { category: "miscellaneous", suggestedAmount: 25000, percentage: 14 }],
    popular: false, uses: 8 },
  { id: "t5", name: "Workshop", description: "Half-day hands-on workshop with materials", totalBudget: 30000, eventType: "workshop",
    categories: [{ category: "speaker", suggestedAmount: 8000, percentage: 27 }, { category: "catering", suggestedAmount: 5000, percentage: 17 }, { category: "printing", suggestedAmount: 3000, percentage: 10 }, { category: "equipment", suggestedAmount: 5000, percentage: 17 }, { category: "merchandise", suggestedAmount: 4000, percentage: 13 }, { category: "miscellaneous", suggestedAmount: 5000, percentage: 17 }],
    popular: false, uses: 32 },
];

const MONTHLY_SPEND: MonthlySpend[] = [
  { month: "Jun", budgeted: 80000, actual: 72000, savings: 8000 },
  { month: "Jul", budgeted: 60000, actual: 58000, savings: 2000 },
  { month: "Aug", budgeted: 200000, actual: 185000, savings: 15000 },
  { month: "Sep", budgeted: 450000, actual: 387500, savings: 62500 },
  { month: "Oct", budgeted: 300000, actual: 25000, savings: 275000 },
  { month: "Nov", budgeted: 100000, actual: 0, savings: 100000 },
];

/* ─────────────── Utilities ─────────────── */

const fmt = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
};
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
const pctOf = (n: number, total: number) => `${pct(n, total)}%`;

/* ─────────────── Sub-Components ─────────────── */

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; color?: string; trend?: string; trendUp?: boolean }> = ({ icon, label, value, sub, color = "text-white", trend, trendUp }) => (
  <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
    <div className="flex items-center gap-2 mb-2">
      <span className={color}>{icon}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    {trend && <div className={`text-xs mt-1 flex items-center gap-1 ${trendUp ? "text-green-400" : "text-red-400"}`}>{trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{trend}</div>}
  </div>
);

const ProgressBar: React.FC<{ value: number; max: number; color?: string; height?: string; showLabel?: boolean }> = ({ value, max, color = "bg-cyan-400", height = "h-2", showLabel = true }) => {
  const p = pct(value, max);
  const barColor = p > 90 ? "bg-red-500" : p > 70 ? "bg-yellow-500" : color;
  return (
    <div>
      {showLabel && <div className="flex items-center justify-between text-xs mb-1"><span className="text-gray-400">{fmt(value)} of {fmt(max)}</span><span className="text-gray-500">{p}%</span></div>}
      <div className={`w-full bg-white/10 rounded-full ${height} overflow-hidden`}>
        <div className={`${barColor} ${height} rounded-full transition-all`} style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
    </div>
  );
};

const EventCard: React.FC<{ event: BudgetEvent; selected: boolean; onSelect: () => void }> = ({ event, selected, onSelect }) => {
  const budgetUsed = pct(event.totalSpent, event.totalBudget);
  const statusCfg = STATUS_CONFIG[event.status];
  const priorityCfg = PRIORITY_CONFIG[event.priority];
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl p-4 border transition-all ${
        selected ? "border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10" : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-white text-sm truncate">{event.name}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityCfg.bg} ${priorityCfg.color}`}>{event.priority}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
        </div>
      </div>
      <div className="text-xs text-gray-400 mb-3 flex items-center gap-3">
        <span className="flex items-center gap-1"><Calendar size={10} />{event.date}</span>
        <span className="flex items-center gap-1"><Users size={10} />{event.expectedAttendees}</span>
        <span className="flex items-center gap-1"><MapPin size={10} />{event.venue.split(" ")[0]}</span>
      </div>
      <ProgressBar value={event.totalSpent} max={event.totalBudget} color="bg-cyan-400" />
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>Spent: <span className="text-white">{fmt(event.totalSpent)}</span></span>
        <span>Remaining: <span className={event.totalBudget - event.totalSpent > 0 ? "text-green-400" : "text-red-400"}>{fmt(event.totalBudget - event.totalSpent)}</span></span>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {event.tags.slice(0, 3).map((t) => <span key={t} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full text-gray-500">#{t}</span>)}
      </div>
    </div>
  );
};

const ExpenseRow: React.FC<{ expense: Expense; expanded: boolean; onToggle: () => void }> = ({ expense, expanded, onToggle }) => {
  const catCfg = CATEGORY_CONFIG[expense.category];
  const prioCfg = PRIORITY_CONFIG[expense.priority];
  return (
    <div className="border border-white/5 rounded-lg overflow-hidden hover:border-white/15 transition-all">
      <div onClick={onToggle} className="flex items-center gap-3 p-3 cursor-pointer">
        <span style={{ color: catCfg.color }}>{catCfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">{expense.description}</div>
          <div className="text-[10px] text-gray-500">{expense.vendor} · {expense.date} · {expense.invoiceNumber}</div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${prioCfg.bg} ${prioCfg.color}`}>{expense.priority}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
          expense.status === "paid" ? "bg-green-500/20 text-green-400" :
          expense.status === "approved" ? "bg-blue-500/20 text-blue-400" :
          expense.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
          "bg-red-500/20 text-red-400"
        }`}>{expense.status}</span>
        <span className="text-sm font-mono text-white w-20 text-right">{fmt(expense.amount)}</span>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </div>
      {expanded && (
        <div className="px-3 pb-3 bg-white/[0.02] border-t border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 text-xs">
            <div><span className="text-gray-500 block">Category</span><span className="text-white capitalize">{catCfg.label}</span></div>
            <div><span className="text-gray-500 block">Quantity</span><span className="text-white">{expense.quantity} × {fmt(expense.unitPrice)}</span></div>
            <div><span className="text-gray-500 block">Payment</span><span className="text-white">{PAYMENT_LABELS[expense.paymentMethod]}</span></div>
            <div><span className="text-gray-500 block">Tax</span><span className="text-white">{expense.tax > 0 ? fmt(expense.tax) : "—"}</span></div>
            <div className="col-span-2"><span className="text-gray-500 block">Notes</span><span className="text-gray-300">{expense.notes}</span></div>
            {expense.approvedBy && <div><span className="text-gray-500 block">Approved By</span><span className="text-white">{expense.approvedBy}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
};

const FundingSourceCard: React.FC<{ source: FundingSource }> = ({ source }) => (
  <div className={`rounded-lg p-3 border transition-all ${source.received ? "border-green-400/30 bg-green-500/5" : "border-white/10 bg-white/5"}`}>
    <div className="flex items-center justify-between mb-1">
      <span className="text-sm text-white font-medium">{source.name}</span>
      <span className="text-sm font-bold text-cyan-400">{fmt(source.amount)}</span>
    </div>
    <div className="flex items-center gap-2 text-[10px] text-gray-500">
      <span className="capitalize">{source.type.replace("_", " ")}</span>
      <span>·</span>
      <span className={source.received ? "text-green-400" : "text-yellow-400"}>{source.received ? "✓ Received" : "⏳ Pending"}</span>
      {source.receivedDate && <><span>·</span><span>{source.receivedDate}</span></>}
    </div>
    {source.conditions && <div className="text-[10px] text-gray-500 mt-1 italic">"{source.conditions}"</div>}
  </div>
);

const TemplateCard: React.FC<{ template: BudgetTemplate; onSelect: () => void }> = ({ template, onSelect }) => (
  <div onClick={onSelect} className="cursor-pointer rounded-xl p-4 border border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all">
    <div className="flex items-center justify-between mb-2">
      <span className="font-semibold text-white text-sm">{template.name}</span>
      {template.popular && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={8} />Popular</span>}
    </div>
    <p className="text-xs text-gray-400 mb-2">{template.description}</p>
    <div className="flex items-center justify-between text-xs">
      <span className="text-cyan-400 font-bold">{fmt(template.totalBudget)}</span>
      <span className="text-gray-500">{template.uses} uses</span>
    </div>
    <div className="mt-2 flex flex-wrap gap-1">
      {template.categories.slice(0, 5).map((c) => (
        <span key={c.category} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full text-gray-400">
          {CATEGORY_CONFIG[c.category].label} {c.percentage}%
        </span>
      ))}
      {template.categories.length > 5 && <span className="text-[9px] text-gray-500">+{template.categories.length - 5}</span>}
    </div>
  </div>
);

const VendorRow: React.FC<{ vendor: Vendor }> = ({ vendor }) => {
  const catCfg = CATEGORY_CONFIG[vendor.category];
  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-all">
      <span style={{ color: catCfg.color }}>{catCfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium">{vendor.name}</div>
        <div className="text-[10px] text-gray-500">{catCfg.label} · {vendor.transactions} transactions</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-white font-bold">{fmt(vendor.totalSpend)}</div>
        <div className="flex items-center gap-1 text-[10px]"><Star size={8} className="text-yellow-400 fill-yellow-400" /><span className="text-gray-400">{vendor.rating}</span></div>
      </div>
      <div className="w-16">
        <div className="text-[10px] text-gray-500 mb-0.5">Reliability</div>
        <div className="w-full bg-white/10 rounded-full h-1.5"><div className={`${vendor.reliability > 90 ? "bg-green-400" : vendor.reliability > 80 ? "bg-yellow-400" : "bg-red-400"} h-1.5 rounded-full`} style={{ width: `${vendor.reliability}%` }} /></div>
      </div>
    </div>
  );
};

const ApprovalPipeline: React.FC<{ stage: ApprovalStage }> = ({ stage }) => {
  const currentIdx = APPROVAL_STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="flex items-center gap-1">
      {APPROVAL_STAGES.filter((s) => s.key !== "rejected").map((s, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = s.key === stage;
        const isRejected = stage === "rejected";
        return (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${
              isRejected ? "bg-red-500/20 text-red-400" :
              isCompleted ? "bg-green-500/20 text-green-400" :
              isCurrent ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-gray-500"
            }`}>
              {isCompleted ? <CheckCircle2 size={10} /> : s.icon}
              <span>{s.label}</span>
            </div>
            {i < APPROVAL_STAGES.length - 2 && <ArrowRight size={10} className="text-gray-600" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ─────────────── Main Component ─────────────── */

export default function EventBudgetManager() {
  const [activeTab, setActiveTab] = useState<"events" | "expenses" | "funding" | "vendors" | "templates" | "analytics">("events");
  const [selectedEvent, setSelectedEvent] = useState<BudgetEvent | null>(EVENTS[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<BudgetStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [sortBy, setSortBy] = useState<"budget" | "spent" | "date" | "name">("date");
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<ExpenseCategory | "all">("all");

  const filteredEvents = useMemo(() => {
    let result = [...EVENTS];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.name.toLowerCase().includes(q) || e.club.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q)));
    }
    if (filterStatus !== "all") result = result.filter((e) => e.status === filterStatus);
    if (filterPriority !== "all") result = result.filter((e) => e.priority === filterPriority);
    if (sortBy === "budget") result.sort((a, b) => b.totalBudget - a.totalBudget);
    else if (sortBy === "spent") result.sort((a, b) => b.totalSpent - a.totalSpent);
    else if (sortBy === "date") result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    else if (sortBy === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [searchQuery, filterStatus, filterPriority, sortBy]);

  const filteredExpenses = useMemo(() => {
    if (!selectedEvent) return [];
    let result = [...selectedEvent.expenses];
    if (expenseSearch) {
      const q = expenseSearch.toLowerCase();
      result = result.filter((e) => e.description.toLowerCase().includes(q) || e.vendor.toLowerCase().includes(q) || e.invoiceNumber.toLowerCase().includes(q));
    }
    if (expenseCategoryFilter !== "all") result = result.filter((e) => e.category === expenseCategoryFilter);
    return result.sort((a, b) => b.amount - a.amount);
  }, [selectedEvent, expenseSearch, expenseCategoryFilter]);

  const totalStats = useMemo(() => {
    const totalBudget = EVENTS.reduce((s, e) => s + e.totalBudget, 0);
    const totalSpent = EVENTS.reduce((s, e) => s + e.totalSpent, 0);
    const totalCommitted = EVENTS.reduce((s, e) => s + e.totalCommitted, 0);
    const activeEvents = EVENTS.filter((e) => e.status === "active").length;
    const completedEvents = EVENTS.filter((e) => e.status === "completed").length;
    return { totalBudget, totalSpent, totalCommitted, activeEvents, completedEvents, remaining: totalBudget - totalSpent - totalCommitted };
  }, []);

  const eventBreakdown = useMemo(() => {
    if (!selectedEvent) return [];
    const catMap: Record<string, number> = {};
    selectedEvent.expenses.forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    return Object.entries(catMap)
      .map(([cat, amount]) => ({ category: cat as ExpenseCategory, amount, percentage: pct(amount, selectedEvent.totalSpent) }))
      .sort((a, b) => b.amount - a.amount);
  }, [selectedEvent]);

  const tabs = [
    { id: "events" as const, label: "Events", icon: <Calendar size={14} /> },
    { id: "expenses" as const, label: "Expenses", icon: <Receipt size={14} /> },
    { id: "funding" as const, label: "Funding", icon: <Wallet size={14} /> },
    { id: "vendors" as const, label: "Vendors", icon: <Building2 size={14} /> },
    { id: "templates" as const, label: "Templates", icon: <Copy size={14} /> },
    { id: "analytics" as const, label: "Analytics", icon: <BarChart3 size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
              <Wallet size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Event Budget Manager</h1>
              <p className="text-gray-400 text-sm">Track budgets, expenses, vendors & approvals</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-500/30 transition border border-green-400/30">
              <Plus size={14} />New Event
            </button>
            <button className="p-2 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white transition">
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KpiCard icon={<Wallet size={18} />} label="Total Budget" value={fmt(totalStats.totalBudget)} sub="across all events" color="text-cyan-400" />
          <KpiCard icon={<Receipt size={18} />} label="Total Spent" value={fmt(totalStats.totalSpent)} sub={`${pct(totalStats.totalSpent, totalStats.totalBudget)}% utilized`} color="text-green-400" trend={`${fmt(totalStats.remaining)} remaining`} trendUp />
          <KpiCard icon={<Clock size={18} />} label="Committed" value={fmt(totalStats.totalCommitted)} sub="pending payments" color="text-yellow-400" />
          <KpiCard icon={<Zap size={18} />} label="Active Events" value={totalStats.activeEvents} sub={`${totalStats.completedEvents} completed`} color="text-purple-400" />
          <KpiCard icon={<Percent size={18} />} label="Avg Utilization" value={`${pct(totalStats.totalSpent, totalStats.totalBudget)}%`} sub="budget spent" color="text-blue-400" trend="+5% vs last month" trendUp />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? "bg-green-500/20 text-green-400 border border-green-400/30" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Events Tab */}
        {activeTab === "events" && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex-1 min-w-[200px]">
                <Search size={14} className="text-gray-400 mr-2" />
                <input type="text" placeholder="Search events, clubs, tags..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1" />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Priority</option>
                {Object.entries(PRIORITY_CONFIG).map(([k]) => <option key={k} value={k} className="capitalize">{k}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="date">Sort: Date</option><option value="budget">Sort: Budget</option>
                <option value="spent">Sort: Spent</option><option value="name">Sort: Name</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} selected={selectedEvent?.id === event.id} onSelect={() => { setSelectedEvent(event); setActiveTab("expenses"); }} />
              ))}
            </div>
            {selectedEvent && (
              <div className="mt-6 bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold text-lg">{selectedEvent.name}</h3>
                    <p className="text-gray-400 text-sm">{selectedEvent.description}</p>
                  </div>
                  <ApprovalPipeline stage={selectedEvent.approvalStage} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-gray-500 block">Organizer</span><span className="text-white">{selectedEvent.organizer}</span></div>
                  <div><span className="text-gray-500 block">Club</span><span className="text-white">{selectedEvent.club}</span></div>
                  <div><span className="text-gray-500 block">Venue</span><span className="text-white">{selectedEvent.venue}</span></div>
                  <div><span className="text-gray-500 block">Attendees</span><span className="text-white">{selectedEvent.actualAttendees || selectedEvent.expectedAttendees} ({selectedEvent.actualAttendees ? "actual" : "expected"})</span></div>
                  <div><span className="text-gray-500 block">Start Date</span><span className="text-white">{selectedEvent.date}</span></div>
                  <div><span className="text-gray-500 block">End Date</span><span className="text-white">{selectedEvent.endDate}</span></div>
                  <div><span className="text-gray-500 block">Approved By</span><span className="text-white">{selectedEvent.approvedBy || "—"}</span></div>
                  <div><span className="text-gray-500 block">Recurring</span><span className="text-white">{selectedEvent.isRecurring ? selectedEvent.recurrencePattern : "One-time"}</span></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expenses Tab */}
        {activeTab === "expenses" && selectedEvent && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-white">Expenses — {selectedEvent.name}</h2>
                <button onClick={() => setShowAddExpense(!showAddExpense)} className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-500/30 transition border border-green-400/30">
                  <Plus size={12} />Add Expense
                </button>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex-1">
                  <Search size={14} className="text-gray-400 mr-2" />
                  <input type="text" placeholder="Search expenses..." value={expenseSearch} onChange={(e) => setExpenseSearch(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1" />
                </div>
                <select value={expenseCategoryFilter} onChange={(e) => setExpenseCategoryFilter(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                  <option value="all">All Categories</option>
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                {filteredExpenses.map((expense) => (
                  <ExpenseRow key={expense.id} expense={expense} expanded={expandedExpense === expense.id} onToggle={() => setExpandedExpense(expandedExpense === expense.id ? null : expense.id)} />
                ))}
              </div>
              {filteredExpenses.length === 0 && (
                <div className="text-center py-8 text-gray-500"><Receipt size={32} className="mx-auto mb-2 opacity-50" /><p>No expenses found</p></div>
              )}
            </div>
            <div className="space-y-4">
              <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-bold mb-3 text-sm">Budget Overview</h3>
                <ProgressBar value={selectedEvent.totalSpent} max={selectedEvent.totalBudget} color="bg-green-400" />
                <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                  <div className="bg-white/5 rounded-lg p-2"><span className="text-gray-500 block">Spent</span><span className="text-white font-bold">{fmt(selectedEvent.totalSpent)}</span></div>
                  <div className="bg-white/5 rounded-lg p-2"><span className="text-gray-500 block">Committed</span><span className="text-yellow-400 font-bold">{fmt(selectedEvent.totalCommitted)}</span></div>
                  <div className="bg-white/5 rounded-lg p-2"><span className="text-gray-500 block">Remaining</span><span className="text-green-400 font-bold">{fmt(selectedEvent.totalBudget - selectedEvent.totalSpent)}</span></div>
                  <div className="bg-white/5 rounded-lg p-2"><span className="text-gray-500 block">Per Person</span><span className="text-white font-bold">{fmt(Math.round(selectedEvent.totalSpent / (selectedEvent.actualAttendees || selectedEvent.expectedAttendees)))}</span></div>
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-bold mb-3 text-sm">Category Breakdown</h3>
                <div className="space-y-2">
                  {eventBreakdown.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat.category];
                    return (
                      <div key={cat.category} className="flex items-center gap-2">
                        <span style={{ color: cfg.color }}>{cfg.icon}</span>
                        <span className="text-xs text-gray-400 w-20">{cfg.label}</span>
                        <div className="flex-1 bg-white/10 rounded-full h-2">
                          <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cfg.color }} />
                        </div>
                        <span className="text-xs text-gray-300 w-16 text-right">{fmt(cat.amount)}</span>
                        <span className="text-[10px] text-gray-500 w-8 text-right">{cat.percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-bold mb-3 text-sm">Payment Methods</h3>
                <div className="space-y-2">
                  {(() => {
                    const pmMap: Record<string, number> = {};
                    selectedEvent.expenses.forEach((e) => { pmMap[e.paymentMethod] = (pmMap[e.paymentMethod] || 0) + e.amount; });
                    return Object.entries(pmMap).sort((a, b) => b[1] - a[1]).map(([pm, amount]) => (
                      <div key={pm} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{PAYMENT_LABELS[pm as PaymentMethod]}</span>
                        <span className="text-white font-mono">{fmt(amount)}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Funding Tab */}
        {activeTab === "funding" && selectedEvent && (
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="text-lg font-bold text-white">Funding Sources — {selectedEvent.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedEvent.fundingSources.map((source) => <FundingSourceCard key={source.id} source={source} />)}
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
              <h3 className="text-white font-bold mb-3">Funding Summary</h3>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-gray-500 mb-1">Total Funding</div>
                  <div className="text-cyan-400 font-bold text-lg">{fmt(selectedEvent.fundingSources.reduce((s, f) => s + f.amount, 0))}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-gray-500 mb-1">Received</div>
                  <div className="text-green-400 font-bold text-lg">{fmt(selectedEvent.fundingSources.filter((f) => f.received).reduce((s, f) => s + f.amount, 0))}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-gray-500 mb-1">Pending</div>
                  <div className="text-yellow-400 font-bold text-lg">{fmt(selectedEvent.fundingSources.filter((f) => !f.received).reduce((s, f) => s + f.amount, 0))}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vendors Tab */}
        {activeTab === "vendors" && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg font-bold text-white mb-4">Vendor Directory</h2>
            <div className="space-y-2">
              {VENDORS.map((v) => <VendorRow key={v.id} vendor={v} />)}
            </div>
            <div className="mt-6 bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
              <h3 className="text-white font-bold mb-3">Top Vendors by Spend</h3>
              <div className="flex items-end gap-2 h-32">
                {VENDORS.sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 5).map((v) => {
                  const maxSpend = Math.max(...VENDORS.map((x) => x.totalSpend));
                  const h = pct(v.totalSpend, maxSpend);
                  return (
                    <div key={v.id} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-gray-400">{fmt(v.totalSpend)}</span>
                      <div className="w-full rounded-t" style={{ height: `${h}%`, backgroundColor: CATEGORY_CONFIG[v.category].color }} />
                      <span className="text-[8px] text-gray-500 text-center leading-tight">{v.name.split(" ")[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === "templates" && (
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Budget Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEMPLATES.map((t) => <TemplateCard key={t.id} template={t} onSelect={() => alert(`Template "${t.name}" selected! Total budget: ${fmt(t.totalBudget)}`)} />)}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Monthly Spend */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-green-400" />Monthly Spend vs Budget</h3>
                <div className="flex items-end gap-2 h-48">
                  {MONTHLY_SPEND.map((m) => {
                    const maxVal = Math.max(...MONTHLY_SPEND.map((x) => Math.max(x.budgeted, x.actual)));
                    const budgetH = pct(m.budgeted, maxVal);
                    const actualH = pct(m.actual, maxVal);
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="flex gap-0.5 items-end w-full">
                          <div className="flex-1 bg-cyan-500/40 rounded-t" style={{ height: `${budgetH}%` }} />
                          <div className="flex-1 bg-green-400 rounded-t" style={{ height: `${actualH}%` }} />
                        </div>
                        <span className="text-[9px] text-gray-500">{m.month}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-500/40" />Budgeted</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400" />Actual</span>
                </div>
              </div>

              {/* Category Distribution */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><PieChart size={16} className="text-purple-400" />Spending by Category</h3>
                <div className="space-y-2">
                  {(() => {
                    const catMap: Record<string, number> = {};
                    EVENTS.forEach((e) => e.expenses.forEach((x) => { catMap[x.category] = (catMap[x.category] || 0) + x.amount; }));
                    const total = Object.values(catMap).reduce((s, v) => s + v, 0);
                    return Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cat, amount]) => {
                      const cfg = CATEGORY_CONFIG[cat as ExpenseCategory];
                      return (
                        <div key={cat} className="flex items-center gap-2">
                          <span style={{ color: cfg.color }}>{cfg.icon}</span>
                          <span className="text-xs text-gray-400 w-20">{cfg.label}</span>
                          <div className="flex-1 bg-white/10 rounded-full h-2">
                            <div className="h-full rounded-full" style={{ width: `${pct(amount, total)}%`, backgroundColor: cfg.color }} />
                          </div>
                          <span className="text-xs text-gray-300 w-16 text-right">{fmt(amount)}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Event Comparison */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Target size={16} className="text-blue-400" />Event Budget Comparison</h3>
                <div className="space-y-3">
                  {EVENTS.sort((a, b) => b.totalBudget - a.totalBudget).map((e) => (
                    <div key={e.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-white truncate max-w-[200px]">{e.name}</span>
                        <span className="text-gray-400">{fmt(e.totalSpent)} / {fmt(e.totalBudget)}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2.5">
                        <div className={`${pct(e.totalSpent, e.totalBudget) > 90 ? "bg-red-400" : pct(e.totalSpent, e.totalBudget) > 70 ? "bg-yellow-400" : "bg-green-400"} h-2.5 rounded-full`} style={{ width: `${pct(e.totalSpent, e.totalBudget)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Per Attendee */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Users size={16} className="text-orange-400" />Cost Per Attendee</h3>
                <div className="space-y-3">
                  {EVENTS.filter((e) => e.actualAttendees > 0 || e.expectedAttendees > 0).map((e) => {
                    const costPerPerson = Math.round(e.totalSpent / (e.actualAttendees || e.expectedAttendees));
                    const maxCost = 600;
                    return (
                      <div key={e.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-white truncate max-w-[200px]">{e.name}</span>
                          <span className="text-cyan-400 font-bold">{fmt(costPerPerson)}/person</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div className="bg-cyan-400 h-2 rounded-full" style={{ width: `${pct(costPerPerson, maxCost)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Expense Modal */}
        {showAddExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAddExpense(false)}>
            <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2"><Plus size={18} className="text-green-400" />Add Expense</h3>
                <button onClick={() => setShowAddExpense(false)}><XCircle size={20} className="text-gray-400 hover:text-white transition" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Description</label>
                  <input type="text" placeholder="e.g. Catering for 200 people" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Category</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                      {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Amount (₹)</label>
                    <input type="number" placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-green-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Vendor</label>
                    <input type="text" placeholder="Vendor name" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Payment Method</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                      {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Quantity</label>
                    <input type="number" placeholder="1" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Priority</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                      {Object.keys(PRIORITY_CONFIG).map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Notes</label>
                  <textarea rows={2} placeholder="Additional details..." className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-400 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowAddExpense(false)} className="flex-1 bg-white/5 text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition border border-white/10">Cancel</button>
                <button onClick={() => { alert("✅ Expense added successfully!"); setShowAddExpense(false); }} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2.5 rounded-lg text-sm font-bold hover:opacity-90 transition">Add Expense</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
