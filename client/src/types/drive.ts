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

export interface QuotaInfo {
  limit: string;
  usage: string;
  usageInDrive: string;
  usageInDriveTrash: string;
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

export interface ScanResult {
  tree: DriveNode;
  categories: CategoryBreakdown;
  quota: QuotaInfo;
  trashSizeBytes: number;
}

export interface AccountInfo {
  sessionId: string;
  email: string;
  displayName: string;
}

export interface AuthStatus {
  authenticated: boolean;
  accounts: AccountInfo[];
  activeSessionId: string | null;
}
