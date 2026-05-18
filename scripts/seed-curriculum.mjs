// Seed the freshly truncated deck with two complementary starter sets:
//   1. 25 cognate-trap family packs — pairs of look-alike words the user
//      mixed up on the May-18 triage test. Each pair becomes a family_pack
//      with two cards (derivation_type: "cognate-trap").
//   2. 20 chat-organic phrases — high-leverage corrections from the May-18
//      English log that passed the 3+ keeper filter (false friend, native
//      idiom, register fix, structural pattern).
//
// Usage:
//   ANKIKUN_BASE_URL=http://localhost:3000 \
//   ANKIKUN_TOKEN=$INGEST_TOKEN \
//   node scripts/seed-curriculum.mjs
//
// Idempotency: the cards table has a unique index on
// (user_id, card_type, lower(word)), so re-running will conflict on dupes.
// Run once on a clean deck.

const BASE_URL = process.env.ANKIKUN_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.ANKIKUN_TOKEN;
if (!TOKEN) {
  console.error("ANKIKUN_TOKEN env var required");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

// ---- Cognate-trap pairs ----------------------------------------------------
// Each entry yields a family_pack named "<seed> vs <trap>" with both cards
// linked. derivation_type:"cognate-trap" marks them so the review UI can flag
// the visual similarity later.
const cognatePairs = [
  ["articulate", "明確に述べる/明瞭な", "artificial", "人工の"],
  ["mitigate", "緩和する", "migrate", "移住する"],
  ["distinguish", "区別する", "extinguish", "消す"],
  ["eloquent", "雄弁な", "elegant", "優雅な"],
  ["conducive", "促進的な/助けになる", "conductive", "伝導性の"],
  ["plausible", "もっともらしい", "applausible", "(誤語)"],
  ["adopt", "採用する", "adapt", "適応する"],
  ["affect", "影響を与える(動)", "effect", "影響/結果(名)"],
  ["accept", "受け入れる", "except", "〜を除いて"],
  ["allude", "ほのめかす", "elude", "巧みに逃れる"],
  ["averse", "嫌悪する", "adverse", "不利な/逆の"],
  ["complement", "補完する/補完", "compliment", "賛辞/褒める"],
  ["conscience", "良心", "conscious", "意識のある"],
  ["discrete", "別個の/離散的な", "discreet", "慎重な/控えめな"],
  ["emigrate", "(自国から)移住する", "immigrate", "(他国へ)移住する"],
  ["eminent", "著名な", "imminent", "差し迫った"],
  ["historic", "歴史的に重要な", "historical", "歴史に関する"],
  ["industrious", "勤勉な", "industrial", "産業の"],
  ["loose", "緩い", "lose", "失う"],
  ["principal", "主要な/校長", "principle", "原則"],
  ["respectfully", "敬意を持って", "respectively", "それぞれ"],
  ["stationary", "静止した", "stationery", "文房具"],
  ["personnel", "職員/人事", "personal", "個人的な"],
  ["assure", "保証する(人に)", "ensure", "確実にする(物事)"],
  ["precede", "先行する", "proceed", "進む"],
];

// ---- Chat-organic keepers --------------------------------------------------
// Selected from the May-18 english-expressions log. Each passed at least 3
// of the keeper criteria (high-frequency, false friend, native-only, real
// misuse, structural pattern).
const chatKeepers = [
  {
    word: "open a PR",
    card_type: "expression",
    definition_ja: "プルリクエストを出す（US テック標準）",
    definition_en: "create a pull request on GitHub — the dominant native phrasing",
    example_en: "I'll open a PR once tests pass.",
    example_ja: "テストが通ったら PR 出すね。",
    curriculum_source: "chat-organic",
    strategic_theme: "business-email",
    difficulty: "B2",
    tags: ["pr-review", "native-only"],
  },
  {
    word: "address the comments",
    card_type: "expression",
    definition_ja: "レビュー指摘に対応する",
    definition_en: "fix or respond to the review feedback",
    example_en: "Can you address the comments before merging?",
    example_ja: "マージ前にレビュー指摘対応してくれる？",
    curriculum_source: "chat-organic",
    strategic_theme: "business-email",
    difficulty: "B2",
    tags: ["pr-review", "native-only"],
  },
  {
    word: "apply X to Y",
    card_type: "expression",
    definition_ja: "Xを Yに適用する（抽象→具体への適用全般）",
    definition_en: "make something abstract act on something concrete",
    example_en: "Apply these comments to the docs.",
    example_ja: "このコメントをドキュメントに反映して。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["pattern", "high-frequency"],
  },
  {
    word: "factor X in",
    card_type: "expression",
    definition_ja: "Xを考慮に入れる",
    definition_en: "include something in a decision or calculation",
    example_en: "Factor that risk in when estimating.",
    example_ja: "見積もる時にそのリスクを織り込んで。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["pattern", "business-email"],
  },
  {
    word: "ship it",
    card_type: "expression",
    definition_ja: "リリース/デプロイする（カジュアル）",
    definition_en: "release or deploy — native engineer chat staple",
    example_en: "LGTM, ship it.",
    example_ja: "問題なし、出していいよ。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["native-only", "casual"],
  },
  {
    word: "good to go",
    card_type: "expression",
    definition_ja: "OK / 進めて大丈夫",
    definition_en: "everything is fine, ready to proceed",
    example_en: "CI is green, we're good to go.",
    example_ja: "CI 通ってる、もう大丈夫。",
    curriculum_source: "chat-organic",
    difficulty: "B1",
    tags: ["native-only", "casual"],
  },
  {
    word: "ready for review",
    card_type: "expression",
    definition_ja: "レビュー依頼可能な状態",
    definition_en: "the PR is in good enough shape to request review",
    example_en: "#351 is ready for review.",
    example_ja: "#351 レビューお願いできます。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["pr-review", "business-email"],
  },
  {
    word: "ditto",
    card_type: "expression",
    definition_ja: "同上/同じく（コンパクトリストの省略記号）",
    definition_en: "same as the previous item",
    example_en: "1) fix bug, 2) ditto for the helper.",
    example_ja: "1) バグ直す、2) ヘルパーも同様。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["native-only", "casual"],
  },
  {
    word: "Got it.",
    card_type: "expression",
    definition_ja: "了解（チャット返答の native default）",
    definition_en: "casual acknowledgment — replaces overused 'I see'",
    example_en: "Got it. I'll handle that next.",
    example_ja: "了解、次やります。",
    curriculum_source: "chat-organic",
    difficulty: "A2",
    tags: ["chat-ack", "native-only"],
  },
  {
    word: "Makes sense.",
    card_type: "expression",
    definition_ja: "なるほど（understanding-after-explanation の native）",
    definition_en: "agreement that the explanation lands; subject dropped in chat",
    example_en: "Makes sense. Let's go with that.",
    example_ja: "なるほど、それで行こう。",
    curriculum_source: "chat-organic",
    difficulty: "B1",
    tags: ["chat-ack", "native-only"],
  },
  {
    word: "nuke",
    card_type: "expression",
    definition_ja: "(ファイル/ディレクトリを)強制削除する",
    definition_en: "wipe out files or a directory forcefully — tech slang",
    example_en: "Just nuke node_modules and reinstall.",
    example_ja: "node_modules 消して再インストールしちゃおう。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["native-only", "tech-slang"],
  },
  {
    word: "blow away",
    card_type: "expression",
    definition_ja: "(キャッシュ等を)消し飛ばす",
    definition_en: "delete a cache or build artifact completely",
    example_en: "Blow away the .next folder.",
    example_ja: ".next フォルダ消して。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["tech-slang"],
  },
  {
    word: "on one's plate",
    card_type: "expression",
    definition_ja: "(現在の)抱えている仕事/負荷",
    definition_en: "current workload",
    example_en: "What's on your plate today?",
    example_ja: "今日何抱えてる？",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["idiom", "high-frequency"],
  },
  {
    word: "at this rate",
    card_type: "expression",
    definition_ja: "このペースだと/このままだと",
    definition_en: "if things continue this way",
    example_en: "At this rate, we'll miss the deadline.",
    example_ja: "このペースだと納期に間に合わない。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["idiom", "high-frequency"],
  },
  {
    word: "from a different angle",
    card_type: "expression",
    definition_ja: "別の角度から(検討する)",
    definition_en: "approach a problem from a different perspective",
    example_en: "Could you review it from a different angle?",
    example_ja: "別の角度からレビューしてくれる？",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["pattern"],
  },
  {
    word: "wordy",
    card_type: "word",
    part_of_speech: "adjective",
    definition_ja: "冗長な/言葉数が多すぎる",
    definition_en: "using too many words",
    example_en: "The intro is a bit wordy — trim it.",
    example_ja: "イントロちょっと冗長、削って。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["register-fix"],
  },
  {
    word: "redundant",
    card_type: "word",
    part_of_speech: "adjective",
    definition_ja: "重複した/冗長な (= 不要な繰り返し)",
    definition_en: "needlessly repeating something already said",
    example_en: "These two checks are redundant.",
    example_ja: "このチェック2つ重複してる。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["false-friend"],
  },
  {
    word: "factor in",
    card_type: "expression",
    definition_ja: "(意思決定で)考慮に入れる",
    definition_en: "include in a decision or calculation — natural verb for adding context",
    example_en: "We'll factor latency into the SLA.",
    example_ja: "レイテンシも SLA に織り込もう。",
    curriculum_source: "chat-organic",
    difficulty: "B2",
    tags: ["pattern", "business-email"],
  },
  {
    word: "high-signal",
    card_type: "expression",
    definition_ja: "情報量が高い/価値の高い",
    definition_en: "rich in important information (from signal-to-noise ratio)",
    example_en: "That review was high-signal — kept every comment.",
    example_ja: "あのレビュー濃かった、全部反映した。",
    curriculum_source: "chat-organic",
    difficulty: "C1",
    tags: ["native-only", "tech-slang"],
  },
  {
    word: "compounding effect",
    card_type: "expression",
    definition_ja: "(複利的に)積み重なる効果",
    definition_en: "small gains stacking up over time, like compound interest",
    example_en: "Daily reviews — the compounding effect is real.",
    example_ja: "毎日の復習、地味だけど積もる。",
    curriculum_source: "chat-organic",
    difficulty: "C1",
    tags: ["native-only"],
  },
];

// ---- API helpers -----------------------------------------------------------

async function postJSON(path, body) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`POST ${path} → ${res.status}: ${text}`);
    return null;
  }
  return JSON.parse(text);
}

