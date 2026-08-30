import { useState, useMemo } from "react";
import {
  BookOpen, Search, Filter, Clock, Star, Heart, MapPin, Users,
  BarChart3, TrendingUp, Calendar, CheckCircle, AlertTriangle,
  BookMarked, Eye, Download, ArrowRight, Layers, Bookmark,
  ChevronRight, RefreshCw, Award, Zap,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────────
type BookCategory = "fiction" | "non-fiction" | "textbook" | "reference" | "journal" | "thesis" | "audiobook" | "ebook";
type BookStatus = "available" | "checked-out" | "reserved" | "lost" | "in-transit" | "on-hold";
type ReservationStatus = "pending" | "ready" | "picked-up" | "expired" | "cancelled";
type DifficultyLevel = "beginner" | "intermediate" | "advanced" | "expert";

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: BookCategory;
  status: BookStatus;
  location: string;
  shelf: string;
  floor: number;
  rating: number;
  reviews: number;
  totalCopies: number;
  availableCopies: number;
  publishedYear: number;
  pages: number;
  language: string;
  edition: string;
  coverColor: string;
  tags: string[];
  popularity: number;
  checkedOutBy?: string;
  dueDate?: string;
  reservedBy?: string;
}

interface BookReservation {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  userId: string;
  userName: string;
  reservationDate: string;
  expiryDate: string;
  status: ReservationStatus;
  pickupLocation: string;
  shelf: string;
  notified: boolean;
}

interface ReadingList {
  id: string;
  name: string;
  description: string;
  bookCount: number;
  totalRead: number;
  category: string;
  difficulty: DifficultyLevel;
  createdBy: string;
  followers: number;
  coverBooks: string[];
  color: string;
}

interface StudyRoom {
  id: string;
  name: string;
  floor: number;
  capacity: number;
  currentOccupancy: number;
  amenities: string[];
  available: boolean;
  nextAvailable: string;
  hourlyRate: number;
  rating: number;
}

interface LibraryStats {
  totalBooks: number;
  totalMembers: number;
  activeLoans: number;
  booksReadThisMonth: number;
  topCategories: { name: string; count: number; color: string }[];
  borrowTrend: { month: string; count: number }[];
  popularBooks: { title: string; borrows: number }[];
  floorDistribution: { floor: string; books: number }[];
}

interface OverdueItem {
  id: string;
  bookTitle: string;
  borrowerName: string;
  dueDate: string;
  daysOverdue: number;
  fine: number;
  status: "warning" | "overdue" | "critical";
}

// ─── Data ───────────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<BookCategory, string> = {
  fiction: "#a855f7", "non-fiction": "#3b82f6", textbook: "#22c55e",
  reference: "#f59e0b", journal: "#ef4444", thesis: "#10b981",
  audiobook: "#ec4899", ebook: "#06b6d4",
};

const CATEGORY_ICONS: Record<BookCategory, string> = {
  fiction: "📖", "non-fiction": "📚", textbook: "🎓", reference: "📋",
  journal: "📰", thesis: "🎓", audiobook: "🎧", ebook: "💻",
};

const STATUS_COLORS: Record<BookStatus, string> = {
  available: "#22c55e", "checked-out": "#ef4444", reserved: "#f59e0b",
  lost: "#6b7280", "in-transit": "#3b82f6", "on-hold": "#a855f7",
};

const FLOOR_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f59e0b", "#ef4444"];

