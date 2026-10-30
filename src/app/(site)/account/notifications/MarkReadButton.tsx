"use client";
import { useTransition } from "react";
import { markNotificationsRead } from "../actions";

export function MarkReadButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => { await markNotificationsRead(); })}>
      Mark all as read
    </button>
  );
}
