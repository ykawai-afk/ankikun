-- pgvector + embeddings for similar-word discovery
create extension if not exists vector;

alter table public.cards
  add column if not exists embedding vector(1536);

create index if not exists cards_embedding_idx
  on public.cards using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_similar_cards(
  target_user_id uuid,
  query_embedding vector(1536),
  exclude_card_id uuid,
  match_count int default 3
)
returns table (
  id uuid,
  word text,
  definition_ja text,
  part_of_speech text,
  reading text,
  similarity float
)
language sql stable as $$
  select
    c.id,
    c.word,
    c.definition_ja,
    c.part_of_speech,
    c.reading,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.cards c
  where c.user_id = target_user_id
    and c.id <> exclude_card_id
    and c.embedding is not null
    and c.status <> 'suspended'
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
