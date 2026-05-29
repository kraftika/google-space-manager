import { drive_v3, Common } from 'googleapis';

export interface RawFile {
  id: string;
  name: string;
  size?: string | null;
  mimeType: string;
  parents?: string[] | null;
  ownedByMe?: boolean | null;
  shared?: boolean | null;
}

export interface ScanRaw {
  allFiles: RawFile[];
  trashSizeBytes: number;
}

export async function scan(drive: drive_v3.Drive): Promise<ScanRaw> {
  const allFiles: RawFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: 'trashed = false',
      fields: 'nextPageToken, files(id,name,size,mimeType,parents,ownedByMe,shared)',
      pageSize: 1000,
      pageToken,
    });
    allFiles.push(...((res.data.files as RawFile[]) ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  let trashSizeBytes = 0;
  pageToken = undefined;
  do {
    const trashRes: Common.GaxiosResponse<drive_v3.Schema$FileList> = await drive.files.list({
      q: 'trashed = true',
      fields: 'nextPageToken, files(size)',
      pageSize: 1000,
      pageToken,
    });
    trashSizeBytes += (trashRes.data.files ?? []).reduce(
      (s: number, f: drive_v3.Schema$File) => s + parseInt((f.size ?? '0'), 10),
      0,
    );
    pageToken = trashRes.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { allFiles, trashSizeBytes };
}
