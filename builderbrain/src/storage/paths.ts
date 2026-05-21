import { resolve } from 'path';
import { loadConfig } from '../config/manager.js';

export function getLibraryPath(): string {
  const cfg = loadConfig();
  const override = cfg.library_path_override?.trim();
  if (override) return resolve(override);
  return resolve(process.cwd(), 'brain-data', 'library');
}

export function getWarehousePath(): string {
  const cfg = loadConfig();
  const override = cfg.warehouse_path_override?.trim();
  if (override) return resolve(override);
  return resolve(process.cwd(), 'brain-data', 'big-bible');
}
