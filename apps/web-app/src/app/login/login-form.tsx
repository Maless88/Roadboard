'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { loginAction, registerAction } from '@/app/actions';


function LoginFields({ pending }: { pending: boolean }) {

  return (
    <>
      <div>
        <label htmlFor="username" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder="username"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Accesso in corso…' : 'Accedi'}
      </button>
    </>
  );
}


function RegisterFields({ pending }: { pending: boolean }) {

  return (
    <>
      <div>
        <label htmlFor="username" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder="mario.rossi"
        />
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          Nome completo
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder="Mario Rossi"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder="mario@esempio.it"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder="Minimo 8 caratteri"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          Conferma password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder="••••••••"
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
          Crea un progetto di esempio
          <span className="block text-xs" style={{ color: 'var(--text-faint)' }}>Per esplorare subito task, decisioni, memoria e Atlas.</span>
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Registrazione in corso…' : 'Crea account'}
      </button>
    </>
  );
}


export function LoginForm() {

  const [mode, setMode] = useState<'login' | 'register'>('login');

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
          Accedi
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className="flex-1 rounded-md py-1.5 text-sm font-medium transition-colors"
          style={mode === 'register'
            ? { background: 'var(--surface-hover)', color: 'var(--text)' }
            : { color: 'var(--text-muted)' }}
        >
          Registrati
        </button>
      </div>

      <form action={action} className="space-y-4">

        {error && (
          <div className="rounded-md px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {mode === 'login'
          ? <LoginFields pending={pending} />
          : <RegisterFields pending={pending} />
        }

      </form>
    </div>
  );
}
