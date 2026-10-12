import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// stripe-webhook v9 (13.10.2026, Onboarding v1):
//   - Finalize-Fehler: nur noch ein Code in last_error/error_code (finalize_failed | finalize_state),
//     nie der Rohtext der Datenbank. Der Rohtext steht nur im Log.
//   - Nach erfolgreichem Finalize: Testphase festhalten (_onb_trial_register_v1). Hatten Nutzer,
//     Website-Domain oder Karte (Fingerprint) schon eine, endet die Testphase sofort (trial_end = now).
//   - Alles andere unverändert gegenüber v8.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value;
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function unixToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function getId(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value;

  const record = asRecord(value);
  if (!record) return null;

  return asString(record.id);
}

function getFirstSubscriptionItemInfo(subscription: Stripe.Subscription): {
  priceId: string | null;
  currentPeriodEnd: string | null;
} {
  const subRecord = subscription as unknown as Record<string, unknown>;
  const items = asRecord(subRecord.items);
  const data = Array.isArray(items?.data) ? items.data : [];

  const firstItem = asRecord(data[0]);
  const price = asRecord(firstItem?.price);

  return {
    priceId: asString(price?.id),
    currentPeriodEnd: unixToIso(firstItem?.current_period_end),
  };
}

function getSubscriptionInfo(subscription: Stripe.Subscription) {
  const subRecord = subscription as unknown as Record<string, unknown>;
  const itemInfo = getFirstSubscriptionItemInfo(subscription);

  const subscriptionId = asString(subRecord.id);
  const customerId = getId(subRecord.customer);
  const status = asString(subRecord.status) ?? "unknown";
  const cancelAtPeriodEnd = asBoolean(subRecord.cancel_at_period_end) ?? false;

  const trialEndsAt = unixToIso(subRecord.trial_end);

  const currentPeriodEnd =
    unixToIso(subRecord.current_period_end) ??
    itemInfo.currentPeriodEnd;

  const cancelAt = unixToIso(subRecord.cancel_at);

  const canceledAt = unixToIso(subRecord.canceled_at);
  const endedAt = unixToIso(subRecord.ended_at);

  return {
    subscriptionId,
    customerId,
    status,
    cancelAtPeriodEnd,
    trialEndsAt,
    currentPeriodEnd,
    cancelAt,
    canceledAt,
    endedAt,
    priceId: itemInfo.priceId,
  };
}

function computeAccessEndsAt(params: {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  cancelAt?: string | null;
  canceledAt: string | null;
  endedAt: string | null;
  forceEnded?: boolean;
}): string | null {
  if (params.forceEnded) {
    return params.endedAt ?? params.canceledAt ?? new Date().toISOString();
  }

  if (params.status === "canceled" || params.status === "incomplete_expired") {
    return params.endedAt ?? params.canceledAt ?? new Date().toISOString();
  }

  if (params.cancelAtPeriodEnd) {
    return params.currentPeriodEnd ?? params.cancelAt ?? null;
  }

  return null;
}
async function resolvePlanForPrice(appDb: any, priceId: string | null) {
  if (!priceId) {
    return null;
  }

  const { data: plan, error } = await appDb
    .from("billing_plan")
    .select(`
      id,
      stripe_monthly_price_id,
      stripe_yearly_price_id
    `)
    .or(`stripe_monthly_price_id.eq.${priceId},stripe_yearly_price_id.eq.${priceId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not resolve billing plan for Stripe price: ${error.message}`);
  }

  if (!plan) {
    return null;
  }

  const billingInterval =
    plan.stripe_monthly_price_id === priceId
      ? "monthly"
      : plan.stripe_yearly_price_id === priceId
        ? "yearly"
        : null;

  if (!billingInterval) {
    return null;
  }

  return {
    billingPlanId: plan.id as string,
    billingInterval,
  };
}

async function findTeamIdBySubscription(appDb: any, subscriptionId: string) {
  const { data: billing, error } = await appDb
    .from("team_billing")
    .select("team_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not find team billing by subscription: ${error.message}`);
  }

  return asString(billing?.team_id);
}

