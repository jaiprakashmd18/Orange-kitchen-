"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/components/cart/CartProvider";
import { formatINR } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";

/** Sticky "View cart" bar on small screens (hidden on cart/checkout). */
export function MobileCartBar() {
  const { count, subtotal, ready } = useCart();
  const pathname = usePathname();
  const hidden = !ready || count === 0 || ["/cart", "/checkout"].some((p) => pathname.startsWith(p)) || /^\/(admin|delivery|auth)/.test(pathname);
  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        >
          <Link href="/cart" className="flex items-center justify-between rounded-2xl bg-brand-600 px-5 py-3.5 text-white shadow-lift">
            <span className="text-sm font-semibold">
              {count} item{count > 1 ? "s" : ""} · {formatINR(subtotal)}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              View cart <Icon name="arrowRight" className="h-4 w-4" />
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
