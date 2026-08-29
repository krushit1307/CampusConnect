// ============================================================
// CampusConnect – Textbook Exchange Service Layer
// src/services/TextbookService.ts
// ============================================================

export type BookCondition = "Brand New" | "Like New" | "Good" | "Fair" | "Poor";
export type AcademicSubject = "Computer Science" | "Mathematics" | "Biology" | "Physics" | "Business" | "History" | "Literature";

export interface TextbookListing {
    id: string;
    sellerId: string;
    sellerName: string;
    sellerAvatar: string;
    title: string;
    author: string;
    edition: string;
    isbn: string;
    courseCode: string;
    subject: AcademicSubject;
    condition: BookCondition;
    description: string;
    retailPrice: number;
    askingPrice: number;
    hasAccessCode: boolean;
    isAnnotated: boolean;
    images: string[];
    status: "available" | "sold" | "pending";
    createdAt: string;
}

export interface TextbookFilters {
    query: string;
    subject: AcademicSubject | "all";
    maxPrice: number;
    condition: BookCondition | "all";
    hasAccessCodeOnly: boolean;
}

// ── Mock Data ───────────────────────────────────────────────

const MOCK_TEXTBOOKS: TextbookListing[] = [
    {
        id: "bk-001",
        sellerId: "u-1",
        sellerName: "Alex Mercer",
        sellerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
        title: "Introduction to Algorithms",
        author: "Thomas H. Cormen",
        edition: "3rd Edition",
        isbn: "978-0262033848",
        courseCode: "CS 3110",
        subject: "Computer Science",
        condition: "Good",
        description: "Standard algorithms textbook. A few highlighted pages in the graph theory section, but otherwise solid condition.",
        retailPrice: 120,
        askingPrice: 50,
        hasAccessCode: false,
        isAnnotated: true,
        images: ["https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80"],
        status: "available",
        createdAt: "2026-08-15T10:00:00Z"
    },
    {
        id: "bk-002",
        sellerId: "u-2",
        sellerName: "Jordan Smith",
        sellerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
        title: "Campbell Biology",
        author: "Lisa A. Urry",
        edition: "12th Edition",
        isbn: "978-0135188746",
        courseCode: "BIO 101",
        subject: "Biology",
        condition: "Like New",
        description: "Dropped the class after a week. Literally untouched. Access code is still sealed and unused inside the cover.",
        retailPrice: 220,
        askingPrice: 150,
        hasAccessCode: true,
        isAnnotated: false,
        images: ["https://images.unsplash.com/photo-1601662528567-526cd06f6582?w=800&q=80"],
        status: "available",
        createdAt: "2026-08-20T14:30:00Z"
    },
    {
        id: "bk-003",
        sellerId: "u-3",
        sellerName: "Taylor Swift",
        sellerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor",
        title: "Principles of Corporate Finance",
        author: "Richard Brealey",
        edition: "13th Edition",
        isbn: "978-1260013900",
        courseCode: "FIN 400",
        subject: "Business",
        condition: "Fair",
        description: "Cover is a bit bent and corners are worn. Heavily highlighted in the first 5 chapters, but it gets the job done cheaply.",
        retailPrice: 180,
        askingPrice: 35,
        hasAccessCode: false,
        isAnnotated: true,
        images: ["https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=800&q=80"],
        status: "available",
        createdAt: "2026-08-22T09:15:00Z"
    },
    {
        id: "bk-004",
        sellerId: "u-4",
        sellerName: "Morgan Chen",
        sellerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Morgan",
        title: "Calculus: Early Transcendentals",
        author: "James Stewart",
        edition: "9th Edition",
        isbn: "978-1337613927",
        courseCode: "MATH 141",
        subject: "Mathematics",
        condition: "Brand New",
        description: "Bought the wrong edition entirely. Still in shrink wrap.",
        retailPrice: 195,
        askingPrice: 140,
        hasAccessCode: true,
        isAnnotated: false,
        images: ["https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=800&q=80"],
        status: "available",
        createdAt: "2026-08-24T16:45:00Z"
    },
    {
        id: "bk-005",
        sellerId: "u-5",
        sellerName: "Sam Rogers",
        sellerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sam",
        title: "University Physics with Modern Physics",
        author: "Hugh D. Young",
        edition: "15th Edition",
        isbn: "978-0135159555",
        courseCode: "PHYS 220",
        subject: "Physics",
        condition: "Good",
        description: "Used for two semesters. Good condition, no writing inside. I can meet on South Campus.",
        retailPrice: 200,
        askingPrice: 90,
        hasAccessCode: false,
        isAnnotated: false,
        images: ["https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80"],
        status: "pending",
        createdAt: "2026-08-25T11:20:00Z"
    }
];

export function getDefaultFilters(): TextbookFilters {
    return {
        query: "",
        subject: "all",
        maxPrice: 250,
        condition: "all",
        hasAccessCodeOnly: false
    };
}

export function fetchTextbooks(filters: TextbookFilters): TextbookListing[] {
    let results = [...MOCK_TEXTBOOKS];

    if (filters.query.trim()) {
        const q = filters.query.toLowerCase();
        results = results.filter(
            r => r.title.toLowerCase().includes(q) ||
                r.courseCode.toLowerCase().includes(q) ||
                r.author.toLowerCase().includes(q) ||
                r.isbn.includes(q)
        );
    }

    if (filters.subject !== "all") results = results.filter(r => r.subject === filters.subject);
    if (filters.condition !== "all") results = results.filter(r => r.condition === filters.condition);
    if (filters.hasAccessCodeOnly) results = results.filter(r => r.hasAccessCode);

    results = results.filter(r => r.askingPrice <= filters.maxPrice);
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return results;
}

export function requestPurchase(bookId: string): Promise<{ success: boolean; message: string }> {
    const book = MOCK_TEXTBOOKS.find(b => b.id === bookId);
    if (!book) return Promise.reject(new Error("Book not found"));
    if (book.status !== "available") return Promise.reject(new Error("Book is no longer available"));

    return new Promise((resolve) => {
        setTimeout(() => {
            book.status = "pending";
            resolve({ success: true, message: `Request sent to ${book.sellerName}! Connect via messages to finalize the trade.` });
        }, 800);
    });
}
