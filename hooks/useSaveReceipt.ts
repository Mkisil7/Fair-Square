import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface SaveReceiptPayload {
    groupId: string;
    uploadedBy: string;
    paidBy: string;
    totals: {
        subtotal: number;
        tax: number;
        tip: number;
        grandTotal: number;
    };
    items: {
        name: string;
        price: number;
        assignedTo: string[];
    }[];
    userOwedBreakdown: Record<string, number>;
}

export function useSaveReceipt() {
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const saveReceipt = async (payload: SaveReceiptPayload) => {
        setIsSaving(true);
        setIsSuccess(false);
        setError(null);

        try {
            // Math Safety: Round all monetary values to exactly 2 decimal places
            const safeTotals = {
                subtotal: Number(payload.totals.subtotal.toFixed(2)),
                tax: Number(payload.totals.tax.toFixed(2)),
                tip: Number(payload.totals.tip.toFixed(2)),
                grandTotal: Number(payload.totals.grandTotal.toFixed(2)),
            };

            const safeItems = payload.items.map((item) => ({
                name: item.name,
                price: Number(item.price.toFixed(2)),
                assignedTo: [...item.assignedTo], // Ensure it's a plain array
            }));

            const safeUserOwedBreakdown: Record<string, number> = {};
            for (const [userId, amount] of Object.entries(payload.userOwedBreakdown)) {
                safeUserOwedBreakdown[userId] = Number(amount.toFixed(2));
            }

            // Construct Firestore Payload matching the Expense model
            // Defaulting category to 'general' since Assign & Split doesn't have a specific category selection yet
            const expenseDescription = `Assign & Split: ${safeItems.map(i => i.name).join(', ')}`;
            const firestorePayload = {
                amount: safeTotals.grandTotal,
                originalCurrency: 'USD',
                originalAmount: safeTotals.grandTotal,
                description: expenseDescription.substring(0, 100) + (expenseDescription.length > 100 ? '...' : ''), // cap description length
                category: 'general',
                payer: payload.paidBy,
                splits: safeUserOwedBreakdown,
                timestamp: serverTimestamp(),
                createdBy: payload.uploadedBy,
                // Include Assign & Split specific data under a metadata object or directly if needed
                receiptItems: safeItems,
                receiptTotals: safeTotals
            };

            // Ensure db and collection are properly resolved targeting trips -> expenses
            const receiptsCollectionRef = collection(db, 'trips', payload.groupId, 'expenses');

            // Add document to the nested sub-collection
            const docRef = await addDoc(receiptsCollectionRef, firestorePayload);

            setIsSuccess(true);
            return { success: true, docId: docRef.id };
        } catch (err: any) {
            console.error('Error saving receipt:', err);
            setError(err instanceof Error ? err : new Error(err.message || 'Failed to save receipt'));
            return { success: false, error: err };
        } finally {
            setIsSaving(false);
        }
    };

    return {
        saveReceipt,
        isSaving,
        isSuccess,
        error,
    };
}
