/** Small fetch wrapper for client components; returns an error message instead of throwing. */
export async function call(method: string, url: string, body?: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? `Lỗi ${res.status}` };
  } catch {
    return { ok: false, error: "Không thể kết nối tới máy chủ." };
  }
}
