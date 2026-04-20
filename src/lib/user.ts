export function getUserId(): string {
  const id = process.env.INGEST_USER_ID;
  if (!id) throw new Error("INGEST_USER_ID is not set");
  return id;
}
