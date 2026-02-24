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
                            <div key={debt.userId} className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/30 shadow-sm rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                                <div>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">You owe {getUserName(debt.userId)}</p>
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">${debt.netAmount.toFixed(2)}</p>
                                </div>
                                <button
                                    onClick={() => handleSettleUpClick(debt.userId, debt.netAmount)}
                                    className="mt-4 w-full bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 py-2 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                                >
                                    Settle Up <ArrowRight size={16} />
                                </button>
                            </div>
                        ))}

                        {/* Owes You */}
                        {debtsOwedToMe.map(debt => (
                            <div key={debt.userId} className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/30 shadow-sm rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                                <div>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{getUserName(debt.userId)} owes you</p>
                                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${Math.abs(debt.netAmount).toFixed(2)}</p>
                                </div>
                            </div>
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
                                    <div key={item.id} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                            <Receipt size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                                {item.merchantName || 'Receipt added'}
                                            </p>
                                            <p className="text-sm text-zinc-500 truncate">
                                                {getUserName(item.paidBy)} paid • {dateFormatted}
                                            </p>
                                        </div>
                                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                                            ${item.totals.grandTotal.toFixed(2)}
                                        </div>
                                    </div>
                                );
                            } else {
                                return (
                                    <div key={item.id} className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                            <CreditCard size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-emerald-900 dark:text-emerald-100 truncate">
                                                {getUserName(item.payerId)} paid {getUserName(item.payeeId)}
                                            </p>
                                            <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70 truncate">
                                                {dateFormatted}
                                            </p>
                                        </div>
                                        <div className="font-bold text-emerald-700 dark:text-emerald-400">
                                            +${item.amount.toFixed(2)}
                                        </div>
                                    </div>
                                );
                            }
                        })}
                    </div>
                )}
            </section>

            {/* Settle Up Confirmation Modal */}
            <AnimatePresence>
                {isSettleModalOpen && settleDebt && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 w-full max-w-sm"
                        >
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Confirm Settlement</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 mb-6 font-medium">
                                Record a payment of <span className="text-zinc-900 dark:text-zinc-100 font-bold">${settleDebt.amount.toFixed(2)}</span> to {getUserName(settleDebt.userId)}?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsSettleModalOpen(false)}
                                    disabled={isSettling}
                                    className="flex-1 py-2.5 rounded-xl font-semibold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmSettleUp}
                                    disabled={isSettling}
                                    className="flex-1 py-2.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex justify-center items-center"
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
