import { sendMagicLink } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        action={sendMagicLink}
        className="w-full max-w-sm flex flex-col gap-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 bg-white dark:bg-zinc-950"
      >
        <div>
          <h1 className="text-2xl font-semibold">Ankikun</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            メールアドレスにログインリンクを送ります
          </p>
        </div>
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          required
          className="h-11 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
        <button
          type="submit"
          className="h-11 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors font-medium"
        >
          ログインリンクを送る
        </button>
        {params.sent && (
          <p className="text-sm text-emerald-600">メール送信しました。受信箱を確認してください。</p>
        )}
        {params.error && (
          <p className="text-sm text-red-600">エラー: {params.error}</p>
        )}
      </form>
    </main>
  );
}
