'use client';

import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Camera, Image as ImageIcon, X, ChevronLeft, Check } from 'lucide-react';
import { motion } from 'motion/react';
import imageCompression from 'browser-image-compression';
import AssignAndSplit from '../AssignAndSplit';
import { Trip, User, Expense } from '../../lib/types';
import { CURRENCY_RATES, CURRENCY_SYMBOLS } from '../../lib/constants';

export default function ExpenseFormTab({ trip, user, initialExpense, onAdded }: { trip: Trip, user: User, initialExpense?: Expense, onAdded: () => void }) {
  const [amount, setAmount] = useState(initialExpense ? (initialExpense.originalAmount || initialExpense.amount).toString() : '');
  const [currency, setCurrency] = useState(initialExpense?.originalCurrency || 'USD');
  const [description, setDescription] = useState(initialExpense ? initialExpense.description : '');
  const [category, setCategory] = useState(initialExpense ? initialExpense.category : 'general');
  const [payer, setPayer] = useState(initialExpense ? initialExpense.payer : user.uid);

  const [isScanning, setIsScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scannedReceiptData, setScannedReceiptData] = useState<any | null>(null);
  const [showCameraOptions, setShowCameraOptions] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Custom splits setup based on initial data
  const initialInvolved = initialExpense
    ? Object.keys(initialExpense.splits)
    : trip.members;

  let initialSplitType: 'equal' | 'exact' | 'percent' = 'equal';
  const initExact: Record<string, string> = {};
  if (initialExpense) {
    initialSplitType = 'exact';
    // For editing with different currencies, it's safest to convert the exact USD splits back to the original currency scale for display
    const conversionRate = CURRENCY_RATES[initialExpense.originalCurrency || 'USD'] || 1.0;
    for (const [uid, amtUSD] of Object.entries(initialExpense.splits)) {
      initExact[uid] = (amtUSD / conversionRate).toFixed(2);
    }
  }

  const [involvedMembers, setInvolvedMembers] = useState<string[]>(initialInvolved);
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percent'>(initialSplitType);
  const [exactSplits, setExactSplits] = useState<Record<string, string>>(initExact);
  const [percentSplits, setPercentSplits] = useState<Record<string, string>>({});

  const isSubmitting = false;

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanPreview(URL.createObjectURL(file));

    try {
      // 1. Compress the Image
      const options = {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);

      // 2. Convert to Base64
      const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(compressedFile);
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      // 3. Send to Supabase Edge Function
      abortControllerRef.current = new AbortController();
      const response = await supabase.functions.invoke('process-receipt', {
        body: {
          imageBase64: base64data,
          mimeType: compressedFile.type,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to process receipt');
      }

      const extractedData = response.data;
      console.log('Parsed receipt data:', extractedData);

      if (extractedData.total) {
        setAmount(extractedData.total.toFixed(2).toString());
      }

      const firstItem = extractedData.lineItems?.[0]?.name;
      if (firstItem) {
        const hasMore = extractedData.lineItems.length > 1;
        setDescription(`Receipt: ${firstItem}${hasMore ? ' & more' : ''}`);
      } else {
        setDescription('Scanned Receipt');
      }

      setScannedReceiptData(extractedData);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Scanner aborted by user.");
        return;
      }
      console.error("Error scanning receipt:", error);
      alert("Failed to process receipt image.");
    } finally {
      setIsScanning(false);
      setScanPreview(null);
    }
  };

  const toggleMemberInvolvement = (memberId: string) => {
    setInvolvedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(m => m !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSave = async () => {
    const numAmountLocal = parseFloat(amount);
    if (isNaN(numAmountLocal) || numAmountLocal <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }
    if (involvedMembers.length === 0) {
      alert('Please select at least one involved member');
      return;
    }

    // Convert to USD for storage and internal math
    const rate = CURRENCY_RATES[currency] || 1.0;
    const numAmountUSD = numAmountLocal * rate;
    const splitsUSD: Record<string, number> = {};

    if (splitType === 'equal') {
      const splitAmountUSD = numAmountUSD / involvedMembers.length;
      involvedMembers.forEach(m => splitsUSD[m] = splitAmountUSD);
    } else if (splitType === 'exact') {
      let totalLocal = 0;
      involvedMembers.forEach(m => {
        const valLocal = parseFloat(exactSplits[m] || '0');
        splitsUSD[m] = valLocal * rate;
        totalLocal += valLocal;
      });
      if (Math.abs(totalLocal - numAmountLocal) > 0.01) {
        alert(`Exact splits must sum to the total amount (${CURRENCY_SYMBOLS[currency]}${numAmountLocal}). Currently: ${CURRENCY_SYMBOLS[currency]}${totalLocal}`);
        return;
      }
    } else if (splitType === 'percent') {
      let totalPct = 0;
      involvedMembers.forEach(m => {
        const pct = parseFloat(percentSplits[m] || '0');
        splitsUSD[m] = (pct / 100) * numAmountUSD;
        totalPct += pct;
      });
      if (Math.abs(totalPct - 100) > 0.01) {
        alert(`Percentages must sum to 100%. Currently: ${totalPct}%`);
        return;
      }
    }

    try {
      const payload = {
        group_id: trip.id,
        amount: numAmountUSD,
        original_currency: currency,
        original_amount: numAmountLocal,
        description,
        category,
        payer_id: payer,
        splits: splitsUSD,
        created_by: initialExpense ? initialExpense.createdBy : user.uid
      };

      if (initialExpense) {
        await supabase
          .from('group_expenses')
          .update(payload)
          .eq('id', initialExpense.id);
      } else {
        await supabase
          .from('group_expenses')
          .insert(payload);
      }
      onAdded();
    } catch (error) {
      console.error('Error saving expense', error);
      alert('Failed to save expense');
    }
  };

  console.log('Current render state:', scannedReceiptData);

  if (scannedReceiptData) {
    const defaultData = {
      items: scannedReceiptData.lineItems?.map((item: any) => ({
        name: item.name || 'Unknown Item',
        price: Number(item.price) || 0
      })) || [],
      subtotal: Number(scannedReceiptData.subtotal) || 0,
      tax: Number(scannedReceiptData.tax) || 0,
      tip: Number(scannedReceiptData.tip) || 0,
      total: Number(scannedReceiptData.total) || 0,
    };

    const tripUsers = trip.members.map(userId => ({
      id: userId,
      name: trip.memberNames[userId] || 'Unknown User'
    }));

    return (
      <div className="animate-in fade-in zoom-in-95 duration-300">
        <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setScannedReceiptData(null)}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 font-medium bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full text-sm"
          >
            <ChevronLeft size={16} /> Discard Receipt
          </button>
        </div>
        <AssignAndSplit
          initialReceiptData={defaultData}
          users={tripUsers}
          groupId={trip.id}
          uploadedBy={user.uid}
          paidBy={payer}
          onSave={() => onAdded()} // This runs after AssignAndSplit saves to firebase successfully
        />
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{initialExpense ? 'Edit Expense' : 'Add Expense'}</h2>
        {!initialExpense && (
          <>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={cameraInputRef}
              onChange={(e) => { setShowCameraOptions(false); handleScanReceipt(e); }}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={galleryInputRef}
              onChange={(e) => { setShowCameraOptions(false); handleScanReceipt(e); }}
            />
            <button
              type="button"
              onClick={() => setShowCameraOptions(true)}
              disabled={isScanning}
              className="flex items-center gap-1.5 sm:gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
            >
              <Camera className="w-4 h-4 sm:w-4 sm:h-4" />
              <span>{isScanning ? 'Scanning...' : 'Scan Receipt'}</span>
            </button>
          </>
        )}
      </div>

      {/* Camera Scan Preview Area */}
      {(isScanning || scanPreview) && (
        <div className="mb-6 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-center gap-4 animate-in fade-in zoom-in-95">
          {scanPreview ? (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-sm">
              <img src={scanPreview} alt="Receipt preview" className="w-full h-full object-cover" />
              {isScanning && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <Camera className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
              {isScanning ? 'Processing Receipt...' : 'Receipt Captured'}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isScanning ? 'Extracting details using AI' : 'Ready to submit'}
            </p>
          </div>
          <button
            onClick={() => {
              if (abortControllerRef.current) abortControllerRef.current.abort();
              setScanPreview(null);
              setIsScanning(false);
            }}
            className="p-2 text-gray-400 hover:text-rose-500 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="space-y-5">
        {/* Amount & Currency */}
        <div className="flex gap-3">
          <div className="w-1/3">
            <select
              className="w-full h-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-3 py-4 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USD">🇺🇸 USD</option>
              <option value="EUR">🇪🇺 EUR</option>
              <option value="GBP">🇬🇧 GBP</option>
              <option value="CAD">🇨🇦 CAD</option>
              <option value="AUD">🇦🇺 AUD</option>
              <option value="JPY">🇯🇵 JPY</option>
            </select>
          </div>
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-gray-500 dark:text-gray-400 text-2xl font-medium">{CURRENCY_SYMBOLS[currency] || '$'}</span>
            </div>
            <input
              type="number"
              placeholder="0.00"
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl pl-10 pr-4 py-4 text-3xl font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {/* Description */}
        <input
          type="text"
          placeholder="What was this for?"
          className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Category */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 hide-scrollbar">
          {[
            { id: 'general', icon: '💸', label: 'General' },
            { id: 'food', icon: '🍔', label: 'Food' },
            { id: 'transport', icon: '🚕', label: 'Transport' },
            { id: 'lodging', icon: '🏨', label: 'Lodging' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex-shrink-0 flex flex-col items-center justify-center gap-2 w-20 h-20 rounded-2xl border transition-all ${category === cat.id
                ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-sm scale-105'
                : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
            >
              <span className="text-2xl drop-shadow-sm">{cat.icon}</span>
              <span className="text-xs font-bold">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Payer */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Who paid?</label>
          <select
            className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
          >
            {trip.members.map(m => (
              <option key={m} value={m}>{trip.memberNames[m]} {m === user.uid && '(You)'}</option>
            ))}
          </select>
        </div>

        {/* Involved Members */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Who is involved?</label>
          <div className="space-y-2">
            {trip.members.map(m => (
              <label key={m} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-indigo-600 dark:bg-gray-800 rounded border-gray-300 dark:border-gray-700 focus:ring-indigo-500"
                  checked={involvedMembers.includes(m)}
                  onChange={() => toggleMemberInvolvement(m)}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
                  {trip.memberNames[m]} {m === user.uid && '(You)'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Split Options */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">How to split?</label>

          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-4">
            <button
              onClick={() => setSplitType('equal')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${splitType === 'equal' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Equally
            </button>
            <button
              onClick={() => setSplitType('exact')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${splitType === 'exact' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Exact
            </button>
            <button
              onClick={() => setSplitType('percent')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${splitType === 'percent' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Percent
            </button>
          </div>

          {splitType === 'equal' && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              Split equally among {involvedMembers.length} people.
              {amount && !isNaN(parseFloat(amount)) && involvedMembers.length > 0 && (
                <span className="block font-medium text-gray-900 dark:text-white mt-1">
                  {CURRENCY_SYMBOLS[currency] || '$'}{(parseFloat(amount) / involvedMembers.length).toFixed(2)} / person
                </span>
              )}
            </p>
          )}

          {splitType === 'exact' && (
            <div className="space-y-2">
              {involvedMembers.map(m => (
                <div key={m} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{trip.memberNames[m]}</span>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1.5 text-gray-500 dark:text-gray-400 text-sm">{CURRENCY_SYMBOLS[currency] || '$'}</span>
                    <input
                      type="number"
                      className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded p-1 pl-5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={exactSplits[m] || ''}
                      onChange={(e) => setExactSplits({ ...exactSplits, [m]: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {splitType === 'percent' && (
            <div className="space-y-2">
              {involvedMembers.map(m => (
                <div key={m} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{trip.memberNames[m]}</span>
                  <div className="relative w-24">
                    <span className="absolute right-2 top-1.5 text-gray-500 dark:text-gray-400 text-sm">%</span>
                    <input
                      type="number"
                      className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded p-1 pr-6 text-right text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={percentSplits[m] || ''}
                      onChange={(e) => setPercentSplits({ ...percentSplits, [m]: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg shadow-[0_8px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_8px_30px_rgba(79,70,229,0.5)] transition-all mt-6 mb-8"
        >
          <Check className="w-5 h-5" /> {initialExpense ? 'Save Changes' : 'Add Expense'}
        </motion.button>
      </div>

      {/* Camera Options Action Sheet */}
      {showCameraOptions && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4 pb-28 sm:pb-4"
          onClick={() => setShowCameraOptions(false)}
        >
          <div
            className="w-full max-w-sm flex flex-col gap-2 animate-in slide-in-from-bottom-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-3 py-4 text-center text-lg font-medium text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Take Photo
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center justify-center gap-3 py-4 text-center text-lg font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Photo Library
              </button>
            </div>
            <button
              onClick={() => setShowCameraOptions(false)}
              className="bg-white dark:bg-zinc-900 rounded-3xl py-4 text-center text-lg font-bold text-gray-900 dark:text-white shadow-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
