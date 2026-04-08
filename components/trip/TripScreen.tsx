'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Settings2, Check, X, Pencil, Users, Calendar, Wallet, ChevronUp, ChevronDown, Filter, Receipt, Plus } from 'lucide-react';
import { format } from 'date-fns';
import ExpenseFormTab from './ExpenseFormTab';
import FriendsTab from './FriendsTab';
import TripSettingsTab from './TripSettingsTab';
import { User, Trip, Expense } from '../../lib/types';
import { CURRENCY_SYMBOLS } from '../../lib/constants';

type TripTab = 'dashboard' | 'add' | 'edit' | 'friends' | 'settings';

export default function TripScreen({ trip, user, onBack, onPayAction }: { trip: Trip, user: User, onBack: () => void, onPayAction: (friendId: string, amount: number) => void }) {
  const [activeTab, setActiveTab] = useState<TripTab>('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'involved'>('all'); // 'all' or 'involved' (for current user)
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: string, end: string } | null>(null);

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    const fetchExpenses = async () => {
      // Supabase realtime is possible, but we'll stick to simple fetch + polling/updates for now
      const { data, error } = await supabase
        .from('group_expenses')
        .select('*')
        .eq('group_id', trip.id)
        .order('created_at', { ascending: false });

      if (data && isSubscribed) {
        const exps = data.map((e: any) => ({
          id: e.id,
          amount: Number(e.amount),
          originalCurrency: e.original_currency,
          originalAmount: Number(e.original_amount),
          payer: e.payer_id,
          category: e.category,
          description: e.description,
          timestamp: e.created_at,
          splits: e.splits,
          createdBy: e.created_by
        } as Expense));
        setExpenses(exps);
      }
      if (isSubscribed) setIsLoading(false);
    };

    fetchExpenses();
    return () => { isSubscribed = false; };
  }, [trip.id, activeTab]); // also refetch when tab changes back to dashboard

  // Calculate Balances
  // Positive balance means the user is owed money
  // Negative balance means the user owes money
  const balances = useMemo(() => {
    const b: Record<string, number> = {};
    trip.members.forEach((m: string) => b[m] = 0);

    expenses.forEach(exp => {
      // Payer gets positive balance for the amount they paid
      if (b[exp.payer] !== undefined) b[exp.payer] += exp.amount;

      // Everyone involved gets negative balance for their split
      if (exp.splits) {
        Object.entries(exp.splits).forEach(([uid, amount]) => {
          if (b[uid] !== undefined) {
            b[uid] -= Number(amount);
          }
        });
      }
    });

    return b;
  }, [expenses, trip.members]);

  // Simplify Debts Algorithm
  const debts = useMemo(() => {
    const debtors: { id: string, amount: number }[] = [];
    const creditors: { id: string, amount: number }[] = [];

    Object.entries(balances).forEach(([id, balance]) => {
      if (balance < -0.01) debtors.push({ id, amount: Math.abs(balance) });
      else if (balance > 0.01) creditors.push({ id, amount: balance });
    });

    // Sort to optimize matching (largest debtor with largest creditor)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const simplifiedDebts: { from: string, to: string, amount: number }[] = [];
    let i = 0; // debtors index
    let j = 0; // creditors index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(debtor.amount, creditor.amount);

      if (amount > 0.01) {
        simplifiedDebts.push({ from: debtor.id, to: creditor.id, amount });
      }

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return simplifiedDebts;
  }, [balances]);

  const handleDeleteExpense = async (expenseId: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      try {
        await supabase.from('group_expenses').delete().eq('id', expenseId);
        setExpenses(prev => prev.filter(e => e.id !== expenseId));
      } catch (err) {
        console.error("Failed to delete", err);
      }
    }
  };

  const myBalance = balances[user.uid] || 0;
  const totalTripCost = expenses.reduce((sum, e) => sum + e.amount, 0);

  const displayExpenses = useMemo(() => {
    let filtered = expenses.filter(expense => {
      if (filterUser !== 'all' && expense.payer !== filterUser) return false;
      if (filterCategory !== 'all' && expense.category !== filterCategory) return false;
      if (filterStatus === 'involved') {
        // involved if user is payer or in splits
        const hasSplit = expense.splits && expense.splits[user.uid] !== undefined;
        if (expense.payer !== user.uid && !hasSplit) return false;
      }
      if (dateRangeFilter) {
        const expDate = new Date(expense.timestamp);
        const start = new Date(dateRangeFilter.start);
        const end = new Date(dateRangeFilter.end);
        end.setHours(23, 59, 59, 999);
        if (expDate < start || expDate > end) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let valA, valB;
      if (sortField === 'date') {
        valA = new Date(a.timestamp).getTime();
        valB = new Date(b.timestamp).getTime();
      } else {
        valA = a.amount;
        valB = b.amount;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [expenses, filterUser, filterCategory, filterStatus, dateRangeFilter, sortField, sortOrder, user.uid]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(trip.id);
      alert('Group ID copied to clipboard! Send this ID to your friends so they can join.');
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-black relative">
      <header className="bg-white/80 dark:bg-black/80 backdrop-blur-xl px-4 py-3 shadow-sm z-20 sticky top-0 border-b border-gray-200/50 dark:border-gray-800/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => {
              if (activeTab === 'add' || activeTab === 'edit') setActiveTab('dashboard');
              else onBack();
            }} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-indigo-600 bg-gray-100/80 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-900/40 rounded-full cursor-pointer transition-colors shadow-sm">
              <ChevronLeft className="w-5 h-5 -ml-0.5" />
            </button>
            <div className="flex flex-col max-w-[180px] sm:max-w-xs">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight truncate">{trip.name}</h1>
              {activeTab === 'dashboard' && trip.dateRange && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{trip.dateRange}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('friends')} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${activeTab === 'friends' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800'}`}>
              <Users className="w-5 h-5" />
            </button>
            <button onClick={() => setActiveTab('settings')} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${activeTab === 'settings' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800'}`}>
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 sm:p-6 pb-24 space-y-6">

              {/* Status Board */}
              <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
                <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-gradient-to-br from-indigo-50 to-transparent dark:from-indigo-900/20 dark:to-transparent rounded-full blur-2xl pointer-events-none transition-transform group-hover:scale-110" />

                <div className="flex flex-col sm:flex-row gap-6 sm:gap-4 justify-between items-start sm:items-center relative z-10">
                  <div>
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Group Spend</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tighter">${totalTripCost.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto p-4 sm:p-5 bg-gray-50 dark:bg-black rounded-3xl border border-gray-100/80 dark:border-gray-800 flex flex-col items-start sm:items-end justify-center min-w-[140px]">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Your Balance</p>
                    {Math.abs(myBalance) < 0.01 ? (
                      <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Settled Up</span>
                    ) : myBalance > 0 ? (
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">Owed ${myBalance.toFixed(2)}</span>
                    ) : (
                      <span className="text-xl font-black text-rose-600 dark:text-rose-400 tracking-tight">Owe ${Math.abs(myBalance).toFixed(2)}</span>
                    )}
                  </div>
                </div>

                {expenses.length > 0 && debts.length > 0 && Math.abs(myBalance) > 0.01 && (
                  <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
                    <button onClick={() => setActiveTab('friends')} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 px-5 py-2.5 rounded-xl transition-colors w-full sm:w-auto text-center">
                      View How to Settle Up
                    </button>
                  </div>
                )}
              </div>

              {/* Transactions List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-bold text-gray-900 dark:text-white text-xl tracking-tight">Recent Expenses</h3>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showFilters || filterUser !== 'all' || filterCategory !== 'all' || filterStatus !== 'all' || dateRangeFilter || sortField !== 'date' || sortOrder !== 'desc' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300'}`}
                  >
                    <Filter className="w-4 h-4" /> Filters {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4 mb-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sort By</label>
                            <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                              <button onClick={() => setSortField('date')} className={`flex-1 py-1 text-xs font-medium ${sortField === 'date' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-transparent text-gray-600 dark:text-gray-400'}`}>Date</button>
                              <button onClick={() => setSortField('amount')} className={`flex-1 py-1 text-xs font-medium border-l border-gray-200 dark:border-gray-700 ${sortField === 'amount' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-transparent text-gray-600 dark:text-gray-400'}`}>Amount</button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Order</label>
                            <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                              <button onClick={() => setSortOrder('desc')} className={`flex-1 py-1 text-xs font-medium flex items-center justify-center ${sortOrder === 'desc' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-transparent text-gray-600 dark:text-gray-400'}`}><ChevronDown className="w-3 h-3 mr-1" /> Desc</button>
                              <button onClick={() => setSortOrder('asc')} className={`flex-1 py-1 text-xs font-medium flex items-center justify-center border-l border-gray-200 dark:border-gray-700 ${sortOrder === 'asc' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-transparent text-gray-600 dark:text-gray-400'}`}><ChevronUp className="w-3 h-3 mr-1" /> Asc</button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">User</label>
                            <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="w-full text-sm bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg py-1 px-2 focus:outline-none">
                              <option value="all">Everyone</option>
                              {trip.members.map(m => (
                                <option key={m} value={m}>{trip.memberNames[m]}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full text-sm bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg py-1 px-2 focus:outline-none">
                              <option value="all">All Categories</option>
                              <option value="general">General</option>
                              <option value="food">Food</option>
                              <option value="transport">Transport</option>
                              <option value="lodging">Lodging</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                            <div className="flex gap-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={filterStatus === 'all'} onChange={() => setFilterStatus('all')} className="text-indigo-600" />
                                <span className="text-sm dark:text-gray-300">All Expenses</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer ml-4">
                                <input type="radio" checked={filterStatus === 'involved'} onChange={() => setFilterStatus('involved')} className="text-indigo-600" />
                                <span className="text-sm dark:text-gray-300">Involving Me</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button onClick={() => {
                            setSortField('date'); setSortOrder('desc'); setFilterUser('all'); setFilterCategory('all'); setFilterStatus('all'); setDateRangeFilter(null);
                          }} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Reset Filters</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isLoading ? (
                  <p className="text-gray-500 text-sm pl-2">Loading expenses...</p>
                ) : displayExpenses.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center flex flex-col items-center">
                    <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-gray-900 dark:text-white font-bold text-lg mb-1">No expenses found</p>
                    <p className="text-gray-500 text-sm">Add an expense to get started or adjust your filters.</p>
                  </div>
                ) : (
                  displayExpenses.map((expense) => {
                    const amIPayer = expense.payer === user.uid;
                    const mySplitAmount = expense.splits?.[user.uid];
                    const amIInvolved = amIPayer || mySplitAmount !== undefined;

                    return (
                      <div key={expense.id} className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between group hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/0 group-hover:bg-indigo-500 transition-colors" />
                        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                          <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-zinc-800 flex items-center justify-center text-xl shrink-0 border border-gray-100 dark:border-gray-700 shadow-sm">
                            {expense.category === 'food' ? '🍔' : expense.category === 'transport' ? '🚕' : expense.category === 'lodging' ? '🏨' : '💸'}
                          </div>
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-gray-900 dark:text-white text-base sm:text-lg truncate">{expense.description}</p>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                              {amIPayer ? 'You' : trip.memberNames[expense.payer]} paid <span className="font-bold text-gray-700 dark:text-gray-300">${expense.amount.toFixed(2)}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{format(new Date(expense.timestamp), 'MMM d, h:mm a')}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 gap-2">
                          {amIInvolved ? (
                            <div className="flex flex-col items-end">
                              {amIPayer ? (
                                <>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">You lens</span>
                                  <span className="font-black text-gray-900 dark:text-white text-lg">
                                    ${(expense.amount - (mySplitAmount || 0)).toFixed(2)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">You borrow</span>
                                  <span className="font-black text-gray-900 dark:text-white text-lg">
                                    ${Number(mySplitAmount).toFixed(2)}
                                  </span>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full uppercase tracking-wider">Not involved</span>
                          )}

                          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingExpense(expense); setActiveTab('edit'); }}
                              className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center text-gray-500 transition-colors border border-gray-200 dark:border-gray-700"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/10 dark:hover:bg-rose-900/30 flex items-center justify-center text-rose-500 transition-colors border border-rose-100 dark:border-rose-900/50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'add' && (
            <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ExpenseFormTab trip={trip} user={user} onAdded={() => setActiveTab('dashboard')} />
            </motion.div>
          )}

          {activeTab === 'edit' && editingExpense && (
            <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ExpenseFormTab trip={trip} user={user} initialExpense={editingExpense} onAdded={() => { setActiveTab('dashboard'); setEditingExpense(undefined); }} />
            </motion.div>
          )}

          {activeTab === 'friends' && (
            <motion.div key="friends" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <FriendsTab trip={trip} user={user} balances={balances} debts={debts} handleShare={handleShare} onPay={(debt: any) => onPayAction(debt.to, debt.amount)} />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <TripSettingsTab trip={trip} user={user} onBack={() => onBack()} handleShare={handleShare} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {activeTab === 'dashboard' && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-auto z-20 px-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('add')}
            className="w-full max-w-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-center gap-2 py-4 rounded-full shadow-[0_8px_30px_rgba(79,70,229,0.3)] dark:shadow-[0_8px_30px_rgba(79,70,229,0.2)] hover:shadow-[0_8px_30px_rgba(79,70,229,0.5)] transition-all relative overflow-hidden group border border-white/10"
          >
            <div className="absolute inset-0 bg-white/20 hover:bg-transparent transition-colors" />
            <Plus className="w-6 h-6 relative z-10" />
            <span className="font-bold text-lg relative z-10">Add Expense</span>
          </motion.button>
        </div>
      )}
    </div>
  );
}
