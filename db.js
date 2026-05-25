import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function dbPath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readDB(name) {
  const p = dbPath(name);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
}

export function writeDB(name, data) {
  const p = dbPath(name);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

export function nextId(records) {
  if (!records.length) return 1;
  return Math.max(...records.map(r => r.id || 0)) + 1;
}

export function findById(records, id) {
  return records.find(r => r.id === Number(id)) || null;
}

export function insertRecord(name, record) {
  const data = readDB(name);
  record.id = nextId(data);
  record.createdAt = Date.now();
  data.push(record);
  writeDB(name, data);
  return record;
}

export function updateRecord(name, id, patch) {
  const data = readDB(name);
  const idx = data.findIndex(r => r.id === Number(id));
  if (idx < 0) return null;
  data[idx] = { ...data[idx], ...patch, updatedAt: Date.now() };
  writeDB(name, data);
  return data[idx];
}

export function deleteRecord(name, id) {
  const data = readDB(name);
  const idx = data.findIndex(r => r.id === Number(id));
  if (idx < 0) return false;
  data.splice(idx, 1);
  writeDB(name, data);
  return true;
}
