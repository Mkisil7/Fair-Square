'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Palmtree, UserPlus, Plus } from 'lucide-react';
import TripCard from './TripCard';
import { User, Trip } from '../../lib/types';

export default function HomeScreen({ user, onSelectTrip }: { user: User, onSelectTrip: (trip: Trip) => void }) {
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
