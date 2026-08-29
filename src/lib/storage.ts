import { AppState, Bill, Category, Account, GroceriesState } from "../types";

export const swatchOptions = [
  "#7B6EF6",
  "#5FD3A3",
  "#FF9B71",
  "#F76E8E",
  "#4FA8E3",
  "#F5B94E",
  "#3D5A80",
  "#B14A3D",
];

export const CURRENT_MONTH = "Aug";
export const CURRENT_YEAR = 2026;
export const APP_PASSWORD = "lisa";

export const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "housing", name: "Landlord (rent)", color: "#7B6EF6", description: "Your landlord for Overtoom 214. Rent is due on the 1st of each month.", featured: true, logo: null, sortOrder: 0 },
  { id: "waternet", name: "Waternet", color: "#4FA8E3", description: "Amsterdam's water authority — bills for drinking water supply and wastewater treatment.", featured: true, logo: null, sortOrder: 1 },
  { id: "eneco", name: "Eneco", color: "#F5B94E", description: "Your gas and electricity supplier.", featured: true, logo: null, sortOrder: 2 },
  { id: "gemeente", name: "Gemeente Amsterdam", color: "#3D5A80", description: "The Amsterdam municipality — bills for local taxes such as afvalstoffenheffing and OZB.", featured: true, logo: null, sortOrder: 3 },
  { id: "car-insurance", name: "Allianz — Car insurance", color: "#B14A3D", description: "Allianz — your car insurance provider, covering liability and damage.", featured: true, logo: null, sortOrder: 4 },
  { id: "health-insurance", name: "Health insurance", color: "#5FD3A3", description: "Your Dutch health insurance provider (zorgverzekering) — a legally required monthly premium.", featured: true, logo: null, sortOrder: 5 },
  { id: "subscription", name: "Subscriptions", color: "#FF9B71", description: "Recurring subscriptions and storage costs, like the cargo bike storage unit.", featured: false, logo: null, sortOrder: 6 },
];

