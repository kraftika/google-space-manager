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

export type PhotosSortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';
