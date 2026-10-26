import { sfx } from "@/lib/sfx";

/** Small fetch wrapper for client components; returns an error message instead of throwing. Failures play the error sound. */
export async function call(method: string, url: string, body?: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const fail = (error: string) => {
    sfx.error();
    return { ok: false as const, error };
  };
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return fail(data.error ?? `Lỗi ${res.status}`);
  } catch {
    return fail("Không thể kết nối tới máy chủ.");
  }
}
