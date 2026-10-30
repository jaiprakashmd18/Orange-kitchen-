export const TIMEZONE = "Asia/Kolkata";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatINR(value: number | string | null | undefined, opts: { whole?: boolean } = {}) {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (opts.whole && Number.isInteger(n)) return inrWhole.format(n);
  return inr.format(n);
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00+05:30") : new Date(iso);
  return new Intl.DateTimeFormat("en-IN", { timeZone: TIMEZONE, day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** "13:30:00" -> "1:30 PM" */
export function formatClock(time: string | null | undefined) {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Current date/time parts in IST, independent of server timezone. */
export function nowInIST(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
    dayOfWeek: weekday,
  };
}

/** Build a Date from an IST calendar date and clock time. */
export function istDateTime(date: string, time: string) {
  return new Date(`${date}T${time.length === 5 ? time + ":00" : time}+05:30`);
}

export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00+05:30");
  d.setUTCDate(d.getUTCDate() + days);
  return nowInIST(d).date;
}

export function telHref(phone: string | null | undefined) {
  return phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : undefined;
}

export function whatsappHref(phone: string | null | undefined, text?: string) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return phone;
}
