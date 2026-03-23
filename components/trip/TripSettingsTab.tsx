'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Plus, LogOut } from 'lucide-react';
import { Trip, User } from '../../lib/types';

export default function TripSettingsTab({ trip, user, onBack, handleShare }: { trip: Trip, user: User, onBack: () => void, handleShare: () => void }) {
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