export const DEFAULT_BILLS: Bill[] = [
  { id: 1, name: "Rent — Overtoom 214", category: "housing", amount: 950.00, paidAmount: 0, due: "Aug 1", month: "Aug", year: 2026, timing: "overdue", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: null, escalation: null, iban: "NL91ABNA0417164300", reference: "RENT-2026-08", sortOrder: 0, payments: [] },
  { id: 2, name: "Waternet — water bill", category: "waternet", amount: 38.10, paidAmount: 38.10, due: "Aug 5", month: "Aug", year: 2026, timing: "upcoming", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: "Lisa", escalation: null, iban: "NL05INGB0007856421", reference: "WN-88213764", sortOrder: 1, payments: [{ id: 1, amount: 38.10, paidBy: "Lisa", month: "Aug", year: 2026 }] },
  { id: 3, name: "Eneco — Energy", category: "eneco", amount: 96.40, paidAmount: 0, due: "Aug 24", month: "Aug", year: 2026, timing: "upcoming", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: null, escalation: null, iban: "NL63RABO0123456789", reference: "ENC-4471209", sortOrder: 2, payments: [] },
  { id: 4, name: "Gemeente Amsterdam — municipal tax", category: "gemeente", amount: 240.00, paidAmount: 100.00, due: "Aug 20", month: "Aug", year: 2026, timing: "upcoming", photo: null, logo: null, paymentPlan: true, notes: "Paying in 3 instalments.", paidBy: "Lisa", escalation: null, iban: "NL39RABO0300065696", reference: "GEM-2026-330871", sortOrder: 3, payments: [{ id: 1, amount: 100.00, paidBy: "Lisa", month: "Aug", year: 2026 }] },
  { id: 5, name: "Allianz — car insurance", category: "car-insurance", amount: 62.50, paidAmount: 0, due: "Aug 15", month: "Aug", year: 2026, timing: "overdue", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: null, escalation: "aanmaning", iban: "NL80DEUT0265186420", reference: "ALZ-9902341", sortOrder: 4, payments: [] },
  { id: 6, name: "Health insurance premium", category: "health-insurance", amount: 132.95, paidAmount: 132.95, due: "Aug 1", month: "Aug", year: 2026, timing: "upcoming", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: "Lisa", escalation: null, iban: "NL22ABNA0458123697", reference: "ZK-77120456", sortOrder: 5, payments: [{ id: 1, amount: 132.95, paidBy: "Lisa", month: "Aug", year: 2026 }] },
  { id: 7, name: "VvE service charge", category: "housing", amount: 68.00, paidAmount: 0, due: "Aug 28", month: "Aug", year: 2026, timing: "upcoming", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: null, escalation: null, iban: "NL91ABNA0417164300", reference: "VVE-2026-08", sortOrder: 6, payments: [] },
  { id: 8, name: "Storage — cargo bike unit", category: "subscription", amount: 45.00, paidAmount: 0, due: "Aug 30", month: "Aug", year: 2026, timing: "upcoming", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: null, escalation: null, iban: "NL54CITI0212345678", reference: "CBX-551029", sortOrder: 7, payments: [] },
  { id: 9, name: "Rent — Overtoom 214", category: "housing", amount: 950.00, paidAmount: 950.00, due: "Jul 1", month: "Jul", year: 2026, timing: "upcoming", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: "Lisa", escalation: null, iban: "NL91ABNA0417164300", reference: "RENT-2026-07", sortOrder: 8, payments: [{ id: 1, amount: 950.00, paidBy: "Lisa", month: "Jul", year: 2026 }] },
  { id: 10, name: "Eneco — Energy", category: "eneco", amount: 88.30, paidAmount: 88.30, due: "Jul 24", month: "Jul", year: 2026, timing: "upcoming", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: "Lisa", escalation: null, iban: "NL63RABO0123456789", reference: "ENC-4470118", sortOrder: 9, payments: [{ id: 1, amount: 88.30, paidBy: "Lisa", month: "Jul", year: 2026 }] },
  { id: 11, name: "Rent — Overtoom 214", category: "housing", amount: 920.00, paidAmount: 920.00, due: "Jun 1", month: "Jun", year: 2026, timing: "upcoming", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: "Lisa", escalation: null, iban: "NL91ABNA0417164300", reference: "RENT-2026-06", sortOrder: 10, payments: [{ id: 1, amount: 920.00, paidBy: "Lisa", month: "Jun", year: 2026 }] },
  { id: 12, name: "Health insurance premium", category: "health-insurance", amount: 128.40, paidAmount: 128.40, due: "Aug 1", month: "Aug", year: 2025, timing: "upcoming", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: "Lisa", escalation: null, iban: "NL22ABNA0458123697", reference: "ZK-76900211", sortOrder: 11, payments: [{ id: 1, amount: 128.40, paidBy: "Lisa", month: "Aug", year: 2025 }] },
  { id: 13, name: "Rent — Overtoom 214", category: "housing", amount: 950.00, paidAmount: 0, due: "Sep 1", month: "Sep", year: 2026, timing: "upcoming", photo: null, logo: null, paymentPlan: false, notes: "", paidBy: null, escalation: null, iban: "NL91ABNA0417164300", reference: "RENT-2026-09", sortOrder: 12, payments: [] },
];

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: "balance",
    label: "Balance",
    tag: "SNS",
    goals: [],
    transactions: [
      { id: 1, month: "Jun", year: 2026, note: "Opening balance carried over", amount: 2840.00, sortOrder: 12 },
      { id: 2, month: "Jun", year: 2026, note: "Salary received", amount: 3150.00, sortOrder: 11 },
      { id: 3, month: "Jun", year: 2026, note: "Rent paid out", amount: -950.00, sortOrder: 10 },
      { id: 4, month: "Jun", year: 2026, note: "Groceries", amount: -380.00, sortOrder: 9 },
      { id: 5, month: "Jul", year: 2026, note: "Salary received", amount: 3180.00, sortOrder: 8 },
      { id: 6, month: "Jul", year: 2026, note: "Rent paid out", amount: -950.00, sortOrder: 7 },
      { id: 7, month: "Jul", year: 2026, note: "Groceries", amount: -410.00, sortOrder: 6 },
      { id: 8, month: "Jul", year: 2026, note: "Eneco paid", amount: -88.30, sortOrder: 5 },
      { id: 9, month: "Aug", year: 2026, note: "Opening balance carried over", amount: 3128.20, sortOrder: 4 },
      { id: 10, month: "Aug", year: 2026, note: "Salary received", amount: 3200.00, sortOrder: 3 },
      { id: 11, month: "Aug", year: 2026, note: "Rent paid out", amount: -950.00, sortOrder: 2 },
      { id: 12, month: "Aug", year: 2026, note: "Groceries", amount: -420.00, sortOrder: 1 },
      { id: 13, month: "Aug", year: 2026, note: "Waternet paid", amount: -38.10, sortOrder: 0 },
    ],
  },
  {
    id: "snappcar",
    label: "SnappCar",
    tag: null,
    goals: [],
    transactions: [
      { id: 1, month: "Mar", year: 2025, note: "Rented by Bram Smit", amount: 50.00, sortOrder: 14 },
      { id: 2, month: "May", year: 2025, note: "Rented by Nora de Groot", amount: 60.00, sortOrder: 13 },
      { id: 3, month: "Jun", year: 2025, note: "Rented by Tim Visser", amount: 80.00, sortOrder: 12 },
      { id: 4, month: "Aug", year: 2025, note: "Rented by Sven Bakker", amount: 95.00, sortOrder: 11 },
      { id: 5, month: "Sep", year: 2025, note: "Rented by Anna Jansen", amount: 45.00, sortOrder: 10 },
      { id: 6, month: "Nov", year: 2025, note: "Rented by Youssef El Amrani", amount: 70.00, sortOrder: 9 },
      { id: 7, month: "Jan", year: 2026, note: "Rented by Sven Bakker", amount: 70.00, sortOrder: 8 },
      { id: 8, month: "Feb", year: 2026, note: "Rented by Nora de Groot", amount: 65.00, sortOrder: 7 },
      { id: 9, month: "Mar", year: 2026, note: "Rented by Tim Visser", amount: 90.00, sortOrder: 6 },
      { id: 10, month: "Apr", year: 2026, note: "Rented by Anna Jansen", amount: 55.00, sortOrder: 5 },
      { id: 11, month: "May", year: 2026, note: "Rented by Youssef El Amrani", amount: 110.00, sortOrder: 4 },
      { id: 12, month: "Jun", year: 2026, note: "Rented by Mark de Vries", amount: 75.00, sortOrder: 3 },
      { id: 13, month: "Jul", year: 2026, note: "Rented by Youssef El Amrani", amount: 120.00, sortOrder: 2 },
      { id: 14, month: "Aug", year: 2026, note: "Rented by Mark de Vries", amount: 85.00, sortOrder: 1 },
      { id: 15, month: "Aug", year: 2026, note: "Rented by Anna Jansen", amount: 60.00, sortOrder: 0 },
    ],
  },
  {
    id: "emergency",
    label: "Emergency fund",
    tag: "SNS",
    goals: [{ id: 1, target: 1000.00, label: "3 months of expenses", photo: null, saved: 310.00 }],
    transactions: [
      { id: 1, month: "Aug", year: 2026, note: "Monthly transfer to emergency fund", amount: 150.00, sortOrder: 1 },
      { id: 2, month: "Jul", year: 2026, note: "Monthly transfer to emergency fund", amount: 160.00, sortOrder: 0 },
    ],
  },
  {
    id: "carrepair",
    label: "Car loss",
    tag: null,
    goals: [],
    transactions: [
      { id: 1, month: "Jul", year: 2026, note: "Brake pads replacement", amount: -180.00, sortOrder: 1 },
      { id: 2, month: "Jun", year: 2026, note: "Tire puncture repair", amount: -45.00, sortOrder: 0 },
    ],
  },
  {
    id: "personal",
    label: "Personal Account",
    tag: "Personal",
    goals: [
      {
        id: 1,
        target: 2500.00,
        label: "Emergency Buffer",
        photo: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&auto=format&fit=crop&q=80",
        saved: 1200.00,
        notes: "3 months personal reserve",
      },
      {
        id: 2,
        target: 1800.00,
        label: "Summer Holiday Trip",
        photo: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
        saved: 650.00,
        notes: "Family vacation savings",
      },
    ],
    transactions: [
      { id: 1, month: "Aug", year: 2026, note: "Salary received", amount: 3200.00, sortOrder: 3 },
      { id: 2, month: "Aug", year: 2026, note: "Rent payment", amount: -950.00, sortOrder: 2 },
      { id: 3, month: "Aug", year: 2026, note: "Personal living expenses", amount: -420.00, sortOrder: 1 },
    ],
    bankFeedUrl: null,
    hasGroceries: true,
    loans: [],
    bills: [
      { id: 1, name: "Electricity (Eneco)", amount: 95.40, due: "Due soon", paid: false, category: "eneco", month: "Aug", year: 2026 },
      { id: 2, name: "Home Internet & TV", amount: 48.00, due: "In 8 days", paid: false, category: "subscription", month: "Aug", year: 2026 },
      { id: 3, name: "Apartment Rent", amount: 1200.00, due: "In 15 days", paid: false, category: "housing", month: "Aug", year: 2026 },
      { id: 4, name: "Mobile Phone Plan", amount: 25.00, due: "Sep 5", paid: false, category: "subscription", month: "Sep", year: 2026 },
      { id: 5, name: "Gym Membership", amount: 35.00, due: "Sep 1", paid: true, category: "subscription", month: "Sep", year: 2026 },
    ],
    budgets: [
      { id: 1, name: "Travel & Commute", budget: 150.00, spent: 40.00 },
      { id: 2, name: "Dining & Social", budget: 200.00, spent: 115.00 },
      { id: 3, name: "Gifts & Personal", budget: 80.00, spent: 25.00 },
      { id: 4, name: "Clothing & Leisure", budget: 120.00, spent: 65.00 },
    ],
  },
  {
    id: "business",
    label: "Business Account",
    tag: "Business",
    goals: [
      {
        id: 1,
        target: 8000.00,
        label: "Studio & Camera Equipment",
        photo: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&auto=format&fit=crop&q=80",
        saved: 3400.00,
        notes: "Next-gen studio workstation and 4k cameras",
      },
      {
        id: 2,
        target: 5000.00,
        label: "Corporate Tax Reserve",
        photo: null,
        saved: 2100.00,
        notes: "VAT / BTW quarterly tax reserve",
      },
    ],
    transactions: [
      { id: 1, month: "Aug", year: 2026, note: "Client invoice paid — Studio Project", amount: 2850.00, sortOrder: 4 },
      { id: 2, month: "Aug", year: 2026, note: "Monthly Retainer — Creative Agency", amount: 1450.00, sortOrder: 3 },
      { id: 3, month: "Aug", year: 2026, note: "Adobe Creative Cloud & Software", amount: -84.60, sortOrder: 2 },
      { id: 4, month: "Aug", year: 2026, note: "Office co-working & stationery", amount: -210.00, sortOrder: 1 },
    ],
    bankFeedUrl: null,
    hasGroceries: false,
    loans: [
      { id: 1, lender: "Rabobank Business Loan", amount: 5000.00, remaining: 3200.00, monthlyPayment: 250.00 },
      { id: 2, lender: "Equipment Lease Facility", amount: 2400.00, remaining: 900.00, monthlyPayment: 150.00 },
    ],
    bills: [
      { id: 1, name: "Invoice #2026-084 — Acme Corp", amount: 1850.00, due: "Due Sep 1", paid: false, category: "services", month: "Aug", year: 2026 },
      { id: 2, name: "Cloud Server & Hosting", amount: 65.00, due: "In 10 days", paid: false, category: "subscription", month: "Aug", year: 2026 },
      { id: 3, name: "Accounting & Tax Filing Services", amount: 175.00, due: "In 14 days", paid: false, category: "services", month: "Aug", year: 2026 },
      { id: 4, name: "Invoice #2026-079 — Brand Design", amount: 1200.00, due: "Aug 15", paid: true, category: "services", month: "Aug", year: 2026 },
    ],
    budgets: [
      { id: 1, name: "Software & SaaS", budget: 250.00, spent: 149.60 },
      { id: 2, name: "Marketing & Ads", budget: 300.00, spent: 120.00 },
      { id: 3, name: "Office & Coworking", budget: 250.00, spent: 210.00 },
      { id: 4, name: "Legal & Accounting", budget: 200.00, spent: 175.00 },
    ],
  },
];

