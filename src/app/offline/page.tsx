import { BTN_PRIMARY, Panel } from "@/components/card";
import { OfflineRetry } from "./retry";

export const metadata = { title: "Mất kết nối" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <Panel title="Mất kết nối" className="w-full">
        <p className="text-sm text-ink-2">Không có mạng. Kiểm tra kết nối rồi thử lại.</p>
        <div className="mt-4">
          <OfflineRetry className={`${BTN_PRIMARY} min-h-11`} />
        </div>
      </Panel>
    </main>
  );
}
