import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const DUE_THRESHOLD = 5;
const THROTTLE_HOURS = 3;
const QUIET_START_HOUR = 0;
const QUIET_END_HOUR = 6;
const QUIET_TZ = "Asia/Tokyo";

function isQuietHours(now: Date): boolean {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: QUIET_TZ,
    hour: "2-digit",
    hour12: false,
  }).format(now);
  const h = Number(hourStr) % 24;
  return h >= QUIET_START_HOUR && h < QUIET_END_HOUR;
}

function configureVapid() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID env vars missing");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function isCronAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (isQuietHours(now)) {
    return NextResponse.json({ sent: 0, skipped: "quiet-hours" });
  }

  configureVapid();
  const supabase = createAdminClient();
  const throttleCutoff = new Date(
    now.getTime() - THROTTLE_HOURS * 3600_000
  ).toISOString();

  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth, last_sent_at")
    .is("disabled_at", null);

  if (subsErr) {
    return NextResponse.json({ error: subsErr.message }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  const dueCounts = new Map<string, number>();
  for (const s of subs) {
    if (dueCounts.has(s.user_id)) continue;
    const { count } = await supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", s.user_id)
      .neq("status", "suspended")
      .lte("next_review_at", now.toISOString());
    dueCounts.set(s.user_id, count ?? 0);
  }

  let sent = 0;
  let skipped = 0;
  const removed: string[] = [];

  for (const sub of subs) {
    const due = dueCounts.get(sub.user_id) ?? 0;
    const recentlySent = sub.last_sent_at && sub.last_sent_at > throttleCutoff;
    if (due < DUE_THRESHOLD || recentlySent) {
      skipped++;
      continue;
    }

    const payload = JSON.stringify({
      title: "Ankikun",
      body: `${due}枚のカードが復習時です`,
      url: "/review",
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;
      await supabase
        .from("push_subscriptions")
        .update({ last_sent_at: now.toISOString() })
        .eq("endpoint", sub.endpoint);
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 404 || status === 410) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
        removed.push(sub.endpoint);
      } else {
        console.error("push send failed", status, err);
      }
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    removed: removed.length,
    subs: subs.length,
  });
}

export const GET = handle;
export const POST = handle;
