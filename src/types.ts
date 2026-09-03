export interface Category {
  id: string;
  name: string;
  color: string;
  description: string;
  featured: boolean;
  logo: string | null;
  sortOrder?: number;
}

export interface PaymentEntry {
  id: number;
  amount: number;
  paidBy?: string | null;
  month: string;
  year: number;
  balanceTxnId?: number | null;
  created_at?: string;
}

export interface BillPhoto {
  type: string;
  name: string;
  data: string; // base64 or remote URL
}

export interface Bill {
  id: number;
  name: string;
  category: string;
  amount: number;
  paidAmount: number;
  due: string;
  month: string;
  year: number;
  timing: "overdue" | "upcoming";
  photo: BillPhoto | null;
  logo: string | null;
  paymentPlan: boolean;
  notes: string;
  paidBy: string | null;
  escalation: "reminder" | "aanmaning" | "deurwaarder" | null;
  iban: string | null;
  reference: string | null;
  payments?: PaymentEntry[];
  sortOrder?: number;
  reminderEnabled?: boolean;
  reminderDays?: number;
  reminderNote?: string;
}

export interface BillExtractionResult {
  isBill: boolean;
  readability: "clear" | "blurry" | "partially_readable" | "unreadable";
  confidenceScore: number;
  needsRetake: boolean;
  statusMessage: string;
  userActionPrompt?: string;
  missingFields: string[];
  extractedData: {
    name?: string;
    category?: string;
    amount?: number | null;
    dueDateIso?: string | null;
    iban?: string | null;
    reference?: string | null;
    escalation?: "reminder" | "aanmaning" | "deurwaarder" | null;
    notes?: string | null;
  };
}

export interface MonthlyFeedbackData {
  overallScore: number;
  monthTitle: string;
  executiveSummary: string;
  keyHighlights: string[];
  groceryInsights: {
    spentAmount: number;
    budgetStatus: string;
    observation: string;
    shoppingPacingTips: string[];
  };
  billsOptimization: {
    totalDue: number;
    totalPaid: number;
    overdueRiskNote: string;
    recommendations: string[];
  };
  savingsAndGoals: {
    statusNote: string;
    recommendations: string[];
  };
  actionPlan: {
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    impact: string;
  }[];
}

export interface Transaction {
  id: number;
  month: string;
  year: number;
  note: string;
  amount: number;
  sortOrder?: number;
}

export interface SavingsGoal {
  id: number;
  target: number;
  label?: string;
  photo?: string | null;
  saved: number;
  notes?: string;
}

export interface Loan {
  id: number;
  lender: string;
  amount: number;
  remaining: number;
  monthlyPayment: number;
}

export interface AccountBill {
  id: number;
  name: string;
  category?: string;
  amount: number;
  paidAmount?: number;
  due: string;
  month?: string;
  year?: number;
  timing?: "overdue" | "upcoming";
  photo?: BillPhoto | null;
  logo?: string | null;
  paymentPlan?: boolean;
  notes?: string;
  paidBy?: string | null;
  escalation?: "reminder" | "aanmaning" | "deurwaarder" | null;
  iban?: string | null;
  reference?: string | null;
  paid: boolean;
  payments?: PaymentEntry[];
  sortOrder?: number;
}

export interface BudgetCategory {
  id: number;
  name: string;
  budget: number;
  spent: number;
}

export interface Account {
  id: string;
  label: string;
  tag?: string | null;
  goals?: SavingsGoal[];
  transactions: Transaction[];
  bankFeedUrl?: string | null;
  hasGroceries?: boolean;
  loans?: Loan[];
  bills?: AccountBill[];
  budgets?: BudgetCategory[];
}

export interface GroceryEntry {
  id: number;
  month: string;
  year: number;
  note: string;
  amount: number;
}

export interface GroceriesState {
  budget: number;
  entries: GroceryEntry[];
}

export interface ScriptureVerse {
  text: string;
  reference: string;
}

export interface LoginNote {
  id: number;
  title: string;
  username: string;
  password: string;
  notes: string;
  url: string;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  label: string;
}

export interface SubscriptionsState {
  business: boolean;
  personal: boolean;
}

export interface AppState {
  categories: Category[];
  bills: Bill[];
  accounts: Account[];
  groceries: GroceriesState;
  loginNotes: LoginNote[];
  verse: ScriptureVerse;
  subscriptions: SubscriptionsState;
  currency: { code: string; symbol: string };
  language: string;
  monthlyBudgetCap?: number;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
  lastSyncedAt: string | null;
}