export const DEFAULT_GROCERIES: GroceriesState = {
  budget: 400.00,
  entries: [
    { id: 1, month: "Aug", year: 2025, note: "Albert Heijn", amount: 68.40 },
    { id: 2, month: "Aug", year: 2025, note: "Lidl", amount: 42.10 },
    { id: 3, month: "Dec", year: 2025, note: "Albert Heijn — holidays", amount: 110.60 },
    { id: 4, month: "Jun", year: 2026, note: "Albert Heijn", amount: 62.30 },
    { id: 5, month: "Jun", year: 2026, note: "Lidl", amount: 45.10 },
    { id: 6, month: "Jun", year: 2026, note: "Albert Heijn", amount: 58.90 },
    { id: 7, month: "Jul", year: 2026, note: "Albert Heijn", amount: 70.20 },
    { id: 8, month: "Jul", year: 2026, note: "Lidl", amount: 50.00 },
    { id: 9, month: "Jul", year: 2026, note: "Jumbo", amount: 40.15 },
    { id: 10, month: "Aug", year: 2026, note: "Albert Heijn", amount: 65.40 },
    { id: 11, month: "Aug", year: 2026, note: "Lidl", amount: 48.75 },
    { id: 12, month: "Aug", year: 2026, note: "Albert Heijn", amount: 33.20 },
  ],
};

