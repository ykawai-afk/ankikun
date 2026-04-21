"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

type State =
  | "loading"
  | "needs-pwa"
  | "unsupported"
  | "denied"
  | "off"
  | "on";

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone =
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mm || iosStandalone;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (typeof window === "undefined") return;
      if (!vapidKey || !("serviceWorker" in navigator)) {
        if (alive) setState("unsupported");
        return;
      }
      if (isIos() && !isStandalonePwa()) {
        if (alive) setState("needs-pwa");
        return;
      }
      if (!("PushManager" in window)) {
        if (alive) setState("unsupported");
        return;
      }
      try {
        const reg =
          (await navigator.serviceWorker.getRegistration("/sw.js")) ??
          (await navigator.serviceWorker.register("/sw.js"));
        await navigator.serviceWorker.ready;
        if (Notification.permission === "denied") {
          if (alive) setState("denied");
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        if (alive) setState(sub ? "on" : "off");
      } catch (e) {
        console.error("sw register failed", e);
        if (alive) setState("unsupported");
      }
    })();
    return () => {
      alive = false;
    };
  }, [vapidKey]);

  async function turnOn() {
    if (!vapidKey || busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const raw = sub.toJSON();
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: raw.endpoint,
          keys: raw.keys,
        }),
      });
      if (!res.ok) throw new Error(`subscribe failed: ${res.status}`);
      setState("on");
    } catch (e) {
      console.error("turnOn failed", e);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(
          `/api/notifications/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
          { method: "DELETE" }
        );
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      console.error("turnOff failed", e);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  if (state === "unsupported") {
    return (
      <div className="rounded-xl bg-surface-2 px-3 py-2 flex items-center gap-2 text-[11px] text-muted">
        <BellOff size={12} />
        このブラウザは通知非対応
      </div>
    );
  }

  if (state === "needs-pwa") {
    return (
      <div className="rounded-xl bg-accent-soft/60 border border-accent/20 px-3 py-2 flex items-start gap-2 text-[11px] text-foreground">
        <Bell size={12} className="text-accent mt-0.5 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">通知を使うには</span>
          <span className="text-muted leading-relaxed">
            Safari下部の共有ボタン → <b>ホーム画面に追加</b> →
            追加したアイコンから起動
          </span>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="rounded-xl bg-surface-2 px-3 py-2 flex items-center gap-2 text-[11px] text-muted">
        <BellOff size={12} />
        通知はブラウザ設定で許可してください
      </div>
    );
  }

  if (state === "on") {
    return (
      <button
        type="button"
        onClick={turnOff}
        disabled={busy}
        className="rounded-xl bg-success-soft border border-success/20 px-3 py-2 flex items-center gap-2 text-[11px] text-success font-medium active:scale-[0.98] transition disabled:opacity-60"
      >
        <Check size={12} />
        通知ON
        <span className="text-muted/80 ml-auto">タップでOFF</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={turnOn}
      disabled={busy}
      className="rounded-xl bg-accent-soft border border-accent/20 px-3 py-2 flex items-center gap-2 text-[11px] text-accent font-medium active:scale-[0.98] transition disabled:opacity-60"
    >
      <Bell size={12} />
      復習時刻に通知を受け取る
    </button>
  );
}
