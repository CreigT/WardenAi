/**
 * Warden Console: Billing & Subscription View
 * Stripe Checkout, Customer Portal, Plan Tiers & Invoices
 * Creignificent LLC
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  CreditCard,
  CheckCircle2,
  ExternalLink,
  Shield,
  Zap,
  Building,
  ArrowRight,
  Sparkles,
  Lock
} from 'lucide-react';
import type { Subscription, SubscriptionPlan } from '../../types';

export const BillingView: React.FC = () => {
  const { organization } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  useEffect(() => {
    loadSubscription();
  }, [organization]);

  const loadSubscription = async () => {
    try {
      const sub = await api.getSubscription();
      setSubscription(sub);
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    setProcessingPlan(plan);
    try {
      const res = await api.createCheckout(plan, window.location.href);
      if (res.url) {
        if (res.simulated) {
          alert(`Simulated Stripe Checkout completed! Upgraded to ${plan.toUpperCase()} tier.`);
          await loadSubscription();
        } else {
          window.location.href = res.url;
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to initiate checkout');
    } finally {
      setProcessingPlan(null);
    }
  };

  const handlePortal = async () => {
    try {
      const res = await api.openCustomerPortal(window.location.href);
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      alert(err.message || 'Failed to open customer portal');
    }
  };

  const currentPlan = subscription?.plan || 'developer';

  const plans = [
    {
      id: 'developer' as SubscriptionPlan,
      name: 'Developer',
      price: '$0',
      period: 'forever free',
      description: 'Zero-trust security playground for personal agents & local testing.',
      features: [
        'Up to 10,000 action admits / mo',
        '2 Agent projects',
        'Standard policy rules engine',
        'Community support',
        '30-day audit log retention'
      ]
    },
    {
      id: 'pro' as SubscriptionPlan,
      name: 'Pro',
      price: '$79',
      period: 'per month',
      popular: true,
      description: 'Production control plane for autonomous agent workloads & startups.',
      features: [
        'Up to 250,000 action admits / mo',
        '10 Agent projects',
        'Path traversal & secret leak prevention',
        'Automated Kill Switch triggers',
        '1-year audit log retention',
        'Role-Based Access Control (RBAC)'
      ]
    },
    {
      id: 'business' as SubscriptionPlan,
      name: 'Business / Enterprise',
      price: '$299',
      period: 'per month',
      description: 'Custom scale, dedicated tenancy & automated SOC2 audit reporting.',
      features: [
        'Up to 2,000,000 action admits / mo',
        'Unlimited projects & workspaces',
        'Custom regex & DLP policy scanning',
        'SAML / SSO & Directory sync',
        'Dedicated SLA & Creignificent Support',
        'Continuous SIEM Webhook streaming'
      ]
    }
  ];

  return (
    <div id="warden-billing-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-cyan-400" />
            Billing & Subscriptions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your WardenAi control plane tier, payment methods, and invoices powered by Stripe.
          </p>
        </div>

        {subscription?.stripe_customer_id && (
          <button
            onClick={handlePortal}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Stripe Customer Portal
          </button>
        )}
      </div>

      {/* Active Subscription Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Subscription</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {subscription?.status || 'active'}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white uppercase">{currentPlan} Plan</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Organization: <span className="text-slate-300 font-semibold">{organization?.name}</span> • Sponsored by Creignificent LLC
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs font-mono text-slate-400">Billing Cycle</div>
          <div className="text-xs font-semibold text-slate-200">
            {subscription?.current_period_end ? `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}` : 'No active renewal schedule'}
          </div>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map(plan => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`bg-slate-900 border rounded-2xl p-6 flex flex-col justify-between relative transition-all ${
                plan.popular
                  ? 'border-cyan-500/80 shadow-2xl shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-slate-950 font-bold text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full shadow-md">
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                </div>

                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-3xl font-extrabold text-white font-mono">{plan.price}</span>
                  <span className="text-xs text-slate-400">/{plan.period}</span>
                </div>

                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  {plan.description}
                </p>

                <div className="space-y-2.5 mb-6">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                disabled={isCurrent || processingPlan === plan.id}
                onClick={() => handleUpgrade(plan.id)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-slate-800 text-slate-400 cursor-default'
                    : plan.popular
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                {isCurrent ? (
                  'Current Plan'
                ) : processingPlan === plan.id ? (
                  'Redirecting to Stripe...'
                ) : (
                  <>
                    Upgrade to {plan.name}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
