"use client";

export function OfflineRetry({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.location.reload()}>
      Thử lại
    </button>
  );
}
