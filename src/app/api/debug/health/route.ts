import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import {
  DAILY_NEW_TARGET,
  VOCAB_BASELINE,
  VOCAB_CARD_WEIGHT,
  VOCAB_MILESTONES,
  vocabCurrentLevel,
} from "@/lib/goals";
import { MASTERED_THRESHOLD_DAYS } from "@/lib/mastery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DAY_MS = 86_400_000;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const token = req.nextUrl.searchParams.get("token");
  return token === secret;
}

type Report = {
  generated_at: string;
  status: Record<string, number>;
  activity: {
    today: number;
    today_new_intros: number;
    today_reviews: number;
    last_7d: number;
    last_30d: number;
    all_time: number;
    last_log_at: string | null;
    last_log_ago_hours: number | null;
  };
  quota: {
    daily_new_target: number;
    new_intros_today: number;
    new_slots_left: number;
  };
  audio: {
    with_url: number;
    empty_sentinel: number;
    null: number;
    coverage_pct: number;
  };
  vocab: {
    baseline: number;
    card_contribution: number;
    estimate: number;
    current_level: string | null;
    cefr: Record<string, number>;
    cefr_mastered: Record<string, number>;
    cefr_accuracy: Record<string, number>;
    cefr_review_count: Record<string, number>;
  };
  queue: {
    due_now: number;
    overdue_7d: number;
    overdue_30d: number;
  };
  mastery: {
    total_active: number;
    mastered: number;
    mastered_pct: number;
    mean_ease: number;
    ease_floor: number;
    interval_bins: Record<string, number>;
  };
  anomalies: {
    orphans: { word: string; reps: number; interval: number }[];
    stuck_learning: { word: string; last_reviewed_at: string | null }[];
    reps_without_logs: { word: string; reps: number }[];
    card_vs_log_mismatches: {
      word: string;
      card_interval: number;
      log_new_interval: number;
      card_ease: number;
      log_new_ease: number;
      log_at: string;
    }[];
  };
  leeches: {
    word: string;
    definition_ja: string;
    again: number;
    total: number;
  }[];
  rhythm_last_14d: { day: string; count: number }[];
};

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const userId = getUserId();
  const now = new Date();
  const nowIso = now.toISOString();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const since7 = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const since14 = new Date(now.getTime() - 14 * DAY_MS).toISOString();
  const since30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const since60 = new Date(now.getTime() - 60 * DAY_MS).toISOString();
  const over7 = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const over30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const over60Learning = new Date(now.getTime() - 60 * DAY_MS).toISOString();

  // Status counts
  const statuses = ["new", "learning", "review", "suspended"] as const;
  const statusCounts = await Promise.all(
    statuses.map((s) =>
      db
        .from("cards")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", s)
    )
  );
  const status: Record<string, number> = {};
  statuses.forEach((s, i) => (status[s] = statusCounts[i].count ?? 0));
  status.total = Object.values(status).reduce((a, b) => a + b, 0);

  // Review activity
  const [todayRes, todayNewRes, wkRes, monthRes, allRes, recentRes] =
    await Promise.all([
      db
        .from("review_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("reviewed_at", startOfToday.toISOString()),
      db
        .from("review_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("prev_interval", 0)
        .eq("prev_ease", 2.5)
        .gte("reviewed_at", startOfToday.toISOString()),
      db
        .from("review_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("reviewed_at", since7),
      db
        .from("review_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("reviewed_at", since30),
      db
        .from("review_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      db
        .from("review_logs")
        .select("reviewed_at")
        .eq("user_id", userId)
        .order("reviewed_at", { ascending: false })
        .limit(1),
    ]);
  const todayTotal = todayRes.count ?? 0;
  const todayNewIntros = todayNewRes.count ?? 0;
  const newSlotsLeft = Math.max(0, DAILY_NEW_TARGET - todayNewIntros);

  // Audio coverage
  const [audioWithUrl, audioEmpty, audioNull] = await Promise.all([
    db
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .like("audio_url", "https%"),
    db
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("audio_url", ""),
    db
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("audio_url", null),
  ]);
  const audioWithCount = audioWithUrl.count ?? 0;
  const audioEmptyCount = audioEmpty.count ?? 0;
  const audioNullCount = audioNull.count ?? 0;
  const audioTotal = audioWithCount + audioEmptyCount + audioNullCount;
  const audioCoveragePct =
    audioTotal > 0 ? Math.round((audioWithCount / audioTotal) * 100) : 0;

  // CEFR counts + per-level accuracy. Use the active card+log data we
  // already have via activeCards/recentLogs further up the file; if those
  // aren't populated the fetch below is a safe fallback.
  const MASTERED_DAYS = 21;
  const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
  const MIN_REVIEWS_FOR_ACC = 5;

  const { data: cardsForCefr } = await db
    .from("cards")
    .select("id, difficulty, interval_days, repetitions, ease_factor")
    .eq("user_id", userId)
    .neq("status", "suspended");
  const cards = cardsForCefr ?? [];
  const diffLookup = new Map<string, string>();
  const cefrCounts: Record<string, number> = { unknown: 0 };
  const cefrMastered: Record<string, number> = { unknown: 0 };
  cefrLevels.forEach((lv) => {
    cefrCounts[lv] = 0;
    cefrMastered[lv] = 0;
  });
  for (const c of cards) {
    const lv =
      c.difficulty && cefrLevels.includes(c.difficulty as (typeof cefrLevels)[number])
        ? c.difficulty
        : "unknown";
    diffLookup.set(c.id as string, lv as string);
    cefrCounts[lv]++;
    const id = c as {
      interval_days: number;
      repetitions: number;
      ease_factor: number;
    };
    const mastered =
      id.interval_days >= MASTERED_DAYS ||
      (id.repetitions >= 1 && id.ease_factor >= 2.5);
    if (mastered) cefrMastered[lv]++;
  }

  const accSince = new Date(
    now.getTime() - 60 * DAY_MS
  ).toISOString();
  const { data: accLogs } = await db
    .from("review_logs")
    .select("card_id, rating")
    .eq("user_id", userId)
    .gte("reviewed_at", accSince);
  const cefrReviews: Record<string, number> = {};
  const cefrNonAgain: Record<string, number> = {};
  for (const l of accLogs ?? []) {
    const lv = diffLookup.get(l.card_id as string) ?? "unknown";
    cefrReviews[lv] = (cefrReviews[lv] ?? 0) + 1;
    if ((l.rating as number) !== 0) {
      cefrNonAgain[lv] = (cefrNonAgain[lv] ?? 0) + 1;
    }
  }
  const cefrAcc: Record<string, number> = {};
  for (const lv of [...cefrLevels, "unknown"] as const) {
    const total = cefrReviews[lv] ?? 0;
    cefrAcc[lv] =
      total < MIN_REVIEWS_FOR_ACC
        ? 1
        : (cefrNonAgain[lv] ?? 0) / total;
  }

  const vocabContribution = Object.entries(cefrMastered).reduce(
    (sum, [lv, count]) =>
      sum + count * (VOCAB_CARD_WEIGHT[lv] ?? 0) * (cefrAcc[lv] ?? 1),
    0
  );
  const vocabEstimate = Math.round(VOCAB_BASELINE + vocabContribution);
  const currentLevel = vocabCurrentLevel(vocabEstimate);
  void VOCAB_MILESTONES;

  const lastLogAt = recentRes.data?.[0]?.reviewed_at ?? null;
  const lastLogAgoHours =
    lastLogAt !== null
      ? Math.round(
          ((now.getTime() - new Date(lastLogAt).getTime()) / 3_600_000) * 10
        ) / 10
      : null;

  // Queue state
  const [dueNow, due7, due30] = await Promise.all([
    db
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .lte("next_review_at", nowIso),
    db
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .lte("next_review_at", over7),
    db
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .lte("next_review_at", over30),
  ]);

  // Mastery + interval distribution
  const { data: activeCards } = await db
    .from("cards")
    .select(
      "id, word, ease_factor, interval_days, repetitions, last_reviewed_at, status"
    )
    .eq("user_id", userId)
    .neq("status", "suspended");
  const c = activeCards ?? [];
  const bins = [
    { label: "0d", min: 0, max: 0 },
    { label: "1-6d", min: 1, max: 6 },
    { label: "7-20d", min: 7, max: 20 },
    { label: "21-60d", min: 21, max: 60 },
    { label: "61+d", min: 61, max: Infinity },
  ];
  const intervalBins: Record<string, number> = {};
  for (const b of bins) {
    intervalBins[b.label] = c.filter(
      (x) => x.interval_days >= b.min && x.interval_days <= b.max
    ).length;
  }
  const meanEase =
    c.length > 0 ? c.reduce((s, x) => s + x.ease_factor, 0) / c.length : 0;
  const easeFloor = c.filter((x) => x.ease_factor <= 1.31).length;
  const mastered = c.filter((x) => x.interval_days >= MASTERED_THRESHOLD_DAYS).length;

  // Anomalies
  const { data: orphans } = await db
    .from("cards")
    .select("word, repetitions, interval_days")
    .eq("user_id", userId)
    .in("status", ["learning", "review"])
    .is("last_reviewed_at", null)
    .limit(50);

  const { data: stuck } = await db
    .from("cards")
    .select("word, last_reviewed_at")
    .eq("user_id", userId)
    .eq("status", "learning")
    .lt("last_reviewed_at", over60Learning)
    .limit(50);

  // reps>0 but no review_log
  const { data: withReps } = await db
    .from("cards")
    .select("id, word, repetitions, interval_days, ease_factor")
    .eq("user_id", userId)
    .gt("repetitions", 0);
  let repsWithoutLogs: { word: string; reps: number }[] = [];
  let mismatches: Report["anomalies"]["card_vs_log_mismatches"] = [];
  if (withReps && withReps.length > 0) {
    const ids = withReps.map((w) => w.id);
    const { data: logs } = await db
      .from("review_logs")
      .select("card_id, new_interval, new_ease, reviewed_at")
      .in("card_id", ids)
      .order("reviewed_at", { ascending: false });
    const latestByCard = new Map<
      string,
      { new_interval: number; new_ease: number; reviewed_at: string }
    >();
    for (const l of logs ?? []) {
      if (!latestByCard.has(l.card_id)) {
        latestByCard.set(l.card_id, {
          new_interval: l.new_interval,
          new_ease: l.new_ease,
          reviewed_at: l.reviewed_at,
        });
      }
    }
    repsWithoutLogs = withReps
      .filter((w) => !latestByCard.has(w.id))
      .map((w) => ({ word: w.word, reps: w.repetitions }));
    // Mismatches: latest log's new_interval != card interval_days, or ease diverges > 0.05
    for (const w of withReps) {
      const l = latestByCard.get(w.id);
      if (!l) continue;
      const intervalMismatch = l.new_interval !== w.interval_days;
      const easeDelta = Math.abs(l.new_ease - w.ease_factor);
      // Allow for Again-after-schedule re-entry (card state re-scheduled after log)
      // so only flag when BOTH drift meaningfully.
      if (intervalMismatch && easeDelta > 0.05) {
        mismatches.push({
          word: w.word,
          card_interval: w.interval_days,
          log_new_interval: l.new_interval,
          card_ease: w.ease_factor,
          log_new_ease: l.new_ease,
          log_at: l.reviewed_at,
        });
      }
    }
    mismatches = mismatches.slice(0, 20);
  }

  // Leech candidates
  const { data: recentLogs } = await db
    .from("review_logs")
    .select("card_id, rating")
    .eq("user_id", userId)
    .gte("reviewed_at", since60)
    .order("reviewed_at", { ascending: false });
  const byCard = new Map<string, number[]>();
  for (const l of recentLogs ?? []) {
    const arr = byCard.get(l.card_id) ?? [];
    if (arr.length < 10) arr.push(l.rating);
    byCard.set(l.card_id, arr);
  }
  const leechIds: { id: string; again: number; total: number }[] = [];
  for (const [id, ratings] of byCard) {
    const again = ratings.filter((r) => r === 0).length;
    if (again >= 3) leechIds.push({ id, again, total: ratings.length });
  }
  leechIds.sort((a, b) => b.again - a.again);
  const topLeech = leechIds.slice(0, 15);
  let leeches: Report["leeches"] = [];
  if (topLeech.length > 0) {
    const { data: words } = await db
      .from("cards")
      .select("id, word, definition_ja")
      .in(
        "id",
        topLeech.map((l) => l.id)
      );
    const m = new Map((words ?? []).map((w) => [w.id, w]));
    leeches = topLeech
      .map((l) => {
        const w = m.get(l.id);
        if (!w) return null;
        return {
          word: w.word,
          definition_ja: w.definition_ja,
          again: l.again,
          total: l.total,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  // Rhythm last 14 days
  const { data: rhythmLogs } = await db
    .from("review_logs")
    .select("reviewed_at")
    .eq("user_id", userId)
    .gte("reviewed_at", since14);
  const byDay = new Map<string, number>();
  for (const l of rhythmLogs ?? []) {
    const d = new Date(l.reviewed_at).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const rhythm = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));

  const report: Report = {
    generated_at: nowIso,
    status,
    activity: {
      today: todayTotal,
      today_new_intros: todayNewIntros,
      today_reviews: todayTotal - todayNewIntros,
      last_7d: wkRes.count ?? 0,
      last_30d: monthRes.count ?? 0,
      all_time: allRes.count ?? 0,
      last_log_at: lastLogAt,
      last_log_ago_hours: lastLogAgoHours,
    },
    quota: {
      daily_new_target: DAILY_NEW_TARGET,
      new_intros_today: todayNewIntros,
      new_slots_left: newSlotsLeft,
    },
    audio: {
      with_url: audioWithCount,
      empty_sentinel: audioEmptyCount,
      null: audioNullCount,
      coverage_pct: audioCoveragePct,
    },
    vocab: {
      baseline: VOCAB_BASELINE,
      card_contribution: Math.round(vocabContribution),
      estimate: vocabEstimate,
      current_level: currentLevel
        ? `${currentLevel.emoji} ${currentLevel.label} (${currentLevel.sub})`
        : null,
      cefr: cefrCounts,
      cefr_mastered: cefrMastered,
      cefr_accuracy: Object.fromEntries(
        Object.entries(cefrAcc).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
      cefr_review_count: cefrReviews,
    },
    queue: {
      due_now: dueNow.count ?? 0,
      overdue_7d: due7.count ?? 0,
      overdue_30d: due30.count ?? 0,
    },
    mastery: {
      total_active: c.length,
      mastered,
      mastered_pct:
        c.length > 0 ? Math.round((mastered / c.length) * 100) : 0,
      mean_ease: Math.round(meanEase * 100) / 100,
      ease_floor: easeFloor,
      interval_bins: intervalBins,
    },
    anomalies: {
      orphans: (orphans ?? []).map((o) => ({
        word: o.word,
        reps: o.repetitions,
        interval: o.interval_days,
      })),
      stuck_learning: (stuck ?? []).map((s) => ({
        word: s.word,
        last_reviewed_at: s.last_reviewed_at,
      })),
      reps_without_logs: repsWithoutLogs,
      card_vs_log_mismatches: mismatches,
    },
    leeches,
    rhythm_last_14d: rhythm,
  };

  if (req.nextUrl.searchParams.get("format") === "text") {
    return new NextResponse(renderText(report), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.json(report);
}

function renderText(r: Report): string {
  const lines: string[] = [];
  const p = (s: string) => lines.push(s);

  p(`🔍 Ankikun review health — ${r.generated_at}`);
  p("");
  p("=== Cards by status ===");
  for (const [k, v] of Object.entries(r.status)) p(`  ${k.padEnd(10)}: ${v}`);
  p("");
  p("=== Review activity ===");
  p(`  today      : ${r.activity.today} (新規 ${r.activity.today_new_intros} + 復習 ${r.activity.today_reviews})`);
  p(`  last 7d    : ${r.activity.last_7d}`);
  p(`  last 30d   : ${r.activity.last_30d}`);
  p(`  all time   : ${r.activity.all_time}`);
  if (r.activity.last_log_at) {
    p(`  last log   : ${r.activity.last_log_at} (${r.activity.last_log_ago_hours}h ago)`);
  } else {
    p(`  last log   : (none)`);
  }
  p("");
  p("=== Today's new-card quota ===");
  p(`  target         : ${r.quota.daily_new_target}`);
  p(`  introduced     : ${r.quota.new_intros_today}`);
  p(`  remaining slot : ${r.quota.new_slots_left}`);
  p("");
  p("=== Vocabulary estimate ===");
  p(`  current level    : ${r.vocab.current_level ?? "—"}`);
  p(`  estimate         : ${r.vocab.estimate.toLocaleString()} 語`);
  p(`  baseline         : ${r.vocab.baseline.toLocaleString()}`);
  p(`  + Ankikun (≥21d) : ${r.vocab.card_contribution.toLocaleString()}`);
  p(`  CEFR (total · mastered · acc · reviews60d):`);
  for (const [lv, n] of Object.entries(r.vocab.cefr)) {
    const m = r.vocab.cefr_mastered?.[lv] ?? 0;
    const a = r.vocab.cefr_accuracy?.[lv];
    const rc = r.vocab.cefr_review_count?.[lv] ?? 0;
    const accStr = a === undefined ? "—" : `${Math.round(a * 100)}%`;
    p(
      `    ${lv.padEnd(10)}: ${String(n).padStart(4)} · mastered ${String(m).padStart(3)} · acc ${accStr.padStart(4)} · reviews ${rc}`
    );
  }
  p("");
  p("=== Audio coverage ===");
  p(`  native URL     : ${r.audio.with_url} (${r.audio.coverage_pct}%)`);
  p(`  empty sentinel : ${r.audio.empty_sentinel} (no audio available from API)`);
  p(`  untouched      : ${r.audio.null}`);
  p("");
  p("=== Queue state ===");
  p(`  due now       : ${r.queue.due_now}`);
  p(`  overdue > 7d  : ${r.queue.overdue_7d}`);
  p(`  overdue > 30d : ${r.queue.overdue_30d}`);
  p("");
  p("=== Mastery ===");
  p(`  active cards   : ${r.mastery.total_active}`);
  p(`  mastered (≥21d): ${r.mastery.mastered} (${r.mastery.mastered_pct}%)`);
  p(`  mean ease      : ${r.mastery.mean_ease}`);
  p(`  ease at floor  : ${r.mastery.ease_floor}`);
  p("");
  p("=== Interval distribution ===");
  for (const [k, v] of Object.entries(r.mastery.interval_bins))
    p(`  ${k.padEnd(8)}: ${v}`);
  p("");
  p("=== Anomalies ===");
  p(`  orphans (status ≠ new, no last_reviewed_at): ${r.anomalies.orphans.length}`);
  for (const o of r.anomalies.orphans.slice(0, 10))
    p(`    - ${o.word} (reps=${o.reps}, interval=${o.interval})`);
  p(`  stuck in learning > 60d: ${r.anomalies.stuck_learning.length}`);
  for (const s of r.anomalies.stuck_learning.slice(0, 10))
    p(`    - ${s.word} (last ${s.last_reviewed_at})`);
  p(`  reps > 0 but no review_log: ${r.anomalies.reps_without_logs.length}`);
  for (const x of r.anomalies.reps_without_logs.slice(0, 10))
    p(`    - ${x.word} (reps=${x.reps})`);
  p(`  card vs log mismatch: ${r.anomalies.card_vs_log_mismatches.length}`);
  for (const m of r.anomalies.card_vs_log_mismatches.slice(0, 10))
    p(
      `    - ${m.word}  card=${m.card_interval}d/e${m.card_ease}  log=${m.log_new_interval}d/e${m.log_new_ease} (${m.log_at})`
    );
  p("");
  p("=== Leech candidates ===");
  if (r.leeches.length === 0) p("  none");
  for (const l of r.leeches)
    p(`  - ${l.word.padEnd(20)} ${l.again}/${l.total} Again  · ${l.definition_ja.slice(0, 30)}`);
  p("");
  p("=== Rhythm last 14 days ===");
  if (r.rhythm_last_14d.length === 0) {
    p("  (no reviews)");
  } else {
    const max = Math.max(...r.rhythm_last_14d.map((x) => x.count));
    for (const d of r.rhythm_last_14d) {
      const bar = "█".repeat(Math.round((d.count / max) * 20));
      p(`  ${d.day}  ${bar} ${d.count}`);
    }
  }
  return lines.join("\n") + "\n";
}
