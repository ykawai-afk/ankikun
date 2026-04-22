#!/usr/bin/env node
// Interactive Midjourney prompt launcher for Ankikun level avatars.
//
// Usage:
//   node scripts/mj-prompts.mjs            → Enter で1件ずつ表示。pbcopyあれば自動コピー
//   node scripts/mj-prompts.mjs --all      → 30件全部を一気に print
//   node scripts/mj-prompts.mjs --from 8   → 指定番号から開始 (現在値ガリ勉=8)
//   node scripts/mj-prompts.mjs --only 8   → 指定番号だけ print
//
// キーバインド (対話モード):
//   Enter   次
//   p       前
//   q       終了
//   数字    その番号にジャンプ (例: 8 + Enter)

import { spawnSync } from "node:child_process";
import readline from "node:readline";

const SHARED = `stylized 3D anime character, cel-shaded 3D render in the style of Arcane and Spider-Verse, volumetric lighting, subtle rim light, soft ambient occlusion, painterly textures on fabric and hair, detailed material shading, expressive proportions, crisp clean outlines, pastel background circle, full body character, centered composition, dynamic confident pose, wholesome American setting`;

const FLAGS = `--ar 1:1 --style raw --v 6.1`;

const CHARACTERS = [
  ["babbling-baby.png",            500, "The Babbling Baby",                "an American East Asian baby boy (age 1), tufts of black hair, in a onesie, mid-laugh with wide eyes, drooling slightly, holding up a rattle, soft peach circle background"],
  ["toddler-chatterbox.png",      2_000, "The Toddler Chatterbox",          "an American Black toddler girl (age 3) with little afro puffs, mid-sentence with mouth wide open, animated gesture, striped shirt, juice box in hand, soft apricot circle background"],
  ["preschool-questioner.png",    4_000, "The Preschool Questioner",        "an American white girl (age 4) with strawberry-blonde curls, one finger raised, giant question-mark speech bubble above head, oversized sweater, soft yellow circle background"],
  ["first-grade-storyteller.png", 6_500, "The 1st Grade Storyteller",       "an American Latino boy (age 6) with short curly brown hair, sitting cross-legged telling a dramatic story, hands spread wide, picture book open at side, missing front tooth, soft lavender circle background"],
  ["second-grade-bookworm.png",   8_000, "The 2nd Grade Bookworm",          "an American East Asian girl (age 7) with twin braids and glasses, oversized round glasses, hugging a stack of chapter books taller than torso, school uniform, tentative proud smile, soft mint circle background"],
  ["third-grade-daydreamer.png",  9_500, "The 3rd Grade Daydreamer",        "an American Black boy (age 8) with short twists, staring up with dreamy smile, cloud-shaped thought bubbles around head, pencil tucked behind ear, sneakers untied, soft sky-blue circle background"],
  ["spelling-bee-rookie.png",    11_000, "The Spelling Bee Rookie",         "an American Latina girl (age 9) with long ponytail and ribbon, at a microphone, contestant number pinned to sweater, spelling-bee stance, nervous smile, soft honey-yellow circle background"],
  ["nerdy-fifth-grader.png",     12_500, "The Nerdy 5th Grader (ガリ勉)",     "an American white boy (age 10), neat blonde side-part hair, in preppy nerd outfit: button-up shirt, bow tie, suspenders, thick-rimmed glasses, calculator clipped to belt, raising one hand eagerly, confident valedictorian aura, soft cornflower-blue circle background"],
  ["sixth-grade-know-it-all.png",14_000, "The 6th Grade Know-It-All",       "an American Indian-American boy (age 11) with tidy black side-part hair, index finger raised to correct someone, smug slight smile, sweater vest over polo, textbook tucked under arm, soft sage-green circle background"],
  ["middle-school-debater.png",  15_500, "The Middle School Debater",       "an American mixed-race girl (age 12) with big natural afro puffs, at a lectern with podium microphone, hand gesturing confidently, blazer over t-shirt, stack of index cards, soft slate-blue circle background"],
  ["rebel-eighth-grader.png",    17_000, "The Rebel 8th Grader",            "an American East Asian boy (age 13) with an undercut and bleached tips, attitude pose, oversized hoodie partially hiding one eye, skateboard tucked under arm, wired earbuds dangling, ripped jeans, skeptical smirk, arms crossed, soft coral circle background"],
  ["freshman-overachiever.png",  18_500, "The Freshman Overachiever",       "an American Black girl (age 14) with long box braids, juggling a heavy backpack, violin case, and sports gym bag, eager smile, varsity pin on lapel, soft lemon circle background"],
  ["ap-lit-sophomore.png",       20_000, "The AP Lit Sophomore",            "an American white girl (age 15) with dark brown hair in a messy half-bun, reading a dense novel with pencil in mouth, headphones around neck, highlighter-streaked pages, soft plum circle background"],
  ["junior-editor.png",          21_500, "The Junior Editor",               "an American Latino boy (age 16) with short curly black hair, school-newspaper editor holding a red marker and a proof sheet, press badge around neck, rolled-up sleeves, intense focused look, soft teal circle background"],
  ["varsity-valedictorian.png",  23_000, "The Varsity Valedictorian",       "an American Pacific Islander boy (age 17) with a long low ponytail, in a letter jacket with big block letter, clutching a diploma and graduation cap, broad confident smile, academic medals around neck, soft gold circle background"],
  ["national-merit-finalist.png",24_500, "The National Merit Finalist",     "an American East Asian girl (age 18) with a sleek bob cut, on a stage receiving a plaque, gold medal hanging from neck, polished interview outfit, composed smile, soft champagne circle background"],
  ["liberal-arts-freshman.png",  26_000, "The Liberal Arts Freshman",       "an American Black boy (age 18) with a high-top fade, in sweater and chinos on an ivy-covered campus, laptop bag over shoulder, stack of paperback classics, wide-eyed optimism, soft burgundy circle background"],
  ["english-major.png",          27_500, "The English Major",               "an American white boy (age 20) with round glasses and shoulder-length brown hair, seated cross-legged reading Shakespeare, thick sweater, coffee thermos, annotated book in hand, soft olive circle background"],
  ["creative-writing-workshopper.png", 29_000, "The Creative Writing Workshopper", "an American Latina woman (age 21) with long wavy chestnut hair, manuscript in hand, pencil behind each ear, turtleneck, glasses, slightly pensive expression, soft dusty-rose circle background"],
  ["coffee-fueled-grad.png",     30_500, "The Coffee-Fueled Grad",          "an American white woman in her mid-20s, tired messy bun, freckles, recent college grad pulling an all-nighter aftermath: rumpled graduation gown unbuttoned, giant to-go coffee cup, stack of printed papers, dark under-eye shadows, triumphant tired smile, soft beige circle background"],
  ["graduate-ta.png",            32_000, "The Graduate TA",                 "a Black woman (age 24) with a natural afro, American grad-school teaching assistant at a whiteboard mid-lecture, blazer over t-shirt, chalk in hand, clipboard under arm, soft mauve circle background"],
  ["phd-candidate.png",          33_500, "The PhD Candidate",               "an American East Asian woman (age 26) with short bob cut and glasses, PhD candidate carrying a tottering stack of research papers, lab badge on belt, reading glasses pushed up into hair, determined expression, soft denim-blue circle background"],
  ["dissertation-survivor.png",  35_000, "The Dissertation Survivor",       "an American South Asian woman (age 28) with a long dark braid, triumphantly holding up a bound dissertation overhead, confetti around, academic robe wrinkled, exhausted but elated face, soft lilac circle background"],
  ["postdoc-scholar.png",        36_500, "The Post-Doc Scholar",            "an American white man (age 30) with short beard and tortoiseshell glasses, post-doc with clipboard and microscope, lab coat, intellectual focus, soft teal-green circle background"],
  ["tenured-professor.png",      38_000, "The Tenured Professor",           "an American Black man (age 45) with salt-and-pepper close-cropped hair, tenured professor gesturing at a chalkboard full of literature notes, tweed blazer with elbow patches, reading glasses on chain, soft forest-green circle background"],
  ["corner-office-pro.png",      40_000, "The Corner Office Pro",           "an American East Asian man (late 20s) with a sharp modern haircut, polished professional in business-casual: tailored blazer, crisp shirt unbuttoned at collar, laptop bag, premium coffee cup, confident boardroom stride, soft slate-grey circle background"],
  ["newsroom-editor.png",        44_000, "The Newsroom Editor-in-Chief",    "an American Latino man (age 40) with salt-and-pepper slicked-back hair, editor-in-chief at a bustling newsroom desk, rolled-up shirt sleeves, red pen in hand, phone wedged between ear and shoulder, stacks of proofs, soft steel-blue circle background"],
  ["published-novelist.png",     48_000, "The Published Novelist",          "an American white woman (age 50) with long grey hair and a silk scarf, novelist at a book signing, fountain pen in hand, stack of hardcover novels with dust jackets, thoughtful half-smile, soft ivory circle background"],
  ["lexicographer.png",          55_000, "The Lexicographer",               "an American Black man (age 55) with a close grey beard and round wire-rim glasses, lexicographer at a tall wooden desk surrounded by massive dictionaries, archivist vest, magnifying glass in hand, soft sepia circle background"],
  ["shakespearean-savant.png",   70_000, "The Shakespearean Savant",        "an American white man (age 60) with long white flowing hair and white beard, Shakespeare scholar in a flowing academic robe, First Folio under arm, quill poised over parchment, sage expression with twinkle in eye, soft royal-purple circle background"],
];

