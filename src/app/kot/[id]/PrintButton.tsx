"use client";
export function KotPrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary btn-sm">
      Print
    </button>
  );
}
