import { PageShell } from "@/components/page-shell";
import { ModeTabs } from "./mode-tabs";

export default function AddPage() {
  return (
    <PageShell title="カードを追加">
      <div className="py-6">
        <ModeTabs />
      </div>
    </PageShell>
  );
}
