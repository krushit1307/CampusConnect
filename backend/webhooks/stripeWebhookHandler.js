const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { updateUserMembershipState } = require('../models/membershipModel');

async function handleStripeWebhookPayload(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error Signature Rejection: ${err.message}`);
  }

  const subscription = event.data.object;
  const { userId, tierId } = subscription.metadata || {};

  switch (event.type) {
    case 'checkout.session.completed':
      // User successfully entered credit card, initialization at $0.00 if trial is present
      const status = subscription.status === 'trialing' ? 'TRIAL' : 'ACTIVE';
      const trialEnds = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
      
      await updateUserMembershipState(userId, tierId, {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: status,
        trialEndsAt: trialEnds,
        role: 'Premium' // Promotes role permissions immediately to Premium status
      });
      break;

    case 'customer.subscription.updated':
      // Triggers automatically when a 14-day trial period converts into a charged $20 subscription
      const updatedStatus = subscription.status === 'active' ? 'ACTIVE' : 'TRIAL';
      await updateUserMembershipState(userId, tierId, { subscriptionStatus: updatedStatus });
      break;

    case 'customer.subscription.deleted':
      // Triggers when a user cancels their trial subscription, revoking the role parameters immediately
      await updateUserMembershipState(userId, tierId, {
        subscriptionStatus: 'CANCELLED',
        role: 'Standard' // Drops role back down to baseline standard tier access parameters
      });
      break;
  }

  return res.status(200).json({ received: true });
}

module.exports = { handleStripeWebhookPayload };
