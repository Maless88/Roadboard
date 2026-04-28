'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { loginAction, registerAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';
import type { Dictionary } from '@/lib/i18n/types';


function LoginFields({ pending, prefilledEmail, dict }: { pending: boolean; prefilledEmail: string | null; dict: Dictionary }) {

  // The login uses username, but if we received an email via invite link
  // we surface it as a hint via placeholder so the user knows which account to pick.
  void prefilledEmail;

  return (
    <>
      <div>
        <label htmlFor="username" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          {dict.auth.usernameLabel}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder={dict.auth.usernamePlaceholder.toLowerCase()}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          {dict.auth.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder={dict.auth.passwordDotsPlaceholder}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? dict.auth.loggingIn : dict.auth.login}
      </button>
    </>
  );
}


function RegisterFields({ pending, prefilledEmail, dict }: { pending: boolean; prefilledEmail: string | null; dict: Dictionary }) {

  return (
    <>
      <div>
        <label htmlFor="username" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          {dict.auth.usernameLabel}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder={dict.auth.usernameRegisterPlaceholder}
        />
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          {dict.auth.fullNameLabel}
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder={dict.auth.fullNamePlaceholder}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          {dict.auth.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={prefilledEmail ?? undefined}
          readOnly={!!prefilledEmail}
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder={dict.auth.emailExamplePlaceholder}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          {dict.auth.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder={dict.auth.passwordMinPlaceholder}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          {dict.auth.confirmPasswordLabel}
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder={dict.auth.passwordDotsPlaceholder}
        />
      </div>

      <label className="flex items-start gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>
        <input
          type="checkbox"
          name="seedDemoProject"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
          style={{ background: 'var(--surface-overlay)', borderColor: 'var(--border)' }}
        />
        <span>
          {dict.auth.seedDemoTitle}
          <span className="block text-xs" style={{ color: 'var(--text-faint)' }}>{dict.auth.seedDemoHint}</span>
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? dict.auth.registering : dict.auth.createAccountButton}
      </button>
    </>
  );
}


export function LoginForm({
  inviteToken = null,
  prefilledEmail = null,
}: {
  inviteToken?: string | null;
  prefilledEmail?: string | null;
} = {}) {

  const dict = useDict();
  const [mode, setMode] = useState<'login' | 'register'>(inviteToken ? 'register' : 'login');

  const [loginState, loginDispatch, loginPending] = useActionState(loginAction, {});
  const [registerState, registerDispatch, registerPending] = useActionState(registerAction, {});

  const error = mode === 'login' ? loginState.error : registerState.error;
  const action = mode === 'login' ? loginDispatch : registerDispatch;
  const pending = mode === 'login' ? loginPending : registerPending;

  return (
    <div>
      <div className="flex rounded-lg p-1 mb-6" style={{ background: 'var(--surface-overlay)' }}>
        <button
          type="button"
          onClick={() => setMode('login')}
          className="flex-1 rounded-md py-1.5 text-sm font-medium transition-colors"
          style={mode === 'login'
            ? { background: 'var(--surface-hover)', color: 'var(--text)' }
            : { color: 'var(--text-muted)' }}
        >
          {dict.auth.login}
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className="flex-1 rounded-md py-1.5 text-sm font-medium transition-colors"
          style={mode === 'register'
            ? { background: 'var(--surface-hover)', color: 'var(--text)' }
            : { color: 'var(--text-muted)' }}
        >
          {dict.auth.register}
        </button>
      </div>

      <form action={action} className="space-y-4">

        {inviteToken && (
          <input type="hidden" name="inviteToken" value={inviteToken} />
        )}

        {error && (
          <div className="rounded-md px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {mode === 'login'
          ? <LoginFields pending={pending} prefilledEmail={prefilledEmail} dict={dict} />
          : <RegisterFields pending={pending} prefilledEmail={prefilledEmail} dict={dict} />
        }

      </form>
    </div>
  );
}
