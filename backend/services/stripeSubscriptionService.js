const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getMembershipTierById } = require('../models/membershipModel');

class StripeSubscriptionService {
  /**
   * Initializes a Stripe Checkout pipeline for premium tiers with conditional trial periods.
   */
  static async createCheckoutSession(userId, tierId, successUrl, cancelUrl) {
    // 1. Fetch targeted tier parameters out of the relational core
    const tier = await getMembershipTierById(tierId);
    if (!tier) throw new Error('Target membership tier configuration could not be located.');

    const checkoutConfig = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: tier.stripePriceId, // Linked Stripe Price Object String
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: `${userId}:${tierId}`,
      subscription_data: {
        metadata: { userId, tierId }
      }
    };

    // 2. Acceptance Criteria: Inject Stripe's native trial functionality if allowed
    if (tier.trial_days_allowed > 0) {
      checkoutConfig.subscription_data.trial_period_days = tier.trial_days_allowed;
    }

    // 3. Compile and issue the remote Stripe Checkout Session
    const session = await stripe.checkout.sessions.create(checkoutConfig);
    return { checkoutUrl: session.url };
  }
}

module.exports = StripeSubscriptionService;
