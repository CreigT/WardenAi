/**
 * Warden Stripe Billing & Plan Subscription Integration
 * Creignificent LLC
 */

import Stripe from 'stripe';
import { db } from './db';
import { logAuditEvent } from './auth';
import type { Subscription, SubscriptionPlan, PlanLimits } from '../src/types';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  developer: {
    monthly_actions: 5000,
    max_projects: 2,
    max_team_members: 2,
    custom_policies: true,
    advanced_threat_detection: false,
    priority_kill_switch: false,
    audit_log_retention_days: 14
  },
  pro: {
    monthly_actions: 100000,
    max_projects: 10,
    max_team_members: 10,
    custom_policies: true,
    advanced_threat_detection: true,
    priority_kill_switch: true,
    audit_log_retention_days: 90
  },
  business: {
    monthly_actions: 1000000,
    max_projects: 50,
    max_team_members: 50,
    custom_policies: true,
    advanced_threat_detection: true,
    priority_kill_switch: true,
    audit_log_retention_days: 365
  }
};

export async function createCheckoutSession(params: {
  organizationId: string;
  userEmail: string;
  plan: SubscriptionPlan;
  returnUrl: string;
}): Promise<{ url: string; simulated?: boolean }> {
  const stripe = getStripe();
  const store = db.get();
  const org = store.organizations.find(o => o.id === params.organizationId);

  if (!stripe) {
    // If Stripe key is not configured in environment, update organization subscription directly
    // and provide instant activation
    let sub = store.subscriptions.find(s => s.organization_id === params.organizationId);
    if (!sub) {
      sub = {
        id: `sub_${Date.now()}`,
        organization_id: params.organizationId,
        plan: params.plan,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        limits: PLAN_LIMITS[params.plan]
      };
      store.subscriptions.push(sub);
    } else {
      sub.plan = params.plan;
      sub.status = 'active';
      sub.limits = PLAN_LIMITS[params.plan];
      sub.current_period_end = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    }

    logAuditEvent({
      organization_id: params.organizationId,
      user_email: params.userEmail,
      event_type: 'billing.subscription_updated',
      decision: 'ALLOW',
      reason: `Subscription updated to ${params.plan.toUpperCase()} plan.`,
      metadata: { plan: params.plan, simulated: true }
    });

    await db.persist();
    return {
      url: `${params.returnUrl}?billing_success=true&plan=${params.plan}`,
      simulated: true
    };
  }

  const priceMap: Record<string, string> = {
    pro: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
    business: process.env.STRIPE_PRICE_BUSINESS || 'price_business_monthly'
  };

  const priceId = priceMap[params.plan];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: params.userEmail,
    client_reference_id: params.organizationId,
    metadata: {
      organization_id: params.organizationId,
      plan: params.plan
    },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Warden ${params.plan.toUpperCase()} Security Subscription`,
            description: `Security control plane for autonomous agents (${PLAN_LIMITS[params.plan].monthly_actions.toLocaleString()} actions/mo)`
          },
          unit_amount: params.plan === 'pro' ? 7900 : 29900,
          recurring: {
            interval: 'month'
          }
        },
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${params.returnUrl}?session_id={CHECKOUT_SESSION_ID}&billing_success=true`,
    cancel_url: `${params.returnUrl}?billing_canceled=true`
  });

  return { url: session.url || params.returnUrl };
}

export async function createCustomerPortal(params: {
  organizationId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const store = db.get();
  const sub = store.subscriptions.find(s => s.organization_id === params.organizationId);

  if (!stripe || !sub?.stripe_customer_id) {
    return { url: `${params.returnUrl}?portal=simulated` };
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: params.returnUrl
  });

  return { url: portal.url };
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const store = db.get();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.client_reference_id || session.metadata?.organization_id;
      const plan = (session.metadata?.plan as SubscriptionPlan) || 'pro';

      if (orgId) {
        let sub = store.subscriptions.find(s => s.organization_id === orgId);
        if (!sub) {
          sub = {
            id: `sub_${session.id}`,
            organization_id: orgId,
            plan,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : undefined,
            stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : undefined,
            limits: PLAN_LIMITS[plan]
          };
          store.subscriptions.push(sub);
        } else {
          sub.plan = plan;
          sub.status = 'active';
          sub.stripe_customer_id = typeof session.customer === 'string' ? session.customer : undefined;
          sub.stripe_subscription_id = typeof session.subscription === 'string' ? session.subscription : undefined;
          sub.limits = PLAN_LIMITS[plan];
        }

        logAuditEvent({
          organization_id: orgId,
          event_type: 'billing.subscription_updated',
          decision: 'ALLOW',
          reason: `Stripe Checkout completed for plan: ${plan}`,
          metadata: { session_id: session.id, customer: session.customer }
        });

        await db.persist();
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const sub = store.subscriptions.find(s => s.stripe_subscription_id === subscription.id);
      if (sub) {
        sub.status = 'canceled';
        sub.plan = 'developer';
        sub.limits = PLAN_LIMITS.developer;
        await db.persist();
      }
      break;
    }
  }
}
