function parseBody<T>(text: string, status: number): T {
  if (!text.trim()) {
    throw new Error(
      status ? `Empty response (${status})` : "Empty response from server. Try binding again.",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Server returned invalid JSON");
  }
}

function xhrRequest(method: string, url: string, body?: unknown): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("Accept", "application/json");
    if (body !== undefined) {
      xhr.setRequestHeader("Content-Type", "application/json");
    }
    xhr.timeout = 25_000;
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText ?? "" });
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Request timed out"));
    xhr.send(body === undefined ? null : JSON.stringify(body));
  });
}

export async function readJson<T>(res: Response): Promise<T> {
  return parseBody<T>(await res.text(), res.status);
}

export async function getJson<T>(url: string): Promise<T | null> {
  try {
    if (typeof XMLHttpRequest !== "undefined") {
      const { status, text } = await xhrRequest("GET", url);
      if (status < 200 || status >= 300) return null;
      return parseBody<T>(text, status);
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await readJson<T>(res);
  } catch {
    return null;
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const send = async () => {
    if (typeof XMLHttpRequest !== "undefined") {
      return xhrRequest("POST", url, body);
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return { status: res.status, text: await res.text() };
  };

  let { status, text } = await send();
  if (!text.trim() && status !== 204) {
    await new Promise((r) => setTimeout(r, 500));
    ({ status, text } = await send());
  }

  const json = parseBody<T & { error?: string }>(text, status);
  if (status < 200 || status >= 300) {
    throw new Error(json.error || `Request failed (${status})`);
  }
  return json;
}
