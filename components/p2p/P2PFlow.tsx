'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, Users } from 'lucide-react';
import { User } from '../../lib/types';

export default function P2PFlow({ user, onBack }: { user: User, onBack: () => void }) {
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
