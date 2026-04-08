'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, UserCircle, ChevronRight, Users, Palmtree } from 'lucide-react';
import { User, Trip } from '../../lib/types';

export default function GlobalExpenseHub({ user, onClose, onSelectGroup, onSelectP2P }: { user: User, onClose: () => void, onSelectGroup: (trip: Trip) => void, onSelectP2P: () => void }) {
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
