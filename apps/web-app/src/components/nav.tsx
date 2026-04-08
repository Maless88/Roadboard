import Link from 'next/link';
import { logoutAction } from '@/app/actions';


export function Nav() {

  return (
    <header className="border-b border-gray-800 bg-gray-900">
      <div className="mx-auto max-w-5xl px-4 flex items-center justify-between h-12">
        <div className="flex items-center gap-6">
          <Link href="/projects" className="text-sm font-semibold text-white tracking-tight hover:text-indigo-300 transition-colors">
            RoadBoard
          </Link>
          <Link href="/settings" className="text-xs text-gray-400 hover:text-white transition-colors">
            Settings
          </Link>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
