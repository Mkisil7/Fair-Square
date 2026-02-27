import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Receipt, CreditCard, ArrowRight, User as UserIcon, CheckCircle2 } from 'lucide-react';
import { cn } from './AssignAndSplit'; // Reusing utility
import { format } from 'date-fns';

export interface GroupLedgerProps {
    groupId: string;
    currentUserId: string;
    // Passing user list to map IDs to names. In a real app, this might come from context or another fetch.
    users: Record<string, { id: string; name: string }>;
}

export interface ReceiptDoc {
    id: string;
    type: 'receipt';
    timestamp: Timestamp | null;
    uploadedBy: string;
    paidBy: string;
    // To simulate the 'merchantName' requested, we can use a fallback or an existing field if present
    merchantName?: string;
    totals: {
        grandTotal: number;
        subtotal?: number;
        tax?: number;
        tip?: number;
    };
    userOwedBreakdown: Record<string, number>;
    items?: any[];
}

export interface PaymentDoc {
    id: string;
    type: 'payment';
    timestamp: Timestamp | null;
    payerId: string;
    payeeId: string;
    amount: number;
}

type FeedItem = ReceiptDoc | PaymentDoc;

export default function GroupLedger({ groupId, currentUserId, users }: GroupLedgerProps) {
    const [receipts, setReceipts] = useState<ReceiptDoc[]>([]);
    const [payments, setPayments] = useState<PaymentDoc[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Settle Up Modal State
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [settleDebt, setSettleDebt] = useState<{ userId: string; amount: number } | null>(null);
    const [isSettling, setIsSettling] = useState(false);

    // --- Data Fetching ---
    useEffect(() => {
        if (!groupId) return;

        const receiptsRef = collection(db, 'groups', groupId, 'receipts');
        const paymentsRef = collection(db, 'groups', groupId, 'payments');

        // Fetch Receipts
        const unsubscribeReceipts = onSnapshot(
            query(receiptsRef, orderBy('timestamp', 'desc')),
            (snapshot) => {
                const fetchedReceipts = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    type: 'receipt' as const,
                    ...doc.data(),
                })) as ReceiptDoc[];
                setReceipts(fetchedReceipts);
                setIsLoading(false);
            }
        );

        // Fetch Payments
        const unsubscribePayments = onSnapshot(
            query(paymentsRef, orderBy('timestamp', 'desc')),
            (snapshot) => {
                const fetchedPayments = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    type: 'payment' as const,
                    ...doc.data(),
                })) as PaymentDoc[];
                setPayments(fetchedPayments);
            }
        );

        return () => {
            unsubscribeReceipts();
            unsubscribePayments();
        };
    }, [groupId]);

    // --- The Debt Aggregator (Core Math Engine) ---
    const netBalances = useMemo(() => {
        // A map of userId -> net amount current user owes them.
        // Positive means currentUser owes them. Negative means they owe currentUser.
        const balances: Record<string, number> = {};

        // 1. Process Receipts
        receipts.forEach((receipt) => {
            const { paidBy, userOwedBreakdown } = receipt;

            if (!userOwedBreakdown) return;

            if (paidBy !== currentUserId) {
                // Someone else paid. Does current user owe them?
                const amountCurrentUserOwes = userOwedBreakdown[currentUserId] || 0;
                if (amountCurrentUserOwes > 0) {
                    balances[paidBy] = (balances[paidBy] || 0) + Number(amountCurrentUserOwes);
                }
            } else {
                // Current user paid. Everyone else in the breakdown owes the current user.
                for (const [userId, amountOwed] of Object.entries(userOwedBreakdown)) {
                    if (userId !== currentUserId && amountOwed > 0) {
                        // Subtracting here because they owe me (decreases the amount I owe them)
                        balances[userId] = (balances[userId] || 0) - Number(amountOwed);
                    }
                }
            }
        });

        // 2. Process Payments
        payments.forEach((payment) => {
            const { payerId, payeeId, amount } = payment;

            if (payerId === currentUserId) {
                // Current user paid someone. Reduces the debt current user owes them.
                balances[payeeId] = (balances[payeeId] || 0) - Number(amount);
            } else if (payeeId === currentUserId) {
                // Someone paid the current user. Reduces the debt they owe current user.
                // Which means it INCREASES the net balance (moves it towards positive/currentUser owing them)
                balances[payerId] = (balances[payerId] || 0) + Number(amount);
            }
        });

        // Finalize Array and Round Safely
        const finalizedBalances = Object.entries(balances).map(([userId, netAmount]) => ({
            userId,
            netAmount: Number(netAmount.toFixed(2))
        })).filter(b => b.userId !== currentUserId); // Paranoia check

        return finalizedBalances;
    }, [receipts, payments, currentUserId]);

    const debtsOwedByMe = netBalances.filter(b => b.netAmount > 0);
    const debtsOwedToMe = netBalances.filter(b => b.netAmount < 0);

    // --- Settle Up Logic ---
    const handleSettleUpClick = (userId: string, amount: number) => {
        setSettleDebt({ userId, amount });
        setIsSettleModalOpen(true);
    };

    const confirmSettleUp = async () => {
        if (!settleDebt) return;
        setIsSettling(true);

        try {
            const paymentsRef = collection(db, 'groups', groupId, 'payments');
            await addDoc(paymentsRef, {
                payerId: currentUserId,
                payeeId: settleDebt.userId,
                amount: settleDebt.amount, // Exactly what is owed
                timestamp: serverTimestamp(),
            });
            setIsSettleModalOpen(false);
            setSettleDebt(null);
        } catch (error) {
            console.error('Error settling up:', error);
            alert('Failed to settle up. Please try again.');
        } finally {
            setIsSettling(false);
        }
    };

    // --- Unified Feed ---
    const unifiedFeed: FeedItem[] = useMemo(() => {
        return [...receipts, ...payments].sort((a, b) => {
            const timeA = a.timestamp?.toMillis() || Date.now();
            const timeB = b.timestamp?.toMillis() || Date.now();
            return timeB - timeA; // Descending
        });
    }, [receipts, payments]);

    const getUserName = (id: string) => users[id]?.name || 'Unknown User';

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-8 animate-in fade-in duration-500">

            {/* Balances Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Your Balances</h2>

                {isLoading ? (
                    <div className="h-32 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
                ) : debtsOwedByMe.length === 0 && debtsOwedToMe.length === 0 ? (
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-6 text-center border border-zinc-200 dark:border-zinc-800">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">🎉 Settled up</h3>
                        <p className="text-sm text-zinc-500 mt-1">You are all squared away with everyone.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {/* You Owe */}
                        {debtsOwedByMe.map(debt => (
                            <motion.div whileHover={{ scale: 1.02 }} key={debt.userId} className="bg-gradient-to-br from-white to-red-50 dark:from-zinc-900 dark:to-red-950/20 border border-red-100 dark:border-red-900/30 shadow-md hover:shadow-lg rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative transition-all group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none transition-transform group-hover:scale-110" />
                                <div className="relative z-10">
                                    <p className="text-sm font-bold text-red-600/80 dark:text-red-400/80 uppercase tracking-wider mb-1">You owe {getUserName(debt.userId)}</p>
                                    <p className="text-4xl font-black text-red-600 dark:text-red-400 drop-shadow-sm mb-4">${debt.netAmount.toFixed(2)}</p>
                                </div>
                                <button
                                    onClick={() => handleSettleUpClick(debt.userId, debt.netAmount)}
                                    className="relative z-10 w-full bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow-red-500/25 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    Settle Up <ArrowRight size={16} />
                                </button>
                            </motion.div>
                        ))}

                        {/* Owes You */}
                        {debtsOwedToMe.map(debt => (
                            <motion.div whileHover={{ scale: 1.02 }} key={debt.userId} className="bg-gradient-to-br from-white to-emerald-50 dark:from-zinc-900 dark:to-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 shadow-md hover:shadow-lg rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative transition-all group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none transition-transform group-hover:scale-110" />
                                <div className="relative z-10">
                                    <p className="text-sm font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider mb-1">{getUserName(debt.userId)} owes you</p>
                                    <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 drop-shadow-sm">${Math.abs(debt.netAmount).toFixed(2)}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </section>

            {/* Activity Feed Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Recent Activity</h2>

                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />)}
                    </div>
                ) : unifiedFeed.length === 0 ? (
                    <p className="text-zinc-500 text-center py-8">No activity yet.</p>
                ) : (
                    <div className="space-y-3">
                        {unifiedFeed.map(item => {
                            const dateRaw = item.timestamp?.toDate() || new Date();
                            const dateFormatted = format(dateRaw, 'MMM d, h:mm a');

                            if (item.type === 'receipt') {
                                return (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        key={item.id}
                                        className="bg-white dark:bg-zinc-900/80 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/40 dark:to-indigo-800/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm border border-indigo-200/50 dark:border-indigo-700/50">
                                            <Receipt size={22} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 dark:text-white truncate tracking-tight text-base mb-0.5">
                                                {item.merchantName || 'Receipt added'}
                                            </p>
                                            <p className="text-xs font-medium text-gray-500 truncate">
                                                <span className="text-gray-700 dark:text-gray-300">{getUserName(item.paidBy)}</span> paid • {dateFormatted}
                                            </p>
                                        </div>
                                        <div className="font-black text-gray-900 dark:text-white text-lg tracking-tight">
                                            ${item.totals.grandTotal.toFixed(2)}
                                        </div>
                                    </motion.div>
                                );
                            } else {
                                return (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        key={item.id}
                                        className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/50 dark:to-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm border border-emerald-200/50 dark:border-emerald-700/50">
                                            <CreditCard size={22} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-emerald-900 dark:text-emerald-100 truncate tracking-tight text-base mb-0.5">
                                                {getUserName(item.payerId)} paid {getUserName(item.payeeId)}
                                            </p>
                                            <p className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 truncate">
                                                {dateFormatted}
                                            </p>
                                        </div>
                                        <div className="font-black text-emerald-600 dark:text-emerald-400 text-lg tracking-tight">
                                            +${item.amount.toFixed(2)}
                                        </div>
                                    </motion.div>
                                );
                            }
                        })}
                    </div>
                )}
            </section>

            {/* Settle Up Confirmation Modal */}
            <AnimatePresence>
                {isSettleModalOpen && settleDebt && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight mb-2 relative z-10">Confirm Settlement</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-8 font-medium relative z-10">
                                Record a payment of <span className="text-gray-900 dark:text-white font-black drop-shadow-sm">${settleDebt.amount.toFixed(2)}</span> to {getUserName(settleDebt.userId)}?
                            </p>
                            <div className="flex gap-3 relative z-10">
                                <button
                                    onClick={() => setIsSettleModalOpen(false)}
                                    disabled={isSettling}
                                    className="flex-1 py-3.5 rounded-2xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmSettleUp}
                                    disabled={isSettling}
                                    className="flex-1 py-3.5 rounded-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all flex justify-center items-center"
                                >
                                    {isSettling ? 'Saving...' : 'Confirm'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
