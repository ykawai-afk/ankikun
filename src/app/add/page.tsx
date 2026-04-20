import { PageShell } from "@/components/page-shell";
import { AddForm } from "./add-form";

export default function AddPage() {
  return (
    <PageShell title="カードを追加">
      <div className="py-6">
        <AddForm />
      </div>
    </PageShell>
  );
}
