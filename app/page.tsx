'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from '../lib/firebase';
import { signInWithPopup, onAuthStateChanged, User, signOut } from 'firebase/auth';
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
  Camera
} from 'lucide-react';
import { format } from 'date-fns';
import imageCompression from 'browser-image-compression';
import AssignAndSplit, { InitialReceiptData } from '../components/AssignAndSplit';

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
  <div className="flex items-center justify-center gap-1.5 py-3 w-full bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/50 z-40 sticky top-0 mt-safe-pt">
    <span className="font-extrabold tracking-tight text-gray-900 dark:text-white text-lg">Fair</span>
    <div className="w-5 h-5 border-[2.5px] border-indigo-600 dark:border-indigo-400 rounded flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-[10px] leading-none mb-0.5">
      &amp;
    </div>
    <span className="font-extrabold tracking-tight text-gray-900 dark:text-white text-lg">Square</span>
  </div>
);

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Global Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'friends' | 'settings'>('dashboard');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark';
    setIsDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('read', '==', false)
      // Note: Ordering requires a composite index, so we sort client-side to avoid index requirement for now
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      notifs.sort((a: any, b: any) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, [user]);

  const markNotificationRead = async (id: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', id), { read: true });
    } catch (e) {
      console.error(e);
    }
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
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
      // Global friends list not implemented yet, just show home
      return <HomeScreen user={user} onSelectTrip={(trip) => setSelectedTrip(trip)} />;
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

      {/* Global Bottom Navigation */}
      <nav className="shrink-0 mt-auto bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-gray-800 px-6 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)] flex justify-between items-center w-full z-50">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'dashboard' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <Wallet className="w-6 h-6" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Dashboard</span>
        </button>

        <button
          onClick={() => {
            // When user clicks add, set active tab to add.
            // If they are on home, we could trigger a "new trip" modal, but for now we'll just switch the tab.
            setActiveTab('add');
          }}
          className="flex-1 flex justify-center -mt-8"
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform ${activeTab === 'add' ? 'bg-indigo-700 dark:bg-indigo-500 scale-110' : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400'}`}>
            <PlusCircle className="w-8 h-8 text-white" />
          </div>
        </button>

        <button
          onClick={() => setActiveTab('friends')}
          className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'friends' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Friends</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'settings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Settings</span>
        </button>
      </nav>
    </div>
  );
}

// --- Login Screen ---
function LoginScreen() {
  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastSeen: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error signing in', error);
      alert('Failed to sign in. Please check your Firebase configuration.');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-lg transform rotate-12">
        <Wallet className="w-10 h-10 text-white -rotate-12" />
      </div>
      <div className="flex items-center justify-center gap-2 mb-2">
        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tighter">Fair</h1>
        <div className="w-12 h-12 border-[5px] border-indigo-600 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-3xl leading-none mb-1">
          &amp;
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tighter">Square</h1>
      </div>
      <p className="text-gray-500 mb-12 text-center text-lg">Split trip expenses with friends, seamlessly.</p>

      <button
        onClick={handleLogin}
        className="w-full max-w-sm bg-gray-900 text-white py-4 px-6 rounded-2xl font-semibold text-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-3 shadow-md"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>
    </div>
  );
}

