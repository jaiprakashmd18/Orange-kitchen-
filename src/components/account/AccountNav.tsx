"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Icon, type IconName } from "@/components/ui/Icon";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/account", label: "Overview", icon: "home" },
  { href: "/account/orders", label: "My Orders", icon: "bag" },
  { href: "/account/addresses", label: "Saved Addresses", icon: "pin" },
  { href: "/account/favourites", label: "Favourite Dishes", icon: "heart" },
  { href: "/account/payments", label: "Payments & Receipts", icon: "receipt" },
  { href: "/account/notifications", label: "Notifications", icon: "bell" },
  { href: "/account/settings", label: "Profile & Settings", icon: "settings" },
];

export function AccountNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:gap-1 lg:p-0">
      {LINKS.map((l) => {
        const active = l.href === "/account" ? pathname === "/account" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={clsx("flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition", active ? "bg-white text-brand-700 shadow-sm" : "text-charcoal-700 hover:bg-white/60")}>
            <Icon name={l.icon} className="h-4 w-4" /> {l.label}
            {l.href === "/account/notifications" && unread > 0 && <span className="ml-auto rounded-full bg-brand-600 px-2 text-xs text-white">{unread}</span>}
          </Link>
        );
      })}
      <form action="/auth/signout" method="post" className="lg:mt-4">
        <button className="flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-charcoal-500 hover:bg-white/60 hover:text-chilli">
          <Icon name="logout" className="h-4 w-4" /> Logout
        </button>
      </form>
    </nav>
  );
}
