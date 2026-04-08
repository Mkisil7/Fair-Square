'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus } from 'lucide-react';

export default function FriendsTab({ trip, user, balances, debts, handleShare, onPay }: any) {
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
