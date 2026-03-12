'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { User as SupabaseUser } from '@supabase/supabase-js';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  orderBy,
  setDoc
} from 'firebase/firestore';
import {
  Wallet,
  Users,
  PlusCircle,
  LogOut,
  Share2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Receipt,
  UserPlus,
  Pencil,
  Check,
  X,
  Settings,
  Settings2,
  Palmtree,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Square,
  Camera,
  Filter,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import imageCompression from 'browser-image-compression';
import AssignAndSplit from '../components/AssignAndSplit';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type Trip = {
  id: string;
  name: string;
  createdBy: string;
  members: string[]; // Array of user IDs or emails
  memberNames: Record<string, string>; // Map of userId to name
  notes?: string;
  dateRange?: string;
  createdAt: any;
};

export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

type Expense = {
  id: string;
  amount: number; // Stored in USD equivalent
  originalCurrency?: string;
  originalAmount?: number;
  payer: string; // userId
  category: string;
  description: string;
  timestamp: any;
  splits: Record<string, number>; // Map of userId to amount they owe (in USD)
  createdBy?: string;
};

// Hardcoded conversion rates to USD for simplicity
const CURRENCY_RATES: Record<string, number> = {
  'USD': 1.00,
  'EUR': 1.08,
  'GBP': 1.25,
  'CAD': 0.74,
  'AUD': 0.65,
  'JPY': 0.0066
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'CAD': 'C$',
  'AUD': 'A$',
  'JPY': '¥'
};

const LogoBanner = () => (
  <div className="flex items-center justify-center gap-2 py-3 pt-[max(env(safe-area-inset-top),1.25rem)] w-full bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 z-40 sticky top-0 shadow-sm">
    <span className="font-extrabold tracking-tight text-gray-900 dark:text-white text-2xl">Fair</span>
    <div className="w-7 h-7 border-[3px] border-indigo-600 dark:border-indigo-500 rounded-md flex items-center justify-center text-indigo-600 dark:text-indigo-500 font-black text-sm leading-none mb-0.5 shadow-sm">
      &amp;
    </div>
    <span className="font-extrabold tracking-tight text-gray-900 dark:text-white text-2xl">Square</span>
  </div>
);

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Global Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'friends' | 'settings' | 'p2p'>('dashboard');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showGlobalHub, setShowGlobalHub] = useState(false);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    // Supabase Notification Realtime logic will go here
  }, [user]);

  const markNotificationRead = async (id: string) => {
    // Set up Supabase mutation
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newDark = !prev;
      if (newDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newDark;
    });
  };

  useEffect(() => {
    const mapUser = (su: SupabaseUser | null): User | null => {
      if (!su) return null;
      return {
        uid: su.id,
        email: su.email || null,
        displayName: su.user_metadata?.full_name || su.user_metadata?.name || null,
        photoURL: su.user_metadata?.avatar_url || su.user_metadata?.picture || null,
      };
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(mapUser(session?.user ?? null));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const mapped = mapUser(session?.user ?? null);
      setUser(mapped);

      if (mapped && _event === 'SIGNED_IN') {
        supabase.from('profiles').upsert({
          id: mapped.uid,
          name: mapped.displayName,
          email: mapped.email,
          avatar_url: mapped.photoURL
        }).then();
      }
    });

    // Listen for deep link callbacks on native platforms (OAuth redirect)
    let appUrlListener: any;
    if (Capacitor.isNativePlatform()) {
      appUrlListener = CapApp.addListener('appUrlOpen', async ({ url }: { url: string }) => {
        // The URL will be like: com.fairsquare.app://login-callback#access_token=...&refresh_token=...
        if (url.includes('login-callback')) {
          const hashPart = url.split('#')[1];
          if (hashPart) {
            const params = new URLSearchParams(hashPart);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
            }
          }
        }
      });
    }

    return () => {
      subscription.unsubscribe();
      appUrlListener?.remove();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center dark:bg-black w-full h-full">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="font-extrabold tracking-tighter text-gray-900 dark:text-white text-3xl">Fair</span>
          <div className="w-8 h-8 border-4 border-indigo-600 dark:border-indigo-400 rounded flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg leading-none animate-pulse mb-0.5">
            &amp;
          </div>
          <span className="font-extrabold tracking-tighter text-gray-900 dark:text-white text-3xl">Square</span>
        </div>
        <p className="text-gray-400 text-sm font-medium tracking-widest uppercase">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Active View Router
  const renderContent = () => {
    if (activeTab === 'settings') {
      return <SettingsScreen user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
    }

    if (activeTab === 'dashboard') {
      if (selectedTrip) {
        return <TripScreen tab="dashboard" user={user} trip={selectedTrip} onBack={() => setSelectedTrip(null)} />;
      }
      return <HomeScreen user={user} onSelectTrip={(trip) => setSelectedTrip(trip)} />;
    }

    if (activeTab === 'add') {
      if (selectedTrip) {
        return <TripScreen tab="add" user={user} trip={selectedTrip} onBack={() => setSelectedTrip(null)} onFinishAdd={() => setActiveTab('dashboard')} />;
      }
      // If no trip selected, default to home view but maybe open create modal. For now, just show home.
      return <HomeScreen user={user} onSelectTrip={(trip) => setSelectedTrip(trip)} />;
    }

    if (activeTab === 'friends') {
      if (selectedTrip) {
        return <TripScreen tab="friends" user={user} trip={selectedTrip} onBack={() => setSelectedTrip(null)} />;
      }
      return <GlobalFriendsScreen user={user} onSelectP2P={() => setActiveTab('p2p')} />;
    }

    if (activeTab === 'p2p') {
      return <P2PFlow user={user} onBack={() => setActiveTab('dashboard')} />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 relative">

      {/* Global Brand Logo Banner */}
      <LogoBanner />

      {/* Toast Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-safe-pt pt-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-[100] flex flex-col gap-2 pointer-events-none">
          {notifications.map(notif => (
            <div key={notif.id} className="bg-white dark:bg-zinc-800 shadow-xl rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-3 pointer-events-auto animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{notif.message}</p>
                <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Payment Received</p>
              </div>
              <button onClick={() => markNotificationRead(notif.id)} className="p-1 -m-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
      </div>

      <AnimatePresence>
        {showGlobalHub && (
          <GlobalExpenseHub
            user={user}
            onClose={() => setShowGlobalHub(false)}
            onSelectGroup={(group) => {
              setSelectedTrip(group);
              setActiveTab('add');
              setShowGlobalHub(false);
            }}
            onSelectP2P={() => {
              setActiveTab('p2p');
              setShowGlobalHub(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Global Bottom Navigation */}
      <nav className="shrink-0 mt-auto bg-white/90 dark:bg-black/90 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-800/50 px-6 pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)] flex justify-between items-center w-full z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] relative">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === 'dashboard' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <motion.div whileTap={{ scale: 0.9 }}>
            <Wallet className={`w-6 h-6 ${activeTab === 'dashboard' ? 'fill-indigo-100 dark:fill-indigo-900/50' : ''}`} />
          </motion.div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Dashboard</span>
        </button>

        <button
          onClick={() => setShowGlobalHub(true)}
          className="flex-1 flex justify-center -mt-10"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(79,70,229,0.4)] dark:shadow-[0_8px_30px_rgba(99,102,241,0.3)] transition-colors border-[4px] border-white dark:border-black ${showGlobalHub ? 'bg-indigo-700 dark:bg-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500'}`}
          >
            <PlusCircle className="w-7 h-7 text-white" />
          </motion.div>
        </button>

        <button
          onClick={() => setActiveTab('friends')}
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === 'friends' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <motion.div whileTap={{ scale: 0.9 }}>
            <Users className={`w-6 h-6 ${activeTab === 'friends' ? 'fill-indigo-100 dark:fill-indigo-900/50' : ''}`} />
          </motion.div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Friends</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === 'settings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <motion.div whileTap={{ scale: 0.9 }}>
            <Settings className={`w-6 h-6 ${activeTab === 'settings' ? 'fill-indigo-100 dark:fill-indigo-900/50' : ''}`} />
          </motion.div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
        </button>
      </nav>
    </div>
  );
}

// --- Login Screen ---
function LoginScreen() {
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

function P2PFlow({ user, onBack }: { user: User, onBack: () => void }) {
  const [step, setStep] = useState<'select_friend' | 'amount'>('select_friend');
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    const fetchFriends = async () => {
      // Find all groups the user is in, and then get all members of those groups
      const { data } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (
            group_members (
              user_id,
              profiles ( id, name, avatar_url, email )
            )
          )
        `)
        .eq('user_id', user.uid);

      if (data && isSubscribed) {
        const uniqueFriends = new Map();
        data.forEach((gm: any) => {
          gm.groups?.group_members?.forEach((member: any) => {
            if (member.user_id !== user.uid && member.profiles) {
              if (!uniqueFriends.has(member.user_id)) {
                uniqueFriends.set(member.user_id, member.profiles);
              }
            }
          });
        });
        setFriends(Array.from(uniqueFriends.values()));
      }
    };
    fetchFriends();
    return () => { isSubscribed = false; };
  }, [user.uid]);

  const handleTransaction = async (type: 'PAY' | 'REQUEST') => {
    if (!selectedFriend || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    setIsSubmitting(true);
    try {
      // In our schema: transactions (id, sender_id, receiver_id, amount, currency, description, status)
      const sender_id = type === 'PAY' ? user.uid : selectedFriend.id;
      const receiver_id = type === 'PAY' ? selectedFriend.id : user.uid;
      // If payment is direct, we can mark "status" = 'completed' or 'pending' if it's a request.
      const status = type === 'PAY' ? 'completed' : 'pending';

      const { error } = await supabase
        .from('transactions')
        .insert({
          sender_id,
          receiver_id,
          amount: Number(amount),
          currency: 'USD',
          description: note || (type === 'PAY' ? 'Direct Payment' : 'Payment Request'),
          status
        });

      if (error) throw error;

      alert(`Successfully ${type === 'PAY' ? 'paid' : 'requested'} ${selectedFriend.name || 'friend'}.`);
      onBack();
    } catch (e) {
      console.error(e);
      alert("Failed to process transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-black relative">
      <header className="bg-white/80 dark:bg-black/80 backdrop-blur-xl px-6 py-4 shadow-sm z-10 sticky top-0 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-4">
          <button onClick={() => step === 'amount' ? setStep('select_friend') : onBack()} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-indigo-600 bg-gray-100/80 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-900/40 rounded-full cursor-pointer transition-colors shadow-sm">
            <ChevronLeft className="w-5 h-5 -ml-0.5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {step === 'select_friend' ? 'Who?' : `To ${selectedFriend?.name}`}
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {step === 'select_friend' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Select a Friend</h2>

            {friends.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No friends found.</p>
                <p className="text-sm text-gray-400 mt-1">Join a group to find people to pay.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.map(friend => (
                  <button
                    key={friend.id}
                    onClick={() => { setSelectedFriend(friend); setStep('amount'); }}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow text-left"
                  >
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt={friend.name} className="w-12 h-12 rounded-full shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                        {friend.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{friend.name}</p>
                      <p className="text-sm text-gray-500">{friend.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'amount' && selectedFriend && (
          <div className="max-w-md mx-auto space-y-8 animate-in slide-in-from-right-8 duration-300">
            <div className="flex flex-col items-center mt-6 mb-10">
              {selectedFriend.avatar_url ? (
                <img src={selectedFriend.avatar_url} alt={selectedFriend.name} className="w-24 h-24 rounded-full shadow-lg border-4 border-white dark:border-black mb-4" />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-4xl shadow-lg border-4 border-white dark:border-black mb-4">
                  {selectedFriend.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedFriend.name}</h2>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-6 border-b-2 border-indigo-500/30 focus-within:border-indigo-500 transition-colors pb-2">
                <span className="text-4xl font-light text-gray-400">$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-5xl font-black bg-transparent text-gray-900 dark:text-white focus:outline-none placeholder-gray-300 dark:placeholder-gray-700"
                  autoFocus
                />
              </div>

              <input
                type="text"
                placeholder="What's this for?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                disabled={isSubmitting}
                onClick={() => handleTransaction('REQUEST')}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-900 dark:text-white py-4 rounded-2xl font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                Request
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => handleTransaction('PAY')}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-500/30 transition-colors disabled:opacity-50"
              >
                Pay
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GlobalExpenseHub({ user, onClose, onSelectGroup, onSelectP2P }: { user: User, onClose: () => void, onSelectGroup: (trip: Trip) => void, onSelectP2P: () => void }) {
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    let isSubscribed = true;
    const fetchTrips = async () => {
      const { data } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (
            id, name, created_by, notes, date_range, created_at,
            group_members ( user_id, profiles ( name ) )
          )
        `)
        .eq('user_id', user.uid);

      if (data && isSubscribed) {
        const tripsData = data.map((gm: any) => {
          const g = gm.groups;
          const members = g.group_members.map((m: any) => m.user_id);
          const memberNames: Record<string, string> = {};
          g.group_members.forEach((m: any) => { memberNames[m.user_id] = m.profiles?.name || 'Unknown'; });
          return {
            id: g.id, name: g.name, createdBy: g.created_by, notes: g.notes,
            dateRange: g.date_range, createdAt: g.created_at, members, memberNames
          } as Trip;
        });
        tripsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTrips(tripsData);
      }
    };
    fetchTrips();
    return () => { isSubscribed = false; };
  }, [user.uid]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-900 w-full rounded-t-[2rem] p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] shadow-2xl relative animate-in slide-in-from-bottom-[100%] duration-300">
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors rounded-full flex items-center justify-center text-gray-500">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 pr-12">Who is this for?</h2>
        <p className="text-gray-500 mb-6 font-medium text-sm border-b border-gray-100 dark:border-gray-800 pb-4">
          Record a payment or add a new expense.
        </p>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pb-4">
          {/* P2P Flow */}
          <button
            onClick={onSelectP2P}
            className="w-full flex items-center p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl gap-4 group hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shadow-sm border border-indigo-200/50 dark:border-indigo-700/50">
              <UserCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-100 leading-none mb-1">Direct Payment / Request</h3>
              <p className="text-sm font-medium text-indigo-600/80 dark:text-indigo-400">Send money or request a split with a friend</p>
            </div>
            <ChevronRight className="w-5 h-5 text-indigo-400" />
          </button>

          <div className="py-2 flex items-center gap-4">
            <div className="h-px bg-gray-100 dark:bg-gray-800 flex-1"></div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Or choose a group</p>
            <div className="h-px bg-gray-100 dark:bg-gray-800 flex-1"></div>
          </div>

          {/* Group Options */}
          {trips.map(trip => (
            <button
              key={trip.id}
              onClick={() => onSelectGroup(trip)}
              className="w-full flex items-center p-4 bg-white dark:bg-black border border-gray-100 dark:border-gray-800 rounded-2xl gap-4 group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all text-left shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-zinc-800 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shadow-sm border border-gray-200/50 dark:border-gray-700/50">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-none mb-1 truncate">{trip.name}</h3>
                <p className="text-sm font-medium text-gray-500 truncate">{trip.members.length} members</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity -ml-4 group-hover:ml-0" />
            </button>
          ))}

          {trips.length === 0 && (
            <div className="text-center py-6 px-4">
              <div className="w-16 h-16 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                <Palmtree className="w-8 h-8" />
              </div>
              <p className="text-gray-900 dark:text-white font-bold mb-1">No groups yet</p>
              <p className="text-gray-500 text-sm">Create a group from the dashboard first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GlobalFriendsScreen({ user, onSelectP2P }: { user: User, onSelectP2P: () => void }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isSubscribed = true;
    const fetchTransactions = async () => {
      // Supabase OR query for sender_id or receiver_id
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id, amount, currency, description, status, created_at,
          sender_id, receiver_id,
          sender:profiles!sender_id(id, name, avatar_url),
          receiver:profiles!receiver_id(id, name, avatar_url)
        `)
        .or(`sender_id.eq.${user.uid},receiver_id.eq.${user.uid}`)
        .order('created_at', { ascending: false });

      if (data && isSubscribed) {
        setTransactions(data);
      }
      if (isSubscribed) setIsLoading(false);
    };
    fetchTransactions();
    return () => { isSubscribed = false; };
  }, [user.uid]);

  const handleUpdateTransaction = async (id: string, newStatus: 'completed' | 'declined') => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error('Failed to update transaction status', err);
      alert('Failed to update request.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-black relative">
      <header className="bg-white/80 dark:bg-black/80 backdrop-blur-xl px-6 py-3 border-b border-gray-200/50 dark:border-gray-800/50 z-10 flex justify-between items-center sticky top-0">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Friends</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
        {/* Actions */}
        <div className="flex gap-4">
          <button onClick={onSelectP2P} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition-colors">
            <Plus className="w-5 h-5" /> Send / Request
          </button>
        </div>

        {/* Activity Feed */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Recent Activity</h2>
          {isLoading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-gray-800">
              <Users className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-900 dark:text-white font-bold mb-1">No activity yet</p>
              <p className="text-gray-500 text-sm">Your P2P transactions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map(t => {
                const amISender = t.sender_id === user.uid;
                const friend = amISender ? t.receiver : t.sender;
                const isPayment = t.status === 'completed';

                return (
                  <div key={t.id} className="bg-white dark:bg-zinc-900/80 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-4 hover:shadow-md transition-shadow">
                    {friend?.avatar_url ? (
                      <img src={friend.avatar_url} alt={friend.name} className="w-12 h-12 rounded-full" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-gray-500 font-bold">
                        {friend?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate">
                        {amISender ? 'You' : friend?.name} {isPayment ? 'paid' : 'requested'} {amISender ? friend?.name : 'you'}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{t.description}</p>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-lg ${amISender && isPayment ? 'text-gray-900 dark:text-white' : (isPayment ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400')}`}>
                        {amISender && isPayment ? '-' : '+'}${Number(t.amount).toFixed(2)}
                      </div>
                      {t.status === 'pending' && <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-500 mt-1">Pending</p>}
                      {t.status === 'declined' && <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-rose-500 mt-1">Declined</p>}
                    </div>
                    {!amISender && t.status === 'pending' && (
                      <div className="w-full flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 col-span-full">
                        <button onClick={() => handleUpdateTransaction(t.id, 'declined')} className="flex-1 py-2 rounded-xl text-sm font-bold text-gray-500 dark:text-gray-400 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors">Decline</button>
                        <button onClick={() => handleUpdateTransaction(t.id, 'completed')} className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/30 transition-colors">Accept & Pay</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// --- Trip Card Component ---
function TripCard({ trip, user, onClick }: { trip: Trip, user: User, onClick: () => void }) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from('group_expenses')
        .select('amount, payer_id, splits')
        .eq('group_id', trip.id);

      if (error) {
        console.error('Error fetching expenses', error);
        return;
      }

      if (data && isSubscribed) {
        let myBalance = 0;
        data.forEach((exp: any) => {
          if (exp.payer_id === user.uid) myBalance += Number(exp.amount);
          if (exp.splits && exp.splits[user.uid] !== undefined) {
            myBalance -= Number(exp.splits[user.uid]);
          }
        });
        setBalance(myBalance);
      }
    };

    fetchBalance();
    return () => { isSubscribed = false; };
  }, [trip.id, user.uid]);

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full bg-white dark:bg-zinc-900/80 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 text-left hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/5 transition-all flex flex-col gap-4 group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-transparent dark:from-indigo-900/20 dark:to-transparent rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-1.5 tracking-tight">{trip.name}</h3>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> {trip.members.length} members
          </p>
        </div>
        <div className="w-10 h-10 bg-indigo-50 dark:bg-zinc-800 rounded-full flex flex-shrink-0 items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500 transition-colors shadow-sm">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>

      {balance !== null && (
        <div className={`mt-1 inline-flex py-1.5 px-3.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm z-10 ${balance > 0.01 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
          balance < -0.01 ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' :
            'bg-gray-50 text-gray-600 border border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'
          }`}>
          {balance > 0.01 ? `You're owed $${balance.toFixed(2)}` :
            balance < -0.01 ? `You owe $${Math.abs(balance).toFixed(2)}` :
              'Settled up'}
        </div>
      )}
    </motion.button>
  );
}

// --- Home Screen ---
function HomeScreen({ user, onSelectTrip }: { user: User, onSelectTrip: (trip: Trip) => void }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [joinTripId, setJoinTripId] = useState('');

  useEffect(() => {
    let isSubscribed = true;
    const fetchTrips = async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (
            id, name, created_by, notes, date_range, created_at,
            group_members (
              user_id,
              profiles ( name )
            )
          )
        `)
        .eq('user_id', user.uid);

      if (error) {
        console.error('Error fetching trips', error);
        return;
      }

      if (data && isSubscribed) {
        const tripsData = data.map((gm: any) => {
          const g = gm.groups;
          const members = g.group_members.map((m: any) => m.user_id);
          const memberNames: Record<string, string> = {};
          g.group_members.forEach((m: any) => {
            memberNames[m.user_id] = m.profiles?.name || 'Unknown';
          });
          return {
            id: g.id,
            name: g.name,
            createdBy: g.created_by,
            notes: g.notes,
            dateRange: g.date_range,
            createdAt: g.created_at,
            members,
            memberNames
          } as Trip;
        });

        tripsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTrips(tripsData);
      }
    };

    fetchTrips();
    return () => { isSubscribed = false; };
  }, [user.uid]);

  const handleCreateTrip = async () => {
    if (!newTripName.trim()) return;
    try {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newTripName,
          created_by: user.uid,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.uid
        });

      if (memberError) throw memberError;

      setNewTripName('');
      setShowCreate(false);
      // Let user view the new trip immediately, or wait for refresh
      onSelectTrip({
        id: group.id,
        name: group.name,
        createdBy: user.uid,
        members: [user.uid],
        memberNames: { [user.uid]: user.displayName || 'Unknown' },
        createdAt: group.created_at
      } as Trip);
    } catch (error) {
      console.error('Error creating group', error);
      alert('Failed to create group.');
    }
  };

  const handleJoinTrip = async () => {
    if (!joinTripId.trim()) return;
    try {
      // Check if group exists
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id')
        .eq('id', joinTripId.trim())
        .single();

      if (groupError || !group) {
        alert('Group not found!');
        return;
      }

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.uid
        });

      if (memberError) {
        if (memberError.code === '23505') {
          alert('You are already a member of this group.');
        } else {
          throw memberError;
        }
      } else {
        setJoinTripId('');
        setShowJoin(false);
      }
    } catch (error) {
      console.error('Error joining group', error);
      alert('Failed to join group. Please ensure the ID is correct.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-black relative">
      <header className="bg-white/80 dark:bg-black/80 backdrop-blur-xl px-6 py-3 border-b border-gray-200/50 dark:border-gray-800/50 z-10 flex justify-between items-center sticky top-0">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">My Groups</h1>
        </div>
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-full border-[3px] border-white dark:border-zinc-800 object-cover shadow-sm" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold border-[3px] border-white dark:border-zinc-800 shadow-sm text-lg">
              {user.displayName?.charAt(0) || '?'}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 pb-32">
        {trips.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 px-4 flex flex-col items-center justify-center h-full"
          >
            <div className="w-56 h-56 mb-8 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-indigo-400/20 dark:bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
              <Palmtree className="w-32 h-32 text-indigo-200 dark:text-indigo-900/50 drop-shadow-xl" />
            </div>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">No groups yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-[260px] mx-auto text-base font-medium leading-relaxed">
              Create a new group or join an existing one to start splitting the costs.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} user={user} onClick={() => onSelectTrip(trip)} />
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-6 right-6 flex gap-4 pointer-events-auto z-20">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowJoin(true)}
          className="flex-1 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-gray-700 transition-colors"
        >
          <UserPlus className="w-6 h-6" /> Join
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreate(true)}
          className="flex-[1.5] bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(79,70,229,0.3)] dark:shadow-[0_8px_30px_rgba(99,102,241,0.2)] transition-colors overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-white/20 hover:bg-transparent transition-colors" />
          <Plus className="w-6 h-6 relative z-10" /> <span className="relative z-10">Create Group</span>
        </motion.button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-full -mr-16 -mt-16" />
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6 relative z-10">Create New Group</h2>
              <input
                type="text"
                placeholder="Group Name (e.g. Bali 2024)"
                className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl px-5 py-4 mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium relative z-10"
                value={newTripName}
                onChange={(e) => setNewTripName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-4 relative z-10">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-4 font-bold text-gray-500 bg-gray-100 dark:bg-zinc-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-2xl transition-colors">Cancel</button>
                <button onClick={handleCreateTrip} className="flex-1 py-4 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-colors shadow-lg shadow-indigo-500/30">Create</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showJoin && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-full -mr-16 -mt-16" />
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6 relative z-10">Join a Group</h2>
              <input
                type="text"
                placeholder="Paste Group ID here"
                className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl px-5 py-4 mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm relative z-10"
                value={joinTripId}
                onChange={(e) => setJoinTripId(e.target.value)}
                autoFocus
              />
              <div className="flex gap-4 relative z-10">
                <button onClick={() => setShowJoin(false)} className="flex-1 py-4 font-bold text-gray-500 bg-gray-100 dark:bg-zinc-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-2xl transition-colors">Cancel</button>
                <button onClick={handleJoinTrip} className="flex-1 py-4 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-colors shadow-lg shadow-indigo-500/30">Join</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TripSettingsTab({ trip, user, onBack, handleShare }: any) {
  const [dateRangeValue, setDateRangeValue] = useState(trip.dateRange || '');
  const [isSavingDates, setIsSavingDates] = useState(false);

  const handleSaveDates = async () => {
    setIsSavingDates(true);
    try {
      await supabase
        .from('groups')
        .update({ date_range: dateRangeValue.trim() })
        .eq('id', trip.id);
    } catch (err) {
      console.error("Failed to save date range", err);
      alert("Failed to update group dates.");
    } finally {
      setIsSavingDates(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (trip.createdBy === user.uid) {
      alert("As the creator, you cannot leave the group. You must delete it instead.");
      return;
    }
    if (confirm("Are you sure you want to leave this group? You will no longer see its expenses.")) {
      try {
        await supabase
          .from('group_members')
          .delete()
          .eq('group_id', trip.id)
          .eq('user_id', user.uid);
        onBack();
      } catch (err) {
        console.error("Error leaving group:", err);
        alert("Failed to leave group.");
      }
    }
  };

  return (
    <div className="p-6">
      <h3 className="font-bold text-gray-900 dark:text-white mb-6 text-xl">Group Settings</h3>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-50 dark:border-gray-800">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Group Dates</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="e.g. Dec 21 - Jan 5"
                className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={dateRangeValue}
                onChange={(e) => setDateRangeValue(e.target.value)}
              />
            </div>
            {dateRangeValue !== (trip.dateRange || '') && (
              <button
                onClick={handleSaveDates}
                disabled={isSavingDates}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSavingDates ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
        <div className="p-4 border-b border-gray-50 dark:border-gray-800">
          <button onClick={handleShare} className="w-full flex justify-between items-center group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Plus className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">Add New Users</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Copy the invite link</p>
              </div>
            </div>
          </button>
        </div>
        <div className="p-4">
          <button onClick={handleLeaveGroup} className="w-full flex justify-between items-center group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-medium text-rose-600 dark:text-rose-400">Leave Group</p>
                <p className="text-xs text-rose-500/80 dark:text-rose-400/80">Remove yourself from this group</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Trip Screen ---
function TripScreen({ user, trip, onBack, tab = 'dashboard', onFinishAdd }: { user: User, trip: Trip, onBack: () => void, tab?: 'dashboard' | 'add' | 'edit' | 'friends' | 'settings', onFinishAdd?: () => void }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'edit' | 'friends' | 'settings'>(tab);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(trip.name);
  const [notesValue, setNotesValue] = useState(trip.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // Filter & Sort State
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'amount_desc' | 'amount_asc' | 'az'>('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [filterUsers, setFilterUsers] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'settled' | 'unsettled'>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Settle Up State
  const [settleUpDebt, setSettleUpDebt] = useState<any | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');

  // Sync internal tab if parent tab changes
  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  // Listen to expenses for this trip
  useEffect(() => {
    let isSubscribed = true;
    const fetchExpenses = async () => {
      const { data, error } = await supabase
        .from('group_expenses')
        .select('*')
        .eq('group_id', trip.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching expenses', error);
        return;
      }

      if (data && isSubscribed) {
        const exps = data.map((d: any) => ({
          id: d.id,
          amount: Number(d.amount),
          originalCurrency: d.original_currency,
          originalAmount: Number(d.original_amount),
          payer: d.payer_id,
          category: d.category,
          description: d.description,
          splits: d.splits,
          createdBy: d.created_by,
          timestamp: d.created_at
        } as Expense));
        setExpenses(exps);
      }
    };

    fetchExpenses();
    return () => { isSubscribed = false; };
  }, [trip.id]);

  const executeSettleUp = async () => {
    if (!settleUpDebt || !settleAmount) return;

    const amountVal = parseFloat(settleAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    // Allow up to 2 cents overpayment to account for fractional splits rounding in the UI
    if (amountVal > settleUpDebt.amount + 0.02) {
      alert("You cannot pay more than you owe (plus a small margin for fractional rounding).");
      return;
    }

    const payeeId = settleUpDebt.to;

    // 1. Record the Settlement Expense
    const expensePayload = {
      group_id: trip.id,
      amount: amountVal,
      original_currency: 'USD',
      original_amount: amountVal,
      description: 'Settlement Payment',
      category: 'settlement',
      payer_id: user.uid,
      splits: { [payeeId]: amountVal },
      created_by: user.uid
    };

    try {
      const { data, error } = await supabase.from('group_expenses').insert(expensePayload).select().single();
      if (error) throw error;

      if (data) {
        setExpenses(prev => [{
          id: data.id,
          amount: Number(data.amount),
          originalCurrency: data.original_currency,
          originalAmount: Number(data.original_amount),
          payer: data.payer_id,
          category: data.category,
          description: data.description,
          splits: data.splits,
          createdBy: data.created_by,
          timestamp: data.created_at
        } as Expense, ...prev]);
      }

      setSettleUpDebt(null);
      setSettleAmount('');
    } catch (e) {
      console.error("Failed to settle up", e);
      alert("Failed to process payment.");
    }
  };

  // Calculate balances
  const balances: Record<string, number> = {};
  trip.members.forEach(m => balances[m] = 0);

  expenses.forEach(exp => {
    // Payer gets positive balance (owed to them)
    if (balances[exp.payer] !== undefined) {
      balances[exp.payer] += exp.amount;
    }
    // Splitters get negative balance (they owe)
    Object.entries(exp.splits || {}).forEach(([userId, amountOwed]) => {
      if (balances[userId] !== undefined) {
        balances[userId] -= amountOwed;
      }
    });
  });

  const myBalance = balances[user.uid] || 0;

  // Calculate peer-to-peer debts minimizing total transfers
  const calculateDebts = () => {
    let debtors: { id: string, amount: number }[] = [];
    let creditors: { id: string, amount: number }[] = [];

    // Separate into those who owe and those who are owed
    Object.entries(balances).forEach(([id, balance]) => {
      // Balance is positive if they are owed money, negative if they owe money
      if (balance > 0.01) creditors.push({ id, amount: balance });
      else if (balance < -0.01) debtors.push({ id, amount: Math.abs(balance) });
    });

    const debts: { from: string; to: string; amount: number }[] = [];

    // Step 1: Find exact matches (someone owes exactly what someone else is owed)
    // This further reduces the total number of transactions
    for (let d = debtors.length - 1; d >= 0; d--) {
      for (let c = creditors.length - 1; c >= 0; c--) {
        if (Math.abs(debtors[d].amount - creditors[c].amount) < 0.01) {
          debts.push({ from: debtors[d].id, to: creditors[c].id, amount: debtors[d].amount });
          debtors.splice(d, 1);
          creditors.splice(c, 1);
          break; // Move to next debtor
        }
      }
    }

    // Sort remainders by amount (largest to largest) for Step 2
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let d = 0;
    let c = 0;

    // Step 2: Greedy matching algorithm for the remaining balances
    while (d < debtors.length && c < creditors.length) {
      const debtor = debtors[d];
      const creditor = creditors[c];

      const amount = Math.min(debtor.amount, creditor.amount);
      if (amount > 0.01) {
        debts.push({ from: debtor.id, to: creditor.id, amount });
      }

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount < 0.01) d++;
      if (creditor.amount < 0.01) c++;
    }

    return debts;
  };

  const debts = calculateDebts();

  // Process expenses for sorting and filtering
  const processedExpenses = useMemo(() => {
    let result = [...expenses];

    // 1. Filter by Users
    if (filterUsers.length > 0) {
      result = result.filter(exp => {
        const involvedUsers = [exp.payer, ...Object.keys(exp.splits || {})];
        return filterUsers.some(uid => involvedUsers.includes(uid));
      });
    }

    // 2. Filter by Category
    if (filterCategory !== 'all') {
      result = result.filter(exp => exp.category === filterCategory);
    }

    // 3. Filter by Status (Settled/Unsettled) - This is a simple approximation
    // A true settlement check would require a more complex ledger analysis per expense
    if (filterStatus !== 'all') {
      if (filterStatus === 'settled') {
        result = result.filter(exp => exp.category === 'settlement');
      } else {
        result = result.filter(exp => exp.category !== 'settlement');
      }
    }

    // 4. Filter by Date
    if (filterStartDate) {
      const start = new Date(filterStartDate).getTime();
      result = result.filter(exp => exp.timestamp && exp.timestamp.toMillis() >= start);
    }
    if (filterEndDate) {
      // Add 1 day to include the entire end date selected
      const end = new Date(filterEndDate).getTime() + (24 * 60 * 60 * 1000);
      result = result.filter(exp => exp.timestamp && exp.timestamp.toMillis() <= end);
    }

    // 5. Apply Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0);
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        case 'az':
          return a.description.localeCompare(b.description);
        case 'recent':
        default:
          return (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0);
      }
    });

    return result;
  }, [expenses, filterUsers, filterCategory, filterStatus, filterStartDate, filterEndDate, sortBy]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Join my group: ${trip.name}`,
        text: 'Join my group on Fair Square to split expenses!',
        url: `${window.location.origin}?join=${trip.id}`
      });
    } else {
      navigator.clipboard.writeText(trip.id);
      alert('Group ID copied to clipboard!');
    }
  };

  const saveUpdatedNotes = async () => {
    try {
      await supabase
        .from('groups')
        .update({ notes: notesValue.trim() })
        .eq('id', trip.id);
      setIsEditingNotes(false);
    } catch (err) {
      console.error('Failed to update notes', err);
      alert('Failed to update group notes');
    }
  };

  const saveUpdatedName = async () => {
    if (!editNameValue.trim() || editNameValue === trip.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await supabase
        .from('groups')
        .update({ name: editNameValue.trim() })
        .eq('id', trip.id);
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name', err);
      alert('Failed to update group name');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-black relative">
      <header className="bg-white/80 dark:bg-black/80 backdrop-blur-xl px-6 py-3 shadow-sm z-10 sticky top-0 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-indigo-600 bg-gray-100/80 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-900/40 rounded-full cursor-pointer transition-colors shadow-sm">
            <ChevronLeft className="w-5 h-5 -ml-0.5" />
          </button>

          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab('settings')} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-indigo-600 bg-gray-100/80 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-900/40 rounded-full cursor-pointer transition-colors shadow-sm">
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          {isEditingName ? (
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                autoFocus
                className="text-3xl font-black tracking-tight text-gray-900 dark:text-white bg-transparent border-b-2 border-indigo-500 focus:outline-none w-full"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveUpdatedName();
                  if (e.key === 'Escape') {
                    setEditNameValue(trip.name);
                    setIsEditingName(false);
                  }
                }}
              />
              <button onClick={saveUpdatedName} className="p-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-400 rounded-full shadow-sm hover:scale-105 transition-transform"><Check className="w-5 h-5" /></button>
              <button onClick={() => { setEditNameValue(trip.name); setIsEditingName(false); }} className="p-2 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 rounded-full shadow-sm hover:scale-105 transition-transform"><X className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setIsEditingName(true)}>
              <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">{trip.name}</h1>
              <div className="w-8 h-8 rounded-full bg-gray-100/0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 flex items-center justify-center transition-colors">
                <Pencil className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 transition-colors" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap overflow-x-auto hide-scrollbar pb-2 -mb-2">
          {/* Members Pill Badge */}
          <div className="flex items-center gap-1.5 bg-gray-100/80 dark:bg-zinc-800/80 text-gray-600 dark:text-gray-300 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap" onClick={() => setActiveTab('friends')}>
            <Users className="w-3.5 h-3.5" />
            <span>{trip.members.length} member{trip.members.length !== 1 ? 's' : ''}</span>
          </div>
          {/* Date Range Pill */}
          {trip.dateRange && (
            <div className="flex items-center gap-1.5 bg-indigo-50/80 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5" />
              <span>{trip.dateRange}</span>
            </div>
          )}
          {/* Active Status Pill */}
          <div className="flex items-center gap-1.5 bg-emerald-50/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>Active</span>
          </div>
        </div>
      </header>

      {/* Background Graphic Watermark */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.03] dark:opacity-[0.05] z-0">
        <Palmtree className="w-96 h-96 text-gray-900 dark:text-white rotate-12" strokeWidth={1} />
      </div>

      <div className="flex-1 overflow-y-auto pb-24 relative z-10">
        {activeTab === 'dashboard' && (
          <div className="p-6 space-y-6">
            {/* Personalized Balance Cards */}
            <div className="space-y-3">
              {(() => {
                // Filter the global debts array to only include settlements involving the current user
                const myDebts = debts.filter(d => d.from === user.uid || d.to === user.uid);

                if (myDebts.length === 0) {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="p-6 rounded-[2rem] text-white shadow-[0_8px_30px_rgba(79,70,229,0.2)] bg-gradient-to-tr from-indigo-500 to-purple-500 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                      <div className="relative z-10">
                        <p className="text-white/80 text-sm font-bold uppercase tracking-wider mb-1">Your Balance</p>
                        <h2 className="text-5xl font-black tracking-tighter mb-2 drop-shadow-sm">
                          $0.00
                        </h2>
                        <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-sm">
                          🎉 <span className="mt-px">You are all settled up</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                return myDebts.map((debt, idx) => {
                  const iOwe = debt.from === user.uid;
                  const otherPersonId = iOwe ? debt.to : debt.from;
                  const otherPersonName = trip.memberNames[otherPersonId] || 'Unknown';

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-6 rounded-[2rem] text-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden relative ${iOwe ? 'bg-gradient-to-br from-rose-500 to-rose-600' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'}`}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 pointer-events-none" />
                      <div className="absolute bottom-[-20%] left-[-10%] w-24 h-24 bg-black/10 rounded-full pointer-events-none blur-xl" />

                      <div className="relative z-10">
                        <h2 className="text-4xl font-black tracking-tighter mb-1 drop-shadow-sm">
                          ${debt.amount.toFixed(2)}
                        </h2>
                        <p className="text-white/95 text-base font-bold mb-5 tracking-wide">
                          {iOwe ? `You owe ${otherPersonName}` : `${otherPersonName} owes you`}
                        </p>
                        {iOwe && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setSettleUpDebt(debt); setSettleAmount(debt.amount.toFixed(2)); }}
                            className="bg-white text-rose-600 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all w-max flex items-center gap-2"
                          >
                            <Wallet className="w-4 h-4" /> Mark as Paid
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  );
                });
              })()}
            </div>

            {/* Add Group Notes */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
              <button
                onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">Group Notes</h3>
                  {trip.notes && !isNotesExpanded && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isNotesExpanded && !isEditingNotes && (
                    <div onClick={(e) => { e.stopPropagation(); setIsNotesExpanded(true); setIsEditingNotes(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-full transition-colors cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {isNotesExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {isNotesExpanded && (
                <div className="p-4 pt-0 border-t border-gray-50 dark:border-gray-800/50">
                  {isEditingNotes ? (
                    <div className="flex flex-col gap-2 mt-4">
                      <textarea
                        autoFocus
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
                        rows={3}
                        placeholder="Add an address, itinerary link, or general notes..."
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setNotesValue(trip.notes || ''); setIsEditingNotes(false); }} className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-1.5">Cancel</button>
                        <button onClick={saveUpdatedNotes} className="text-xs font-bold bg-indigo-600 text-white px-4 py-1.5 rounded-full hover:bg-indigo-700 transition-colors">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 group relative">
                      <p className={`text-sm ${trip.notes ? 'text-gray-700 dark:text-gray-300 whitespace-pre-wrap' : 'text-gray-400 italic'}`}>
                        {trip.notes || 'Add an address, itinerary link, or general notes...'}
                      </p>
                      {trip.notes && (
                        <button
                          onClick={() => setIsEditingNotes(true)}
                          className="absolute top-0 right-0 p-1.5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm text-gray-400 hover:text-indigo-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Expenses & Filters */}
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 mb-5 mt-2">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer shadow-sm"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="oldest">Oldest</option>
                    <option value="amount_desc">Amount: High to Low</option>
                    <option value="amount_asc">Amount: Low to High</option>
                    <option value="az">A-Z</option>
                  </select>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${showFilters ? 'bg-indigo-600 text-white shadow-indigo-500/30' : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 border border-gray-200 dark:border-gray-700'}`}
                  >
                    <Filter size={14} />
                    Filters {showFilters ? '-' : '+'}
                  </button>
                </div>
              </div>

              {/* Collapsible Filters Panel */}
              {showFilters && (
                <div className="mb-6 p-4 sm:p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl animate-in slide-in-from-top-4 duration-300 fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Filter Expenses</h4>
                    <button
                      onClick={() => {
                        setFilterUsers([]);
                        setFilterCategory('all');
                        setFilterStatus('all');
                        setFilterStartDate('');
                        setFilterEndDate('');
                      }}
                      className="text-xs font-semibold text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-wider transition-colors"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-5">
                    {/* By User(s) */}
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wide">By User(s)</p>
                      <div className="flex flex-wrap gap-2">
                        {trip.members.map(memberId => {
                          const isActive = filterUsers.includes(memberId);
                          return (
                            <button
                              key={memberId}
                              onClick={() => {
                                setFilterUsers(prev =>
                                  isActive ? prev.filter(id => id !== memberId) : [...prev, memberId]
                                );
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300' : 'bg-zinc-50 dark:bg-black/20 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                            >
                              <div className={`w-3 h-3 rounded shadow-sm border ${isActive ? 'bg-indigo-500 border-indigo-600 dark:border-indigo-400 flex items-center justify-center' : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700'}`}>
                                {isActive && <Check size={10} strokeWidth={3} className="text-white" />}
                              </div>
                              {trip.memberNames[memberId]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* By Category */}
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wide">By Category</p>
                      <div className="flex flex-wrap gap-2">
                        {['all', 'food', 'transport', 'lodging', 'general', 'settlement'].map(cat => (
                          <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${filterCategory === cat ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300' : 'bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                          >
                            {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-5">
                      {/* By Status */}
                      <div className="flex-1">
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wide">By Status</p>
                        <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl w-full">
                          {['all', 'unsettled', 'settled'].map(status => (
                            <button
                              key={status}
                              onClick={() => setFilterStatus(status as any)}
                              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${filterStatus === status ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-black/5 dark:border-white/5' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'}`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* By Date Range */}
                      <div className="flex-1">
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wide">By Date</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="w-full bg-transparent border-b border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 text-sm p-1 text-zinc-900 dark:text-zinc-100 appearance-none outline-none"
                          />
                          <span className="text-zinc-400 text-xs">to</span>
                          <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="w-full bg-transparent border-b border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 text-sm p-1 text-zinc-900 dark:text-zinc-100 appearance-none outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {processedExpenses.length === 0 ? (
                <div className="text-center py-12 px-4 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mb-4">
                    <Receipt className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No expenses yet</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-xs">Start adding expenses to automatically track who owes what.</p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/20 active:scale-95 flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Add First Expense
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {processedExpenses.map((exp: Expense, index: number) => (
                    <motion.div
                      key={exp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                      className="bg-white dark:bg-zinc-900/80 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-50 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-white/50 dark:border-white/5">
                          {exp.category === 'food' ? '🍔' : exp.category === 'transport' ? '🚕' : exp.category === 'lodging' ? '🏨' : exp.category === 'settlement' ? '💸' : '🛒'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-base tracking-tight mb-0.5">{exp.description}</p>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            <span className="text-gray-700 dark:text-gray-300">{trip.memberNames[exp.payer]}</span> paid • {exp.timestamp ? format(exp.timestamp.toDate(), 'MMM d, h:mm a') : 'Just now'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <p className="font-black text-gray-900 dark:text-white text-lg tracking-tight">
                          {exp.originalCurrency && exp.originalCurrency !== 'USD' ? (
                            <span className="text-[10px] text-gray-400 mr-1.5 font-bold bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md" title={`$${exp.amount.toFixed(2)} USD`}>
                              {CURRENCY_SYMBOLS[exp.originalCurrency]}{exp.originalAmount?.toFixed(2)}
                            </span>
                          ) : null}
                          ${exp.amount.toFixed(2)}
                        </p>
                        {exp.splits[user.uid] > 0 && exp.payer !== user.uid && (
                          exp.category === 'settlement' ? (
                            <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-lg self-end tracking-wider uppercase">Received ${exp.splits[user.uid].toFixed(2)}</div>
                          ) : myBalance < -0.01 ? (
                            <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-lg self-end tracking-wider uppercase">You owe ${exp.splits[user.uid].toFixed(2)}</div>
                          ) : (
                            <div className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-lg self-end tracking-wider uppercase">Your share ${exp.splits[user.uid].toFixed(2)}</div>
                          )
                        )}
                      </div>
                      {(exp.createdBy === user.uid || (!exp.createdBy && exp.payer === user.uid)) && (
                        <div className="pl-3 ml-3 border-l border-gray-100 dark:border-gray-800 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingExpense(exp);
                              setActiveTab('edit');
                            }}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Floating Action Button for Trips Dashboard */}
            <button
              onClick={() => setActiveTab('add')}
              className="fixed bottom-8 right-6 w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(79,70,229,0.4)] hover:shadow-[0_8px_30px_rgba(79,70,229,0.6)] hover:scale-105 active:scale-95 transition-all z-50 group"
            >
              <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        )}

        {activeTab === 'add' && (
          <ExpenseFormTab
            trip={trip}
            user={user}
            onAdded={() => {
              setActiveTab('dashboard');
              onFinishAdd?.();
            }}
          />
        )}

        {activeTab === 'edit' && editingExpense && (
          <ExpenseFormTab
            trip={trip}
            user={user}
            initialExpense={editingExpense}
            onAdded={() => {
              setEditingExpense(null);
              setActiveTab('dashboard');
              onFinishAdd?.();
            }}
          />
        )}

        {activeTab === 'friends' && (
          <FriendsTab
            trip={trip}
            user={user}
            balances={balances}
            debts={debts}
            handleShare={handleShare}
            onPay={(debt: any) => { setSettleUpDebt(debt); setSettleAmount(debt.amount.toFixed(2)); }}
          />
        )
        }

        {
          activeTab === 'settings' && (
            <TripSettingsTab trip={trip} user={user} onBack={() => setActiveTab('dashboard')} handleShare={handleShare} />
          )
        }
      </div >

      {/* Settle Up Modal */}
      {
        settleUpDebt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 pb-safe">
            <div className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settle Up</h2>
                <button onClick={() => setSettleUpDebt(null)} className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">You owe {trip.memberNames[settleUpDebt.to]}</p>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 dark:text-gray-400 text-3xl font-bold">$</span>
                  </div>
                  <input
                    type="number"
                    className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl pl-12 pr-4 py-4 text-4xl font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2 text-right">Total Owed: ${settleUpDebt.amount.toFixed(2)}</p>
              </div>

              <button
                onClick={executeSettleUp}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-colors"
              >
                Record Payment
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
}

function FriendsTab({ trip, user, balances, debts, handleShare, onPay }: any) {
  const [profiles, setProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('id', trip.members);

        if (error) throw error;

        const newProfiles: Record<string, any> = {};
        data?.forEach((d: any) => {
          newProfiles[d.id] = {
            uid: d.id,
            displayName: d.name,
            photoURL: d.avatar_url,
            email: d.email
          };
        });
        setProfiles(newProfiles);
      } catch (e) {
        console.error("Failed to fetch profiles", e);
      }
    }
    loadProfiles();
  }, [trip.members]);

  return (
    <div className="p-6">
      {/* How to Settle Up Section (Moved to Top) */}
      {debts.length > 0 && (
        <div className="mb-10">
          <h3 className="font-bold text-gray-900 dark:text-white text-xl mb-4">How to Settle Up</h3>
          <div className="space-y-4">
            {debts.map((debt: any, idx: number) => {
              const fromProfile = profiles[debt.from];
              const toProfile = profiles[debt.to];
              const amISender = user.uid === debt.from;
              const amIReceiver = user.uid === debt.to;

              return (
                <div key={idx} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 flex items-center justify-between text-base">
                      <div className="flex items-center gap-3">
                        {fromProfile?.photoURL ? <img src={fromProfile.photoURL} className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">{trip.memberNames[debt.from]?.charAt(0).toUpperCase()}</div>}
                        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[100px]">{amISender ? 'You' : trip.memberNames[debt.from]}</span>
                      </div>
                      <div className="flex flex-col items-center px-3 text-gray-400">
                        <span className="text-[10px] uppercase font-bold text-gray-400 mb-1">Pays</span>
                        <div className="w-10 h-px bg-gray-200 dark:bg-gray-700 relative">
                          <div className="absolute right-0 -top-[3px] border-solid border-l-gray-200 dark:border-l-gray-700 border-l-[4px] border-y-transparent border-y-[3px] border-r-0"></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {toProfile?.photoURL ? <img src={toProfile.photoURL} className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">{trip.memberNames[debt.to]?.charAt(0).toUpperCase()}</div>}
                        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[100px]">{amIReceiver ? 'You' : trip.memberNames[debt.to]}</span>
                      </div>
                    </div>
                    <div className="font-bold text-gray-900 dark:text-white text-xl pl-5 border-l border-gray-100 dark:border-gray-800">
                      ${debt.amount.toFixed(2)}
                    </div>
                  </div>

                  {/* Action Buttons for Relevant Users */}
                  {amISender && (
                    <div className="pt-4 border-t border-gray-50 dark:border-gray-800/50 flex justify-end">
                      <button
                        onClick={() => onPay(debt)}
                        className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors w-full sm:w-auto text-center"
                      >
                        Mark as Paid
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Trip Members Section (Moved Down) */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">Trip Members</h3>
          <button onClick={handleShare} className="text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
            <Plus className="w-4 h-4" /> Invite
          </button>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {trip.members.map((memberId: string, idx: number) => {
            const profile = profiles[memberId];
            return (
              <div key={memberId} className={`p-4 flex items-center justify-between ${idx !== trip.members.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}>
                <div className="flex items-center gap-3">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {trip.memberNames[memberId]?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {trip.memberNames[memberId]} {memberId === user.uid && '(You)'}
                    </p>
                    <div className="text-sm font-medium">
                      {(() => {
                        const bal = balances[memberId] || 0;
                        if (Math.abs(bal) < 0.01) {
                          return <span className="text-gray-500 dark:text-gray-400">🎉 Settled up</span>;
                        } else if (bal > 0) {
                          return <span className="text-emerald-500 dark:text-emerald-400">Gets back ${bal.toFixed(2)}</span>;
                        } else {
                          // Find who they owe from the calculated debts array
                          const userDebts = debts.filter((d: any) => d.from === memberId);
                          let oweText = `Owes $${Math.abs(bal).toFixed(2)} total`;
                          if (userDebts.length === 1) {
                            const creditorName = trip.memberNames[userDebts[0].to] || 'someone';
                            oweText = `Owes ${creditorName} $${Math.abs(bal).toFixed(2)}`;
                          }
                          return <span className="text-rose-500 dark:text-rose-400">{oweText}</span>;
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center uppercase tracking-wider font-semibold mb-2">Trip ID</p>
        <div className="flex items-center justify-center gap-2">
          <code className="font-mono text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700">{trip.id}</code>
          <button onClick={() => { navigator.clipboard.writeText(trip.id); alert('Copied!'); }} className="text-indigo-600 dark:text-indigo-400 text-sm font-medium">Copy</button>
        </div>
      </div>
    </div>
  );
}

// --- Settings Screen ---
function SettingsScreen({ user, isDarkMode, toggleTheme }: { user: User, isDarkMode: boolean, toggleTheme: () => void }) {
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

// --- Expense Form Tab (Add or Edit) ---
function ExpenseFormTab({ trip, user, initialExpense, onAdded }: { trip: Trip, user: User, initialExpense?: Expense, onAdded: () => void }) {
  const [amount, setAmount] = useState(initialExpense ? (initialExpense.originalAmount || initialExpense.amount).toString() : '');
  const [currency, setCurrency] = useState(initialExpense?.originalCurrency || 'USD');
  const [description, setDescription] = useState(initialExpense ? initialExpense.description : '');
  const [category, setCategory] = useState(initialExpense ? initialExpense.category : 'general');
  const [payer, setPayer] = useState(initialExpense ? initialExpense.payer : user.uid);

  const [isScanning, setIsScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scannedReceiptData, setScannedReceiptData] = useState<any | null>(null);
  const [showCameraOptions, setShowCameraOptions] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Custom splits setup based on initial data
  const initialInvolved = initialExpense
    ? Object.keys(initialExpense.splits)
    : trip.members;

  let initialSplitType: 'equal' | 'exact' | 'percent' = 'equal';
  const initExact: Record<string, string> = {};
  if (initialExpense) {
    initialSplitType = 'exact';
    // For editing with different currencies, it's safest to convert the exact USD splits back to the original currency scale for display
    const conversionRate = CURRENCY_RATES[initialExpense.originalCurrency || 'USD'] || 1.0;
    for (const [uid, amtUSD] of Object.entries(initialExpense.splits)) {
      initExact[uid] = (amtUSD / conversionRate).toFixed(2);
    }
  }

  const [involvedMembers, setInvolvedMembers] = useState<string[]>(initialInvolved);
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percent'>(initialSplitType);
  const [exactSplits, setExactSplits] = useState<Record<string, string>>(initExact);
  const [percentSplits, setPercentSplits] = useState<Record<string, string>>({});

  const isSubmitting = false;

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanPreview(URL.createObjectURL(file));

    try {
      // 1. Compress the Image
      const options = {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);

      // 2. Convert to Base64
      const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(compressedFile);
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      // 3. Send to Supabase Edge Function
      abortControllerRef.current = new AbortController();
      const response = await supabase.functions.invoke('process-receipt', {
        body: {
          imageBase64: base64data,
          mimeType: compressedFile.type,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to process receipt');
      }

      const extractedData = response.data;
      console.log('Parsed receipt data:', extractedData);

      if (extractedData.total) {
        setAmount(extractedData.total.toFixed(2).toString());
      }

      const firstItem = extractedData.lineItems?.[0]?.name;
      if (firstItem) {
        const hasMore = extractedData.lineItems.length > 1;
        setDescription(`Receipt: ${firstItem}${hasMore ? ' & more' : ''}`);
      } else {
        setDescription('Scanned Receipt');
      }

      setScannedReceiptData(extractedData);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Scanner aborted by user.");
        return;
      }
      console.error("Error scanning receipt:", error);
      alert("Failed to process receipt image.");
    } finally {
      setIsScanning(false);
      setScanPreview(null);
    }
  };

  const toggleMemberInvolvement = (memberId: string) => {
    setInvolvedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(m => m !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSave = async () => {
    const numAmountLocal = parseFloat(amount);
    if (isNaN(numAmountLocal) || numAmountLocal <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }
    if (involvedMembers.length === 0) {
      alert('Please select at least one involved member');
      return;
    }

    // Convert to USD for storage and internal math
    const rate = CURRENCY_RATES[currency] || 1.0;
    const numAmountUSD = numAmountLocal * rate;

    const splitsUSD: Record<string, number> = {};

    if (splitType === 'equal') {
      const splitAmountUSD = numAmountUSD / involvedMembers.length;
      involvedMembers.forEach(m => splitsUSD[m] = splitAmountUSD);
    } else if (splitType === 'exact') {
      let totalLocal = 0;
      involvedMembers.forEach(m => {
        const valLocal = parseFloat(exactSplits[m] || '0');
        splitsUSD[m] = valLocal * rate;
        totalLocal += valLocal;
      });
      if (Math.abs(totalLocal - numAmountLocal) > 0.01) {
        alert(`Exact splits must sum to the total amount (${CURRENCY_SYMBOLS[currency]}${numAmountLocal}). Currently: ${CURRENCY_SYMBOLS[currency]}${totalLocal}`);
        return;
      }
    } else if (splitType === 'percent') {
      let totalPct = 0;
      involvedMembers.forEach(m => {
        const pct = parseFloat(percentSplits[m] || '0');
        splitsUSD[m] = (pct / 100) * numAmountUSD;
        totalPct += pct;
      });
      if (Math.abs(totalPct - 100) > 0.01) {
        alert(`Percentages must sum to 100%. Currently: ${totalPct}%`);
        return;
      }
    }

    try {
      const payload = {
        group_id: trip.id,
        amount: numAmountUSD,
        original_currency: currency,
        original_amount: numAmountLocal,
        description,
        category,
        payer_id: payer,
        splits: splitsUSD,
        created_by: initialExpense ? initialExpense.createdBy : user.uid
      };

      if (initialExpense) {
        await supabase
          .from('group_expenses')
          .update(payload)
          .eq('id', initialExpense.id);
      } else {
        await supabase
          .from('group_expenses')
          .insert(payload);
      }
      onAdded();
    } catch (error) {
      console.error('Error saving expense', error);
      alert('Failed to save expense');
    }
  };

  console.log('Current render state:', scannedReceiptData);

  if (scannedReceiptData) {
    const defaultData = {
      items: scannedReceiptData.lineItems?.map((item: any) => ({
        name: item.name || 'Unknown Item',
        price: Number(item.price) || 0
      })) || [],
      subtotal: Number(scannedReceiptData.subtotal) || 0,
      tax: Number(scannedReceiptData.tax) || 0,
      tip: Number(scannedReceiptData.tip) || 0,
      total: Number(scannedReceiptData.total) || 0,
    };

    const tripUsers = trip.members.map(userId => ({
      id: userId,
      name: trip.memberNames[userId] || 'Unknown User'
    }));

    return (
      <div className="animate-in fade-in zoom-in-95 duration-300">
        <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setScannedReceiptData(null)}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 font-medium bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full text-sm"
          >
            <ChevronLeft size={16} /> Discard Receipt
          </button>
        </div>
        <AssignAndSplit
          initialReceiptData={defaultData}
          users={tripUsers}
          groupId={trip.id}
          uploadedBy={user.uid}
          paidBy={payer}
          onSave={() => onAdded()} // This runs after AssignAndSplit saves to firebase successfully
        />
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{initialExpense ? 'Edit Expense' : 'Add Expense'}</h2>
        {!initialExpense && (
          <>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={cameraInputRef}
              onChange={(e) => { setShowCameraOptions(false); handleScanReceipt(e); }}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={galleryInputRef}
              onChange={(e) => { setShowCameraOptions(false); handleScanReceipt(e); }}
            />
            <button
              type="button"
              onClick={() => setShowCameraOptions(true)}
              disabled={isScanning}
              className="flex items-center gap-1.5 sm:gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
            >
              <Camera className="w-4 h-4 sm:w-4 sm:h-4" />
              <span>{isScanning ? 'Scanning...' : 'Scan Receipt'}</span>
            </button>
          </>
        )}
      </div>

      {/* Camera Scan Preview Area */}
      {(isScanning || scanPreview) && (
        <div className="mb-6 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-center gap-4 animate-in fade-in zoom-in-95">
          {scanPreview ? (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-sm">
              <img src={scanPreview} alt="Receipt preview" className="w-full h-full object-cover" />
              {isScanning && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <Camera className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
              {isScanning ? 'Processing Receipt...' : 'Receipt Captured'}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isScanning ? 'Extracting details using AI' : 'Ready to submit'}
            </p>
          </div>
          <button
            onClick={() => {
              if (abortControllerRef.current) abortControllerRef.current.abort();
              setScanPreview(null);
              setIsScanning(false);
            }}
            className="p-2 text-gray-400 hover:text-rose-500 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="space-y-5">
        {/* Amount & Currency */}
        <div className="flex gap-3">
          <div className="w-1/3">
            <select
              className="w-full h-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-3 py-4 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USD">🇺🇸 USD</option>
              <option value="EUR">🇪🇺 EUR</option>
              <option value="GBP">🇬🇧 GBP</option>
              <option value="CAD">🇨🇦 CAD</option>
              <option value="AUD">🇦🇺 AUD</option>
              <option value="JPY">🇯🇵 JPY</option>
            </select>
          </div>
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-gray-500 dark:text-gray-400 text-2xl font-medium">{CURRENCY_SYMBOLS[currency] || '$'}</span>
            </div>
            <input
              type="number"
              placeholder="0.00"
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl pl-10 pr-4 py-4 text-3xl font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {/* Description */}
        <input
          type="text"
          placeholder="What was this for?"
          className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Category */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 hide-scrollbar">
          {[
            { id: 'general', icon: '💸', label: 'General' },
            { id: 'food', icon: '🍔', label: 'Food' },
            { id: 'transport', icon: '🚕', label: 'Transport' },
            { id: 'lodging', icon: '🏨', label: 'Lodging' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex-shrink-0 flex flex-col items-center justify-center gap-2 w-20 h-20 rounded-2xl border transition-all ${category === cat.id
                ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-sm scale-105'
                : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
            >
              <span className="text-2xl drop-shadow-sm">{cat.icon}</span>
              <span className="text-xs font-bold">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Payer */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Who paid?</label>
          <select
            className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
          >
            {trip.members.map(m => (
              <option key={m} value={m}>{trip.memberNames[m]} {m === user.uid && '(You)'}</option>
            ))}
          </select>
        </div>

        {/* Involved Members */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Who is involved?</label>
          <div className="space-y-2">
            {trip.members.map(m => (
              <label key={m} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-indigo-600 dark:bg-gray-800 rounded border-gray-300 dark:border-gray-700 focus:ring-indigo-500"
                  checked={involvedMembers.includes(m)}
                  onChange={() => toggleMemberInvolvement(m)}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
                  {trip.memberNames[m]} {m === user.uid && '(You)'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Split Options */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">How to split?</label>

          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-4">
            <button
              onClick={() => setSplitType('equal')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${splitType === 'equal' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Equally
            </button>
            <button
              onClick={() => setSplitType('exact')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${splitType === 'exact' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Exact
            </button>
            <button
              onClick={() => setSplitType('percent')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${splitType === 'percent' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Percent
            </button>
          </div>

          {splitType === 'equal' && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              Split equally among {involvedMembers.length} people.
              {amount && !isNaN(parseFloat(amount)) && involvedMembers.length > 0 && (
                <span className="block font-medium text-gray-900 dark:text-white mt-1">
                  {CURRENCY_SYMBOLS[currency] || '$'}{(parseFloat(amount) / involvedMembers.length).toFixed(2)} / person
                </span>
              )}
            </p>
          )}

          {splitType === 'exact' && (
            <div className="space-y-2">
              {involvedMembers.map(m => (
                <div key={m} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{trip.memberNames[m]}</span>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1.5 text-gray-500 dark:text-gray-400 text-sm">{CURRENCY_SYMBOLS[currency] || '$'}</span>
                    <input
                      type="number"
                      className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded p-1 pl-5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={exactSplits[m] || ''}
                      onChange={(e) => setExactSplits({ ...exactSplits, [m]: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {splitType === 'percent' && (
            <div className="space-y-2">
              {involvedMembers.map(m => (
                <div key={m} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{trip.memberNames[m]}</span>
                  <div className="relative w-24">
                    <span className="absolute right-2 top-1.5 text-gray-500 dark:text-gray-400 text-sm">%</span>
                    <input
                      type="number"
                      className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded p-1 pr-6 text-right text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={percentSplits[m] || ''}
                      onChange={(e) => setPercentSplits({ ...percentSplits, [m]: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg shadow-[0_8px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_8px_30px_rgba(79,70,229,0.5)] transition-all mt-6 mb-8"
        >
          <Check className="w-5 h-5" /> {initialExpense ? 'Save Changes' : 'Add Expense'}
        </motion.button>
      </div>

      {/* Camera Options Action Sheet */}
      {showCameraOptions && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4 pb-28 sm:pb-4"
          onClick={() => setShowCameraOptions(false)}
        >
          <div
            className="w-full max-w-sm flex flex-col gap-2 animate-in slide-in-from-bottom-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-3 py-4 text-center text-lg font-medium text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Take Photo
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center justify-center gap-3 py-4 text-center text-lg font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Photo Library
              </button>
            </div>
            <button
              onClick={() => setShowCameraOptions(false)}
              className="bg-white dark:bg-zinc-900 rounded-3xl py-4 text-center text-lg font-bold text-gray-900 dark:text-white shadow-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
