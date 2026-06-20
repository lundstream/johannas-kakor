/**
 * Single source of truth for "does this tenant get watermarked output?"
 *
 * A "tenant" here is a user-account row (see the users-table migration in db.js).
 * Only the Stripe webhook writes the plan / subscription_status fields this reads.
 *
 * Rules:
 *   - plan === 'trial'                                   -> watermarked
 *   - plan === 'paid' AND status in (active, trialing)   -> NOT watermarked
 *   - plan === 'paid' AND status NOT in (active,trialing) -> watermarked (lapsed)
 *   - plan === 'free_comp'                               -> NOT watermarked
 *   - unknown / missing                                  -> watermarked (safe default)
 *
 * Do NOT add scattered "is paid?" checks elsewhere — call this.
 */
const ENTITLED_STATUSES = new Set(['active', 'trialing']);

export function isWatermarked(tenant) {
  if (!tenant) return true;
  // Operators (admins) never get watermarked output, regardless of plan.
  if (tenant.role === 'admin') return false;
  const plan = tenant.plan || 'trial';
  if (plan === 'free_comp') return false;
  if (plan === 'paid') return !ENTITLED_STATUSES.has(tenant.subscription_status);
  // 'trial' or anything unrecognized
  return true;
}
