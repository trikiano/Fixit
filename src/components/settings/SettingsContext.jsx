import React, { createContext, useContext, useState, useEffect } from 'react';

export const DEFAULT_SETTINGS = {
  shop_name: 'TechRepair Pro',
  shop_address: '',
  shop_phone: '',
  shop_email: '',
  shop_website: '',
  currency: 'DZD',
  currency_symbol: 'DA',
  currency_decimals: '2',
  currency_symbol_position: 'right',
  tax_rate: '20',
  custom_tax: '',
  price_include_tax: true,
  theme: 'light',
  language: 'fr',
  date_format: 'DD/MM/YYYY',
  default_warranty_repair: '90',
  default_warranty_sale: '365',
  repair_prefix: 'REP',
  sale_prefix: 'VNT',
  notif_repair_ready: true,
  notif_low_stock: true,
  notif_warranty_expire: true,
  notif_email: true,
  notif_sms: false,
  notif_whatsapp: false,
  require_close_reason: true,
  auto_print_receipt: false,
  show_tax_on_receipt: true,
  two_fa_admin: false,
  session_timeout: '60',
  min_password_length: '8',
};

export const CURRENCY_SYMBOLS = {
  EUR: '€', USD: '$', GBP: '£', MAD: 'DH', DZD: 'DA',
  TND: 'DT', XOF: 'CFA', CAD: 'CA$', CHF: 'CHF',
};

export function applyTheme(theme) {
  const root = document.documentElement;
  const vars = theme === 'light' ? {
    '--background': '0 0% 97%', '--foreground': '222 47% 8%',
    '--card': '0 0% 100%', '--card-foreground': '222 47% 8%',
    '--muted': '220 13% 91%', '--muted-foreground': '220 9% 46%',
    '--border': '220 13% 86%', '--input': '220 13% 86%',
    '--popover': '0 0% 100%', '--popover-foreground': '222 47% 8%',
    '--secondary': '220 13% 91%', '--secondary-foreground': '222 47% 8%',
    '--accent': '220 13% 91%', '--accent-foreground': '222 47% 8%',
  } : theme === 'blue' ? {
    '--background': '224 71% 4%', '--foreground': '213 31% 91%',
    '--card': '224 71% 7%', '--card-foreground': '213 31% 91%',
    '--muted': '223 47% 11%', '--muted-foreground': '215 16% 47%',
    '--border': '216 34% 17%', '--input': '216 34% 17%',
    '--popover': '224 71% 7%', '--popover-foreground': '213 31% 91%',
    '--secondary': '222 47% 12%', '--secondary-foreground': '213 31% 91%',
    '--accent': '216 34% 17%', '--accent-foreground': '213 31% 91%',
  } : {
    '--background': '222 47% 6%', '--foreground': '210 40% 98%',
    '--card': '222 47% 10%', '--card-foreground': '210 40% 98%',
    '--muted': '222 47% 14%', '--muted-foreground': '215 20% 55%',
    '--border': '222 47% 18%', '--input': '222 47% 18%',
    '--popover': '222 47% 10%', '--popover-foreground': '210 40% 98%',
    '--secondary': '222 47% 15%', '--secondary-foreground': '210 40% 98%',
    '--accent': '222 47% 18%', '--accent-foreground': '210 40% 98%',
  };
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('app_settings');
      const parsed = stored ? JSON.parse(stored) : {};
      // If no theme was explicitly saved, use default (light)
      if (!parsed.theme) parsed.theme = 'light';
      const merged = { ...DEFAULT_SETTINGS, ...parsed };
      merged.currency_symbol = CURRENCY_SYMBOLS[merged.currency] || merged.currency;
      return merged;
    } catch { return DEFAULT_SETTINGS; }
  });

  useEffect(() => { applyTheme(settings.theme); }, [settings.theme]);

  const saveSettings = (newSettings) => {
    const updated = {
      ...newSettings,
      currency_symbol: CURRENCY_SYMBOLS[newSettings.currency] || newSettings.currency,
    };
    localStorage.setItem('app_settings', JSON.stringify(updated));
    setSettings(updated);
    applyTheme(updated.theme);
  };

  const formatCurrency = (amount) => {
    const sym = settings.currency_symbol || 'DA';
    const decimals = parseInt(settings.currency_decimals ?? '2');
    const position = settings.currency_symbol_position || 'right';
    const num = (typeof amount === 'number' ? amount : 0).toFixed(decimals);
    return position === 'left' ? `${sym} ${num}` : `${num} ${sym}`;
  };

  const getTaxRate = () => {
    if (settings.tax_rate === 'Personnalisé') return parseFloat(settings.custom_tax) || 0;
    return parseFloat(settings.tax_rate) || 0;
  };

  const generateTicketNumber = (type) => {
    const prefix = type === 'repair' ? (settings.repair_prefix || 'REP') : (settings.sale_prefix || 'VNT');
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  };

  return (
    <SettingsContext.Provider value={{ settings, saveSettings, formatCurrency, getTaxRate, generateTicketNumber }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_SETTINGS,
      saveSettings: () => {},
      formatCurrency: (a) => `${(a || 0).toFixed(2)} DA`,
      getTaxRate: () => 20,
      generateTicketNumber: (type) => `${type === 'repair' ? 'REP' : 'VNT'}-${Date.now().toString(36).toUpperCase()}`,
    };
  }
  return ctx;
}