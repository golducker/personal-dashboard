"use client";

import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { BTN_GHOST } from "./card";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
      className={`${BTN_GHOST} ml-auto sm:ml-0`}
      title="Đăng xuất"
    >
      <SignOut size={18} />
      <span className="sr-only sm:not-sr-only">Đăng xuất</span>
    </button>
  );
}
