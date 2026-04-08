'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { App as CapApp } from '@capacitor/app';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Home, Users as UsersIcon } from 'lucide-react';

import LoginScreen from '../components/auth/LoginScreen';
import P2PFlow from '../components/p2p/P2PFlow';
import GlobalExpenseHub from '../components/expenses/GlobalExpenseHub';
import GlobalFriendsScreen from '../components/friends/GlobalFriendsScreen';
import HomeScreen from '../components/dashboard/HomeScreen';
import TripScreen from '../components/trip/TripScreen';
import SettingsScreen from '../components/settings/SettingsScreen';
import { User, Trip } from '../lib/types';

function LogoBanner() {
  return (
    <div className="absolute top-0 left-0 right-[-100px] h-32 flex items-center justify-center opacity-[0.03] dark:opacity-[0.02] pointer-events-none select-none z-0 overflow-hidden" suppressHydrationWarning>
      <div className="flex items-center gap-4 rotate-[-5deg] scale-150 transform-origin-center">
        <h1 className="text-8xl font-black font-sans tracking-tighter whitespace-nowrap">Fair</h1>
        <div className="w-16 h-16 border-[8px] border-current rounded-2xl flex items-center justify-center font-black text-6xl leading-none">&amp;</div>
        <h1 className="text-8xl font-black font-sans tracking-tighter whitespace-nowrap">Square</h1>
        <div className="w-4 h-4 rounded-full bg-current mt-12 mx-4"></div>
        <h1 className="text-8xl font-black font-sans tracking-tighter whitespace-nowrap">Fair</h1>
        <div className="w-16 h-16 border-[8px] border-current rounded-2xl flex items-center justify-center font-black text-6xl leading-none">&amp;</div>
        <h1 className="text-8xl font-black font-sans tracking-tighter whitespace-nowrap">Square</h1>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'friends' | 'settings'>('dashboard');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const [showExpenseHub, setShowExpenseHub] = useState(false);
  const [showP2PFlow, setShowP2PFlow] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          uid: session.user.id,
          email: session.user.email || null,
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          photoURL: session.user.user_metadata?.avatar_url || null,
        });

        supabase.from('profiles').upsert({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          avatar_url: session.user.user_metadata?.avatar_url || null,
          updated_at: new Date().toISOString()
        }).then(({ error }) => { if (error) console.error("Error upserting profile:", error); });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          uid: session.user.id,
          email: session.user.email || null,
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          photoURL: session.user.user_metadata?.avatar_url || null,
        });
      } else {
        setUser(null);
        setSelectedTrip(null);
        setActiveTab('dashboard');
      }
    });

    // Handle deep links for Capacitor native app
    const setupDeepLinks = async () => {
      try {
        await CapApp.addListener('appUrlOpen', (event) => {
          const url = new URL(event.url);
          const hash = url.hash;
          if (hash) {
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
              supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
            }
          }
        });
      } catch (e) {
        console.log('App URL Open listener not supported (probably running in web).');
      }
    };
    setupDeepLinks();

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Basic dark mode setup based on system preference
    if (typeof window !== 'undefined') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(isDark);
      if (isDark) document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-white dark:bg-black">
        <div className="w-10 h-10 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  const renderContent = () => {
    if (showP2PFlow) {
      return <P2PFlow user={user} onBack={() => setShowP2PFlow(false)} />;
    }

    if (selectedTrip) {
      return (
        <TripScreen
          trip={selectedTrip}
          user={user}
          onBack={() => setSelectedTrip(null)}
          onPayAction={(friendId, amount) => {
            setShowP2PFlow(true);
            // Optionally could pre-fill the P2P flow amount and selected friend here via props
          }}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <HomeScreen user={user} onSelectTrip={setSelectedTrip} />;
      case 'friends':
        return <GlobalFriendsScreen user={user} onSelectP2P={() => setShowP2PFlow(true)} />;
      case 'settings':
        return <SettingsScreen user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
      default:
        return <HomeScreen user={user} onSelectTrip={setSelectedTrip} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-black overflow-hidden relative font-sans antialiased text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <LogoBanner />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10 w-full max-w-2xl mx-auto shadow-2xl overflow-hidden bg-white dark:bg-black">
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTrip ? `trip-${selectedTrip.id}` : showP2PFlow ? 'p2p' : activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global Bottom Navigation */}
        {!selectedTrip && !showP2PFlow && (
          <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2 px-6 flex justify-between items-center z-50 transition-colors">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center p-2 transition-all duration-300 relative ${activeTab === 'dashboard' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              <div className={`absolute top-0 w-8 h-1 rounded-b-full bg-indigo-600 dark:bg-indigo-400 transition-transform duration-300 ${activeTab === 'dashboard' ? 'scale-100' : 'scale-0'}`}></div>
              <Home className={`w-6 h-6 mb-1 ${activeTab === 'dashboard' ? 'scale-110' : ''}`} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
              <span className="text-[10px] font-bold">Groups</span>
            </button>

            {/* Floating Action Button for Expenses Hub */}
            <div className="relative -top-6">
              <button
                onClick={() => setShowExpenseHub(true)}
                className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all outline outline-4 outline-white dark:outline-black"
              >
                <Plus className="w-6 h-6" strokeWidth={3} />
              </button>
            </div>

            <button
              onClick={() => setActiveTab('friends')}
              className={`flex flex-col items-center p-2 transition-all duration-300 relative ${activeTab === 'friends' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              <div className={`absolute top-0 w-8 h-1 rounded-b-full bg-indigo-600 dark:bg-indigo-400 transition-transform duration-300 ${activeTab === 'friends' ? 'scale-100' : 'scale-0'}`}></div>
              <UsersIcon className={`w-6 h-6 mb-1 ${activeTab === 'friends' ? 'scale-110' : ''}`} strokeWidth={activeTab === 'friends' ? 2.5 : 2} />
              <span className="text-[10px] font-bold">Friends</span>
            </button>
          </div>
        )}

        {/* Global Modals */}
        <AnimatePresence>
          {showExpenseHub && (
            <GlobalExpenseHub
              user={user}
              onClose={() => setShowExpenseHub(false)}
              onSelectGroup={(trip) => {
                setShowExpenseHub(false);
                setSelectedTrip(trip);
              }}
              onSelectP2P={() => {
                setShowExpenseHub(false);
                setShowP2PFlow(true);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
