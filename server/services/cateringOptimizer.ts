// server/services/cateringOptimizer.ts

export interface MenuItem {
    id: string;
    vendorId: string;
    name: string;
    price: number;
    category: 'standard' | 'vegan' | 'gluten-free';
}

export interface CateringConstraints {
    maxBudget: number;
    requiredStandard: number;
    requiredVegan: number;
    requiredGlutenFree: number;
    totalMinCount: number;
}

export interface CartItem {
    item: MenuItem;
    quantity: number;
}

export interface OptimizationResult {
    success: boolean;
    totalCost: number;
    cart: CartItem[];
    message: string;
}

/**
 * Optimizes catering budget given constraints and available menu items.
 */
export function optimizeCatering(
    menuItems: MenuItem[],
    constraints: CateringConstraints
): OptimizationResult {
    // Greedy/Combinatorial solver mock for demonstration
    // In production, this integrates with glpk.js for exact ILP solving.
    let bestCart: CartItem[] = [];
    let minCost = Infinity;

    // Filter cheapest items per category
    const veganItems = menuItems.filter(i => i.category === 'vegan').sort((a, b) => a.price - b.price);
    const gfItems = menuItems.filter(i => i.category === 'gluten-free').sort((a, b) => a.price - b.price);
    const standardItems = menuItems.filter(i => i.category === 'standard').sort((a, b) => a.price - b.price);

    if (veganItems.length === 0 || gfItems.length === 0 || standardItems.length === 0) {
        return { success: false, totalCost: 0, cart: [], message: 'Insufficient menu items across required dietary categories.' };
    }

    const cheapestVegan = veganItems[0];
    const cheapestGf = gfItems[0];
    const cheapestStandard = standardItems[0];

    const totalVeganCost = cheapestVegan.price * constraints.requiredVegan;
    const totalGfCost = cheapestGf.price * constraints.requiredGlutenFree;
    
    const remainingMealsCount = Math.max(0, constraints.totalMinCount - (constraints.requiredVegan + constraints.requiredGlutenFree));
    const totalStandardCost = cheapestStandard.price * remainingMealsCount;

    const totalCost = totalVeganCost + totalGfCost + totalStandardCost;

    if (totalCost > constraints.maxBudget) {
        return {
            success: false,
            totalCost,
            cart: [],
            message: `Optimization failed: Required meals exceed budget ($${totalCost} > $${constraints.maxBudget}).`
        };
    }

    bestCart = [
        { item: cheapestVegan, quantity: constraints.requiredVegan },
        { item: cheapestGf, quantity: constraints.requiredGlutenFree },
        { item: cheapestStandard, quantity: remainingMealsCount }
    ];

    return {
        success: true,
        totalCost,
        cart: bestCart,
        message: `Successfully optimized cart within $${constraints.maxBudget} budget.`
    };
}
