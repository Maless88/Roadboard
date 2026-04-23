'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { loginAction, registerAction } from '@/app/actions';


function LoginFields({ pending }: { pending: boolean }) {

  return (
    <>
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="username"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
        <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="mario.rossi"
        />
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-1">
          Nome completo
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Mario Rossi"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="mario@esempio.it"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Minimo 8 caratteri"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
          Conferma password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="••••••••"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer select-none">
        <input
          type="checkbox"
          name="seedDemoProject"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
        />
        <span>
          Crea un progetto di esempio
          <span className="block text-xs text-gray-500">Per esplorare subito task, decisioni, memoria e Atlas.</span>
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
      <div className="flex rounded-lg bg-gray-800 p-1 mb-6">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
            mode === 'login'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Accedi
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
            mode === 'register'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Registrati
        </button>
      </div>

      <form action={action} className="space-y-4">

        {error && (
          <div className="rounded-md bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
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
