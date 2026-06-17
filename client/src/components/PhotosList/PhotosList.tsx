import { useEffect } from 'react';
import { Trash2, AlertTriangle, Play, Check } from 'lucide-react';
import { useAppState } from '../../state/useAppState';
import { triggerLogin } from '../../api/client';
import { PhotosSortOption } from '../../types/photos';

const SORT_OPTIONS: { value: PhotosSortOption; label: string }[] = [
  { value: 'date-desc', label: 'Newest' },
  { value: 'date-asc', label: 'Oldest' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
];

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PhotosList() {
  const {
    photosResult, filteredPhotos, photosLoading, photosSelectedIds, photosScopeError,
    photosSortOption, loadPhotos, loadMorePhotos, deleteSelectedPhotos,
    togglePhotoSelection, selectAllPhotos, setPhotosSortOption,
  } = useAppState();

  useEffect(() => {
    if (!photosResult && !photosLoading && !photosScopeError) loadPhotos();
  }, [photosResult, photosLoading, photosScopeError, loadPhotos]);

  if (photosScopeError) {
    return (
      <div className="photos-panel">
        <div className="scope-error-banner">
          <AlertTriangle size={18} />
          <span>Photos permissions required to view and manage your library.</span>
          <button className="scope-error-btn" onClick={() => triggerLogin()}>Re-authenticate</button>
        </div>
      </div>
    );
  }

  const allSelected = filteredPhotos.length > 0 && photosSelectedIds.size === filteredPhotos.length;

  return (
    <div className="photos-panel">
      <div className="photos-controls">
        <label className="select-all-label">
          <input type="checkbox" checked={allSelected} onChange={selectAllPhotos} />
          Select all
        </label>
        <div className="sort-toggle">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`sort-pill${photosSortOption === opt.value ? ' sort-active' : ''}`}
              onClick={() => setPhotosSortOption(opt.value)}
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {photosLoading && filteredPhotos.length === 0 ? (
        <div className="panel-loading"><div className="spinner" /></div>
      ) : filteredPhotos.length === 0 ? (
        <div className="panel-empty">No photos found.</div>
      ) : (
        <>
          <div className="photos-grid">
            {filteredPhotos.map(photo => {
              const selected = photosSelectedIds.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className={`photo-card${selected ? ' photo-card-selected' : ''}`}
                  onClick={() => togglePhotoSelection(photo.id)}
                >
                  <div className="photo-thumb-wrap">
                    <img
                      className="photo-thumb"
                      src={`${photo.baseUrl}=w300-h300-c`}
                      alt={photo.filename}
                      loading="lazy"
                    />
                    <span className={`photo-checkbox${selected ? ' photo-checkbox-on' : ''}`}>
                      {selected && <Check size={14} />}
                    </span>
                    {photo.isVideo && (
                      <span className="video-badge"><Play size={12} /></span>
                    )}
                  </div>
                  <div className="photo-meta">
                    <span className="photo-name" title={photo.filename}>{photo.filename}</span>
                    <span className="photo-sub">
                      {formatDate(photo.creationTime)}
                      {photo.width > 0 ? ` · ${photo.width}×${photo.height}` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {photosResult?.nextPageToken && (
            <button className="load-more-btn" onClick={loadMorePhotos} disabled={photosLoading}>
              {photosLoading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}

      {photosSelectedIds.size > 0 && (
        <div className="photos-actions-bar">
          <span>{photosSelectedIds.size} selected</span>
          <button
            className="action-danger"
            onClick={() => {
              const n = photosSelectedIds.size;
              if (window.confirm(`Permanently delete ${n} ${n === 1 ? 'photo' : 'photos'}? This cannot be undone.`)) {
                deleteSelectedPhotos();
              }
            }}
          >
            <Trash2 size={15} />
            Delete {photosSelectedIds.size} {photosSelectedIds.size === 1 ? 'photo' : 'photos'}
          </button>
        </div>
      )}
    </div>
  );
}
