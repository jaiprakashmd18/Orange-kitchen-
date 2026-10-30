import { PageHeader, StatCard } from "@/components/admin/PageHeader";
import { requireRole } from "@/lib/auth";
import { addDays, formatDate, formatINR, nowInIST } from "@/lib/format";
import { istRange, salesByPeriod, salesSummary, topItems } from "@/lib/reports";

export const metadata = { title: "Sales & reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; bucket?: string }> }) {
  await requireRole(["admin"], "/admin/reports");
  const sp = await searchParams;
  const today = nowInIST().date;
  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const from = valid(sp.from) ?? addDays(today, -29);
  const to = valid(sp.to) ?? today;
  const bucket = sp.bucket === "week" || sp.bucket === "month" ? sp.bucket : "day";
  const range = istRange(from, to);
  const [summary, periods, top] = await Promise.all([salesSummary(range.from, range.to), salesByPeriod(range.from, range.to, bucket), topItems(range.from, range.to, 15)]);
  const max = Math.max(1, ...periods.map((p) => p.revenue));
  const exportQs = new URLSearchParams({ from, to }).toString();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & reports"
        description="Revenue counts paid orders that were not cancelled, rejected or refunded. Dates in IST."
        actions={<>
          <a href={`/api/admin/reports/export?type=orders&${exportQs}`} className="btn-secondary">Export orders CSV</a>
          <a href={`/api/admin/reports/export?type=payments&${exportQs}`} className="btn-secondary">Export payments CSV</a>
          <a href={`/api/admin/reports/export?type=items&${exportQs}`} className="btn-secondary">Export items CSV</a>
        </>}
      />
      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <label><span className="label">From</span><input type="date" name="from" defaultValue={from} className="input" /></label>
        <label><span className="label">To</span><input type="date" name="to" defaultValue={to} className="input" /></label>
        <label><span className="label">Group by</span><select name="bucket" defaultValue={bucket} className="input"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
        <button className="btn-primary">Update</button>
      </form>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total revenue" value={formatINR(summary.revenue)} />
        <StatCard label="Orders" value={summary.orders_count} />
        <StatCard label="Average order value" value={formatINR(summary.avg_order_value)} />
        <StatCard label="Cancelled / rejected" value={summary.cancelled_orders} />
        <StatCard label="Delivery revenue" value={formatINR(summary.delivery_revenue)} hint={`${summary.delivery_orders} orders`} />
        <StatCard label="Takeaway revenue" value={formatINR(summary.takeaway_revenue)} hint={`${summary.takeaway_orders} orders`} />
      </section>
      <section className="card p-5">
        <h2 className="mb-4 font-sans font-bold">Revenue by {bucket}</h2>
        {periods.length === 0 ? <p className="text-sm text-charcoal-500">No paid orders in this range.</p> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>{bucket === "day" ? "Date" : bucket === "week" ? "Week of" : "Month"}</th><th className="w-1/2" /><th className="text-right">Orders</th><th className="text-right">Delivery</th><th className="text-right">Takeaway</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.bucket}>
                    <td className="whitespace-nowrap">{bucket === "month" ? p.bucket.slice(0, 7) : formatDate(p.bucket)}</td>
                    <td><div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${(p.revenue / max) * 100}%` }} aria-hidden /></td>
                    <td className="text-right tabular-nums">{p.orders_count}</td>
                    <td className="text-right tabular-nums">{formatINR(p.delivery_revenue)}</td>
                    <td className="text-right tabular-nums">{formatINR(p.takeaway_revenue)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatINR(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card p-5">
        <h2 className="mb-4 font-sans font-bold">Best-selling dishes</h2>
        {top.length === 0 ? <p className="text-sm text-charcoal-500">No sales in this range.</p> : (
          <table className="table-base">
            <thead><tr><th>#</th><th>Dish</th><th className="text-right">Quantity</th><th className="text-right">Revenue</th></tr></thead>
            <tbody>{top.map((t, i) => <tr key={t.menu_item_id ?? i}><td>{i + 1}</td><td>{t.item_name}</td><td className="text-right tabular-nums">{t.quantity}</td><td className="text-right tabular-nums">{formatINR(t.revenue)}</td></tr>)}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
