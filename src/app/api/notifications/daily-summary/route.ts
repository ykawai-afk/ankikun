import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isIntroLog } from "@/lib/mastery";

export const runtime = "nodejs";
export const maxDuration = 60;

const DAY_MS = 86_400_000;
const SUMMARY_THROTTLE_HOURS = 18;

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

type Summary = {
  todayReviews: number;
  todayNewIntros: number;
  retentionPct: number | null;
  tomorrowDue: number;
};

async function buildSummary(userId: string): Promise<Summary> {
  const db = createAdminClient();
  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(startOfToday.getTime() + DAY_MS);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + DAY_MS);

  const [todayLogsRes, tomorrowDueRes] = await Promise.all([
    db
      .from("review_logs")
      .select("rating, prev_interval, prev_ease")
      .eq("user_id", userId)
      .gte("reviewed_at", startOfToday.toISOString()),
    db
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .lt("next_review_at", tomorrowEnd.toISOString())
      .gte("next_review_at", now.toISOString()),
  ]);

  const todayLogs = todayLogsRes.data ?? [];
  const todayReviews = todayLogs.length;
  const todayNewIntros = todayLogs.filter((l) =>
    isIntroLog(l as { prev_interval: number | null; prev_ease: number | null })
  ).length;
  const nonAgain = todayLogs.filter((l) => (l.rating as number) !== 0).length;
  const retentionPct =
    todayReviews > 0 ? Math.round((nonAgain / todayReviews) * 100) : null;

  return {
    todayReviews,
    todayNewIntros,
    retentionPct,
    tomorrowDue: tomorrowDueRes.count ?? 0,
  };
}

function renderBody(s: Summary): string {
  if (s.todayReviews === 0) {
    return `明日 ${s.tomorrowDue}枚が復習予定`;
  }
  const reviewPart = `${s.todayReviews}枚完了 (新${s.todayNewIntros})`;
  const retentionPart =
    s.retentionPct !== null ? ` · 定着 ${s.retentionPct}%` : "";
  return `${reviewPart}${retentionPart} · 明日 ${s.tomorrowDue}枚予定`;
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  configureVapid();
  const db = createAdminClient();
  const now = new Date();
  const throttleCutoff = new Date(
    now.getTime() - SUMMARY_THROTTLE_HOURS * 3_600_000
  ).toISOString();

  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth, last_summary_at")
    .is("disabled_at", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, subs: 0 });
  }

  const summaries = new Map<string, Summary>();
  let sent = 0;
  let skipped = 0;
  const removed: string[] = [];

  for (const sub of subs) {
    if (sub.last_summary_at && sub.last_summary_at > throttleCutoff) {
      skipped++;
      continue;
    }
    let s = summaries.get(sub.user_id);
    if (!s) {
      s = await buildSummary(sub.user_id);
      summaries.set(sub.user_id, s);
    }

    const payload = JSON.stringify({
      title: "Ankikun · 今日のまとめ",
      body: renderBody(s),
      url: "/stats",
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
      await db
        .from("push_subscriptions")
        .update({ last_summary_at: now.toISOString() })
        .eq("endpoint", sub.endpoint);
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 404 || status === 410) {
        await db
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
        removed.push(sub.endpoint);
      } else {
        console.error("daily-summary push failed", status, err);
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
