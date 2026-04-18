import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const COUNTRIES = [
  { code: 'TN', flag: '🇹🇳', name: 'Tunisie', dial: '+216', pattern: /^\d{8}$/, placeholder: '12 345 678' },
  { code: 'DZ', flag: '🇩🇿', name: 'Algérie', dial: '+213', pattern: /^\d{9}$/, placeholder: '612 345 678' },
  { code: 'MA', flag: '🇲🇦', name: 'Maroc', dial: '+212', pattern: /^\d{9}$/, placeholder: '612 345 678' },
  { code: 'FR', flag: '🇫🇷', name: 'France', dial: '+33', pattern: /^\d{9}$/, placeholder: '612 345 678' },
  { code: 'BE', flag: '🇧🇪', name: 'Belgique', dial: '+32', pattern: /^\d{9}$/, placeholder: '472 123 456' },
  { code: 'CH', flag: '🇨🇭', name: 'Suisse', dial: '+41', pattern: /^\d{9}$/, placeholder: '791 234 567' },
  { code: 'DE', flag: '🇩🇪', name: 'Allemagne', dial: '+49', pattern: /^\d{10,11}$/, placeholder: '1512 3456789' },
  { code: 'GB', flag: '🇬🇧', name: 'Royaume-Uni', dial: '+44', pattern: /^\d{10}$/, placeholder: '7911 123456' },
  { code: 'US', flag: '🇺🇸', name: 'États-Unis', dial: '+1', pattern: /^\d{10}$/, placeholder: '2025551234' },
  { code: 'LY', flag: '🇱🇾', name: 'Libye', dial: '+218', pattern: /^\d{9}$/, placeholder: '912 345 678' },
  { code: 'EG', flag: '🇪🇬', name: 'Égypte', dial: '+20', pattern: /^\d{10}$/, placeholder: '1012345678' },
  { code: 'SA', flag: '🇸🇦', name: 'Arabie Saoudite', dial: '+966', pattern: /^\d{9}$/, placeholder: '512 345 678' },
  { code: 'IT', flag: '🇮🇹', name: 'Italie', dial: '+39', pattern: /^\d{10}$/, placeholder: '3123456789' },
  { code: 'ES', flag: '🇪🇸', name: 'Espagne', dial: '+34', pattern: /^\d{9}$/, placeholder: '612 345 678' },
];

/**
 * PhoneInput - champ téléphone avec sélecteur de pays (drapeau + indicatif).
 * Props:
 *   value: string (numéro complet avec indicatif, ex: "+216 12 345 678")
 *   onChange: (fullValue: string) => void
 *   placeholder: string (override)
 *   className: string
 */
export default function PhoneInput({ value = '', onChange, className, disabled }) {
  // Parse stored value to extract dial code and local number
  const parseValue = (val) => {
    if (!val) return { country: COUNTRIES[0], local: '' };
    const found = COUNTRIES.find(c => val.startsWith(c.dial + ' ') || val.startsWith(c.dial));
    if (found) {
      const local = val.startsWith(found.dial + ' ')
        ? val.slice(found.dial.length + 1)
        : val.slice(found.dial.length);
      return { country: found, local };
    }
    return { country: COUNTRIES[0], local: val };
  };

  const parsed = parseValue(value);
  const [country, setCountry] = useState(parsed.country);
  const [local, setLocal] = useState(parsed.local);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  // Sync if external value changes
  useEffect(() => {
    const p = parseValue(value);
    setCountry(p.country);
    setLocal(p.local);
  }, [value]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLocalChange = (e) => {
    const v = e.target.value.replace(/[^\d\s\-]/g, '');
    setLocal(v);
    onChange?.(`${country.dial} ${v}`.trim());
  };

  const handleCountrySelect = (c) => {
    setCountry(c);
    setOpen(false);
    setSearch('');
    onChange?.(`${c.dial} ${local}`.trim());
  };

  const filtered = COUNTRIES.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search)
  );

  return (
    <div className={cn('flex h-9 w-full rounded-md border border-input bg-transparent shadow-sm overflow-visible relative', className)} ref={dropdownRef}>
      {/* Flag + dial code button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(v => !v); setSearch(''); }}
        className="flex items-center gap-1 px-2 border-r border-input bg-muted/30 hover:bg-muted/60 transition-colors rounded-l-md flex-shrink-0 text-sm"
      >
        <span className="text-base leading-none">{country.flag}</span>
        <span className="text-xs font-mono text-muted-foreground hidden sm:block">{country.dial}</span>
        <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {/* Local number input */}
      <input
        type="tel"
        value={local}
        onChange={handleLocalChange}
        placeholder={country.placeholder}
        disabled={disabled}
        className="flex-1 min-w-0 px-3 py-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground disabled:opacity-50"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-[200] bg-card border border-border rounded-lg shadow-xl w-64 overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un pays..."
              className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCountrySelect(c)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left',
                  country.code === c.code && 'bg-primary/10 text-primary font-medium'
                )}
              >
                <span className="text-base">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs font-mono text-muted-foreground">{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}