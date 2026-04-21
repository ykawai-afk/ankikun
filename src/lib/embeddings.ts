const MODEL = "text-embedding-3-small";
const DIM = 1536;

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, input: text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`embedding failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as {
    data: { embedding: number[] }[];
  };
  const vec = json.data[0]?.embedding;
  if (!vec || vec.length !== DIM) {
    throw new Error(`unexpected embedding shape: len=${vec?.length}`);
  }
  return vec;
}

export async function embedBatch(inputs: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`embedding failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  const out: number[][] = new Array(inputs.length);
  for (const d of json.data) out[d.index] = d.embedding;
  return out;
}

export function textForEmbedding(card: {
  word: string;
  part_of_speech: string | null;
  definition_ja: string;
  definition_en: string | null;
}): string {
  const pos = card.part_of_speech ? ` (${card.part_of_speech})` : "";
  const en = card.definition_en ? ` — ${card.definition_en}` : "";
  return `${card.word}${pos}: ${card.definition_ja}${en}`;
}
