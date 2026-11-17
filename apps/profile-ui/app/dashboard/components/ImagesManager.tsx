'use client';

import { useConfirm } from '@newax/design-tokens/ConfirmDialog';
import { useEffect, useState } from 'react';
import { TrashIcon } from '@newax/design-tokens/icons';
import { ApiError, apiUrl } from '../../../lib/api';
import {
  deleteImage,
  deleteOrgImage,
  listMyImages,
  listOrgImages,
  uploadGalleryImage,
  uploadOrgGalleryImage,
  type OwnerProfileImage,
} from '../../../lib/owner-api';

/** organizationId present -> this organization's work profile; absent ->
 * the caller's own personal profile -- see ServicesManager.tsx's doc
 * comment for the pattern this mirrors. `slug` is always that same
 * profile's own slug, used to build the public image URL below. */
export function ImagesManager({ token, slug, organizationId }: { token: string; slug: string; organizationId?: string }) {
  const { confirm, dialog } = useConfirm();
  const [images, setImages] = useState<OwnerProfileImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'BANNER' | 'GALLERY' | null>(null);

  function list() {
    return organizationId ? listOrgImages(token, organizationId) : listMyImages(token);
  }
  function upload(kind: 'BANNER' | 'GALLERY', file: File) {
    return organizationId ? uploadOrgGalleryImage(token, organizationId, kind, file) : uploadGalleryImage(token, kind, file);
  }
  function remove(id: string) {
    return organizationId ? deleteOrgImage(token, organizationId, id) : deleteImage(token, id);
  }

  useEffect(() => {
    list()
      .then(setImages)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load images.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizationId]);

  async function handleUpload(kind: 'BANNER' | 'GALLERY', e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    setError(null);
    try {
      const created = await upload(kind, file);
      setImages((prev) => [...(prev ?? []), created]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload that image.');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!(await confirm({ title: 'Delete this image?', body: 'It is removed from your profile and cannot be restored.', confirmLabel: 'Delete image' }))) return;
    await remove(id);
    setImages((prev) => prev?.filter((i) => i.id !== id) ?? null);
  }

  const banners = images?.filter((i) => i.kind === 'BANNER') ?? [];
  const gallery = images?.filter((i) => i.kind === 'GALLERY') ?? [];

  return (
    <div>
      {dialog}
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Banner
      </h2>
      {banners.length === 0 && <p className="empty-state">No banner uploaded yet.</p>}
      <div className="thumb-grid">
        {banners.map((img) => (
          <div className="thumb" key={img.id}>
            <img src={apiUrl(`/v1/profiles/${slug}/images/${img.id}`)} alt={`Uploaded ${img.kind === 'BANNER' ? 'banner' : 'gallery photo'}`} />
            <button type="button" onClick={() => handleDelete(img.id)} aria-label="Delete image">
              <TrashIcon size={16} />
            </button>
          </div>
        ))}
      </div>
      <label className="btn btn-sm btn-secondary file-pick" style={{ cursor: 'pointer', display: 'inline-flex' }}>
        {uploading === 'BANNER' ? 'Uploading…' : 'Upload banner'}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleUpload('BANNER', e)}
          disabled={uploading !== null}
          className="sr-only"
        />
      </label>

      <h2 className="section-title">Gallery</h2>
      {gallery.length === 0 && <p className="empty-state">No gallery photos yet.</p>}
      <div className="thumb-grid">
        {gallery.map((img) => (
          <div className="thumb" key={img.id}>
            <img src={apiUrl(`/v1/profiles/${slug}/images/${img.id}`)} alt={`Uploaded ${img.kind === 'BANNER' ? 'banner' : 'gallery photo'}`} />
            <button type="button" onClick={() => handleDelete(img.id)} aria-label="Delete image">
              <TrashIcon size={16} />
            </button>
          </div>
        ))}
      </div>
      <label className="btn btn-sm btn-secondary file-pick" style={{ cursor: 'pointer', display: 'inline-flex' }}>
        {uploading === 'GALLERY' ? 'Uploading…' : 'Add gallery photo'}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleUpload('GALLERY', e)}
          disabled={uploading !== null}
          className="sr-only"
        />
      </label>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
