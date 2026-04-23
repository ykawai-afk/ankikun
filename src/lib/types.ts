export type CardStatus = "new" | "learning" | "review" | "suspended";

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type RelatedWord = {
  word: string;
  part_of_speech: string | null;
  meaning_ja: string;
};

export type ExtraExample = {
  en: string;
  ja: string;
  register: "formal" | "conversational" | "idiom" | null;
};

export type RootSegment = {
  segment: string;
  origin: string | null;
  meaning: string;
};

export type Cognate = {
  word: string;
  meaning_ja: string;
};

export type DeepDive = {
  roots: RootSegment[];
  cognates: Cognate[];
  hook: string;
};

export type Card = {
  id: string;
  user_id: string;
  word: string;
  reading: string | null;
  part_of_speech: string | null;
  definition_ja: string;
  definition_en: string | null;
  example_en: string | null;
  example_ja: string | null;
  source_image_path: string | null;
  source_context: string | null;
  etymology: string | null;
  user_note: string | null;
  audio_url: string | null;
  difficulty: CEFRLevel | null;
  frequency_rank: number | null;
  was_intro_easy: boolean;
  image_url: string | null;
  related_words: RelatedWord[] | null;
  extra_examples: ExtraExample[] | null;
  deep_dive: DeepDive | null;
  tags: string[] | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  status: CardStatus;
  created_at: string;
  updated_at: string;
};

export type Rating = 0 | 1 | 2 | 3; // Again | Hard | Good | Easy

// Source format the user was reviewing in when the rating was produced.
// Drives the format-aware bump in grade(): cloze/typing successful
// recalls are one SRS tier stronger than front/back recognition.
export type ReviewFormat = "normal" | "cloze" | "typing";

export type ReviewLog = {
  id: string;
  card_id: string;
  user_id: string;
  rating: Rating;
  prev_interval: number;
  new_interval: number;
  prev_ease: number;
  new_ease: number;
  format: ReviewFormat | null;
  reviewed_at: string;
};

export type IngestionStatus = "pending" | "processed" | "failed";

export type Ingestion = {
  id: string;
  user_id: string;
  image_path: string;
  status: IngestionStatus;
  raw_response: unknown | null;
  cards_created: number;
  error: string | null;
  created_at: string;
  processed_at: string | null;
};