export const DEFAULT_STATE: AppState = {
  categories: DEFAULT_CATEGORIES,
  bills: DEFAULT_BILLS,
  accounts: DEFAULT_ACCOUNTS,
  groceries: DEFAULT_GROCERIES,
  verse: { text: "God will supply all our needs.", reference: "Philippians 4:19" },
  subscriptions: { business: true, personal: true },
  currency: { code: "EUR", symbol: "€" },
  language: "en",
  monthlyBudgetCap: 2500.00,
};

const LS_STATE_KEY = "ledger_app_state";

export function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(LS_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let accounts: Account[] = parsed.accounts || DEFAULT_ACCOUNTS;

      // Ensure separate Personal and Business accounts exist
      const defaultPersonal = DEFAULT_ACCOUNTS.find((a) => a.id === "personal")!;
      const defaultBusiness = DEFAULT_ACCOUNTS.find((a) => a.id === "business")!;

      let personalAcc = accounts.find((a) => a.id === "personal");
      let businessAcc = accounts.find((a) => a.id === "business");

      if (!personalAcc) {
        personalAcc = defaultPersonal;
        accounts = [...accounts, personalAcc];
      } else {
        // Update label to reflect standalone Personal Account
        personalAcc = {
          ...personalAcc,
          label: "Personal Account",
          tag: "Personal",
        };
        accounts = accounts.map((a) => (a.id === "personal" ? personalAcc! : a));
      }

      if (!businessAcc) {
        businessAcc = defaultBusiness;
        accounts = [...accounts, businessAcc];
      } else {
        businessAcc = {
          ...businessAcc,
          label: "Business Account",
          tag: "Business",
        };
        accounts = accounts.map((a) => (a.id === "business" ? businessAcc! : a));
      }

      return {
        categories: parsed.categories || DEFAULT_CATEGORIES,
        bills: (parsed.bills || DEFAULT_BILLS).map((b: Bill) => ({
          ...b,
          payments: b.payments || (b.paidAmount > 0 ? [{ id: 1, amount: b.paidAmount, paidBy: b.paidBy, month: b.month, year: b.year }] : []),
        })),
        accounts,
        groceries: parsed.groceries || DEFAULT_GROCERIES,
        verse: parsed.verse || DEFAULT_STATE.verse,
        subscriptions: parsed.subscriptions || DEFAULT_STATE.subscriptions,
        currency: parsed.currency || DEFAULT_STATE.currency,
        language: parsed.language || DEFAULT_STATE.language,
        monthlyBudgetCap: parsed.monthlyBudgetCap !== undefined ? parsed.monthlyBudgetCap : DEFAULT_STATE.monthlyBudgetCap,
      };
    }
  } catch (e) {
    console.warn("Failed to load local storage state:", e);
  }
  return DEFAULT_STATE;
}

