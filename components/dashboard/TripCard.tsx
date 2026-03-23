'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Trip, User } from '../../lib/types';

export default function TripCard({ trip, user, onClick }: { trip: Trip, user: User, onClick: () => void }) {
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
