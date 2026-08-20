/**
 * Campus Marketplace Engine
 * Listing schemas, course tag filters, condition quality ratings, and offer negotiators.
 */

export interface MarketplaceItem {
    id: string;
    title: string;
    category: 'Textbooks' | 'Electronics' | 'Dorm Goods';
    courseCode?: string;
    condition: 'Like New' | 'Good' | 'Fair';
    priceUSD: number;
    sellerName: string;
    sellerMajor: string;
    description: string;
}

export const MOCK_MARKETPLACE_ITEMS: MarketplaceItem[] = [
    {
        id: "item_1",
        title: "Introduction to Algorithms (4th Edition - Cormen)",
        category: "Textbooks",
        courseCode: "CS301",
        condition: "Like New",
        priceUSD: 45,
        sellerName: "Alex Rivera",
        sellerMajor: "Computer Science '26",
        description: "Hardcover condition, minimal highlights on Chapter 3. Includes digital access code."
    },
    {
        id: "item_2",
        title: "Dell 27-inch 4K Monitor (USB-C Hub)",
        category: "Electronics",
        condition: "Good",
        priceUSD: 160,
        sellerName: "Sarah Chen",
        sellerMajor: "Electrical Engineering '25",
        description: "Great for dorm multi-screen setups. Includes power adapter and HDMI cable."
    },
    {
        id: "item_3",
        title: "Compact Dorm Mini Fridge (3.2 Cu. Ft)",
        category: "Dorm Goods",
        condition: "Good",
        priceUSD: 75,
        sellerName: "Jordan Smith",
        sellerMajor: "Business Administration '27",
        description: "Works perfectly, includes freezer compartment. Available for pickup at North Hall."
    }
];

export const filterMarketplaceItems = (items: MarketplaceItem[], category: string): MarketplaceItem[] => {
    if (category === 'All') return items;
    return items.filter(i => i.category === category);
};
