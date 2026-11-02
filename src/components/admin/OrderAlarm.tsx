"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Kitchen alarm: rings (Web Audio, no sound file needed), shows a browser
// notification and flashes the tab title whenever an order needs attention:
//   • a paid order waiting to be accepted (status payment_confirmed)
//   • a UPI payment waiting to be verified (payment verification_pending)
// It keeps ringing every 15 s until nothing is waiting or staff press "Stop".
// Browsers only allow sound after a tap, so staff tap "Turn on alerts" once
// per device; the choice is remembered.

const PREF = "ok-order-alerts";
const RING_EVERY_MS = 15_000;

interface Pending {
  orders: number;
  upi: number;
}

function ring(ctx: AudioContext) {
  // Two-tone "ding-dong" × 3, loud enough for a kitchen.
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    for (const [offset, freq] of [
      [0, 1046.5],
      [0.18, 784],
    ] as const) {
      const t = now + i * 0.6 + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    }
  }
}

export function OrderAlarm() {
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState<Pending>({ orders: 0, upi: 0 });
  const [snoozedAt, setSnoozedAt] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);
  const lastTotal = useRef(0);
  const total = pending.orders + pending.upi;

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [o, p] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "payment_confirmed"),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "verification_pending"),
    ]);
    setPending({ orders: o.count ?? 0, upi: p.count ?? 0 });
  }, []);

  // Restore preference
  useEffect(() => {
    try {
      if (localStorage.getItem(PREF) === "on") setEnabled(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Live updates
  useEffect(() => {
    refresh();
    const supabase = createClient();
    const ch = supabase
      .channel(`order-alarm-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => refresh())
      .subscribe();
    const poll = setInterval(refresh, 60_000); // safety net if the socket drops
    return () => {
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  // New item arrived → browser notification + un-snooze
  useEffect(() => {
    if (total > lastTotal.current) {
      setSnoozedAt(0);
      if (enabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const body = [pending.orders && `${pending.orders} new order(s) to accept`, pending.upi && `${pending.upi} UPI payment(s) to verify`].filter(Boolean).join(" · ");
        try {
          new Notification("🍊 Orange Kitchen — new order", { body, icon: "/icons/icon-192.png", tag: "ok-new-order", requireInteraction: true });
        } catch {
          /* some mobile browsers only allow notifications via a service worker */
        }
      }
    }
    lastTotal.current = total;
  }, [total, enabled, pending.orders, pending.upi]);

  // Ring loop while something is waiting
  useEffect(() => {
    if (!enabled || total === 0) return;
    const tick = () => {
      if (snoozedAt && Date.now() - snoozedAt < 5 * 60_000) return; // "Stop" silences for 5 min
      const ctx = ctxRef.current;
      if (ctx) {
        if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
        ring(ctx);
      }
    };
    tick();
    const t = setInterval(tick, RING_EVERY_MS);
    return () => clearInterval(t);
  }, [enabled, total, snoozedAt]);

  // Flash the tab title
  useEffect(() => {
    if (total === 0) return;
    const base = document.title;
    let on = false;
    const t = setInterval(() => {
      on = !on;
      document.title = on ? `🔔 (${total}) New order!` : base;
    }, 1000);
    return () => {
      clearInterval(t);
      document.title = base;
    };
  }, [total]);

  // Keep a kitchen tablet's screen awake while alerts are on
  useEffect(() => {
    if (!enabled) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const acquire = () => nav.wakeLock?.request("screen").then((l) => (wakeRef.current = l)).catch(() => undefined);
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wakeRef.current?.release().catch(() => undefined);
    };
  }, [enabled]);

  async function turnOn() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctxRef.current ??= new AC();
    await ctxRef.current.resume().catch(() => undefined);
    ring(ctxRef.current); // test ring (also unlocks audio on iOS/Android)
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => undefined);
    }
    try {
      localStorage.setItem(PREF, "on");
    } catch {
      /* ignore */
    }
    setEnabled(true);
  }

  function turnOff() {
    try {
      localStorage.setItem(PREF, "off");
    } catch {
      /* ignore */
    }
    setEnabled(false);
  }

  // Audio contexts can't be created before a tap; after a reload with alerts
  // "on", the first tap anywhere re-arms the sound.
  useEffect(() => {
    if (!enabled || ctxRef.current) return;
    const arm = () => {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AC();
      ctxRef.current.resume().catch(() => undefined);
    };
    window.addEventListener("pointerdown", arm, { once: true });
    return () => window.removeEventListener("pointerdown", arm);
  }, [enabled]);

  const needsTap = enabled && !ctxRef.current;

  return (
    <>
      {total > 0 && (
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lift" role="alert">
          <span className="animate-pulse text-lg" aria-hidden>🔔</span>
          {pending.orders > 0 && (
            <Link href="/admin/orders?status=payment_confirmed" className="rounded-full bg-white/15 px-3 py-1 hover:bg-white/25">
              {pending.orders} new order{pending.orders > 1 ? "s" : ""} — accept now
            </Link>
          )}
          {pending.upi > 0 && (
            <Link href="/admin/orders?payment=verification_pending" className="rounded-full bg-white/15 px-3 py-1 hover:bg-white/25">
              {pending.upi} UPI payment{pending.upi > 1 ? "s" : ""} to verify
            </Link>
          )}
          {enabled && (
            <button type="button" onClick={() => setSnoozedAt(Date.now())} className="rounded-full bg-charcoal/30 px-3 py-1 hover:bg-charcoal/50">
              Stop ringing (5 min)
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-3 text-xs sm:px-6 lg:px-8">
        {!enabled ? (
          <button type="button" onClick={turnOn} className="btn btn-sm bg-leaf text-white hover:brightness-110">
            🔔 Turn on new-order alerts (sound + notification)
          </button>
        ) : (
          <>
            <span className="text-leaf">● Order alerts on{needsTap ? " — tap anywhere to enable sound" : ""}</span>
            <button type="button" onClick={() => ctxRef.current && ring(ctxRef.current)} className="btn-ghost btn-sm">Test sound</button>
            <button type="button" onClick={turnOff} className="btn-ghost btn-sm text-charcoal-500">Turn off</button>
          </>
        )}
      </div>
    </>
  );
}