const books: Book[] = [
  { id: "b1", title: "Introduction to Algorithms", author: "Thomas H. Cormen", isbn: "978-0262033848", category: "textbook", status: "available", location: "CS Wing", shelf: "A-102", floor: 2, rating: 4.8, reviews: 342, totalCopies: 8, availableCopies: 3, publishedYear: 2009, pages: 1312, language: "English", edition: "3rd", coverColor: "#3b82f6", tags: ["algorithms", "computer-science", "programming"], popularity: 95 },
  { id: "b2", title: "Clean Code", author: "Robert C. Martin", isbn: "978-0132350884", category: "textbook", status: "available", location: "CS Wing", shelf: "A-105", floor: 2, rating: 4.7, reviews: 289, totalCopies: 5, availableCopies: 2, publishedYear: 2008, pages: 464, language: "English", edition: "1st", coverColor: "#22c55e", tags: ["software-engineering", "best-practices"], popularity: 91 },
  { id: "b3", title: "Sapiens: A Brief History of Humankind", author: "Yuval Noah Harari", isbn: "978-0062316097", category: "non-fiction", status: "checked-out", location: "Main Hall", shelf: "B-201", floor: 1, rating: 4.6, reviews: 567, totalCopies: 4, availableCopies: 0, publishedYear: 2015, pages: 443, language: "English", edition: "1st", coverColor: "#a855f7", tags: ["history", "anthropology", "science"], popularity: 88, checkedOutBy: "Alex Chen", dueDate: "Sep 5, 2026" },
  { id: "b4", title: "The Art of War", author: "Sun Tzu", isbn: "978-1599869773", category: "reference", status: "available", location: "Reference Section", shelf: "R-301", floor: 3, rating: 4.5, reviews: 892, totalCopies: 12, availableCopies: 10, publishedYear: -500, pages: 273, language: "Multiple", edition: "Ancient", coverColor: "#f59e0b", tags: ["strategy", "philosophy", "classic"], popularity: 85 },
  { id: "b5", title: "Deep Learning", author: "Ian Goodfellow", isbn: "978-0262035613", category: "textbook", status: "reserved", location: "CS Wing", shelf: "A-108", floor: 2, rating: 4.4, reviews: 178, totalCopies: 3, availableCopies: 0, publishedYear: 2016, pages: 800, language: "English", edition: "1st", coverColor: "#ef4444", tags: ["machine-learning", "AI", "deep-learning"], popularity: 82, reservedBy: "Sarah Kim" },
  { id: "b6", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", isbn: "978-0374533557", category: "non-fiction", status: "available", location: "Main Hall", shelf: "B-105", floor: 1, rating: 4.7, reviews: 445, totalCopies: 6, availableCopies: 4, publishedYear: 2011, pages: 499, language: "English", edition: "1st", coverColor: "#06b6d4", tags: ["psychology", "decision-making", "behavioral-economics"], popularity: 90 },
  { id: "b7", title: "Design Patterns", author: "Gang of Four", isbn: "978-0201633610", category: "textbook", status: "available", location: "CS Wing", shelf: "A-110", floor: 2, rating: 4.3, reviews: 234, totalCopies: 5, availableCopies: 3, publishedYear: 1994, pages: 395, language: "English", edition: "1st", coverColor: "#10b981", tags: ["software-engineering", "patterns", "architecture"], popularity: 80 },
  { id: "b8", title: "Atomic Habits", author: "James Clear", isbn: "978-0735211292", category: "non-fiction", status: "checked-out", location: "Main Hall", shelf: "B-208", floor: 1, rating: 4.8, reviews: 623, totalCopies: 7, availableCopies: 1, publishedYear: 2018, pages: 320, language: "English", edition: "1st", coverColor: "#f97316", tags: ["self-improvement", "productivity", "habits"], popularity: 93, checkedOutBy: "Jordan Lee", dueDate: "Sep 2, 2026" },
  { id: "b9", title: "Physics: Principles with Applications", author: "Douglas C. Giancoli", isbn: "978-0321625922", category: "textbook", status: "available", location: "Science Wing", shelf: "C-101", floor: 2, rating: 4.2, reviews: 156, totalCopies: 10, availableCopies: 7, publishedYear: 2013, pages: 656, language: "English", edition: "7th", coverColor: "#6366f1", tags: ["physics", "science", "textbook"], popularity: 75 },
  { id: "b10", title: "The Pragmatic Programmer", author: "David Thomas", isbn: "978-0135957059", category: "textbook", status: "available", location: "CS Wing", shelf: "A-115", floor: 2, rating: 4.6, reviews: 312, totalCopies: 4, availableCopies: 2, publishedYear: 2019, pages: 352, language: "English", edition: "2nd", coverColor: "#8b5cf6", tags: ["programming", "career", "best-practices"], popularity: 87 },
  { id: "b11", title: "Data Structures and Algorithms in Python", author: "Michael T. Goodrich", isbn: "978-1118290279", category: "textbook", status: "checked-out", location: "CS Wing", shelf: "A-120", floor: 2, rating: 4.4, reviews: 189, totalCopies: 6, availableCopies: 2, publishedYear: 2013, pages: 748, language: "English", edition: "1st", coverColor: "#14b8a6", tags: ["data-structures", "algorithms", "python"], popularity: 84, checkedOutBy: "Maria Garcia", dueDate: "Sep 8, 2026" },
  { id: "b12", title: "Cracking the Coding Interview", author: "Gayle Laakmann McDowell", isbn: "978-0984782857", category: "reference", status: "available", location: "CS Wing", shelf: "A-125", floor: 2, rating: 4.7, reviews: 478, totalCopies: 10, availableCopies: 5, publishedYear: 2015, pages: 687, language: "English", edition: "6th", coverColor: "#0891b2", tags: ["interviews", "coding", "career"], popularity: 94 },
  { id: "b13", title: "The Great Gatsby", author: "F. Scott Fitzgerald", isbn: "978-0743273565", category: "fiction", status: "available", location: "Fiction Wing", shelf: "F-101", floor: 1, rating: 4.2, reviews: 1234, totalCopies: 15, availableCopies: 12, publishedYear: 1925, pages: 180, language: "English", edition: "Classic", coverColor: "#d946ef", tags: ["classic", "american-literature", "novel"], popularity: 78 },
  { id: "b14", title: "Nature Neuroscience Review", author: "Various", isbn: "1094-7159", category: "journal", status: "available", location: "Journal Section", shelf: "J-201", floor: 3, rating: 4.9, reviews: 56, totalCopies: 3, availableCopies: 3, publishedYear: 2026, pages: 0, language: "English", edition: "Vol. 29", coverColor: "#e11d48", tags: ["neuroscience", "research", "peer-reviewed"], popularity: 70 },
  { id: "b15", title: "Machine Learning Yearning", author: "Andrew Ng", isbn: "978-1537634616", category: "ebook", status: "available", location: "Digital", shelf: "Online", floor: 0, rating: 4.5, reviews: 345, totalCopies: 999, availableCopies: 999, publishedYear: 2018, pages: 160, language: "English", edition: "1st", coverColor: "#059669", tags: ["machine-learning", "AI", "practical"], popularity: 86 },
];

const reservations: BookReservation[] = [
  { id: "r1", bookId: "b5", bookTitle: "Deep Learning", bookAuthor: "Ian Goodfellow", userId: "u1", userName: "Sarah Kim", reservationDate: "Aug 25, 2026", expiryDate: "Aug 30, 2026", status: "pending", pickupLocation: "CS Wing", shelf: "A-108", notified: false },
  { id: "r2", bookId: "b8", bookTitle: "Atomic Habits", bookAuthor: "James Clear", userId: "u2", userName: "Alex Chen", reservationDate: "Aug 22, 2026", expiryDate: "Aug 27, 2026", status: "ready", pickupLocation: "Main Hall", shelf: "B-208", notified: true },
  { id: "r3", bookId: "b1", bookTitle: "Introduction to Algorithms", bookAuthor: "Thomas H. Cormen", userId: "u3", userName: "Jordan Lee", reservationDate: "Aug 20, 2026", expiryDate: "Aug 25, 2026", status: "picked-up", pickupLocation: "CS Wing", shelf: "A-102", notified: true },
  { id: "r4", bookId: "b12", bookTitle: "Cracking the Coding Interview", bookAuthor: "Gayle Laakmann McDowell", userId: "u4", userName: "Maria Garcia", reservationDate: "Aug 18, 2026", expiryDate: "Aug 23, 2026", status: "expired", pickupLocation: "CS Wing", shelf: "A-125", notified: true },
];

const readingLists: ReadingList[] = [
  { id: "rl1", name: "CS Fundamentals", description: "Essential computer science reads for beginners", bookCount: 8, totalRead: 3, category: "Computer Science", difficulty: "beginner", createdBy: "Prof. Smith", followers: 234, coverBooks: ["#3b82f6", "#22c55e", "#a855f7"], color: "#3b82f6" },
  { id: "rl2", name: "AI & Machine Learning", description: "From neural networks to deep learning mastery", bookCount: 12, totalRead: 5, category: "Artificial Intelligence", difficulty: "advanced", createdBy: "Dr. Patel", followers: 189, coverBooks: ["#ef4444", "#f59e0b", "#10b981"], color: "#ef4444" },
  { id: "rl3", name: "Productivity Mastery", description: "Build better habits and optimize your workflow", bookCount: 6, totalRead: 4, category: "Self-Improvement", difficulty: "beginner", createdBy: "Library Staff", followers: 456, coverBooks: ["#f97316", "#06b6d4", "#8b5cf6"], color: "#f97316" },
  { id: "rl4", name: "Research Methods", description: "Graduate-level research methodology and writing", bookCount: 10, totalRead: 2, category: "Academic", difficulty: "expert", createdBy: "Prof. Williams", followers: 78, coverBooks: ["#22c55e", "#a855f7", "#3b82f6"], color: "#22c55e" },
  { id: "rl5", name: "Classic Literature", description: "Timeless novels that shaped world literature", bookCount: 15, totalRead: 6, category: "Literature", difficulty: "intermediate", createdBy: "English Dept.", followers: 312, coverBooks: ["#d946ef", "#e11d48", "#f59e0b"], color: "#d946ef" },
  { id: "rl6", name: "Data Science Toolkit", description: "Statistics, visualization, and practical data analysis", bookCount: 9, totalRead: 3, category: "Data Science", difficulty: "intermediate", createdBy: "Dr. Johnson", followers: 167, coverBooks: ["#14b8a6", "#6366f1", "#0891b2"], color: "#14b8a6" },
];

const studyRooms: StudyRoom[] = [
  { id: "sr1", name: "Room A1", floor: 1, capacity: 4, currentOccupancy: 3, amenities: ["Whiteboard", "Power Outlets", "WiFi"], available: false, nextAvailable: "2:30 PM", hourlyRate: 0, rating: 4.5 },
  { id: "sr2", name: "Room A2", floor: 1, capacity: 6, currentOccupancy: 0, amenities: ["Whiteboard", "Projector", "WiFi", "Power Outlets"], available: true, nextAvailable: "Now", hourlyRate: 0, rating: 4.8 },
  { id: "sr3", name: "Room B1", floor: 2, capacity: 8, currentOccupancy: 6, amenities: ["Whiteboard", "TV Screen", "WiFi", "Power Outlets", "Noise Cancelling"], available: false, nextAvailable: "4:00 PM", hourlyRate: 5, rating: 4.9 },
  { id: "sr4", name: "Room B2", floor: 2, capacity: 4, currentOccupancy: 2, amenities: ["Whiteboard", "WiFi", "Power Outlets"], available: true, nextAvailable: "Now", hourlyRate: 0, rating: 4.3 },
  { id: "sr5", name: "Room C1", floor: 3, capacity: 12, currentOccupancy: 10, amenities: ["Whiteboard", "Projector", "TV Screen", "WiFi", "Podium"], available: false, nextAvailable: "5:00 PM", hourlyRate: 10, rating: 4.7 },
  { id: "sr6", name: "Quiet Pod 1", floor: 1, capacity: 1, currentOccupancy: 0, amenities: ["WiFi", "Power Outlet", "Soundproof"], available: true, nextAvailable: "Now", hourlyRate: 0, rating: 4.6 },
];

const stats: LibraryStats = {
  totalBooks: 45280,
  totalMembers: 3456,
  activeLoans: 1234,
  booksReadThisMonth: 567,
  topCategories: [
    { name: "Textbooks", count: 12400, color: "#22c55e" },
    { name: "Non-Fiction", count: 9800, color: "#3b82f6" },
    { name: "Fiction", count: 8500, color: "#a855f7" },
    { name: "Reference", count: 6200, color: "#f59e0b" },
    { name: "Journals", count: 4800, color: "#ef4444" },
    { name: "E-Books", count: 3580, color: "#06b6d4" },
  ],
  borrowTrend: [
    { month: "Mar", count: 420 }, { month: "Apr", count: 485 }, { month: "May", count: 390 },
    { month: "Jun", count: 310 }, { month: "Jul", count: 280 }, { month: "Aug", count: 520 },
  ],
  popularBooks: [
    { title: "Cracking the Coding Interview", borrows: 234 },
    { title: "Atomic Habits", borrows: 212 },
    { title: "Introduction to Algorithms", borrows: 198 },
    { title: "Clean Code", borrows: 187 },
    { title: "The Pragmatic Programmer", borrows: 176 },
  ],
  floorDistribution: [
    { floor: "Floor 1 - Main", books: 12400 },
    { floor: "Floor 2 - CS/Science", books: 14800 },
    { floor: "Floor 3 - Reference/Journals", books: 10200 },
    { floor: "Floor 4 - Archives", books: 7880 },
  ],
};

const overdueItems: OverdueItem[] = [
  { id: "o1", bookTitle: "Sapiens", borrowerName: "Alex Chen", dueDate: "Aug 20, 2026", daysOverdue: 9, fine: 4.50, status: "critical" },
  { id: "o2", bookTitle: "Atomic Habits", borrowerName: "Jordan Lee", dueDate: "Aug 25, 2026", daysOverdue: 4, fine: 2.00, status: "overdue" },
  { id: "o3", bookTitle: "DS & Algorithms in Python", borrowerName: "Maria Garcia", dueDate: "Aug 27, 2026", daysOverdue: 2, fine: 1.00, status: "warning" },
  { id: "o4", bookTitle: "Thinking, Fast and Slow", borrowerName: "Ryan Patel", dueDate: "Aug 18, 2026", daysOverdue: 11, fine: 5.50, status: "critical" },
];

// ─── SVG Components ─────────────────────────────────────────────────────────────
const RatingStars = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} size={size} className={s <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-600"} />
    ))}
    <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
  </div>
);

