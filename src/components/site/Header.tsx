"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { Logo } from "./Logo";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/components/cart/CartProvider";
import type { AppRole } from "@/lib/types";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header({
  logoUrl,
  name,
  announcement,
  signedIn,
  roles,
}: {
  logoUrl: string | null;
  name: string;
  announcement: string | null;
  signedIn: boolean;
  roles: AppRole[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { count, ready } = useCart();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const staffLinks = [
    ...(roles.includes("delivery") ? [{ href: "/delivery", label: "Deliveries" }] : []),
  ];

  return (
    <>
      {announcement && (
        <div className="bg-charcoal px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">{announcement}</div>
      )}
      <header
        className={clsx(
          "sticky top-0 z-40 border-b transition-colors",
          scrolled ? "border-charcoal/10 bg-white/90 backdrop-blur-md" : "border-transparent bg-cream/80 backdrop-blur-sm",
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4 sm:h-20">
          <Logo logoUrl={logoUrl} name={name} />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  isActive(n.href) ? "bg-brand-50 text-brand-700" : "text-charcoal-700 hover:text-brand-700",
                )}
              >
                {n.label}
              </Link>
            ))}
            {staffLinks.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-full px-4 py-2 text-sm font-semibold text-charcoal-500 hover:text-brand-700">
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {signedIn ? (
              <Link href="/account" className="btn-ghost hidden sm:inline-flex" aria-label="My account">
                <Icon name="user" /> <span className="hidden lg:inline">Account</span>
              </Link>
            ) : (
              <Link href="/auth/login" className="btn-ghost hidden sm:inline-flex">
                Login / Sign up
              </Link>
            )}
            <Link href="/cart" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-charcoal/10 transition hover:ring-brand-500" aria-label={`Cart, ${count} items`}>
              <Icon name="cart" />
              {ready && count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
            <Link href="/menu" className="btn-primary hidden sm:inline-flex">
              Order Now
            </Link>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full md:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              <Icon name={open ? "close" : "menu"} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.nav
              id="mobile-nav"
              aria-label="Mobile"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-charcoal/10 bg-white md:hidden"
            >
              <div className="container-page flex flex-col gap-1 py-3">
                {[...NAV, ...staffLinks].map((n) => (
                  <Link key={n.href} href={n.href} className={clsx("rounded-xl px-4 py-3 font-semibold", isActive(n.href) ? "bg-brand-50 text-brand-700" : "text-charcoal")}>
                    {n.label}
                  </Link>
                ))}
                <Link href={signedIn ? "/account" : "/auth/login"} className="rounded-xl px-4 py-3 font-semibold text-charcoal">
                  {signedIn ? "My Account" : "Login / Sign up"}
                </Link>
                <Link href="/menu" className="btn-primary mt-2">
                  Order Now
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
