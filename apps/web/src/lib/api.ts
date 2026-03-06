const BASE =
  typeof window === 'undefined'
    ? (process.env.API_INTERNAL_URL ?? 'http://localhost:4000')
    : '';   // client-side: use relative URL → goes through Next.js rewrite

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { headers: this.headers(), cache: 'no-store' });
    return this.handle<T>(res);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handle<T>(res);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.handle<T>(res);
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    return this.handle<T>(res);
  }

  private async handle<T>(res: Response): Promise<T> {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    return json as T;
  }
}

export const api = new ApiClient();
