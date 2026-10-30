"use client";
import { Icon } from "@/components/ui/Icon";

export function PrintButton() {
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>
      <Icon name="download" className="h-4 w-4" /> Download / Print
    </button>
  );
}