async function syncSubscriptionToSupabase(
  appDb: any,
  subscription: Stripe.Subscription,
  options: {
    teamIdHint?: string | null;
    forceEnded?: boolean;
  } = {},
) {
  const info = getSubscriptionInfo(subscription);

  if (!info.subscriptionId) {
    return {
      success: true,
      ignored: true,
      reason: "Missing subscription id",
    };
  }

  // 11.10.2026: Team-Checkout (metadata.source = 'team') traegt die team_id im Abo selbst
  const subMeta = asRecord((subscription as unknown as Record<string, unknown>).metadata) ?? {};
  const metaTeamId =
    asString(subMeta.source) === "team" ? asString(subMeta.team_id) : null;

  const teamId =
    options.teamIdHint ??
    await findTeamIdBySubscription(appDb, info.subscriptionId) ??
    metaTeamId;

  if (!teamId) {
    return {
      success: true,
      ignored: true,
      reason: "No team_billing row found for subscription",
      subscription_id: info.subscriptionId,
    };
  }

  const planMatch = await resolvePlanForPrice(appDb, info.priceId);

const accessEndsAt = computeAccessEndsAt({
  status: info.status,
  cancelAtPeriodEnd: info.cancelAtPeriodEnd,
  currentPeriodEnd: info.currentPeriodEnd,
  cancelAt: info.cancelAt,
  canceledAt: info.canceledAt,
  endedAt: info.endedAt,
  forceEnded: options.forceEnded,
});

  const billingUpdate: Record<string, unknown> = {
    stripe_customer_id: info.customerId,
    stripe_subscription_id: info.subscriptionId,
    status: info.status,
    cancel_at_period_end: info.cancelAtPeriodEnd,
    trial_ends_at: info.trialEndsAt,
    current_period_end: info.currentPeriodEnd,
    canceled_at: info.canceledAt,
    ended_at: options.forceEnded
      ? info.endedAt ?? info.canceledAt ?? new Date().toISOString()
      : info.endedAt,
    access_ends_at: accessEndsAt,
    updated_at: new Date().toISOString(),
  };

  if (planMatch) {
    billingUpdate.billing_plan_id = planMatch.billingPlanId;
    billingUpdate.billing_interval = planMatch.billingInterval;
  }

  const { error: billingUpdateError } = await appDb
    .from("team_billing")
    .update(billingUpdate)
    .eq("team_id", teamId);

  if (billingUpdateError) {
    throw new Error(`Could not update team_billing: ${billingUpdateError.message}`);
  }

  const teamUpdate: Record<string, unknown> = {};

  if (planMatch) {
    teamUpdate.billing_plan_id = planMatch.billingPlanId;
  }

  // 11.10.2026: Ein Abo-Ende loescht das Team nicht mehr. Der Zugang endet ueber
  // team_billing (status / access_ends_at, siehe app.team_access); das Team kann
  // danach wieder ein Abo abschliessen (create-team-checkout).

  if (Object.keys(teamUpdate).length > 0) {
    const { error: teamUpdateError } = await appDb
      .from("team")
      .update(teamUpdate)
      .eq("id", teamId);

    if (teamUpdateError) {
      throw new Error(`Could not update team: ${teamUpdateError.message}`);
    }
  }

  return {
    success: true,
    ignored: false,
    team_id: teamId,
    subscription_id: info.subscriptionId,
    customer_id: info.customerId,
    status: info.status,
    cancel_at_period_end: info.cancelAtPeriodEnd,
    current_period_end: info.currentPeriodEnd,
    trial_ends_at: info.trialEndsAt,
    access_ends_at: accessEndsAt,
    stripe_price_id: info.priceId,
    billing_plan_id: planMatch?.billingPlanId ?? null,
    billing_interval: planMatch?.billingInterval ?? null,
    force_ended: options.forceEnded ?? false,
  };
}

// 13.10.2026: Finalize gescheitert -> nur ein Code, nie der Rohtext.
async function markFinalizeFailed(appDb: any, onboardingId: string, userId: string, message: string) {
  const code = /cannot be finalized from status/i.test(message) ? "finalize_state" : "finalize_failed";
  const { error } = await appDb.rpc("_onb_finalize_failed_v1", { p_onboarding: onboardingId, p_code: code });
  if (error) {
    // Rückfall, solange onboarding_v1.sql noch nicht eingespielt ist
    await appDb
      .from("onboarding_project")
      .update({ last_error: code, status_label: "Setup failed after billing", updated_at: new Date().toISOString() })
      .eq("id", onboardingId)
      .eq("user_id", userId);
  }
  return code;
}

