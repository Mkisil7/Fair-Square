'use client';

import { supabase } from '../../lib/supabase';
import { LogOut } from 'lucide-react';
import { User } from '../../lib/types';

export default function SettingsScreen({ user, isDarkMode, toggleTheme }: { user: User, isDarkMode: boolean, toggleTheme: () => void }) {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-black">
      <header className="bg-white dark:bg-zinc-900 px-6 py-3 shadow-sm z-10 transition-colors">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-full border-2 border-indigo-100 dark:border-indigo-900 object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                  {user.displayName?.charAt(0) || '?'}
                </div>
              )}
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-lg">{user.displayName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="p-2">
            <button onClick={() => supabase.auth.signOut()} className="w-full text-left px-4 py-3 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl font-medium flex items-center gap-3 transition-colors">
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-2">Preferences</h3>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Toggle dark appearance</p>
              </div>
              <button
                onClick={toggleTheme}
                className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${isDarkMode ? 'translate-x-6.5 left-0.5' : 'translate-x-0.5'}`}></div>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center pt-8">
          <p className="text-xs text-gray-400">Fair & Square v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