async function seedCognateFamilies() {
  let packs = 0;
  let cards = 0;
  for (const [a, aJa, b, bJa] of cognatePairs) {
    const body = {
      pack_name: `${a} vs ${b}`,
      seed: {
        card_type: "word",
        word: a,
        definition_ja: aJa,
        derivation_type: "cognate-trap",
        curriculum_source: "cognate-trap",
        difficulty: "B2",
        tags: ["cognate-trap"],
      },
      members: [
        {
          card_type: "word",
          word: b,
          definition_ja: bJa,
          derivation_type: "cognate-trap",
          curriculum_source: "cognate-trap",
          difficulty: "B2",
          tags: ["cognate-trap"],
        },
      ],
    };
    const result = await postJSON("/api/cli/family", body);
    if (result) {
      packs += 1;
      cards += 1 + (result.members_inserted ?? 0);
    }
  }
  return { packs, cards };
}

async function seedChatKeepers() {
  const result = await postJSON("/api/cards/bulk", { cards: chatKeepers });
  return result ?? { inserted: 0, skipped: chatKeepers.length };
}

// ---- Main ------------------------------------------------------------------

const onlySection = process.argv[2]; // "cognate" | "chat" | undefined (both)

console.log(`seeding to ${BASE_URL}…`);
let cognateCards = 0;
let chatInserted = 0;

if (!onlySection || onlySection === "cognate") {
  const cognate = await seedCognateFamilies();
  cognateCards = cognate.cards;
  console.log(
    `cognate-trap packs: ${cognate.packs} packs, ${cognate.cards} cards`
  );
}

if (!onlySection || onlySection === "chat") {
  const chat = await seedChatKeepers();
  chatInserted = chat.inserted ?? 0;
  console.log(
    `chat-organic: ${chatInserted} inserted, ${chat.skipped} skipped`
  );
}

console.log(`\nseed complete: +${cognateCards + chatInserted} cards total`);
