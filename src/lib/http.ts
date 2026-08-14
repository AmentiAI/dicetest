export async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.status ? `Empty response (${res.status})` : "Empty response from server",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Server returned invalid JSON");
  }
}

export async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await readJson<T>(res);
  } catch {
    return null;
  }
}

export async function postJson<T extends { error?: string }>(
  url: string,
  body: unknown,
): Promise<T> {
  const send = () =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

  let res = await send();
  let text = await res.text();
  if (!text.trim() && res.status !== 204) {
    await new Promise((r) => setTimeout(r, 400));
    res = await send();
    text = await res.text();
  }
  if (!text.trim()) {
    throw new Error("Empty response from server. Try binding again.");
  }
  let json: T;
  try {
    json = JSON.parse(text) as T;
  } catch {
    throw new Error("Server returned invalid JSON");
  }
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
