const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

type ApiOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
};

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = (opts.method || "GET").toUpperCase();

  const headers: Record<string, string> = {
    ...(opts.headers || {}),
  };

  const isSafe = ["GET", "HEAD", "OPTIONS"].includes(method);
  if (!isSafe) {
    const csrf = localStorage.getItem("csrfToken");
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  let body: BodyInit | undefined = undefined;
  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      body = opts.body;
    } else if (typeof opts.body === "string") {
      headers["content-type"] ||= "application/json";
      body = opts.body;
    } else {
      headers["content-type"] ||= "application/json";
      body = JSON.stringify(opts.body);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data });
  }

  return data as T;
}