// 13.10.2026: Testphase festhalten; schon einmal genutzt (Nutzer, Domain oder Karte) -> sofort beenden.
async function registerTrial(appDb: any, stripe: Stripe, onboardingId: string, subscriptionId: string) {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["default_payment_method"] });
    const rec = sub as unknown as Record<string, any>;
    if (rec.status !== "trialing" || !rec.trial_end || !rec.trial_start) {
      return { registered: false, end_trial: false };
    }
    const trialDays = Math.round((rec.trial_end - rec.trial_start) / 86400);
    const fingerprint = rec.default_payment_method?.card?.fingerprint ?? null;
    const { data, error } = await appDb.rpc("_onb_trial_register_v1", {
      p_onboarding: onboardingId,
      p_subscription: subscriptionId,
      p_fingerprint: fingerprint,
      p_trial_days: trialDays,
    });
    if (error) {
      console.error("trial register failed", error.message);
      return { registered: false, end_trial: false };
    }
    if (data?.end_trial === true) {
      await stripe.subscriptions.update(subscriptionId, { trial_end: "now", proration_behavior: "none" });
      console.log("trial ended early", onboardingId, subscriptionId);
    }
    return data;
  } catch (e) {
    console.error("trial register failed", e instanceof Error ? e.message : String(e));
    return { registered: false, end_trial: false };
  }
}

