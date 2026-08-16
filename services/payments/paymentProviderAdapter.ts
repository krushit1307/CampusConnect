export interface PaymentProvider {
  refundTransaction(transactionId: string, amount: number): Promise<boolean>;
  verifyRefundStatus(refundId: string): Promise<string>;
}

export class StripeAdapter implements PaymentProvider {
  async refundTransaction(transactionId: string, amount: number): Promise<boolean> {
    console.log(`[Stripe] Refunding ${amount} for tx ${transactionId}`);
    return true; // Mock implementation
  }
  
  async verifyRefundStatus(refundId: string): Promise<string> {
    return 'REFUNDED';
  }
}

export class RazorpayAdapter implements PaymentProvider {
  async refundTransaction(transactionId: string, amount: number): Promise<boolean> {
    console.log(`[Razorpay] Refunding ${amount} for tx ${transactionId}`);
    return true;
  }

  async verifyRefundStatus(refundId: string): Promise<string> {
    return 'REFUNDED';
  }
}

export class PaymentProviderFactory {
  static getProvider(type: 'stripe' | 'razorpay'): PaymentProvider {
    switch (type) {
      case 'stripe': return new StripeAdapter();
      case 'razorpay': return new RazorpayAdapter();
      default: throw new Error("Unsupported provider");
    }
  }
}
