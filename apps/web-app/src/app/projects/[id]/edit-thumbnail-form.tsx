'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateProjectAction, uploadProjectThumbnailAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';
import { resolveThumbnailUrl } from '@/lib/thumbnail-url';


interface Props {
  projectId: string;
  initialHomeUrl: string | null;
  initialThumbnailUrl: string | null;
}


export function EditThumbnailForm({ projectId, initialHomeUrl, initialThumbnailUrl }: Props) {

  const dict = useDict();
  const router = useRouter();
  const [homeUrl, setHomeUrl] = useState(initialHomeUrl ?? '');
  const [savingUrl, startSaveUrlTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(initialThumbnailUrl);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const urlSet = homeUrl.trim().length > 0;

  function handleSaveUrl(e: React.FormEvent) {

    e.preventDefault();
    setMessage(null);
    startSaveUrlTransition(async () => {
      const result = await updateProjectAction(projectId, { homeUrl: homeUrl.trim() });

      if (result.error) {
        setMessage({ type: 'err', text: result.error });
        return;
      }

      router.refresh();
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {

    setMessage(null);
    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'err', text: dict.projectCard.thumbnail.uploadError });
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const result = await uploadProjectThumbnailAction(projectId, form);
    setUploading(false);

    if (result.error) {
      setMessage({ type: 'err', text: result.error });
      return;
    }

    if (result.thumbnailUrl) {
      setThumbnailUrl(result.thumbnailUrl);
    }

    setMessage({ type: 'ok', text: dict.projectCard.thumbnail.uploadSuccess });
    router.refresh();
  }

  const resolvedSrc = resolveThumbnailUrl(thumbnailUrl);

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Thumbnail</p>

        {resolvedSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={resolvedSrc}
            alt="Project thumbnail"
            className="w-full max-w-xs rounded-lg"
            style={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
          />
        ) : (
          <div
            className="w-full max-w-xs rounded-lg flex items-center justify-center"
            style={{ aspectRatio: '16 / 9', background: 'rgba(255,255,255,0.04)' }}
          >
            <span className="text-xs text-gray-600">{dict.projectCard.thumbnail.placeholder}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveUrl} className="space-y-2">
        <label className="block text-xs text-gray-400">{dict.projectCard.thumbnail.homeUrlLabel}</label>
        <input
          type="url"
          value={homeUrl}
          onChange={(e) => setHomeUrl(e.target.value)}
          placeholder={dict.projectCard.thumbnail.homeUrlPlaceholder}
          className="w-full text-sm glass-input rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <p className="text-[11px] text-gray-500">{dict.projectCard.thumbnail.homeUrlHint}</p>
        <button
          type="submit"
          disabled={savingUrl}
          className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {savingUrl ? dict.projectCard.thumbnail.uploading : 'Save'}
        </button>
      </form>

      <div className="space-y-2">
        <label className="block text-xs text-gray-400">{dict.projectCard.thumbnail.uploadLabel}</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={urlSet || uploading}
          onChange={handleUpload}
          className="text-xs text-gray-300"
        />
        <p className="text-[11px] text-gray-500">
          {urlSet ? dict.projectCard.thumbnail.uploadDisabledByUrl : dict.projectCard.thumbnail.uploadHint}
        </p>
      </div>

      {message && (
        <p className={`text-xs ${message.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
      )}
    </div>
  );
}
