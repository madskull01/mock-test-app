const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const USER_STORAGE_KEY = "formative.user";

export async function apiRequest(path, options = {}) {
  let token;
  try {
    token = JSON.parse(localStorage.getItem(USER_STORAGE_KEY))?.token;
  } catch {
    token = undefined;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && token) {
      localStorage.removeItem(USER_STORAGE_KEY);
      window.dispatchEvent(new Event("formative:auth-expired"));
    }
    const body = await response.json().catch(() => null);
    const error = new Error(
      body?.message || body?.error || `Request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}
