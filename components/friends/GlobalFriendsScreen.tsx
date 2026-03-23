'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Plus } from 'lucide-react';
import { User } from '../../lib/types';

export default function GlobalFriendsScreen({ user, onSelectP2P }: { user: User, onSelectP2P: () => void }) {
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
