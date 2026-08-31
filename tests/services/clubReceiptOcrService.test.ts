/**
 * Enterprise Architectural Specification & Header:
 * Module: Automated Unit Test Suite for Club Spending Receipt OCR Service
 * File: tests/services/clubReceiptOcrService.test.ts
 * Framework: Jest JS / Enterprise CampusConnect Test Suite (#4267)
 * Coverage Goal: 100% Statement & Branch Coverage Compliance
 *
 * Test Scenarios:
 * 1. AWS Textract AnalyzeExpense JSON Parsing (Vendor Name, Total Amount, Date)
 * 2. Sanitize Raw OCR String Formats (e.g., "$45.92" -> 45.92, "Domino's Pizza #4402" -> "Domino's")
 * 3. Pre-fill Ledger Entry Payload Generation
 * 4. Error Handling for Invalid/Missing Textract Payloads
 * 5. Input Sanitation Security Review against Cross-Site Scripting (XSS)
 */

import { ClubReceiptOcrService } from '../../src/services/clubReceiptOcrService';

describe('ClubReceiptOcrService Enterprise Test Suite (#4267)', () => {
  let service: ClubReceiptOcrService;

  beforeEach(() => {
    service = new ClubReceiptOcrService();
  });

  describe('AWS Textract AnalyzeExpense Response Parsing', () => {
    test('should extract Vendor Name, Total Amount, and Date from valid Textract JSON', () => {
      const mockPayload = {
        ExpenseDocuments: [
          {
            SummaryFields: [
              {
                Type: { Text: 'VENDOR_NAME' },
                ValueDetection: { Text: "Domino's Pizza #4402", Confidence: 99.0 }
              },
              {
                Type: { Text: 'TOTAL' },
                ValueDetection: { Text: '$45.92', Confidence: 98.5 }
              },
              {
                Type: { Text: 'INVOICE_RECEIPT_DATE' },
                ValueDetection: { Text: '2026-08-23', Confidence: 97.0 }
              }
            ]
          }
        ]
      };

      const parsed = service.parseTextractExpenseResponse(mockPayload, 'https://example.com/receipt.jpg');

      expect(parsed.vendorName).toBe("Domino's");
      expect(parsed.totalAmount).toBe(45.92);
      expect(parsed.purchaseDate).toBe('2026-08-23');
      expect(parsed.confidenceScore).toBeGreaterThan(95.0);
    });

    test('should throw error for empty expense document response', () => {
      expect(() => service.parseTextractExpenseResponse({}, 'url')).toThrow(
        'Invalid AWS Textract response: No expense documents detected.'
      );
    });
  });

  describe('Ledger Pre-Fill Payload Generation', () => {
    test('should construct pre-fill ledger object with isOcrVerified flag', () => {
      const parsed = {
        vendorName: "Domino's",
        totalAmount: 45.92,
        purchaseDate: '2026-08-23',
        confidenceScore: 98.2,
        receiptImageUrl: 'https://example.com/receipt.jpg'
      };

      const preFill = service.generateLedgerPreFill(parsed, 'CLUB-101', 'TREASURER-501');

      expect(preFill.clubId).toBe('CLUB-101');
      expect(preFill.vendorName).toBe("Domino's");
      expect(preFill.amount).toBe(45.92);
      expect(preFill.isOcrVerified).toBe(true);
    });
  });

  describe('Input Sanitation Security Validation', () => {
    test('should sanitize malicious XSS payloads', () => {
      const clean = service.sanitizeInput('<script>alert("hack")</script>');
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('&lt;script&gt;');
    });
  });
});