const BookCover = ({ color, title, size = "md" }: { color: string; title: string; size?: "sm" | "md" | "lg" }) => {
  const dims = size === "sm" ? "w-10 h-14" : size === "lg" ? "w-20 h-28" : "w-14 h-20";
  return (
    <div className={`${dims} rounded-md flex flex-col items-center justify-center p-1 relative overflow-hidden shrink-0`}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
      <div className="absolute top-0 left-0 w-full h-1 bg-white/20" />
      <div className="text-white text-[8px] font-bold text-center leading-tight line-clamp-3 px-0.5">{title}</div>
    </div>
  );
};

const OccupancyBar = ({ current, max, color = "#3b82f6" }: { current: number; max: number; color?: string }) => {
  const pct = max > 0 ? (current / max) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : color }} />
    </div>
  );
};

const TrendLine = ({ data, width = 180, height = 50, color = "#3b82f6" }: { data: number[]; width?: number; height?: number; color?: string }) => {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 4)}`).join(" ");
  return (
    <svg width={width} height={height} className="inline-block">
      <defs>
        <linearGradient id={`lg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#lg-${color.replace("#", "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
};

const HorizontalBar = ({ label, value, max, color, width = 200 }: { label: string; value: number; max: number; color: string; width?: number }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-400 w-24 truncate">{label}</span>
    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden" style={{ maxWidth: width }}>
      <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
    </div>
    <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
  </div>
);

