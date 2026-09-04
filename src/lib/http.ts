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

function xhrRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("Accept", "application/json");
    if (body !== undefined) {
      xhr.setRequestHeader("Content-Type", "application/json");
    }
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }
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

export async function requestJson<T>(
  method: "GET" | "POST",
  url: string,
  opts?: { body?: unknown; headers?: Record<string, string> },
): Promise<{ status: number; json: (T & { error?: string }) | null; text: string }> {
  let status: number;
  let text: string;
  if (typeof XMLHttpRequest !== "undefined") {
    ({ status, text } = await xhrRequest(method, url, opts?.body, opts?.headers));
  } else {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(opts?.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...opts?.headers,
      },
      body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
    });
    status = res.status;
    text = await res.text();
  }
  if (!text.trim()) return { status, json: null, text };
  try {
    return { status, json: parseBody<T & { error?: string }>(text, status), text };
  } catch {
    return { status, json: null, text };
  }
}

export async function getJson<T>(
  url: string,
  headers?: Record<string, string>,
): Promise<T | null> {
  try {
    const { status, json } = await requestJson<T>("GET", url, { headers });
    if (status < 200 || status >= 300) return null;
    return json;
  } catch {
    return null;
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const send = () => requestJson<T>("POST", url, { body });

  let { status, json, text } = await send();
  if (!text.trim() && status !== 204) {
    await new Promise((r) => setTimeout(r, 500));
    ({ status, json, text } = await send());
  }

  if (!json) {
    throw new Error(status ? `Empty response (${status})` : "Empty response from server.");
  }
  if (status < 200 || status >= 300) {
    throw new Error(json.error || `Request failed (${status})`);
  }
  return json;
}
