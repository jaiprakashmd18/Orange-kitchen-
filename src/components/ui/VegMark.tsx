/** Standard Indian veg / non-veg indicator (FSSAI style square). */
export function VegMark({ veg, className = "" }: { veg: boolean; className?: string }) {
  const color = veg ? "#1E8E3E" : "#B42318";
  return (
    <span
      role="img"
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] bg-white ${className}`}
      style={{ borderColor: color }}
    >
      {veg ? (
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      ) : (
        <span className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent" style={{ borderBottomColor: color }} />
      )}
    </span>
  );
}
