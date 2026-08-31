const express = require('express');
const router = express.Router();
const RadiusAccountingLog = require('../models/RadiusAccountingLog');
// Mocking Stripe for prototype
const stripe = { 
  invoiceItems: { create: async () => {} },
  invoices: { create: async () => ({ id: 'inv_123' }), sendInvoice: async () => {} }
};

/**
 * Endpoint to intercept RADIUS Accounting-Request packets from the host institution (MIT).
 * The packet contains bandwidth usage tied to a zero-knowledge proof identity.
 */
router.post('/api/radius/accounting', async (req, res) => {
  const { zkProofId, acctInputOctets, acctOutputOctets, acctStatusType, timestamp } = req.body;

  try {
    if (acctStatusType === 'Start') {
      await RadiusAccountingLog.create({
        zkProofIdentifier: zkProofId,
        sessionStartTime: new Date(timestamp),
      });
      return res.status(201).json({ status: 'Session started' });
    }

    if (acctStatusType === 'Interim-Update' || acctStatusType === 'Stop') {
      const session = await RadiusAccountingLog.findOne({ zkProofIdentifier: zkProofId, billingStatus: 'UNBILLED' }).sort({ createdAt: -1 });
      
      if (session) {
        session.bytesIn += parseInt(acctInputOctets) || 0;
        session.bytesOut += parseInt(acctOutputOctets) || 0;
        if (acctStatusType === 'Stop') {
          session.sessionEndTime = new Date(timestamp);
        }
        await session.save();
        return res.status(200).json({ status: 'Accounting data updated' });
      } else {
        return res.status(404).json({ error: 'Active session not found' });
      }
    }

    res.status(400).json({ error: 'Invalid Acct-Status-Type' });
  } catch (error) {
    console.error('[RADIUS ACCOUNTING ERROR]', error);
    res.status(500).json({ error: 'Failed to process RADIUS accounting packet' });
  }
});

/**
 * Endpoint to generate B2B Invoice for inter-institutional bandwidth usage.
 */
router.post('/api/radius/billing/invoice', async (req, res) => {
  try {
    // Aggregate unbilled bandwidth for Harvard students on MIT network
    const logs = await RadiusAccountingLog.find({ billingStatus: 'UNBILLED', homeInstitution: 'Harvard University' });
    
    if (logs.length === 0) {
      return res.status(200).json({ message: 'No unbilled usage found.' });
    }

    let totalBytes = 0;
    logs.forEach(log => {
      totalBytes += (log.bytesIn + log.bytesOut);
    });

    const totalGigabytes = totalBytes / (1024 ** 3); // Convert to GB
    // Pricing model: $0.01 per GB
    const costPerGB = 0.01; 
    const totalAmount = Math.ceil(totalGigabytes * costPerGB * 100); // Amount in cents

    if (totalAmount > 0) {
      // Mock Stripe Customer ID for Harvard IT Department
      const customerId = 'cus_HarvardITDept123';
      
      // Create Invoice Item
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: totalAmount,
        currency: 'usd',
        description: `MIT Network Usage: Harvard Students consumed ${totalGigabytes.toFixed(2)} GB of data.`
      });

      // Create and send Invoice
      const invoice = await stripe.invoices.create({
        customer: customerId,
        collection_method: 'send_invoice',
        days_until_due: 30
      });
      await stripe.invoices.sendInvoice(invoice.id);
      
      // Mark logs as invoiced
      await RadiusAccountingLog.updateMany({ _id: { $in: logs.map(l => l._id) } }, { billingStatus: 'INVOICED' });

      res.status(200).json({ 
        status: 'INVOICE_GENERATED', 
        message: `B2B Invoice generated for ${totalGigabytes.toFixed(2)} GB. Total Cost: $${(totalAmount / 100).toFixed(2)}` 
      });
    } else {
      res.status(200).json({ message: 'Usage too low to bill.' });
    }
  } catch (error) {
    console.error('[BILLING ERROR]', error);
    res.status(500).json({ error: 'Failed to generate inter-institutional invoice' });
  }
});

module.exports = router;
