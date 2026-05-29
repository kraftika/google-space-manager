import { RawFile } from './scanner';
import path from 'path';

const CATEGORY_MAP: Record<string, string[]> = {
  Video: ['video/'],
  Images: ['image/'],
  Audio: ['audio/'],
  Archives: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    'application/x-bzip2',
  ],
  'Google Workspace': ['application/vnd.google-apps.'],
  Documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument',
    'application/vnd.ms-',
    'text/',
  ],
};

export function getCategory(mimeType: string): string {
  for (const [category, prefixes] of Object.entries(CATEGORY_MAP)) {
    if (prefixes.some(p => mimeType.startsWith(p) || mimeType === p)) {
      return category;
    }
  }
  return 'Other';
}

export interface ExtensionStat {
  bytes: number;
  count: number;
}

export interface CategoryStat {
  totalBytes: number;
  fileCount: number;
  extensions: Record<string, ExtensionStat>;
}

export type CategoryBreakdown = Record<string, CategoryStat>;

export function buildCategoryBreakdown(files: RawFile[]): CategoryBreakdown {
  const result: CategoryBreakdown = {};

  for (const f of files) {
    if (f.mimeType === 'application/vnd.google-apps.folder') continue;

    const category = getCategory(f.mimeType);
    const sizeBytes = parseInt(f.size ?? '0', 10);
    const ext = path.extname(f.name).toLowerCase() || '(no ext)';

    if (!result[category]) {
      result[category] = { totalBytes: 0, fileCount: 0, extensions: {} };
    }
    result[category].totalBytes += sizeBytes;
    result[category].fileCount += 1;

    const exts = result[category].extensions;
    if (!exts[ext]) exts[ext] = { bytes: 0, count: 0 };
    exts[ext].bytes += sizeBytes;
    exts[ext].count += 1;
  }

  return result;
}
