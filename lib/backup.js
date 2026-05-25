export const BACKUP_COLLECTIONS = ['meets', 'events', 'athletes', 'results'];

export function buildBackupPayload(collections, options = {}) {
  const now = options.now || Date.now;
  const normalized = {};

  for (const name of BACKUP_COLLECTIONS) {
    normalized[name] = Array.isArray(collections[name]) ? collections[name] : [];
  }

  return {
    version: 1,
    exportedAt: new Date(now()).toISOString(),
    collections: normalized,
  };
}
