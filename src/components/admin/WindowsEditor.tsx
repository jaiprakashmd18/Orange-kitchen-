"use client";

import { useState } from "react";
import { DAY_NAMES } from "@/lib/format";

type W = { day_of_week: number; start_time: string; end_time: string };

/** Weekly time windows when a dish can be ordered (e.g. breakfast only). */
export function WindowsEditor({ name, initial }: { name: string; initial: W[] }) {
  const [rows, setRows] = useState<W[]>(initial.map((w) => ({ ...w, start_time: w.start_time.slice(0, 5), end_time: w.end_time.slice(0, 5) })));
  const addPreset = (start: string, end: string) => setRows((r) => [...r, ...[0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, start_time: start, end_time: end }))]);
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.length === 0 && <p className="text-sm text-charcoal-500">Available whenever the restaurant is open.</p>}
      <ul className="space-y-2">
        {rows.map((w, i) => (
          <li key={i} className="flex flex-wrap gap-2">
            <select className="input w-36" value={w.day_of_week} onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, day_of_week: Number(e.target.value) } : x)))}>
              {DAY_NAMES.map((d, di) => <option key={d} value={di}>{d}</option>)}
            </select>
            <input type="time" className="input w-32" value={w.start_time} onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))} aria-label="From" />
            <input type="time" className="input w-32" value={w.end_time} onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))} aria-label="Until" />
            <button type="button" className="btn-ghost btn-sm" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setRows((r) => [...r, { day_of_week: 1, start_time: "07:00", end_time: "11:00" }])}>+ Add window</button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => addPreset("07:00", "11:00")}>+ Every day (set times)</button>
        {rows.length > 0 && <button type="button" className="btn-ghost btn-sm text-chilli" onClick={() => setRows([])}>Clear all</button>}
      </div>
    </div>
  );
}