function buildPrompt(charDesc) {
  return `${SHARED}, ${charDesc} ${FLAGS}`;
}

function tryClipboard(text) {
  const r = spawnSync("pbcopy", [], { input: text });
  return r.status === 0;
}

function printOne(idx) {
  const [file, vocab, label, desc] = CHARACTERS[idx];
  const prompt = buildPrompt(desc);
  console.log();
  console.log(
    `\x1b[1m[${idx + 1}/${CHARACTERS.length}] ${label}\x1b[0m  · ${vocab.toLocaleString()} words`
  );
  console.log(`\x1b[2mSave as: public/levels/${file}\x1b[0m`);
  console.log();
  console.log(prompt);
  console.log();
  if (tryClipboard(prompt)) {
    console.log("\x1b[32m✓ Copied to clipboard — pasted ready in Midjourney.\x1b[0m");
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { all: false, from: 0, only: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--all") out.all = true;
    else if (a === "--from") out.from = Math.max(0, Number(args[++i]) - 1);
    else if (a === "--only") out.only = Number(args[++i]) - 1;
  }
  return out;
}

async function main() {
  const { all, from, only } = parseArgs();
  if (only !== null && only >= 0 && only < CHARACTERS.length) {
    printOne(only);
    return;
  }
  if (all) {
    for (let i = 0; i < CHARACTERS.length; i++) {
      printOne(i);
      console.log("\x1b[2m" + "─".repeat(60) + "\x1b[0m");
    }
    return;
  }

  // Interactive
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let idx = from;
  const ask = () => {
    if (idx >= CHARACTERS.length) {
      console.log("\n\x1b[32m全30キャラ完了！\x1b[0m\n");
      rl.close();
      return;
    }
    printOne(idx);
    rl.question(
      "\x1b[36m[Enter=次 / p=前 / q=終了 / 数字=ジャンプ]\x1b[0m ",
      (ans) => {
        const trimmed = ans.trim().toLowerCase();
        if (trimmed === "q") {
          rl.close();
          return;
        }
        if (trimmed === "p") idx = Math.max(0, idx - 1);
        else if (/^\d+$/.test(trimmed)) {
          const n = Number(trimmed) - 1;
          idx = Math.min(CHARACTERS.length - 1, Math.max(0, n));
        } else idx++;
        ask();
      }
    );
  };
  ask();
}

main();
