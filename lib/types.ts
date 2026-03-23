export type Trip = {
  id: string;
  name: string;
  createdBy: string;
  members: string[]; // Array of user IDs or emails
  memberNames: Record<string, string>; // Map of userId to name
  notes?: string;
  dateRange?: string;
  createdAt: any;
};

export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export type Expense = {
  id: string;
  amount: number; // Stored in USD equivalent
  originalCurrency?: string;
  originalAmount?: number;
  payer: string; // userId
  category: string;
  description: string;
  timestamp: any;
  splits: Record<string, number>; // Map of userId to amount they owe (in USD)
  createdBy?: string;
};
