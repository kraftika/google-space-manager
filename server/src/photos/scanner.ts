import { OAuth2Client } from 'google-auth-library';

export interface PhotoItem {
  id: string;
  filename: string;
  productUrl: string;
  baseUrl: string;
  creationTime: string;
  width: number;
  height: number;
  isVideo: boolean;
}

export interface PhotosResult {
  items: PhotoItem[];
  nextPageToken?: string;
}

const BASE_URL = 'https://photoslibrary.googleapis.com/v1';

interface MediaItem {
  id: string;
  filename?: string;
  productUrl?: string;
  baseUrl?: string;
  mimeType?: string;
  mediaMetadata?: {
    creationTime?: string;
    width?: string;
    height?: string;
    video?: unknown;
  };
}

function toPhotoItem(m: MediaItem): PhotoItem {
  const meta = m.mediaMetadata ?? {};
  return {
    id: m.id,
    filename: m.filename ?? '',
    productUrl: m.productUrl ?? '',
    baseUrl: m.baseUrl ?? '',
    creationTime: meta.creationTime ?? '',
    width: meta.width ? Number(meta.width) : 0,
    height: meta.height ? Number(meta.height) : 0,
    isVideo: (m.mimeType?.startsWith('video/') ?? false) || meta.video != null,
  };
}

export async function listPhotos(
  auth: OAuth2Client,
  pageToken?: string,
): Promise<PhotosResult> {
  const params = new URLSearchParams({ pageSize: '50' });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await auth.request<{ mediaItems?: MediaItem[]; nextPageToken?: string }>({
    url: `${BASE_URL}/mediaItems?${params.toString()}`,
    method: 'GET',
  });

  const items = (res.data.mediaItems ?? []).map(toPhotoItem);
  return { items, nextPageToken: res.data.nextPageToken ?? undefined };
}

export async function deletePhotos(
  auth: OAuth2Client,
  mediaItemIds: string[],
): Promise<void> {
  await auth.request({
    url: `${BASE_URL}/mediaItems:batchDelete`,
    method: 'POST',
    data: { mediaItemIds },
  });
}
