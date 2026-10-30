import clsx from "clsx";
import { stagesFor, stageIndex } from "@/lib/order-status";
import { formatTime } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import type { Fulfillment, OrderStatus, StatusHistory } from "@/lib/types";

export function OrderTimeline({ fulfillment, status, history, createdAt }: { fulfillment: Fulfillment; status: OrderStatus; history: StatusHistory[]; createdAt: string }) {
  const stages = stagesFor(fulfillment);
  const current = stageIndex(fulfillment, status);
  const reached = (key: string) => (key === "placed" ? createdAt : history.find((h) => h.to_status === key)?.created_at);

  return (
    <ol className="relative space-y-0" aria-label="Order progress">
      {stages.map((s, i) => {
        const done = i < current || (i === current && ["delivered", "collected"].includes(status));
        const active = i === current && !done;
        const at = reached(s.key);
        return (
          <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
            {i < stages.length - 1 && <span className={clsx("absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5", i < current ? "bg-brand-500" : "bg-charcoal/10")} aria-hidden />}
            <span
              className={clsx(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                done ? "border-brand-500 bg-brand-500 text-white" : active ? "animate-pulseRing border-brand-500 bg-white text-brand-600" : "border-charcoal/15 bg-white text-charcoal-400",
              )}
            >
              {done ? <Icon name="check" className="h-4 w-4" strokeWidth={2.5} /> : <span className="text-xs font-bold">{i + 1}</span>}
            </span>
            <div className="pt-1">
              <p className={clsx("font-semibold", active ? "text-brand-700" : done ? "text-charcoal" : "text-charcoal-400")} aria-current={active ? "step" : undefined}>
                {s.label}
              </p>
              {at && (done || active) && <p className="text-xs text-charcoal-500">{formatTime(at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
