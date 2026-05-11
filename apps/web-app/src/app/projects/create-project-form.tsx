'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProjectAction, addProjectRepositoryAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';
import type { Team, RepositoryProvider } from '@/lib/api';


interface RepoEntry {
  provider: RepositoryProvider;
  repoUrl: string;
}


interface CreateProjectFormProps {
  teams: Team[];
}


const ALL_PROVIDERS: RepositoryProvider[] = ['github', 'gitlab', 'bitbucket', 'local', 'manual'];


function detectProvider(url: string): RepositoryProvider {

  if (url.includes('github.com')) return 'github';

  if (url.includes('gitlab.com')) return 'gitlab';

  if (url.includes('bitbucket.org')) return 'bitbucket';

  return 'manual';
}


export function CreateProjectForm({ teams }: CreateProjectFormProps) {

  const dict = useDict();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [ownerTeamId, setOwnerTeamId] = useState(teams[0]?.id ?? '');
  const [repos, setRepos] = useState<RepoEntry[]>([]);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [newRepoProvider, setNewRepoProvider] = useState<RepositoryProvider>('github');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {

    const value = e.target.value;
    setName(value);
    setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  }

  function handleRepoUrlChange(e: React.ChangeEvent<HTMLInputElement>) {

    const value = e.target.value;
    setNewRepoUrl(value);
    setNewRepoProvider(detectProvider(value));
  }

  function addRepo() {

    if (!newRepoUrl.trim()) return;

    setRepos((prev) => [...prev, { provider: newRepoProvider, repoUrl: newRepoUrl.trim() }]);
    setNewRepoUrl('');
    setNewRepoProvider('github');
  }

  function removeRepo(index: number) {

    setRepos((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    if (!name.trim() || !slug.trim() || !ownerTeamId) return;

    startTransition(async () => {
      const result = await createProjectAction({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        ownerTeamId,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.id) {
        // Create repos sequentially; failures are non-blocking (project already created)
        for (const repo of repos) {
          await addProjectRepositoryAction(result.id, repo).catch(() => null);
        }

        router.push(`/projects/${result.id}`);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
      >
        + {dict.projects.createProject}
      </button>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5 mb-6">
      <h2 className="text-sm font-semibold text-white mb-4">{dict.projects.createProject}</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          autoFocus
          type="text"
          placeholder={dict.projects.namePlaceholder}
          value={name}
          onChange={handleNameChange}
          className="w-full text-sm glass-input rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <input
          type="text"
          placeholder={dict.projects.slugPlaceholder}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full text-sm glass-input rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <textarea
          placeholder={dict.projects.descriptionPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="glass-input w-full text-sm rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />

        {teams.length > 0 && (
          <select
            value={ownerTeamId}
            onChange={(e) => setOwnerTeamId(e.target.value)}
            className="glass-input w-full text-xs rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        {/* Repositories block */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium">{dict.projects.repositories.label}</p>

          {repos.map((repo, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
              <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{repo.provider}</span>
              <span className="flex-1 truncate text-gray-400">{repo.repoUrl}</span>
              <button
                type="button"
                onClick={() => removeRepo(i)}
                className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                aria-label={dict.projects.repositories.removeRepository}
              >
                ✕
              </button>
            </div>
          ))}

          <div className="flex gap-1.5">
            <select
              value={newRepoProvider}
              onChange={(e) => setNewRepoProvider(e.target.value as RepositoryProvider)}
              className="glass-input text-xs rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-28 shrink-0"
              aria-label={dict.projects.repositories.providerLabel}
            >
              {ALL_PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              type="url"
              placeholder={dict.projects.repositories.urlPlaceholder}
              value={newRepoUrl}
              onChange={handleRepoUrlChange}
              className="flex-1 text-xs glass-input rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={addRepo}
              disabled={!newRepoUrl.trim()}
              className="text-xs px-2.5 py-1.5 rounded bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-40 transition-colors shrink-0"
            >
              {dict.projects.repositories.addRepository}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || !name.trim() || !slug.trim() || !ownerTeamId}
            className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {isPending ? dict.projects.creating : dict.projects.createProject}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(''); }}
            className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            {dict.forms.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