// ─── Card Components ────────────────────────────────────────────────────────────
const BookCard = ({ book, onSelect }: { book: Book; onSelect: () => void }) => (
  <button onClick={onSelect} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 text-left hover:border-white/20 transition-all w-full flex gap-3">
    <BookCover color={book.coverColor} title={book.title} />
    <div className="flex-1 min-w-0">
      <div className="text-white font-semibold text-sm truncate">{book.title}</div>
      <div className="text-gray-500 text-xs truncate">{book.author}</div>
      <div className="flex items-center gap-2 mt-1">
        <RatingStars rating={book.rating} size={10} />
        <span className="text-gray-600 text-[10px]">({book.reviews})</span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: CATEGORY_COLORS[book.category] + "22", color: CATEGORY_COLORS[book.category] }}>{book.category}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: STATUS_COLORS[book.status] + "22", color: STATUS_COLORS[book.status] }}>{book.status}</span>
      </div>
      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-600">
        <span className="flex items-center gap-0.5"><MapPin size={8} />{book.location}</span>
        <span className="flex items-center gap-0.5"><BookOpen size={8} />{book.availableCopies}/{book.totalCopies} free</span>
      </div>
    </div>
  </button>
);

const ReservationCard = ({ res }: { res: BookReservation }) => {
  const statusColors: Record<string, string> = { pending: "#f59e0b", ready: "#22c55e", "picked-up": "#3b82f6", expired: "#ef4444", cancelled: "#6b7280" };
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-white font-semibold text-sm">{res.bookTitle}</div>
          <div className="text-gray-500 text-xs">{res.bookAuthor}</div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full capitalize font-medium" style={{ background: statusColors[res.status] + "22", color: statusColors[res.status] }}>{res.status.replace("-", " ")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-gray-600">Reserved by</span><div className="text-gray-300">{res.userName}</div></div>
        <div><span className="text-gray-600">Pickup</span><div className="text-gray-300">{res.shelf}</div></div>
        <div><span className="text-gray-600">Reserved</span><div className="text-gray-300">{res.reservationDate}</div></div>
        <div><span className="text-gray-600">Expires</span><div className="text-gray-300">{res.expiryDate}</div></div>
      </div>
    </div>
  );
};

