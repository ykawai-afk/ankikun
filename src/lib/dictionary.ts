// Free Dictionary API (https://dictionaryapi.dev) — no key, no auth.
// Returns the first available pronunciation MP3 URL for a word, preferring
// the American English variant when both US and UK are available.

type PhoneticEntry = {
  text?: string | null;
  audio?: string | null;
};

type DictEntry = {
  word?: string;
  phonetics?: PhoneticEntry[];
};

export async function fetchWordAudio(word: string): Promise<string | null> {
  const head = word.trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (!head || !/^[a-z'-]+$/i.test(head)) return null;
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(head)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DictEntry[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const phonetics = data.flatMap((e) => e.phonetics ?? []);
    const us = phonetics.find((p) => p.audio && /-us\.mp3$/i.test(p.audio));
    if (us?.audio) return us.audio;
    const anyAudio = phonetics.find((p) => p.audio);
    return anyAudio?.audio ?? null;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("dictionary lookup failed", word, e);
    }
    return null;
  }
}
