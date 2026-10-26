"use client";

import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { BTN_GHOST } from "./card";

export function LogoutButton({ className = "", wide = false }: { className?: string; wide?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
      className={`${BTN_GHOST} ${wide ? "w-full" : ""} ${className}`}
      title="Đăng xuất"
    >
      <SignOut size={18} />
      <span className={wide ? "" : "sr-only lg:not-sr-only"}>Đăng xuất</span>
    </button>
  );
}
