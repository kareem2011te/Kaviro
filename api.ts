let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
  if (token) {
    sessionStorage.setItem('kaviro_session_token', token);
  } else {
    sessionStorage.removeItem('kaviro_session_token');
  }
}

export function getAuthToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  const saved = sessionStorage.getItem('kaviro_session_token');
  if (saved) inMemoryToken = saved;
  return saved;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const errMsg = typeof data === 'object' && data && 'error' in data ? String(data.error) : `Request failed (${res.status})`;
    const err = new Error(errMsg) as Error & { status?: number; payload?: any };
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data as T;
}

export async function downloadProjectZip(): Promise<void> {
  const res = await fetch('/api/export/project-zip');
  if (!res.ok) {
    throw new Error('Failed to generate downloadable ZIP package.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'kaviro-platform-web.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

