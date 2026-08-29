export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "KES", symbol: "KSh", label: "Kenyan Shilling" },
  { code: "TZS", symbol: "TSh", label: "Tanzanian Shilling" },
  { code: "UGX", symbol: "USh", label: "Ugandan Shilling" },
  { code: "NGN", symbol: "₦", label: "Nigerian Naira" },
  { code: "ZAR", symbol: "R", label: "South African Rand" },
];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
];

export const I18N: Record<string, Record<string, string>> = {
  en: {
    home: "Home",
    allBills: "All bills",
    overview: "Overview",
    morePages: "More pages",
    more: "More",
    sync: "Sync",
    settings: "Settings",
    dueThisMonth: "Due this month",
    priorityBills: "Priority bills",
    companies: "Companies",
    seeAll: "See all →",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    addBill: "+ Add bill",
    choosePage: "Choose a page",
    seePlans: "See plans and pricing →",
  },
  nl: {
    home: "Home",
    allBills: "Alle rekeningen",
    overview: "Overzicht",
    morePages: "Meer pagina's",
    more: "Meer",
    sync: "Sync",
    settings: "Instellingen",
    dueThisMonth: "Verschuldigd deze maand",
    priorityBills: "Prioriteitsrekeningen",
    companies: "Bedrijven",
    seeAll: "Alles bekijken →",
    save: "Opslaan",
    cancel: "Annuleren",
    delete: "Verwijderen",
    edit: "Bewerken",
    add: "Toevoegen",
    addBill: "+ Rekening toevoegen",
    choosePage: "Kies een pagina",
    seePlans: "Bekijk abonnementen en prijzen →",
  },
};

export function translate(key: string, lang = "en"): string {
  const dict = I18N[lang] || I18N.en;
  return dict[key] || I18N.en[key] || key;
}
