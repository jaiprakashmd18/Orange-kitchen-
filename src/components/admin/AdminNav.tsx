"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Icon, type IconName } from "@/components/ui/Icon";

type Item = { href: string; label: string; icon: IconName; adminOnly?: boolean };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Operations", items: [
    { href: "/admin", label: "Dashboard", icon: "chart" },
    { href: "/admin/orders", label: "Orders", icon: "bag" },
    { href: "/admin/delivery-team", label: "Delivery team", icon: "bike" },
  ] },
  { title: "Menu", items: [
    { href: "/admin/menu", label: "Dishes", icon: "menu" },
    { href: "/admin/categories", label: "Categories", icon: "tag" },
  ] },
  { title: "Business", items: [
    { href: "/admin/reports", label: "Sales & reports", icon: "chart", adminOnly: true },
    { href: "/admin/coupons", label: "Coupons", icon: "tag", adminOnly: true },
    { href: "/admin/reviews", label: "Reviews", icon: "star" },
    { href: "/admin/messages", label: "Messages", icon: "mail" },
  ] },
  { title: "Settings", items: [
    { href: "/admin/settings", label: "Restaurant settings", icon: "settings", adminOnly: true },
    { href: "/admin/hours", label: "Hours & holidays", icon: "clock", adminOnly: true },
    { href: "/admin/delivery-areas", label: "Delivery areas", icon: "pin", adminOnly: true },
    { href: "/admin/pickup-slots", label: "Pickup slots", icon: "bag", adminOnly: true },
    { href: "/admin/delivery-providers", label: "Delivery partners", icon: "external", adminOnly: true },
    { href: "/admin/staff", label: "Staff access", icon: "user", adminOnly: true },
    { href: "/admin/audit", label: "Audit log", icon: "receipt", adminOnly: true },
  ] },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav aria-label="Admin" className="space-y-6">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => isAdmin || !i.adminOnly);
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <p className="px-3 text-[11px] font-bold uppercase tracking-widest text-white/40">{g.title}</p>
            <ul className="mt-2 space-y-0.5">
              {items.map((i) => {
                const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} onClick={() => setOpen(false)} className={clsx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-brand-600 text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}>
                      <Icon name={i.icon} className="h-4 w-4" /> {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
  return (
    <>
      <button type="button" className="btn-ghost text-white lg:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name={open ? "close" : "menu"} /> Menu
      </button>
      <div className={clsx("lg:block", open ? "block" : "hidden")}>{nav}</div>
    </>
  );
}
