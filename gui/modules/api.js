export const API_BASE_URL = 'http://localhost:8765/api';

async function parseJson(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = { ok: false, error: '响应解析失败' };
  }
  return payload;
}

export async function apiGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  return parseJson(response);
}

export async function apiPost(path, body = undefined) {
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  return parseJson(response);
}
