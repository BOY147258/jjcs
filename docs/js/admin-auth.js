export const ADMIN_TOKEN_STORAGE_KEY = 'jjcs-admin-token';

export function normalizeAdminToken(value) {
  return String(value || '').trim();
}

export function buildAdminHeaders(token) {
  const normalized = normalizeAdminToken(token);
  if (!normalized) return {};
  return {
    Authorization: `Bearer ${normalized}`,
    'X-Admin-Token': normalized,
  };
}

export function readAdminTokenFromStorageValue(value) {
  if (!value) return '';
  try {
    return normalizeAdminToken(JSON.parse(value));
  } catch {
    return '';
  }
}

export function getStoredAdminToken(storage = globalThis.localStorage) {
  try {
    return readAdminTokenFromStorageValue(storage?.getItem(ADMIN_TOKEN_STORAGE_KEY));
  } catch {
    return '';
  }
}

export function setStoredAdminToken(token, storage = globalThis.localStorage) {
  const normalized = normalizeAdminToken(token);
  if (!storage) return normalized;
  if (normalized) storage.setItem(ADMIN_TOKEN_STORAGE_KEY, JSON.stringify(normalized));
  else storage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  return normalized;
}

export function getAdminHeaders(storage = globalThis.localStorage) {
  return buildAdminHeaders(getStoredAdminToken(storage));
}
