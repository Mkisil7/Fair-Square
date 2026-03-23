'use client';

import { Capacitor } from '@capacitor/core';
import { supabase } from '../../lib/supabase';
import { Wallet } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoginScreen() {
  const signInWithGoogle = async () => {
    try {
      // On native iOS/Android, redirect back to the app via custom URL scheme.
      // On web, use the current origin so the browser stays on the same site.
      const isNative = Capacitor.isNativePlatform();
      const redirectUrl = isNative
        ? 'com.fairsquare.app://login-callback'
        : typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;

      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });
    } catch (error) {
      console.error('Error signing in', error);
      alert('Failed to sign in. Please check your Supabase configuration.');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-white dark:from-zinc-900 dark:to-black relative overflow-hidden w-full h-full">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-indigo-400/20 dark:bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-purple-400/20 dark:bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="z-10 flex flex-col items-center"
      >
        <motion.div
          initial={{ rotate: -90, scale: 0.5 }}
          animate={{ rotate: 12, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/30"
        >
          <Wallet className="w-12 h-12 text-white -rotate-12" />
        </motion.div>

        <div className="flex items-center justify-center gap-3 mb-3">
          <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tighter">Fair</h1>
          <div className="w-12 h-12 border-[5px] border-indigo-600 dark:border-indigo-500 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-3xl leading-none mb-1 shadow-sm">
            &amp;
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tighter">Square</h1>
        </div>

        <p className="text-gray-500 dark:text-gray-400 mb-14 text-center text-lg max-w-xs font-medium">
          Split trip expenses with friends, seamlessly.
        </p>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={signInWithGoogle}
          className="w-full max-w-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 px-6 rounded-2xl font-bold text-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.12)]"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </motion.button>
      </motion.div>
    </div>
  );
}
