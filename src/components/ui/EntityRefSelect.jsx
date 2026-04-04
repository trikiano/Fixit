import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fixit } from '@/api/fixitClient';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import PhoneInput from "@/components/ui/PhoneInput";
import { Plus, Search, X, Check, Truck, Tag, Layers, Smartphone } from 'lucide-react';

export default function EntityRefSelect({ 
  entityType, // 'brand', 'model', 'category', 'device_type', 'supplier', OR 'custom'
  customTable = null, // optional: custom table name if entityType is 'custom'
  customColumn = null, // optional: custom column name if entityType is 'custom'
  parentFilters = {}, // optional: object of dependency values (ex: { category: 'Telephone' })
  defaultOptions = [], // optional: array of {id, label} to always show
  value,      // string (for string refs) OR UUID (for supplier)
  onChange,   // function(newStrOrUUID, newLabel)
  placeholder,
  className = "",
  disabled = false,
  required = false
}) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({ name: '', phone: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const isSupplier = entityType === 'supplier';

  // Mapping to new database entities
  const entityMap = {
    brand: 'Brand',
    model: 'DeviceModel',
    device_type: 'DeviceType',
    category: 'ProductCategory',
  };
  const dbEntity = entityMap[entityType];

  const prettyNames = {
    brand: 'Marque',
    model: 'Modèle',
    device_type: "Type d'appareil",
    category: 'Catégorie',
    supplier: 'Fournisseur',
  };
  const prettyName = prettyNames[entityType] || entityType;

  // Format placeholder
  let defaultPlaceholder = "Sélectionner ou créer...";
  let Icon = Tag;
  if (isSupplier) { defaultPlaceholder = "Rechercher fournisseur..."; Icon = Truck; }
  else if (entityType === 'category' || entityType === 'ProductCategory') { defaultPlaceholder = "Rechercher catégorie..."; Icon = Layers; }
  else { Icon = Smartphone; }

  const pText = placeholder || defaultPlaceholder;

  // -- Fetch Options --
  const { data: rawOptions = [], isLoading } = useQuery({
    queryKey: ['refOptions', entityType, customTable, customColumn, parentFilters],
    queryFn: async () => {
      if (isSupplier) {
        const res = await fixit.entities.Supplier.list('-created_date', 500);
        return res.map(s => ({ id: s.id, label: s.name, extra: s.phone }));
      }
      
      // 1. Fetch from new persistent tables if available
      let entityResults = [];
      if (dbEntity) {
        try {
          const rawFilters = { ...parentFilters };
          const finalFilters = {};
          
          if (dbEntity === 'Brand') {
             const catVal = rawFilters['category'] || rawFilters['device_type'];
             if (catVal) finalFilters['category'] = catVal;
          } else if (dbEntity === 'DeviceModel') {
             if (rawFilters['brand'] || rawFilters['device_brand']) {
               finalFilters['brand'] = rawFilters['brand'] || rawFilters['device_brand'];
             }
             const typeVal = rawFilters['device_type'] || rawFilters['category'];
             if (typeVal) finalFilters['device_type'] = typeVal;
          } else {
             Object.keys(rawFilters).forEach(k => { if (rawFilters[k]) finalFilters[k] = rawFilters[k]; });
          }
          
          let list = [];
          try {
             list = await fixit.entities[dbEntity].filter(finalFilters);
             
             // Fallback 1: Plural/Singular tolerance
             const catKey = dbEntity === 'Brand' ? 'category' : (dbEntity === 'DeviceModel' ? 'device_type' : null);
             if (list.length === 0 && catKey && typeof finalFilters[catKey] === 'string' && finalFilters[catKey].length > 2) {
                const currentVal = finalFilters[catKey].trim();
                let altVal = currentVal.endsWith('s') ? currentVal.slice(0, -1) : currentVal + 's';
                const altList = await fixit.entities[dbEntity].filter({ ...finalFilters, [catKey]: altVal });
                list = [...list, ...altList];
             }

             // Fallback 2: Show ALL brands if no specific match
             if (list.length === 0 && dbEntity === 'Brand' && finalFilters['category']) {
                const genericBrands = await fixit.entities.Brand.list('-created_date', 500);
                list = [...list, ...genericBrands];
             }
          } catch(e) { console.error("Filter failed", e); }
          entityResults = list.map((item) => item.name);
        } catch (e) { console.error("Error fetching persistent entities", e); }
      }

      // 2. Fetch from existing data (Data Discovery)
      const fetchDistinct = async (table, column) => {
        try {
          const filters = { ...parentFilters };
          const applyAltMapping = (f) => {
             const nf = { ...f };
             if (table === 'products') {
               if (nf['device_type'] !== undefined) { nf['category'] = nf['device_type']; delete nf['device_type']; }
               if (nf['device_brand'] !== undefined) { nf['brand'] = nf['device_brand']; delete nf['device_brand']; }
               if (nf['device_model'] !== undefined) { nf['model'] = nf['device_model']; delete nf['device_model']; }
             } else if (table === 'repairs') {
               if (nf['category'] !== undefined) { nf['device_type'] = nf['category']; delete nf['category']; }
               if (nf['brand'] !== undefined) { nf['device_brand'] = nf['brand']; delete nf['brand']; }
               if (nf['model'] !== undefined) { nf['device_model'] = nf['model']; delete nf['model']; }
             }
             return nf;
          };
          const runQuery = async (f) => {
            const res = await fixit.functions.invoke('getDistinctValues', { table, column, filters: applyAltMapping(f) });
            return res.success ? res.result : [];
          };

          let finalRes = await runQuery(filters);
          const catKey = filters['category'] ? 'category' : (filters['device_type'] ? 'device_type' : null);
          if (finalRes.length === 0 && catKey && typeof filters[catKey] === 'string' && filters[catKey].length > 2) {
             const currentVal = filters[catKey].trim();
             let altVal = currentVal.endsWith('s') ? currentVal.slice(0, -1) : currentVal + 's';
             const altRes = await runQuery({ ...filters, [catKey]: altVal });
             finalRes = [...finalRes, ...altRes];
          }
          return finalRes;
        } catch(e) { return []; }
      };

      let results = [];
      if (entityType === 'brand') {
        const brandsP = await fetchDistinct('products', 'brand');
        const brandsR = await fetchDistinct('repairs', 'device_brand');
        results = [...new Set([...entityResults, ...brandsP, ...brandsR])];
      } else if (entityType === 'category') {
        const catP = await fetchDistinct('products', 'category');
        results = [...new Set([...entityResults, ...catP])];
      } else if (entityType === 'model') {
        const modelsP = await fetchDistinct('products', 'model');
        const modelsR = await fetchDistinct('repairs', 'device_model');
        results = [...new Set([...entityResults, ...modelsP, ...modelsR])];
      } else if (entityType === 'device_type') {
        const dtR = await fetchDistinct('repairs', 'device_type');
        results = [...new Set([...entityResults, ...dtR])];
      } else if (entityType === 'custom' && customTable && customColumn) {
        results = await fetchDistinct(customTable, customColumn);
      } else {
        results = entityResults;
      }
      
      const fetchedOptions = results.map(str => ({ id: str, label: str }));
      const mergedMap = new Map();
      defaultOptions.forEach(o => mergedMap.set(o.id.toLowerCase(), { id: o.id, label: o.label }));
      fetchedOptions.forEach(o => {
        if (o.id && !mergedMap.has(o.id.toLowerCase())) {
          mergedMap.set(o.id.toLowerCase(), o);
        }
      });
      return Array.from(mergedMap.values());
    },
  });

  const completeOptions = useMemo(() => {
    let list = [...rawOptions];
    if (!isSupplier && value && String(value).trim() !== '' && !list.some(o => o.id === value)) {
      list.push({ id: value, label: value });
    }
    return list;
  }, [rawOptions, isSupplier, value]);

  // -- Derive search text from value --
  useEffect(() => {
    if (!showDropdown && value !== undefined) {
      if (!value) {
        setQuery('');
      } else {
        const match = completeOptions.find(o => o.id === value);
        if (match) setQuery(match.label);
        else if (!isSupplier) setQuery(value); // Custom string
      }
    }
  }, [value, showDropdown, completeOptions, isSupplier]);

  // Handle outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
        if (isSupplier && value) {
          const match = completeOptions.find(o => o.id === value);
          setQuery(match ? match.label : '');
        } else if (!isSupplier && query !== value && query.trim() !== '') {
           onChange(query.trim(), query.trim());
        } else if (!value) {
           setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [wrapperRef, value, query, isSupplier, completeOptions, onChange]);

  // -- Filter options --
  const filtered = useMemo(() => {
    const lower = (query || '').toString().toLowerCase().trim();
    if (!lower) return completeOptions;
    const selectedOpt = completeOptions.find(o => o.id === value || o.label === value);
    if (selectedOpt && selectedOpt.label.toLowerCase() === lower) return completeOptions;
    return completeOptions.filter(o => o.label?.toLowerCase().includes(lower) || (o.extra && o.extra.toLowerCase().includes(lower)));
  }, [query, completeOptions, value]);

  const safeQuery = (query || '').toString();
  const exactMatch = filtered.some(o => o.label?.toLowerCase() === safeQuery.toLowerCase().trim());

  // -- Mutation for Supplier --
  const createSupplierMut = useMutation({
    mutationFn: (data) => fixit.entities.Supplier.create(data),
    onSuccess: (newSupplier) => {
      qc.invalidateQueries({ queryKey: ['refOptions'] });
      onChange(newSupplier.id, newSupplier.name);
      setQuery(newSupplier.name);
      setShowSupplierModal(false);
      setShowDropdown(false);
      setNewSupplierForm({ name: '', phone: '' });
    }
  });

  // -- Mutation for generic entities --
  const createEntityMut = useMutation({
    mutationFn: (data) => fixit.entities[dbEntity].create(data),
    onSuccess: (newRecord) => {
      qc.invalidateQueries({ queryKey: ['refOptions'] });
      const recordName = newRecord?.name || newEntityName;
      onChange(recordName, recordName);
      setQuery(recordName);
      setShowCreateModal(false);
      setShowDropdown(false);
      setNewEntityName('');
    },
    onError: (err) => {
      console.error("Erreur de création:", err);
      alert("Erreur lors de la création : " + (err.message || "Erreur inconnue"));
    }
  });

  const handleSelect = (id, label) => {
    onChange(id, label);
    setQuery(label);
    setShowDropdown(false);
  };

  const handleCreateInline = () => {
    const val = safeQuery.trim();
    if (isSupplier) {
      setNewSupplierForm({ name: val, phone: '' });
      setShowSupplierModal(true);
      setShowDropdown(false);
    } else if (dbEntity) {
      setNewEntityName(val);
      setShowCreateModal(true);
      setShowDropdown(false);
    } else {
      if (!val) {
        if (inputRef.current) inputRef.current.focus();
        return;
      }
      onChange(val, val);
      setQuery(val);
      setShowDropdown(false);
    }
  };

  const submitSupplier = async () => {
    if (!newSupplierForm.name) return;
    setSaving(true);
    await createSupplierMut.mutateAsync(newSupplierForm);
    setSaving(false);
  };

  const submitEntity = async () => {
    if (!newEntityName) return;
    setSaving(true);
    const payload = { name: newEntityName };
    if (dbEntity === 'DeviceModel') {
      if (parentFilters['device_brand']) payload['brand'] = parentFilters['device_brand'];
      else if (parentFilters['brand']) payload['brand'] = parentFilters['brand'];
      if (parentFilters['device_type']) payload['device_type'] = parentFilters['device_type'];
      else if (parentFilters['category']) payload['device_type'] = parentFilters['category'];
    }
    // For brands, we can also link to category if selected
    if (dbEntity === 'Brand') {
        const catVal = parentFilters['category'] || parentFilters['device_type'];
        if (catVal) payload['category'] = catVal;
    }
    await createEntityMut.mutateAsync(payload);
    setSaving(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div ref={wrapperRef} className="relative">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => {
                const nv = e.target.value;
                setQuery(nv);
                setShowDropdown(true);
                if (nv === '') onChange('', '');
              }}
              onFocus={(e) => { e.target.select(); setShowDropdown(true); }}
              placeholder={pText}
              className="pl-8 pr-8 bg-background"
              disabled={disabled}
              required={required}
            />
            {query && !disabled && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => { setQuery(''); onChange('', ''); setShowDropdown(true); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {showDropdown && !disabled && (
          <div className="absolute z-50 w-full mt-1.5 rounded-xl border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1">
            {isLoading && <div className="p-3 text-sm text-center text-muted-foreground">Chargement...</div>}
            {!isLoading && (
              <div className="max-h-[220px] overflow-y-auto">
                {filtered.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                    onClick={() => handleSelect(opt.id, opt.label)}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="h-6 w-6 rounded flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="truncate">{opt.label}</span>
                      {opt.extra && <span className="text-xs text-muted-foreground ml-2">— {opt.extra}</span>}
                    </div>
                    {value === opt.id && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                  </button>
                ))}
                {!(safeQuery.trim().length > 0 && exactMatch) && (
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary hover:bg-primary/10 transition-colors border-t border-border/50 font-medium text-left"
                    onClick={handleCreateInline}
                  >
                    <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    {safeQuery.trim().length === 0 ? "Ajouter" : "Créer \"" + safeQuery + "\""}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showSupplierModal} onOpenChange={setShowSupplierModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Nouveau fournisseur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Nom *</Label>
              <Input 
                value={newSupplierForm.name} 
                onChange={e => setNewSupplierForm({...newSupplierForm, name: e.target.value})} 
                placeholder="Société ou Contact" 
                autoFocus 
              />
            </div>
            <div>
              <Label>Téléphone (optionnel)</Label>
              <PhoneInput 
                value={newSupplierForm.phone} 
                onChange={v => setNewSupplierForm({...newSupplierForm, phone: v})} 
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowSupplierModal(false)}>Annuler</Button>
              <Button onClick={submitSupplier} disabled={saving || !newSupplierForm.name}>
                {saving ? 'Création...' : 'Créer et sélectionner'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Plus className="h-5 w-5 text-primary" />
              Nouveau {prettyName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitEntity(); }} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="entity-name">Nom du {prettyName} *</Label>
              <Input 
                id="entity-name"
                value={newEntityName} 
                onChange={e => setNewEntityName(e.target.value)} 
                placeholder={`Nom de ${prettyName}...`} 
                autoFocus 
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Annuler</Button>
              <Button type="submit" disabled={saving || !newEntityName.trim()}>
                {saving ? 'Création...' : 'Créer et sélectionner'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
