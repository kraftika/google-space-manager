import { RawFile } from './scanner';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const GWORKSPACE_PREFIX = 'application/vnd.google-apps.';
const GWORKSPACE_EXCLUDES = new Set([FOLDER_MIME]);

export interface DriveNode {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  ownedByMe: boolean;
  shared: boolean;
  isGoogleWorkspace: boolean;
  children: DriveNode[];
}

function isGWorkspace(mimeType: string): boolean {
  return mimeType.startsWith(GWORKSPACE_PREFIX) && !GWORKSPACE_EXCLUDES.has(mimeType);
}

function computeSize(node: DriveNode): number {
  if (node.mimeType === FOLDER_MIME) {
    node.sizeBytes = node.children.reduce((s, c) => s + computeSize(c), 0);
  }
  return node.sizeBytes;
}

function sortChildren(node: DriveNode): void {
  node.children.sort((a, b) => b.sizeBytes - a.sizeBytes);
  node.children.forEach(sortChildren);
}

export function build(files: RawFile[]): DriveNode {
  const nodeMap = new Map<string, DriveNode>();
  const parentOf = new Map<string, string>();

  for (const f of files) {
    nodeMap.set(f.id, {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      sizeBytes: parseInt(f.size ?? '0', 10),
      ownedByMe: f.ownedByMe ?? false,
      shared: f.shared ?? false,
      isGoogleWorkspace: isGWorkspace(f.mimeType),
      children: [],
    });
    if (f.parents?.[0]) parentOf.set(f.id, f.parents[0]);
  }

  const roots: DriveNode[] = [];

  for (const node of nodeMap.values()) {
    const pid = parentOf.get(node.id);
    const parent = pid ? nodeMap.get(pid) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  roots.forEach(computeSize);
  roots.forEach(sortChildren);

  const totalBytes = roots.reduce((s, r) => s + r.sizeBytes, 0);
  return {
    id: 'root',
    name: 'My Drive',
    mimeType: FOLDER_MIME,
    sizeBytes: totalBytes,
    ownedByMe: true,
    shared: false,
    isGoogleWorkspace: false,
    children: roots,
  };
}
