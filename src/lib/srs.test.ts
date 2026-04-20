// Lightweight sanity checks (run with `pnpm tsx src/lib/srs.test.ts`).
// Not wired to a test runner yet — kept inline for quick verification.
import { schedule } from "./srs";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:  ", msg);
}

const base = { ease_factor: 2.5, interval_days: 0, repetitions: 0 };

// First Good → interval 1 day, repetitions 1
const r1 = schedule(base, 2);
assert(r1.interval_days === 1, "first Good → 1 day");
assert(r1.repetitions === 1, "first Good → reps 1");
assert(r1.status === "learning", "first Good → learning");

// Second Good (reps=1) → interval 6 days, repetitions 2, status review
const r2 = schedule({ ease_factor: r1.ease_factor, interval_days: 1, repetitions: 1 }, 2);
assert(r2.interval_days === 6, "second Good → 6 days");
assert(r2.repetitions === 2, "second Good → reps 2");
assert(r2.status === "review", "second Good → review");

// Third Good → interval = round(6 * ease) ≈ 15
const r3 = schedule({ ease_factor: r2.ease_factor, interval_days: 6, repetitions: 2 }, 2);
assert(r3.interval_days === Math.round(6 * r2.ease_factor), "third Good → prev * ease");

// Again resets repetitions and interval
const rAgain = schedule({ ease_factor: 2.5, interval_days: 20, repetitions: 5 }, 0);
assert(rAgain.repetitions === 0, "Again resets reps to 0");
assert(rAgain.interval_days === 0, "Again sets interval 0");
assert(rAgain.status === "learning", "Again → learning");
assert(rAgain.ease_factor < 2.5, "Again lowers ease");

// Ease floor is 1.3
let s = { ease_factor: 1.3, interval_days: 0, repetitions: 0 };
for (let i = 0; i < 10; i++) s = { ...s, ...schedule(s, 0) };
assert(s.ease_factor >= 1.3, "ease never drops below 1.3");

console.log("\nAll SRS sanity checks passed.");