// --- Trip Card Component ---
function TripCard({ trip, user, onClick }: { trip: Trip, user: User, onClick: () => void }) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    // We only need a lightweight listener on expenses to calculate the user's balance
    const q = query(collection(db, 'trips', trip.id, 'expenses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let myBalance = 0;
      snapshot.forEach((doc) => {
        const exp = doc.data() as Expense;
        // If user paid, they are owed money (+ balance)
        if (exp.payer === user.uid) {
          myBalance += exp.amount;
        }
        // If user is part of the split, they owe money (- balance)
        if (exp.splits && exp.splits[user.uid] !== undefined) {
          myBalance -= exp.splits[user.uid];
        }
      });
      setBalance(myBalance);
    });

    return () => unsubscribe();
  }, [trip.id, user.uid]);

  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-left hover:shadow-md transition-shadow flex flex-col gap-3 group"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">{trip.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Users className="w-4 h-4" /> {trip.members.length} members
          </p>
        </div>
        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex flex-shrink-0 items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>

      {balance !== null && (
        <div className={`mt-2 inline-flex py-1 px-3 rounded-full text-xs font-bold uppercase tracking-wide ${balance > 0.01 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
          balance < -0.01 ? 'bg-rose-50 text-rose-600 border border-rose-100' :
            'bg-gray-100 text-gray-500'
          }`}>
          {balance > 0.01 ? `You're owed $${balance.toFixed(2)}` :
            balance < -0.01 ? `You owe $${Math.abs(balance).toFixed(2)}` :
              'Settled up'}
        </div>
      )}
    </button>
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
    const q = query(
      collection(db, 'trips'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripsData: Trip[] = [];
      snapshot.forEach((doc) => {
        tripsData.push({ id: doc.id, ...doc.data() } as Trip);
      });
      // Sort client-side to avoid needing a composite index initially
      tripsData.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setTrips(tripsData);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleCreateTrip = async () => {
    if (!newTripName.trim()) return;
    try {
      await addDoc(collection(db, 'trips'), {
        name: newTripName,
        createdBy: user.uid,
        members: [user.uid],
        memberNames: {
          [user.uid]: user.displayName || 'Unknown'
        },
        createdAt: serverTimestamp(),
      });
      setNewTripName('');
      setShowCreate(false);
    } catch (error) {
      console.error('Error creating trip', error);
      alert('Failed to create trip.');
    }
  };

  const handleJoinTrip = async () => {
    if (!joinTripId.trim()) return;
    try {
      const tripRef = doc(db, 'trips', joinTripId.trim());
      const tripSnap = await getDoc(tripRef);

      if (tripSnap.exists()) {
        await updateDoc(tripRef, {
          members: arrayUnion(user.uid),
          [`memberNames.${user.uid}`]: user.displayName || 'Unknown'
        });
        setJoinTripId('');
        setShowJoin(false);
      } else {
        alert('Trip not found. Please check the ID.');
      }
    } catch (error) {
      console.error('Error joining trip', error);
      alert('Failed to join trip.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-black">
      <header className="bg-white dark:bg-zinc-900 px-6 py-4 pt-[max(env(safe-area-inset-top),2.5rem)] shadow-sm z-10 flex justify-between items-center transition-colors">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Trips</h1>
        </div>
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-indigo-100 dark:border-indigo-900 object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold border-2 border-indigo-200 dark:border-indigo-800">
              {user.displayName?.charAt(0) || '?'}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {trips.length === 0 ? (
          <div className="text-center py-12 px-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="w-48 h-48 mx-auto mb-6 opacity-90 transition-transform hover:scale-105 duration-300">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
                <circle cx="50" cy="50" r="45" fill="#f3f4f6" />
                <path d="M20,60 Q35,40 50,60 T80,50 L80,95 L20,95 Z" fill="#d1d5db" />
                <path d="M30,55 Q45,35 60,55 T90,45 L90,95 L30,95 Z" fill="#9ca3af" />
                <circle cx="70" cy="25" r="8" fill="#fbbf24" />
                <path d="M15,25 Q20,20 25,25 T35,25" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                <path d="M40,15 Q45,10 50,15 T60,15" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">You haven't planned any trips yet!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto text-sm">
              Whether it's a weekend getaway or a cross-country road trip, Fair & Square makes it easy to split the costs.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} user={user} onClick={() => onSelectTrip(trip)} />
            ))}
          </div>
        )}
      </div>

      <div className="p-6 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-gray-800 flex gap-3 transition-colors">
        <button
          onClick={() => setShowJoin(true)}
          className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <UserPlus className="w-5 h-5" /> Join
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2 shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" /> Create
        </button>
      </div>

      {/* Modals */}
      {showCreate && (
        <div className="absolute inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Create New Trip</h2>
            <input
              type="text"
              placeholder="Trip Name (e.g. Bali 2024)"
              className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newTripName}
              onChange={(e) => setNewTripName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleCreateTrip} className="flex-1 py-3 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="absolute inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Join a Trip</h2>
            <input
              type="text"
              placeholder="Paste Trip ID here"
              className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-xl px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              value={joinTripId}
              onChange={(e) => setJoinTripId(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowJoin(false)} className="flex-1 py-3 font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleJoinTrip} className="flex-1 py-3 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors">Join</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TripSettingsTab({ trip, user, onBack, handleShare }: any) {
  const [dateRangeValue, setDateRangeValue] = useState(trip.dateRange || '');
  const [isSavingDates, setIsSavingDates] = useState(false);

  const handleSaveDates = async () => {
    setIsSavingDates(true);
    try {
      await updateDoc(doc(db, 'trips', trip.id), {
        dateRange: dateRangeValue.trim()
      });
    } catch (err) {
      console.error("Failed to save date range", err);
      alert("Failed to update trip dates.");
    } finally {
      setIsSavingDates(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (trip.createdBy === user.uid) {
      alert("As the creator, you cannot leave the trip. You must delete it instead.");
      return;
    }
    if (confirm("Are you sure you want to leave this trip? You will no longer see its expenses.")) {
      try {
        const newMembers = trip.members.filter((id: string) => id !== user.uid);
        const newMemberNames = { ...trip.memberNames };
        delete newMemberNames[user.uid];
        await updateDoc(doc(db, 'trips', trip.id), {
          members: newMembers,
          memberNames: newMemberNames
        });
        onBack();
      } catch (err) {
        console.error("Error leaving group:", err);
        alert("Failed to leave group.");
      }
    }
  };

  return (
    <div className="p-6">
      <h3 className="font-bold text-gray-900 dark:text-white mb-6 text-xl">Trip Settings</h3>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-50 dark:border-gray-800">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Trip Dates</label>
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
                <p className="text-xs text-rose-500/80 dark:text-rose-400/80">Remove yourself from this trip</p>
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

  // Settle Up State
  const [settleUpDebt, setSettleUpDebt] = useState<any | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');

  // Sync internal tab if parent tab changes
  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  // Listen to expenses for this trip
  useEffect(() => {
    const q = query(
      collection(db, 'trips', trip.id, 'expenses'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exps: Expense[] = [];
      snapshot.forEach((doc) => {
        exps.push({ id: doc.id, ...doc.data() } as Expense);
      });
      setExpenses(exps);
    });

    return () => unsubscribe();
  }, [trip.id]);

  const executeSettleUp = async () => {
    if (!settleUpDebt || !settleAmount) return;

    const amountVal = parseFloat(settleAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (amountVal > settleUpDebt.amount) {
      alert("You cannot pay more than you owe.");
      return;
    }

    const payeeId = settleUpDebt.to;

    // 1. Record the Settlement Expense
    const expensePayload = {
      amount: amountVal,
      originalCurrency: 'USD',
      originalAmount: amountVal,
      description: 'Settlement Payment',
      category: 'settlement',
      payer: user.uid,
      splits: { [payeeId]: amountVal },
      timestamp: serverTimestamp(),
      createdBy: user.uid
    };

    try {
      await addDoc(collection(db, 'trips', trip.id, 'expenses'), expensePayload);

      // 2. Generate Notification for Payee
      const remainingBalance = settleUpDebt.amount - amountVal;
      let message = "";
      if (remainingBalance <= 0.01) {
        message = `${user.displayName || 'Someone'} has fully settled their balance with you! 💸🎉`;
      } else {
        message = `${user.displayName || 'Someone'} sent you $${amountVal.toFixed(2)}. They still owe you $${remainingBalance.toFixed(2)}.`;
      }

      await addDoc(collection(db, 'users', payeeId, 'notifications'), {
        type: 'settlement',
        tripId: trip.id,
        payerId: user.uid,
        payerName: user.displayName || 'Someone',
        amount: amountVal,
        remainingBalance: remainingBalance,
        message: message,
        timestamp: serverTimestamp(),
        read: false
      });

      setSettleUpDebt(null);
      setSettleAmount('');
      // Note: The global snapshot listener for expenses will automatically refresh the balances!
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

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Join my trip: ${trip.name}`,
        text: 'Join my trip on Fair Square to split expenses!',
        url: `${window.location.origin}?join=${trip.id}`
      });
    } else {
      navigator.clipboard.writeText(trip.id);
      alert('Trip ID copied to clipboard!');
    }
  };

  const saveUpdatedNotes = async () => {
    try {
      await updateDoc(doc(db, 'trips', trip.id), {
        notes: notesValue.trim()
      });
      setIsEditingNotes(false);
    } catch (err) {
      console.error('Failed to update notes', err);
      alert('Failed to update trip notes');
    }
  };

  const saveUpdatedName = async () => {
    if (!editNameValue.trim() || editNameValue === trip.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await updateDoc(doc(db, 'trips', trip.id), {
        name: editNameValue.trim()
      });
      // The parent component listens to snapshot so it will update automatically, or we just optimistically close
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name', err);
      alert('Failed to update trip name');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-black">
      <header className="bg-white dark:bg-zinc-900 px-6 py-4 pt-[max(env(safe-area-inset-top),2.5rem)] shadow-sm z-10 sticky top-0 transition-colors">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full cursor-pointer transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab('settings')} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full cursor-pointer transition-colors">
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          {isEditingName ? (
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                autoFocus
                className="text-3xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-indigo-500 focus:outline-none w-full"
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
              <button onClick={saveUpdatedName} className="p-1.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-400 rounded-full"><Check className="w-5 h-5" /></button>
              <button onClick={() => { setEditNameValue(trip.name); setIsEditingName(false); }} className="p-1.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full"><X className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingName(true)}>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{trip.name}</h1>
              <Pencil className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 transition-colors" />
            </div>
          )}
        </div>

        <div className="flex gap-2 flew-wrap overflow-x-auto no-scrollbar pb-2 -mb-2">
          {/* Members Pill Badge */}
          <div className="flex items-center gap-1.5 bg-gray-100/50 dark:bg-zinc-800/50 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-200/50 dark:hover:bg-zinc-700/50 transition-colors whitespace-nowrap" onClick={() => setActiveTab('friends')}>
            <Users className="w-3.5 h-3.5" />
            <span>{trip.members.length} member{trip.members.length !== 1 ? 's' : ''}</span>
          </div>
          {/* Date Range Pill */}
          {trip.dateRange && (
            <div className="flex items-center gap-1.5 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border border-indigo-100/50 dark:border-indigo-800/50 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5" />
              <span>{trip.dateRange}</span>
            </div>
          )}
          {/* Active Status Pill */}
          <div className="flex items-center gap-1.5 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border border-emerald-100/50 dark:border-emerald-800/50 whitespace-nowrap">
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
                    <div className="p-6 rounded-3xl text-white shadow-lg bg-indigo-500">
                      <p className="text-white/80 text-sm font-medium mb-1">Your Balance</p>
                      <h2 className="text-4xl font-bold tracking-tight mb-2">
                        $0.00
                      </h2>
                      <p className="text-white/100 text-sm font-semibold">
                        🎉 You are all settled up.
                      </p>
                    </div>
                  );
                }

                return myDebts.map((debt, idx) => {
                  const iOwe = debt.from === user.uid;
                  const otherPersonId = iOwe ? debt.to : debt.from;
                  const otherPersonName = trip.memberNames[otherPersonId] || 'Unknown';

                  return (
                    <div key={idx} className={`p-6 rounded-3xl text-white shadow-md ${iOwe ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                      <h2 className="text-3xl font-bold tracking-tight mb-1">
                        ${debt.amount.toFixed(2)}
                      </h2>
                      <p className="text-white/100 text-base font-semibold mb-4">
                        {iOwe ? `You owe ${otherPersonName}` : `${otherPersonName} owes you`}
                      </p>
                      {iOwe && (
                        <button
                          onClick={() => { setSettleUpDebt(debt); setSettleAmount(debt.amount.toFixed(2)); }}
                          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
                        >
                          Mark as Paid
                        </button>
                      )}
                    </div>
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

            {/* Recent Expenses */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-lg">Recent Expenses</h3>
              {expenses.length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <Receipt className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No expenses yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.map(exp => (
                    <div key={exp.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-xl">
                          {exp.category === 'food' ? '🍔' : exp.category === 'transport' ? '🚕' : exp.category === 'lodging' ? '🏨' : '💸'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{exp.description}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {trip.memberNames[exp.payer]} paid • {exp.timestamp ? format(exp.timestamp.toDate(), 'MMM d') : 'Just now'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-gray-900 dark:text-white">
                          {exp.originalCurrency && exp.originalCurrency !== 'USD' ? (
                            <span className="text-xs text-gray-400 mr-1 font-normal" title={`$${exp.amount.toFixed(2)} USD`}>
                              {CURRENCY_SYMBOLS[exp.originalCurrency]}{exp.originalAmount?.toFixed(2)}
                            </span>
                          ) : null}
                          ${exp.amount.toFixed(2)}
                        </p>
                        {exp.splits[user.uid] > 0 && exp.payer !== user.uid && (
                          exp.category === 'settlement' ? (
                            <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">You received ${exp.splits[user.uid].toFixed(2)}</p>
                          ) : myBalance < -0.01 ? (
                            <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">You owe ${exp.splits[user.uid].toFixed(2)}</p>
                          ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Your share ${exp.splits[user.uid].toFixed(2)}</p>
                          )
                        )}
                      </div>
                      {(exp.createdBy === user.uid || (!exp.createdBy && exp.payer === user.uid)) && (
                        <div className="pl-4 ml-4 border-l border-gray-100 dark:border-gray-800 flex items-center">
                          <button
                            onClick={() => {
                              setEditingExpense(exp);
                              setActiveTab('edit');
                            }}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
        )}

        {activeTab === 'settings' && (
          <TripSettingsTab trip={trip} user={user} onBack={() => setActiveTab('dashboard')} handleShare={handleShare} />
        )}
      </div>

      {/* Settle Up Modal */}
      {settleUpDebt && (
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
      )}
    </div>
  );
}

function FriendsTab({ trip, user, balances, debts, handleShare, onPay }: any) {
  const [profiles, setProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    async function loadProfiles() {
      try {
        const fetchPromises = trip.members.map((id: string) => getDoc(doc(db, 'users', id)));
        const snapDocs = await Promise.all(fetchPromises);
        const newProfiles: Record<string, any> = {};
        snapDocs.forEach(d => {
          if (d.exists()) newProfiles[d.id] = d.data();
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
      <header className="bg-white dark:bg-zinc-900 px-6 py-4 pt-[max(env(safe-area-inset-top),2.5rem)] shadow-sm z-10 transition-colors">
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
            <button onClick={() => signOut(auth)} className="w-full text-left px-4 py-3 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl font-medium flex items-center gap-3 transition-colors">
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

  // Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scannedReceiptData, setScannedReceiptData] = useState<InitialReceiptData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // 3. Send to API Endpoint
      const response = await fetch('/api/process-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64data,
          mimeType: compressedFile.type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to process receipt');
      }

      const extractedData = await response.json();
      console.log('Parsed receipt data:', extractedData);

      setScannedReceiptData(extractedData);

    } catch (error) {
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
        amount: numAmountUSD,
        originalCurrency: currency,
        originalAmount: numAmountLocal,
        description,
        category,
        payer,
        splits: splitsUSD,
        timestamp: initialExpense ? initialExpense.timestamp : serverTimestamp(),
        createdBy: initialExpense ? initialExpense.createdBy : user.uid
      };

      if (initialExpense) {
        await updateDoc(doc(db, 'trips', trip.id, 'expenses', initialExpense.id), payload);
      } else {
        await addDoc(collection(db, 'trips', trip.id, 'expenses'), payload);
      }
      onAdded();
    } catch (error) {
      console.error('Error saving expense', error);
      alert('Failed to save expense');
    }
  };

  return (
    <div className="p-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{initialExpense ? 'Edit Expense' : 'Add Expense'}</h2>
        {!initialExpense && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={fileInputRef}
              onChange={handleScanReceipt}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="flex items-center gap-1.5 sm:gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Camera className="w-4 h-4 sm:w-4 sm:h-4" />
              <span>{isScanning ? 'Processing...' : 'Scan Receipt'}</span>
            </button>
          </div>
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
          {!isScanning && (
            <button
              onClick={() => setScanPreview(null)}
              className="p-2 text-gray-400 hover:text-rose-500 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
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
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 hide-scrollbar">
          {[
            { id: 'general', icon: '💸', label: 'General' },
            { id: 'food', icon: '🍔', label: 'Food' },
            { id: 'transport', icon: '🚕', label: 'Transport' },
            { id: 'lodging', icon: '🏨', label: 'Lodging' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${category === cat.id
                ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400'
                : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                }`}
            >
              <span>{cat.icon}</span> {cat.label}
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

        <button
          onClick={handleSave}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors mt-4"
        >
          Save Expense
        </button>
      </div>
    </div>
  );
}
