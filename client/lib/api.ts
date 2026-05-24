/**
 * API helper for the Contact Center frontend.
 * Automatically adds auth token and handles common patterns.
 */

const API_BASE = '/api';

interface ApiError extends Error {
  status?: number;
  data?: any;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE;
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
    const token = this.getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  async request(method: string, path: string, body: any = null): Promise<any> {
    const opts: RequestInit = {
      method,
      headers: this.headers(),
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(data.error || `HTTP ${res.status}`) as ApiError;
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  /**
   * Upload a file via multipart/form-data.
   */
  upload(path: string, file: File, onProgress?: (percent: number) => void): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseUrl}${path}`);

      const token = this.getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }

      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
          } else {
            const error = new Error(data.error || `HTTP ${xhr.status}`) as ApiError;
            error.status = xhr.status;
            error.data = data;
            reject(error);
          }
        } catch {
          reject(new Error('Invalid response'));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  }

  get<T = any>(path: string): Promise<T>    { return this.request('GET', path); }
  post<T = any>(path: string, body?: any): Promise<T>  { return this.request('POST', path, body); }
  put<T = any>(path: string, body?: any): Promise<T>   { return this.request('PUT', path, body); }
  patch<T = any>(path: string, body?: any): Promise<T> { return this.request('PATCH', path, body); }
  delete<T = any>(path: string): Promise<T>      { return this.request('DELETE', path); }
}

const api = new ApiClient();
export default api;