async function handleCheckoutSessionCompleted(
  appDb: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  if (session.mode !== "subscription") {
    return {
      success: true,
      received: true,
      ignored: true,
      reason: "Checkout session is not subscription mode",
      session_id: session.id,
    };
  }

  const metadata = session.metadata ?? {};

  // 11.10.2026: Kasse fuer bestehende Teams (create-team-checkout)
  if (asString(metadata.source) === "team") {
    return await handleTeamCheckoutCompleted(appDb, stripe, session);
  }

  const onboardingId = asString(metadata.onboarding_id);
  const userId = asString(metadata.user_id);
  const billingPlanId = asString(metadata.billing_plan_id);
  const billingInterval = asString(metadata.billing_interval);

  if (!onboardingId || !userId || !billingPlanId || !billingInterval) {
    console.error("Missing required metadata", {
      session_id: session.id,
      metadata,
    });

    return {
      success: false,
      status: 400,
      error: "Missing required checkout metadata",
      session_id: session.id,
    };
  }

  if (billingInterval !== "monthly" && billingInterval !== "yearly") {
    return {
      success: false,
      status: 400,
      error: "Invalid billing_interval in checkout metadata",
      session_id: session.id,
      billing_interval: billingInterval,
    };
  }

  const subscriptionId = getId(session.subscription);

  if (!subscriptionId) {
    return {
      success: false,
      status: 400,
      error: "Missing Stripe subscription id",
      session_id: session.id,
    };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subRecord = subscription as unknown as Record<string, unknown>;

  const customerId =
    getId(session.customer) ??
    getId(subRecord.customer);

  if (!customerId) {
    return {
      success: false,
      status: 400,
      error: "Missing Stripe customer id",
      session_id: session.id,
      subscription_id: subscriptionId,
    };
  }

  const subscriptionInfo = getSubscriptionInfo(subscription);

  const { data: finalizeResult, error: finalizeError } = await appDb.rpc(
    "onboarding_finalize_after_billing_v1",
    {
      p_onboarding_id: onboardingId,
      p_user_id: userId,
      p_billing_plan_id: billingPlanId,
      p_billing_interval: billingInterval,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscriptionId,
      p_stripe_subscription_status: subscriptionInfo.status,
      p_trial_ends_at: subscriptionInfo.trialEndsAt,
      p_current_period_end: subscriptionInfo.currentPeriodEnd,
    },
  );

  if (finalizeError) {
    console.error("Finalize onboarding failed:", {
      session_id: session.id,
      subscription_id: subscriptionId,
      error: finalizeError,
    });

    const code = await markFinalizeFailed(appDb, onboardingId, userId, finalizeError.message ?? "");

    return {
      success: false,
      status: 500,
      error: "Finalize onboarding failed",
      code,
      session_id: session.id,
      subscription_id: subscriptionId,
    };
  }

  const trialResult = await registerTrial(appDb, stripe, onboardingId, subscriptionId);

  const finalizeRecord = asRecord(finalizeResult);
  const finalizedTeamId = asString(finalizeRecord?.team_id);

  // Nach einem vorzeitigen Ende der Testphase den neuen Stand holen
  const freshSubscription = trialResult?.end_trial === true
    ? await stripe.subscriptions.retrieve(subscriptionId)
    : subscription;

  const syncResult = await syncSubscriptionToSupabase(appDb, freshSubscription, {
    teamIdHint: finalizedTeamId,
  });

  return {
    success: true,
    received: true,
    event_type: "checkout.session.completed",
    session_id: session.id,
    subscription_id: subscriptionId,
    customer_id: customerId,
    finalize_result: finalizeResult,
    trial_result: trialResult,
    sync_result: syncResult,
  };
}

async function handleTeamCheckoutCompleted(
  appDb: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  const metadata = session.metadata ?? {};
  const teamId = asString(metadata.team_id);
  const userId = asString(metadata.user_id);
  const planId = asString(metadata.billing_plan_id);
  const billingInterval = asString(metadata.billing_interval);

  if (!teamId || !planId || !billingInterval) {
    return {
      success: false,
      status: 400,
      error: "Missing required team checkout metadata",
      session_id: session.id,
    };
  }

  const subscriptionId = getId(session.subscription);
  if (!subscriptionId) {
    return { success: false, status: 400, error: "Missing Stripe subscription id", session_id: session.id };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const info = getSubscriptionInfo(subscription);
  const customerId = getId(session.customer) ?? info.customerId;

  if (!customerId) {
    return { success: false, status: 400, error: "Missing Stripe customer id", session_id: session.id };
  }

  const { data: applyResult, error: applyError } = await appDb.rpc(
    "_billing_team_checkout_apply_v1",
    {
      p_team: teamId,
      p_user: userId,
      p_plan: planId,
      p_interval: billingInterval,
      p_customer: customerId,
      p_subscription: subscriptionId,
      p_status: info.status,
      p_trial_ends_at: info.trialEndsAt,
      p_current_period_end: info.currentPeriodEnd,
    },
  );

  if (applyError) {
    console.error("Team checkout apply failed:", { session_id: session.id, error: applyError });
    return {
      success: false,
      status: 500,
      error: "Team checkout apply failed",
      details: applyError.message,
      session_id: session.id,
    };
  }

  const syncResult = await syncSubscriptionToSupabase(appDb, subscription, { teamIdHint: teamId });

  return {
    success: true,
    received: true,
    event_type: "checkout.session.completed",
    source: "team",
    session_id: session.id,
    subscription_id: subscriptionId,
    customer_id: customerId,
    apply_result: applyResult,
    sync_result: syncResult,
  };
}

async function handleSubscriptionEvent(
  appDb: any,
  subscription: Stripe.Subscription,
  options: {
    forceEnded?: boolean;
  } = {},
) {
  const syncResult = await syncSubscriptionToSupabase(appDb, subscription, {
    forceEnded: options.forceEnded,
  });

  return {
    success: true,
    received: true,
    sync_result: syncResult,
  };
}

async function handleInvoiceEvent(
  appDb: any,
  stripe: Stripe,
  invoice: Stripe.Invoice,
) {
  const invoiceRecord = invoice as unknown as Record<string, unknown>;
  const subscriptionId = getId(invoiceRecord.subscription);

  if (!subscriptionId) {
    return {
      success: true,
      received: true,
      ignored: true,
      reason: "Invoice has no subscription",
      invoice_id: invoice.id,
    };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const syncResult = await syncSubscriptionToSupabase(appDb, subscription);

  return {
    success: true,
    received: true,
    invoice_id: invoice.id,
    subscription_id: subscriptionId,
    sync_result: syncResult,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: "Missing server configuration" },
      500,
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return jsonResponse(
      { success: false, error: "Missing Stripe signature" },
      400,
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();

    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      stripeWebhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);

    return jsonResponse(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Invalid Stripe webhook signature",
      },
      400,
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const appDb = supabaseAdmin.schema("app");

  try {
    let result: Record<string, unknown>;

    switch (event.type) {
      case "checkout.session.completed": {
        result = await handleCheckoutSessionCompleted(
          appDb,
          stripe,
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      }

      case "customer.subscription.updated": {
        // 11.10.2026: aktuellen Stand holen statt Event-Stand (Events koennen in falscher Reihenfolge kommen)
        const evSub = event.data.object as Stripe.Subscription;
        const freshSub = await stripe.subscriptions.retrieve(evSub.id);
        result = await handleSubscriptionEvent(
          appDb,
          freshSub,
        );
        break;
      }

      case "customer.subscription.deleted": {
        result = await handleSubscriptionEvent(
          appDb,
          event.data.object as Stripe.Subscription,
          { forceEnded: true },
        );
        break;
      }

      case "invoice.payment_succeeded": {
        result = await handleInvoiceEvent(
          appDb,
          stripe,
          event.data.object as Stripe.Invoice,
        );
        break;
      }

      case "invoice.payment_failed": {
        result = await handleInvoiceEvent(
          appDb,
          stripe,
          event.data.object as Stripe.Invoice,
        );
        break;
      }

      default: {
        result = {
          success: true,
          received: true,
          ignored: true,
          event_type: event.type,
        };
      }
    }

    const status = result.success === false
      ? Number(result.status ?? 500)
      : 200;

    return jsonResponse(
      {
        ...result,
        event_type: event.type,
      },
      status,
    );
  } catch (error) {
    console.error("Stripe webhook handler failed:", error);

    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown webhook error",
        event_type: event.type,
      },
      500,
    );
  }
});
