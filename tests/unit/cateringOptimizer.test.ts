// tests/unit/cateringOptimizer.test.ts

import { optimizeCatering, MenuItem, CateringConstraints } from '../../server/services/cateringOptimizer';

describe('Dynamic Event Catering Budget Optimizer (#4158)', () => {
    const mockMenu: MenuItem[] = [
        { id: 'm1', vendorId: 'v1', name: 'Vendor A Vegan Wrap', price: 6.50, category: 'vegan' },
        { id: 'm2', vendorId: 'v2', name: 'Vendor B Vegan Roll', price: 7.00, category: 'vegan' },
        { id: 'm3', vendorId: 'v1', name: 'Vendor A GF Bowl', price: 8.00, category: 'gluten-free' },
        { id: 'm4', vendorId: 'v3', name: 'Vendor C Standard Pizza', price: 5.00, category: 'standard' }
    ];

    it('should find optimal vendor combination meeting dietary and budget constraints', () => {
        const constraints: CateringConstraints = {
            maxBudget: 300,
            requiredStandard: 40,
            requiredVegan: 10,
            requiredGlutenFree: 2,
            totalMinCount: 52
        };

        const result = optimizeCatering(mockMenu, constraints);

        expect(result.success).toBe(true);
        expect(result.totalCost).toBeLessThanOrEqual(constraints.maxBudget);
        expect(result.cart.length).toBeGreaterThan(0);
    });

    it('should fail gracefully if budget is insufficient', () => {
        const constraints: CateringConstraints = {
            maxBudget: 50, // Too low
            requiredStandard: 40,
            requiredVegan: 10,
            requiredGlutenFree: 2,
            totalMinCount: 52
        };

        const result = optimizeCatering(mockMenu, constraints);

        expect(result.success).toBe(false);
        expect(result.message).toContain('exceed budget');
    });
});