const ReadingListCard = ({ list }: { list: ReadingList }) => {
  const diffColors: Record<string, string> = { beginner: "#22c55e", intermediate: "#f59e0b", advanced: "#ef4444", expert: "#a855f7" };
  const pct = list.bookCount > 0 ? Math.round((list.totalRead / list.bookCount) * 100) : 0;
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex -space-x-2">
          {list.coverBooks.map((c, i) => (
            <div key={i} className="w-8 h-10 rounded-md border-2 border-gray-900" style={{ background: c, zIndex: list.coverBooks.length - i }} />
          ))}
        </div>
        <div className="flex-1">
          <div className="text-white font-semibold text-sm">{list.name}</div>
          <div className="text-gray-500 text-xs">{list.description}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-2">
        <span className="px-1.5 py-0.5 rounded-full" style={{ background: diffColors[list.difficulty] + "22", color: diffColors[list.difficulty] }}>{list.difficulty}</span>
        <span className="flex items-center gap-0.5"><BookOpen size={8} />{list.bookCount} books</span>
        <span className="flex items-center gap-0.5"><Users size={8} />{list.followers}</span>
        <span>by {list.createdBy}</span>
      </div>
      <OccupancyBar current={list.totalRead} max={list.bookCount} color={list.color} />
      <div className="text-[10px] text-gray-600 mt-1">{list.totalRead}/{list.bookCount} read ({pct}%)</div>
    </div>
  );
};

