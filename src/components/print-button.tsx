"use client";

export function PrintButton({ label }: { label: string }) {
  return <button className="btn btn-ghost no-print" type="button" onClick={() => window.print()}>{label}</button>;
}
