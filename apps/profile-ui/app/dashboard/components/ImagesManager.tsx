'use client';

import { useEffect, useState } from 'react';
import { ApiError, apiUrl } from '../../../lib/api';
import { deleteImage, listMyImages, uploadGalleryImage, type OwnerProfileImage } from '../../../lib/owner-api';

export function ImagesManager({ token, slug }: { token: string; slug: string }) {
  const [images, setImages] = useState<OwnerProfileImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'BANNER' | 'GALLERY' | null>(null);

  useEffect(() => {
    listMyImages(token)
      .then(setImages)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load images.'));
  }, [token]);

  async function handleUpload(kind: 'BANNER' | 'GALLERY', e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    setError(null);
    try {
      const created = await uploadGalleryImage(token, kind, file);
      setImages((prev) => [...(prev ?? []), created]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload that image.');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  }

  async function handleDelete(id: string): Promise<void> {
    await deleteImage(token, id);
    setImages((prev) => prev?.filter((i) => i.id !== id) ?? null);
  }

  const banners = images?.filter((i) => i.kind === 'BANNER') ?? [];
  const gallery = images?.filter((i) => i.kind === 'GALLERY') ?? [];

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Banner
      </h2>
      {banners.length === 0 && <p className="empty-state">No banner uploaded yet.</p>}
      <div className="thumb-grid">
        {banners.map((img) => (
          <div className="thumb" key={img.id}>
            <img src={apiUrl(`/v1/profiles/${slug}/images/${img.id}`)} alt="" />
            <button type="button" className="btn btn-icon btn-danger" aria-label="Delete banner image" onClick={() => handleDelete(img.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
        {uploading === 'BANNER' ? 'Uploading…' : 'Upload banner'}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleUpload('BANNER', e)}
          disabled={uploading !== null}
          style={{ display: 'none' }}
        />
      </label>

      <h2 className="section-title">Gallery</h2>
      {gallery.length === 0 && <p className="empty-state">No gallery photos yet.</p>}
      <div className="thumb-grid">
        {gallery.map((img) => (
          <div className="thumb" key={img.id}>
            <img src={apiUrl(`/v1/profiles/${slug}/images/${img.id}`)} alt="" />
            <button type="button" className="btn btn-icon btn-danger" aria-label="Delete gallery image" onClick={() => handleDelete(img.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
        {uploading === 'GALLERY' ? 'Uploading…' : 'Add gallery photo'}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleUpload('GALLERY', e)}
          disabled={uploading !== null}
          style={{ display: 'none' }}
        />
      </label>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
