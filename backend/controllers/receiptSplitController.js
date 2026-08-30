// backend/controllers/receiptSplitController.js
// Handles granular line-item mapping and structural 1-to-Many ledger allocations

// Mock models for demonstration purposes
const LedgerTransaction = {
  findById: async (id) => {
    return {
      id,
      clubId: 'club_test_1',
      totalAmount: 200.00,
      isSplitProcessed: false,
      save: async function() { return this; }
    };
  }
};

const TransactionAllocation = {
  deleteMany: async () => {},
  create: async (data) => data
};

export const allocateReceiptSplits = async (req, res) => {
  const { ledgerTransactionId, allocations } = req.body; 
  // allocations structure: [{ budgetCategory: 'Food', amount: 100.00, items: ['Pizza'] }]

  try {
    const parentTransaction = await LedgerTransaction.findById(ledgerTransactionId);
    if (!parentTransaction) {
      return res.status(404).json({ error: "Monolithic ledger transaction trace not found." });
    }

    // 1. Enforce precise financial math validation (Sum of splits must equal parent total)
    const totalAllocatedSum = allocations.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const expectedTotal = parseFloat(parentTransaction.totalAmount); // e.g., $200.00 Stripe charge

    if (Math.abs(totalAllocatedSum - expectedTotal) > 0.01) {
      return res.status(400).json({ 
        error: `Financial Math Mismatch. Allocated sum ($${totalAllocatedSum.toFixed(2)}) must exactly equal transaction total ($${expectedTotal.toFixed(2)}).` 
      });
    }

    // 2. Clear old references and persist new 1-to-Many dynamic relational mappings
    await TransactionAllocation.deleteMany({ ledgerTransactionId });

    const allocationRecords = await Promise.all(
      allocations.map(async (allocation) => {
        return await TransactionAllocation.create({
          ledgerTransactionId,
          clubId: parentTransaction.clubId,
          budgetCategory: allocation.budgetCategory, // e.g., 'Food', 'Marketing'
          allocatedAmount: allocation.amount,
          associatedLineItems: allocation.items
        });
      })
    );

    // 3. Mark the parent transaction record as cleanly partitioned
    parentTransaction.isSplitProcessed = true;
    await parentTransaction.save();

    return res.status(201).json({
      success: "Receipt allocation split compiled successfully.",
      recordsCreatedCount: allocationRecords.length
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to isolate relational financial math structures.", details: error.message });
  }
};
