import Stripe from 'stripe';
import { settings } from './settings.js';
import { queries } from './db.js';

// Secrets come from the environment ONLY — never settings.json, never the DB,
// never shipped to the client. See .env.example / README.
const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PRICE_ID = process.env.STRIPE_PRICE_ID;

let stripe = null;
function getStripe() {
  if (!SECRET_KEY) return null;
  // Pin to the SDK's bundled apiVersion (omit to let the SDK pick its default).
  if (!stripe) stripe = new Stripe(SECRET_KEY);
  return stripe;
}

/** True when checkout/portal can run (key + price configured). */
export function billingConfigured() {
  return !!(SECRET_KEY && PRICE_ID);
}

function baseUrl() {
  return (settings.base_url || '').replace(/\/$/, '');
}

/**
 * Create a subscription Checkout Session for the logged-in user.
 * Returns the hosted Checkout URL. Persists the Stripe customer id when created.
 */
export async function createCheckoutSession(user) {
  const s = getStripe();
  if (!s || !PRICE_ID) throw new Error('billing_not_configured');

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await s.customers.create({
      email: user.email,
      metadata: { user_id: String(user.id) },
    });
    customerId = customer.id;
    queries.updateUserStripeCustomer.run(customerId, user.id);
  }

  const base = baseUrl();
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    // Two independent ways for the webhook to map back to this user, so we don't
    // depend on event ordering.
    client_reference_id: String(user.id),
    metadata: { user_id: String(user.id) },
    subscription_data: { metadata: { user_id: String(user.id) } },
    allow_promotion_codes: true,
    success_url: `${base}/?billing=success`,
    cancel_url: `${base}/?billing=cancel`,
  });
  return session.url;
}

/** Create a Stripe Customer Portal session (cancel / update card / invoices). */
export async function createPortalSession(user) {
  const s = getStripe();
  if (!s) throw new Error('billing_not_configured');
  if (!user.stripe_customer_id) throw new Error('no_customer');
  const session = await s.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${baseUrl()}/`,
  });
  return session.url;
}

/** Apply subscription state to a user. plan stays 'paid'; status drives entitlement. */
function setBilling(userId, customerId, subscriptionId, status) {
  queries.setUserBilling.run(
    'paid',
    customerId ? String(customerId) : null,
    subscriptionId ? String(subscriptionId) : null,
    status || null,
    userId,
  );
}

function resolveUserId(obj) {
  const fromMeta = Number(obj?.metadata?.user_id);
  if (fromMeta) return fromMeta;
  if (obj?.customer) {
    const u = queries.findUserByStripeCustomer.get(String(obj.customer));
    if (u) return u.id;
  }
  return null;
}

/**
 * Stripe webhook handler. The ONLY writer of plan / stripe_* / subscription_status.
 * Receives the RAW body (express.raw) so the signature can be verified.
 * Idempotent: upserts by Stripe id and drives state from the event's status,
 * so redelivery / out-of-order events converge correctly.
 */
export async function handleWebhook(req, res) {
  const s = getStripe();
  if (!s || !WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'billing_not_configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    // req.body is a Buffer here (express.raw). Never trust an event we can't verify.
    event = s.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[billing] webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = Number(session.client_reference_id) || resolveUserId(session);
        if (userId && session.subscription) {
          const sub = await s.subscriptions.retrieve(String(session.subscription));
          setBilling(userId, session.customer, sub.id, sub.status);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = resolveUserId(sub);
        if (userId) setBilling(userId, sub.customer, sub.id, sub.status);
        break;
      }
      default:
        // Ignore unrelated events.
        break;
    }
  } catch (err) {
    console.error('[billing] webhook handler error:', err);
    // 500 → Stripe retries; handler is idempotent so retries are safe.
    return res.status(500).json({ error: 'handler_error' });
  }

  res.json({ received: true });
}
