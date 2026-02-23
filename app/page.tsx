'use client';

import { useState, useEffect } from 'react';
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
  orderBy
} from 'firebase/firestore';
import {
  Wallet,
  Users,
  PlusCircle,
  LogOut,
  Share2,
  ChevronLeft,
  Plus,
  Receipt,
  UserPlus,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { format } from 'date-fns';

// --- Types ---
type Trip = {
  id: string;
  name: string;
  createdBy: string;
  members: string[]; // Array of user IDs or emails
  memberNames: Record<string, string>; // Map of userId to name
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

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'home' | 'trip'>('home');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      {currentView === 'home' ? (
        <HomeScreen
          user={user}
          onSelectTrip={(trip) => {
            setSelectedTrip(trip);
            setCurrentView('trip');
          }}
        />
      ) : (
        selectedTrip && (
          <TripScreen
            user={user}
            trip={selectedTrip}
            onBack={() => {
              setSelectedTrip(null);
              setCurrentView('home');
            }}
          />
        )
      )}
    </div>
  );
}

// --- Login Screen ---
function LoginScreen() {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
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
      <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">Fair & Square</h1>
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
    <div className="flex flex-col h-full bg-gray-50">
      <header className="bg-white px-6 py-6 pt-12 shadow-sm z-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
          <p className="text-sm text-gray-500">Welcome back, {user.displayName?.split(' ')[0]}</p>
        </div>
        <button onClick={() => signOut(auth)} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {trips.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No trips yet</h3>
            <p className="text-gray-500 mb-6">Create a new trip or join an existing one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => (
              <button
                key={trip.id}
                onClick={() => onSelectTrip(trip)}
                className="w-full bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow flex items-center justify-between group"
              >
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">{trip.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Users className="w-4 h-4" /> {trip.members.length} members
                  </p>
                </div>
                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ChevronLeft className="w-5 h-5 rotate-180" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 bg-white border-t border-gray-100 flex gap-3">
        <button
          onClick={() => setShowJoin(true)}
          className="flex-1 bg-gray-100 text-gray-900 py-4 rounded-xl font-medium flex items-center justify-center gap-2"
        >
          <UserPlus className="w-5 h-5" /> Join
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
        >
          <Plus className="w-5 h-5" /> Create
        </button>
      </div>

      {/* Modals */}
      {showCreate && (
        <div className="absolute inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <h2 className="text-xl font-bold mb-4">Create New Trip</h2>
            <input
              type="text"
              placeholder="Trip Name (e.g. Bali 2024)"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newTripName}
              onChange={(e) => setNewTripName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 font-medium text-gray-500 bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleCreateTrip} className="flex-1 py-3 font-medium text-white bg-indigo-600 rounded-xl">Create</button>
            </div>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="absolute inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <h2 className="text-xl font-bold mb-4">Join a Trip</h2>
            <input
              type="text"
              placeholder="Paste Trip ID here"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              value={joinTripId}
              onChange={(e) => setJoinTripId(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowJoin(false)} className="flex-1 py-3 font-medium text-gray-500 bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleJoinTrip} className="flex-1 py-3 font-medium text-white bg-indigo-600 rounded-xl">Join</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Trip Screen ---
function TripScreen({ user, trip, onBack }: { user: User, trip: Trip, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'edit' | 'friends'>('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(trip.name);

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

  // Calculate peer-to-peer debts
  const calculateDebts = () => {
    const debtors: { id: string, amount: number }[] = [];
    const creditors: { id: string, amount: number }[] = [];

    // Separate into those who owe and those who are owed
    Object.entries(balances).forEach(([id, balance]) => {
      // Balance is positive if they are owed money, negative if they owe money
      if (balance > 0.01) creditors.push({ id, amount: balance });
      else if (balance < -0.01) debtors.push({ id, amount: Math.abs(balance) });
    });

    // Sort by amount for slightly better matching (largest to largest)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const debts: { from: string; to: string; amount: number }[] = [];
    let d = 0;
    let c = 0;

    // Greedy matching algorithm
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

  const handleShare = async () => {
    const shareData = {
      title: `Join my trip: ${trip.name}`,
      text: `Join my trip "${trip.name}" on Fair & Square! Use this Trip ID: ${trip.id}`,
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing', err);
      }
    } else {
      navigator.clipboard.writeText(trip.id);
      alert('Trip ID copied to clipboard!');
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
    <div className="flex flex-col h-full bg-gray-50">
      <header className="bg-white px-4 py-4 pt-10 shadow-sm z-10 flex items-center justify-between sticky top-0 min-h-[5rem]">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full flex-shrink-0">
          <ChevronLeft className="w-6 h-6" />
        </button>

        {isEditingName ? (
          <div className="flex-1 flex items-center px-2">
            <input
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              className="w-full font-bold text-gray-900 border-b-2 border-indigo-500 focus:outline-none bg-transparent px-1 py-1"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveUpdatedName()}
            />
            <button onClick={saveUpdatedName} className="p-1 ml-1 text-emerald-600 hover:bg-emerald-50 rounded">
              <Check className="w-5 h-5" />
            </button>
            <button onClick={() => { setIsEditingName(false); setEditNameValue(trip.name); }} className="p-1 text-gray-400 hover:bg-gray-50 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center truncate px-2 group cursor-pointer" onClick={() => setIsEditingName(true)}>
            <h1 className="text-lg font-bold text-gray-900 truncate">{trip.name}</h1>
            <Pencil className="w-3.5 h-3.5 text-gray-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        )}

        <button onClick={handleShare} className="p-2 -mr-2 text-indigo-600 hover:bg-indigo-50 rounded-full flex-shrink-0">
          <Share2 className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'dashboard' && (
          <div className="p-6 space-y-6">
            {/* Balance Card */}
            <div className={`p-6 rounded-3xl text-white shadow-lg ${myBalance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
              <p className="text-white/80 text-sm font-medium mb-1">Your Balance</p>
              <h2 className="text-4xl font-bold tracking-tight">
                {myBalance >= 0 ? '+' : '-'}${Math.abs(myBalance).toFixed(2)}
              </h2>
              <p className="text-white/90 text-sm mt-2">
                {myBalance > 0 ? 'You are owed' : myBalance < 0 ? 'You owe' : 'You are settled up'}
              </p>
            </div>

            {/* Recent Expenses */}
            <div>
              <h3 className="font-bold text-gray-900 mb-4 text-lg">Recent Expenses</h3>
              {expenses.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
                  <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No expenses yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.map(exp => (
                    <div key={exp.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">
                          {exp.category === 'food' ? '🍔' : exp.category === 'transport' ? '🚕' : exp.category === 'lodging' ? '🏨' : '💸'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{exp.description}</p>
                          <p className="text-xs text-gray-500">
                            {trip.memberNames[exp.payer]} paid • {exp.timestamp ? format(exp.timestamp.toDate(), 'MMM d') : 'Just now'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-gray-900">
                          {exp.originalCurrency && exp.originalCurrency !== 'USD' ? (
                            <span className="text-xs text-gray-400 mr-1 font-normal" title={`$${exp.amount.toFixed(2)} USD`}>
                              {CURRENCY_SYMBOLS[exp.originalCurrency]}{exp.originalAmount?.toFixed(2)}
                            </span>
                          ) : null}
                          ${exp.amount.toFixed(2)}
                        </p>
                        {exp.splits[user.uid] > 0 && exp.payer !== user.uid && (
                          <p className="text-xs text-rose-500 font-medium">You owe ${exp.splits[user.uid].toFixed(2)}</p>
                        )}
                      </div>
                      {(exp.createdBy === user.uid || (!exp.createdBy && exp.payer === user.uid)) && (
                        <div className="pl-4 ml-4 border-l border-gray-100 flex items-center">
                          <button
                            onClick={() => {
                              setEditingExpense(exp);
                              setActiveTab('edit');
                            }}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
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
            onAdded={() => setActiveTab('dashboard')}
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
            }}
          />
        )}

        {activeTab === 'friends' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-900 text-lg">Trip Members</h3>
              <button onClick={handleShare} className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full flex items-center gap-1">
                <Plus className="w-4 h-4" /> Invite
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {trip.members.map((memberId, idx) => (
                <div key={memberId} className={`p-4 flex items-center justify-between ${idx !== trip.members.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {trip.memberNames[memberId]?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {trip.memberNames[memberId]} {memberId === user.uid && '(You)'}
                      </p>
                      <p className={`text-sm font-medium ${balances[memberId] > 0 ? 'text-emerald-500' : balances[memberId] < 0 ? 'text-rose-500' : 'text-gray-400'}`}>
                        {balances[memberId] > 0 ? `Gets back $${balances[memberId].toFixed(2)}` : balances[memberId] < 0 ? `Owes $${Math.abs(balances[memberId]).toFixed(2)}` : 'Settled up'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 bg-gray-100 p-4 rounded-xl">
              <p className="text-xs text-gray-500 text-center uppercase tracking-wider font-semibold mb-2">Trip ID</p>
              <div className="flex items-center justify-center gap-2">
                <code className="font-mono text-sm bg-white px-3 py-1.5 rounded border border-gray-200">{trip.id}</code>
                <button onClick={() => { navigator.clipboard.writeText(trip.id); alert('Copied!'); }} className="text-indigo-600 text-sm font-medium">Copy</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-100 px-6 py-4 flex justify-between items-center absolute bottom-0 w-full pb-6">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Wallet className="w-6 h-6" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Dashboard</span>
        </button>

        <button
          onClick={() => {
            setEditingExpense(null);
            setActiveTab('add');
          }}
          className="flex-1 flex justify-center -mt-8"
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform ${activeTab === 'add' || activeTab === 'edit' ? 'bg-indigo-700 scale-110' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            <PlusCircle className="w-8 h-8 text-white" />
          </div>
        </button>

        <button
          onClick={() => setActiveTab('friends')}
          className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'friends' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Friends</span>
        </button>
      </nav>
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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{initialExpense ? 'Edit Expense' : 'Add Expense'}</h2>

      <div className="space-y-5">
        {/* Amount & Currency */}
        <div className="flex gap-3">
          <div className="w-1/3">
            <select
              className="w-full h-full bg-white border border-gray-200 rounded-2xl px-3 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none"
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
              <span className="text-gray-500 text-2xl font-medium">{CURRENCY_SYMBOLS[currency] || '$'}</span>
            </div>
            <input
              type="number"
              placeholder="0.00"
              className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-4 text-3xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {/* Description */}
        <input
          type="text"
          placeholder="What was this for?"
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
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
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-gray-200 text-gray-600'
                }`}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>

        {/* Payer */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Who paid?</label>
          <select
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
          >
            {trip.members.map(m => (
              <option key={m} value={m}>{trip.memberNames[m]} {m === user.uid && '(You)'}</option>
            ))}
          </select>
        </div>

        {/* Involved Members */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Who is involved?</label>
          <div className="space-y-2">
            {trip.members.map(m => (
              <label key={m} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  checked={involvedMembers.includes(m)}
                  onChange={() => toggleMemberInvolvement(m)}
                />
                <span className="text-sm font-medium text-gray-700 select-none">
                  {trip.memberNames[m]} {m === user.uid && '(You)'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Split Options */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">How to split?</label>

          <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
            <button
              onClick={() => setSplitType('equal')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${splitType === 'equal' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Equally
            </button>
            <button
              onClick={() => setSplitType('exact')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${splitType === 'exact' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Exact
            </button>
            <button
              onClick={() => setSplitType('percent')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${splitType === 'percent' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Percent
            </button>
          </div>

          {splitType === 'equal' && (
            <p className="text-sm text-gray-500 text-center py-2">
              Split equally among {involvedMembers.length} people.
              {amount && !isNaN(parseFloat(amount)) && involvedMembers.length > 0 && (
                <span className="block font-medium text-gray-900 mt-1">
                  {CURRENCY_SYMBOLS[currency] || '$'}{(parseFloat(amount) / involvedMembers.length).toFixed(2)} / person
                </span>
              )}
            </p>
          )}

          {splitType === 'exact' && (
            <div className="space-y-2">
              {involvedMembers.map(m => (
                <div key={m} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{trip.memberNames[m]}</span>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1.5 text-gray-500 text-sm">{CURRENCY_SYMBOLS[currency] || '$'}</span>
                    <input
                      type="number"
                      className="w-full bg-gray-50 border border-gray-200 rounded p-1 pl-5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  <span className="text-sm font-medium text-gray-700">{trip.memberNames[m]}</span>
                  <div className="relative w-24">
                    <span className="absolute right-2 top-1.5 text-gray-500 text-sm">%</span>
                    <input
                      type="number"
                      className="w-full bg-gray-50 border border-gray-200 rounded p-1 pr-6 text-right text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