const StudyRoomCard = ({ room }: { room: StudyRoom }) => (
  <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all">
    <div className="flex items-center justify-between mb-2">
      <div>
        <div className="text-white font-semibold text-sm">{room.name}</div>
        <div className="text-gray-500 text-xs">Floor {room.floor} · Capacity {room.capacity}</div>
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${room.available ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
        {room.available ? "Available" : "Occupied"}
      </span>
    </div>
    <OccupancyBar current={room.currentOccupancy} max={room.capacity} />
    <div className="flex items-center justify-between mt-2">
      <div className="flex gap-1 flex-wrap">
        {room.amenities.map((a) => (
          <span key={a} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">{a}</span>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs">
        <Star size={10} className="text-yellow-400 fill-yellow-400" />
        <span className="text-gray-400">{room.rating}</span>
      </div>
    </div>
    <div className="flex items-center justify-between mt-2 text-[10px] text-gray-600">
      <span>{room.available ? "Ready now" : `Next: ${room.nextAvailable}`}</span>
      <span>{room.hourlyRate > 0 ? `$${room.hourlyRate}/hr` : "Free"}</span>
    </div>
  </div>
);

const OverdueCard = ({ item }: { item: OverdueItem }) => {
  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    warning: { bg: "#f59e0b22", text: "#f59e0b", border: "#f59e0b44" },
    overdue: { bg: "#ef444422", text: "#ef4444", border: "#ef444444" },
    critical: { bg: "#dc262622", text: "#dc2626", border: "#dc262644" },
  };
  const s = statusColors[item.status];
  return (
    <div className="rounded-xl p-3 border" style={{ background: s.bg, borderColor: s.border }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <AlertTriangle size={12} style={{ color: s.text }} />
          <span className="text-white text-sm font-medium">{item.bookTitle}</span>
        </div>
        <span className="text-xs font-semibold" style={{ color: s.text }}>{item.daysOverdue}d overdue</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{item.borrowerName}</span>
        <span className="text-gray-500">Fine: ${item.fine.toFixed(2)}</span>
      </div>
    </div>
  );
};

// ─── Main Dashboard ─────────────────────────────────────────────────────────────
export default function LibraryBookFinder() {
  const [activeTab, setActiveTab] = useState<"search" | "reservations" | "reading-lists" | "study-rooms" | "analytics" | "overdue">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<BookCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<BookStatus | "all">("all");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const tabs = [
    { key: "search" as const, label: "Search Books", icon: <Search size={14} /> },
    { key: "reservations" as const, label: "Reservations", icon: <Bookmark size={14} /> },
    { key: "reading-lists" as const, label: "Reading Lists", icon: <BookMarked size={14} /> },
    { key: "study-rooms" as const, label: "Study Rooms", icon: <MapPin size={14} /> },
    { key: "analytics" as const, label: "Analytics", icon: <BarChart3 size={14} /> },
    { key: "overdue" as const, label: "Overdue", icon: <AlertTriangle size={14} /> },
  ];

  const filteredBooks = useMemo(() => {
    let result = books;
    if (categoryFilter !== "all") result = result.filter((b) => b.category === categoryFilter);
    if (statusFilter !== "all") result = result.filter((b) => b.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.tags.some((t) => t.includes(q)));
    }
    return result;
  }, [categoryFilter, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <BookOpen size={22} className="text-emerald-400" />
          </div>
          Library Explorer
        </h1>
        <p className="text-gray-500 text-sm mt-1">Search · Reserve · Study · Read</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1"><BookOpen size={14} className="text-emerald-400" />Total Books</div>
          <div className="text-2xl font-bold text-white">{stats.totalBooks.toLocaleString()}</div>
          <TrendLine data={[38000, 39500, 41200, 43000, 44100, 45280]} width={120} height={30} color="#22c55e" />
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1"><Users size={14} className="text-blue-400" />Active Members</div>
          <div className="text-2xl font-bold text-white">{stats.totalMembers.toLocaleString()}</div>
          <div className="text-xs text-gray-500">+12% this semester</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1"><RefreshCw size={14} className="text-purple-400" />Active Loans</div>
          <div className="text-2xl font-bold text-white">{stats.activeLoans}</div>
          <div className="text-xs text-gray-500">{stats.booksReadThisMonth} returned this month</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1"><TrendingUp size={14} className="text-amber-400" />Reads This Month</div>
          <div className="text-2xl font-bold text-white">{stats.booksReadThisMonth}</div>
          <TrendLine data={stats.borrowTrend.map((b) => b.count)} width={120} height={30} color="#f59e0b" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === t.key ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "search" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                placeholder="Search title, author, or tag..." />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
              <option value="all">All Categories</option>
              {Object.keys(CATEGORY_COLORS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
              <option value="all">All Status</option>
              {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="text-xs text-gray-500">{filteredBooks.length} books found</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredBooks.map((book) => (
              <BookCard key={book.id} book={book} onSelect={() => setSelectedBook(book)} />
            ))}
          </div>
          {/* Book Detail Modal */}
          {selectedBook && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedBook(null)}>
              <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-4 mb-4">
                  <BookCover color={selectedBook.coverColor} title={selectedBook.title} size="lg" />
                  <div>
                    <div className="text-white font-bold text-lg">{selectedBook.title}</div>
                    <div className="text-gray-400 text-sm">{selectedBook.author}</div>
                    <RatingStars rating={selectedBook.rating} size={12} />
                    <div className="flex gap-2 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: CATEGORY_COLORS[selectedBook.category] + "22", color: CATEGORY_COLORS[selectedBook.category] }}>{selectedBook.category}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: STATUS_COLORS[selectedBook.status] + "22", color: STATUS_COLORS[selectedBook.status] }}>{selectedBook.status}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  {[
                    { label: "ISBN", value: selectedBook.isbn },
                    { label: "Pages", value: selectedBook.pages > 0 ? String(selectedBook.pages) : "N/A" },
                    { label: "Published", value: selectedBook.publishedYear > 0 ? String(selectedBook.publishedYear) : `${Math.abs(selectedBook.publishedYear)} BC` },
                    { label: "Edition", value: selectedBook.edition },
                    { label: "Language", value: selectedBook.language },
                    { label: "Location", value: `${selectedBook.location} · ${selectedBook.shelf}` },
                    { label: "Copies", value: `${selectedBook.availableCopies}/${selectedBook.totalCopies} available` },
                    { label: "Floor", value: selectedBook.floor > 0 ? `Level ${selectedBook.floor}` : "Digital" },
                  ].map((item) => (
                    <div key={item.label}><span className="text-gray-600">{item.label}</span><div className="text-gray-300">{item.value}</div></div>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap mb-4">
                  {selectedBook.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">#{tag}</span>
                  ))}
                </div>
                {selectedBook.checkedOutBy && (
                  <div className="text-xs text-gray-500 mb-3 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                    Checked out by {selectedBook.checkedOutBy} · Due {selectedBook.dueDate}
                  </div>
                )}
                <div className="flex gap-2">
                  {selectedBook.status === "available" && (
                    <button className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-all">
                      <Bookmark size={12} />Reserve
                    </button>
                  )}
                  <button className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-white/5 text-gray-400 border border-white/10 rounded-lg text-xs font-medium hover:bg-white/10 transition-all">
                    <Eye size={12} />Details
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "reservations" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">{reservations.length} reservations</div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-all">
              <Bookmark size={12} />New Reservation
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reservations.map((res) => <ReservationCard key={res.id} res={res} />)}
          </div>
        </div>
      )}

      {activeTab === "reading-lists" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">{readingLists.length} curated lists</div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-all">
              <BookMarked size={12} />Create List
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readingLists.map((list) => <ReadingListCard key={list.id} list={list} />)}
          </div>
        </div>
      )}

      {activeTab === "study-rooms" && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500">{studyRooms.filter((r) => r.available).length} of {studyRooms.length} rooms available</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {studyRooms.map((room) => <StudyRoomCard key={room.id} room={room} />)}
          </div>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Category Distribution</h3>
            <div className="space-y-2">
              {stats.topCategories.map((cat) => (
                <HorizontalBar key={cat.name} label={cat.name} value={cat.count} max={stats.topCategories[0].count} color={cat.color} width={180} />
              ))}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Monthly Borrow Trend</h3>
            <div className="flex items-end gap-1 h-24">
              {stats.borrowTrend.map((m, i) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-emerald-500/30 rounded-t" style={{ height: `${(m.count / 600) * 80}px` }} />
                  <span className="text-[9px] text-gray-600">{m.month}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Most Borrowed Books</h3>
            <div className="space-y-2">
              {stats.popularBooks.map((book, i) => (
                <div key={book.title} className="flex items-center gap-3">
                  <span className="text-gray-600 text-xs w-4">{i + 1}.</span>
                  <span className="text-white text-xs flex-1 truncate">{book.title}</span>
                  <span className="text-gray-500 text-xs">{book.borrows} borrows</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Floor Distribution</h3>
            <div className="space-y-3">
              {stats.floorDistribution.map((floor, i) => (
                <div key={floor.floor}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">{floor.floor}</span>
                    <span className="text-gray-500">{floor.books.toLocaleString()} books</span>
                  </div>
                  <HorizontalBar label="" value={floor.books} max={stats.floorDistribution[0].books} color={FLOOR_COLORS[i]} width={220} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "overdue" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">{overdueItems.length} overdue items · ${overdueItems.reduce((a, i) => a + i.fine, 0).toFixed(2)} total fines</div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-all">
              <AlertTriangle size={12} />Send Reminders
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overdueItems.map((item) => <OverdueCard key={item.id} item={item} />)}
          </div>
        </div>
      )}
    </div>
  );
}
