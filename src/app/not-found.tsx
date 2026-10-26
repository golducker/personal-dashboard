import Link from "next/link";
import { BTN_PRIMARY } from "@/components/card";
import { Mascot } from "@/components/mascot";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center page-pad">
      <p className="font-display text-7xl leading-none font-extrabold tracking-tight text-accent-strong">404</p>
      <Mascot size="lg" pose="lost" />
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">Không tìm thấy trang</h1>
        <p className="text-sm text-ink-2">Đường dẫn có thể đã đổi hoặc không tồn tại.</p>
      </div>
      <Link href="/" className={BTN_PRIMARY}>
        Về Hôm nay
      </Link>
    </main>
  );
}
