import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { AlertCircle, Save, User as UserIcon, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSaveReceipt } from '@/hooks/useSaveReceipt';

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

export interface User {
    id: string;
    name: string;
}

export interface InitialReceiptData {
    items: { name: string; price: number }[];
    subtotal: number;
    tax: number;
    tip: number;
    total: number;
}

export interface ReceiptItem {
    id: string;
    name: string;
    price: number;
    assignedTo: string[];
}

export interface AssignAndSplitProps {
    initialReceiptData: InitialReceiptData;
    users: User[];
    groupId: string;
    uploadedBy: string;
    paidBy: string;
    onSave?: (data: { items: ReceiptItem[]; userTotals: Record<string, number>; subtotal: number; tax: number; tip: number; total: number }) => void;
}

export default function AssignAndSplit({ initialReceiptData, users, groupId, uploadedBy, paidBy, onSave }: AssignAndSplitProps) {
    const router = useRouter();
    const { saveReceipt, isSaving, isSuccess } = useSaveReceipt();

    useEffect(() => {
        if (isSuccess) {
            // Replace with your app's actual toast system if applicable
            alert('Receipt added to group!');
            router.push(`/groups/${groupId}`);
        }
    }, [isSuccess, router, groupId]);
    // Initialize state with an ID and assignedTo array for each item
    const [items, setItems] = useState<ReceiptItem[]>(() =>
        initialReceiptData.items.map(() => ({
            id: crypto.randomUUID(),
            name: '',
            price: 0,
            assignedTo: [],
        })).map((item, index) => ({
            ...item,
            name: initialReceiptData.items[index]?.name || '',
            price: initialReceiptData.items[index]?.price || 0,
        }))
    );

    const [subtotal, setSubtotal] = useState(initialReceiptData.subtotal);
    const [tax, setTax] = useState(initialReceiptData.tax);
    const [tip, setTip] = useState(initialReceiptData.tip);

    // Recalculate total whenever subtotal, tax, or tip changes (optional since users might edit them too)
    const total = subtotal + tax + tip;

    const handleItemChange = (id: string, field: keyof ReceiptItem, value: string | number) => {
        setItems((prevItems) =>
            prevItems.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
    };

    const toggleUserAssignment = (itemId: string, userId: string) => {
        setItems((prevItems) =>
            prevItems.map((item) => {
                if (item.id === itemId) {
                    const isAssigned = item.assignedTo.includes(userId);
                    const newAssignedTo = isAssigned
                        ? item.assignedTo.filter((id) => id !== userId)
                        : [...item.assignedTo, userId];
                    return { ...item, assignedTo: newAssignedTo };
                }
                return item;
            })
        );
    };

    const addNewItem = () => {
        setItems((prev) => [
            ...prev,
            { id: crypto.randomUUID(), name: 'New Item', price: 0, assignedTo: [] },
        ]);
    };

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    // --- Proportional Math Engine ---
    const { userTotals, unclaimedAmount } = useMemo(() => {
        let currentUnclaimedAmount = 0;
        const totals: Record<string, number> = {};

        // Initialize totals
        users.forEach((u) => {
            totals[u.id] = 0;
        });

        items.forEach((item) => {
            const price = Number(item.price) || 0;
            if (item.assignedTo.length === 0) {
                currentUnclaimedAmount += price;
            } else {
                const splitPrice = price / item.assignedTo.length;
                item.assignedTo.forEach((userId) => {
                    if (totals[userId] !== undefined) {
                        totals[userId] += splitPrice;
                    }
                });
            }
        });

        // Step 2 & 3: Apply proportional tax and tip
        Object.keys(totals).forEach((userId) => {
            const userItemTotal = totals[userId];
            // Prevent division by zero if subtotal is 0 or negative
            const validSubtotal = Number(subtotal) > 0 ? Number(subtotal) : 1;

            const sharePercentage = (userItemTotal / validSubtotal);
            const userTax = sharePercentage * Number(tax);
            const userTip = sharePercentage * Number(tip);

            // Final amount
            totals[userId] = userItemTotal + userTax + userTip;
        });

        return { userTotals: totals, unclaimedAmount: currentUnclaimedAmount };
    }, [items, users, subtotal, tax, tip]);

    const hasUnclaimed = unclaimedAmount > 0;

    const handleSave = () => {
        saveReceipt({
            groupId,
            uploadedBy,
            paidBy,
            totals: {
                subtotal,
                tax,
                tip,
                grandTotal: total,
            },
            items,
            userOwedBreakdown: userTotals,
        });

        // Trigger the onSave callback as well if provided
        onSave?.({ items, userTotals, subtotal, tax, tip, total });
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header & Sticky Alert */}
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Assign & Split</h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Tap users to assign them to items. Costs split automatically.
                        </p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={hasUnclaimed || isSaving}
                        className={cn(
                            "flex flex-none items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition-all shadow-sm",
                            (hasUnclaimed || isSaving)
                                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600"
                                : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5"
                        )}
                    >
                        <Save size={18} />
                        {isSaving ? 'Saving...' : 'Save to Group'}
                    </button>
                </div>

                {hasUnclaimed && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 flex items-center gap-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 p-3 rounded-lg border border-red-200 dark:border-red-900/50"
                    >
                        <AlertCircle className="shrink-0" size={20} />
                        <span className="font-medium text-sm">
                            ⚠️ ${unclaimedAmount.toFixed(2)} left unassigned. Please assign all items.
                        </span>
                    </motion.div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* Left Column: Editable Data Grid & Assignments */}
                <div className="col-span-1 lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Items</h2>
                        <button
                            onClick={addNewItem}
                            className="text-sm flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
                        >
                            <Plus size={16} />
                            Add Item
                        </button>
                    </div>

                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-colors group"
                            >
                                <div className="flex flex-col sm:flex-row gap-4">
                                    {/* Item Inputs */}
                                    <div className="flex-1 flex items-center gap-3">
                                        <input
                                            type="text"
                                            className="flex-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-medium text-zinc-900 dark:text-zinc-100 focus:ring-0 p-1 text-base placeholder-zinc-400 outline-none transition-colors"
                                            value={item.name}
                                            onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                                            placeholder="Item name"
                                        />
                                        <div className="flex items-center gap-1 text-zinc-500 font-medium text-lg">
                                            <span>$</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="w-20 bg-transparent border-0 font-medium text-zinc-900 dark:text-zinc-100 focus:ring-0 p-0 text-right appearance-none"
                                                value={item.price === 0 && item.name === '' ? '' : item.price}
                                                onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                                onFocus={(e) => e.target.select()}
                                            />
                                        </div>
                                    </div>

                                    {/* Divider on mobile, hidden on desktop */}
                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 block sm:hidden my-1" />

                                    {/* Assignment Chips */}
                                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap overflow-x-auto pb-1 sm:pb-0 scrollbar-hide shrink-0 sm:max-w-xs md:max-w-sm">
                                        {users.map((user) => {
                                            const isAssigned = item.assignedTo.includes(user.id);
                                            return (
                                                <button
                                                    key={user.id}
                                                    onClick={() => toggleUserAssignment(item.id, user.id)}
                                                    className={cn(
                                                        "flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 select-none whitespace-nowrap",
                                                        isAssigned
                                                            ? "bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800/60 dark:text-indigo-300 shadow-sm"
                                                            : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
                                                    )}
                                                >
                                                    <UserIcon size={12} className={cn(isAssigned && "fill-current")} />
                                                    {user.name}
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="ml-auto p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            aria-label="Remove item"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Receipt Summary</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm text-zinc-600 dark:text-zinc-400">
                                <span>Subtotal</span>
                                <div className="flex items-center gap-1">
                                    <span>$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-1 text-right text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={subtotal}
                                        onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm text-zinc-600 dark:text-zinc-400">
                                <span>Tax</span>
                                <div className="flex items-center gap-1">
                                    <span>$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-1 text-right text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={tax}
                                        onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm text-zinc-600 dark:text-zinc-400">
                                <span>Tip</span>
                                <div className="flex items-center gap-1">
                                    <span>$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-1 text-right text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={tip}
                                        onChange={(e) => setTip(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-center font-bold text-lg text-zinc-900 dark:text-zinc-100">
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: User Totals */}
                <div className="col-span-1 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 shadow-sm overflow-hidden sticky top-28">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Owed Amounts</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Includes proportional tax & tip</p>
                    </div>

                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                        {users.map(user => {
                            const owed = userTotals[user.id] || 0;
                            return (
                                <div key={user.id} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                            {user.name}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                            ${owed.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
}