export function saveStateToStorage(state: AppState) {
  try {
    localStorage.setItem(LS_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save state to localStorage:", e);
  }
}

export function formatCurrency(amount: number, symbol = "€"): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`;
}

export function getPaymentStatus(b: Bill): "paid" | "partial" | "unpaid" {
  if (b.paidAmount >= b.amount && b.amount > 0) return "paid";
  if (b.paidAmount > 0) return "partial";
  return "unpaid";
}

export function getRemaining(b: Bill): number {
  return Math.max(0, b.amount - b.paidAmount);
}

export function isBillUrgent(b: Bill): boolean {
  return b.timing === "overdue" && getPaymentStatus(b) !== "paid";
}

export function getAccountTotal(acc: Account): number {
  return (acc.transactions || []).reduce((sum, t) => sum + t.amount, 0);
}

export function periodKey(year: number, month: string): number {
  return year * 12 + monthOrder.indexOf(month);
}

export function dueToISO(due: string, year: number): string {
  if (!due || !year) return "";
  const match = /^([A-Za-z]+)\s+(\d{1,2})$/.exec(due.trim());
  if (!match) return "";
  const mi = monthOrder.indexOf(match[1]);
  if (mi === -1) return "";
  const mm = String(mi + 1).padStart(2, "0");
  const dd = String(parseInt(match[2], 10)).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function isoToDue(iso: string): { due: string; month: string; year: number } {
  if (!iso) return { due: "—", month: CURRENT_MONTH, year: CURRENT_YEAR };
  const parts = iso.split("-");
  const year = parseInt(parts[0], 10) || CURRENT_YEAR;
  const mi = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10) || 1;
  const month = monthOrder[mi] || CURRENT_MONTH;
  return {
    due: `${month} ${day}`,
    month,
    year,
  };
}
