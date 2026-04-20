import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { fixit } from '@/api/fixitClient';
import { fixitFetch } from '@/api/fixitFetch';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Camera, Upload, Loader2, CheckCircle2, AlertCircle, X, Sparkles,
  Package, Plus, ChevronDown, ChevronUp, ImagePlus, Trash2,
} from 'lucide-react';
import { useAppSettings } from '@/components/settings/SettingsContext';

// Resize image to max 1024px and return base64
function resizeImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl.split(',')[1]); // return base64 only
    };
    img.src = url;
  });
}

const STATUS = { PENDING: 'pending', LOADING: 'loading', DONE: 'done', ERROR: 'error' };

function ProductRow({ item, index, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(true);
  const d = item.data;

  const field = (key, label, type = 'text') => (
    <div>
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <Input
        type={type}
        value={d?.[key] ?? ''}
        onChange={e => onChange(index, key, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className="h-8 text-sm"
      />
    </div>
  );

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      item.status === STATUS.ERROR ? 'border-destructive/50 bg-destructive/5' :
      item.status === STATUS.DONE ? 'border-primary/30 bg-primary/5' :
      'border-border bg-card'
    }`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Thumbnail */}
        <img src={item.preview} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 border border-border/50" />

        {/* Status icon */}
        <div className="shrink-0">
          {item.status === STATUS.LOADING && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
          {item.status === STATUS.DONE && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          {item.status === STATUS.ERROR && <AlertCircle className="h-5 w-5 text-destructive" />}
          {item.status === STATUS.PENDING && <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          {item.status === STATUS.LOADING && (
            <p className="text-sm text-muted-foreground animate-pulse">Analyse en cours…</p>
          )}
          {item.status === STATUS.ERROR && (
            <p className="text-sm text-destructive">{item.error}</p>
          )}
          {item.status === STATUS.DONE && (
            <div>
              <p className="text-sm font-medium truncate">{d?.name || 'Produit sans nom'}</p>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {d?.brand && <span className="text-xs text-muted-foreground">{d.brand}</span>}
                {d?.model && <span className="text-xs text-muted-foreground">· {d.model}</span>}
                {(d?.sell_price > 0) && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1 text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
                    {d.sell_price} (prix détecté)
                  </Badge>
                )}
              </div>
            </div>
          )}
          {item.status === STATUS.PENDING && (
            <p className="text-sm text-muted-foreground">En attente…</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {item.status === STATUS.DONE && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editable fields */}
      {item.status === STATUS.DONE && expanded && (
        <div className="px-3 pb-3 border-t border-border/50 pt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {field('name', 'Nom *')}
          {field('brand', 'Marque')}
          {field('model', 'Modèle')}
          {field('category', 'Catégorie')}
          {field('barcode', 'Code-barres')}
          {field('sku', 'SKU')}
          {field('sell_price', 'Prix vente', 'number')}
          {field('buy_price', 'Prix achat', 'number')}
          {field('quantity', 'Qté initiale', 'number')}
        </div>
      )}
    </div>
  );
}

export default function PhotoScanner({ open, onOpenChange }) {
  const { settings } = useAppSettings();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const qc = useQueryClient();

  const hasApiKey = !!(settings.openai_api_key);
  const doneCount = items.filter(i => i.status === STATUS.DONE).length;
  const savedCount = items.filter(i => i.saved).length;

  const addFiles = useCallback(async (files) => {
    const newItems = await Promise.all(Array.from(files).map(async (file) => {
      const preview = URL.createObjectURL(file);
      return {
        id: Math.random().toString(36).slice(2),
        file,
        preview,
        status: STATUS.PENDING,
        data: null,
        error: null,
        saved: false,
      };
    }));
    setItems(prev => [...prev, ...newItems]);

    // Analyze each one sequentially to avoid rate limits
    for (const item of newItems) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: STATUS.LOADING } : i));
      try {
        const base64 = await resizeImage(item.file);
        const mimeType = item.file.type || 'image/jpeg';
        const result = await fixitFetch('/functions/analyzeProductPhoto', {
          method: 'POST',
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        setItems(prev => prev.map(i =>
          i.id === item.id
            ? {
                ...i,
                status: STATUS.DONE,
                data: {
                  ...result,
                  // Use AI-detected prices if present, else default to 0
                  sell_price: result.sell_price != null ? parseFloat(result.sell_price) || 0 : 0,
                  buy_price:  result.buy_price  != null ? parseFloat(result.buy_price)  || 0 : 0,
                  quantity: 0, // always start at 0, user sets stock
                },
              }
            : i
        ));
      } catch (err) {
        setItems(prev => prev.map(i =>
          i.id === item.id
            ? { ...i, status: STATUS.ERROR, error: err.message }
            : i
        ));
      }
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = ''; // allow re-selecting same files
    }
  };

  const handleChange = (index, key, value) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, data: { ...item.data, [key]: value } } : item
    ));
  };

  const handleRemove = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    const toSave = items.filter(i => i.status === STATUS.DONE && !i.saved);
    if (!toSave.length) return;
    setSaving(true);
    let ok = 0;
    for (const item of toSave) {
      try {
        const d = item.data;
        const product = await fixit.entities.Product.create({
          name: d.name || 'Produit',
          brand: d.brand || '',
          model: d.model || '',
          category: d.category || '',
          barcode: d.barcode || '',
          sku: d.sku || '',
          sell_price: parseFloat(d.sell_price) || 0,
          buy_price: parseFloat(d.buy_price) || 0,
          quantity: parseInt(d.quantity) || 0,
          condition: d.condition || 'neuf',
        });
        if ((parseInt(d.quantity) || 0) > 0) {
          await fixit.entities.StockMovement.create({
            product_id: product.id,
            type: 'entree',
            quantity: parseInt(d.quantity),
            previous_stock: 0,
            new_stock: parseInt(d.quantity),
            reason: 'Stock initial (scan photo)',
            reference_type: 'inventaire',
            unit_cost: parseFloat(d.buy_price) || 0,
          });
        }
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, saved: true } : i));
        ok++;
      } catch (err) {
        toast.error(`Erreur pour "${item.data?.name}": ${err.message}`);
      }
    }
    setSaving(false);
    if (ok > 0) {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(`${ok} produit${ok > 1 ? 's' : ''} créé${ok > 1 ? 's' : ''} avec succès`);
    }
  };

  const handleClose = () => {
    items.forEach(i => { if (i.preview) URL.revokeObjectURL(i.preview); });
    setItems([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 py-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            Scanner des produits par photo
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Prenez des photos ou sélectionnez depuis la galerie — l'IA détecte automatiquement le nom, la marque, le modèle et le code-barres.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* No API key warning */}
          {!hasApiKey && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Clé API OpenAI requise</p>
                <p className="text-xs mt-0.5 opacity-80">
                  Ajoutez votre clé dans <strong>Paramètres → Intégrations → Clé API OpenAI</strong> pour activer l'analyse IA.
                </p>
              </div>
            </div>
          )}

          {/* Drop zone / Add photos */}
          <label
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all
              ${hasApiKey ? 'border-primary/30 hover:border-primary/60 hover:bg-primary/5' : 'border-border/40 opacity-50 pointer-events-none'}
              bg-muted/20`}
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ImagePlus className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Ajouter des photos</p>
              <p className="text-xs text-muted-foreground mt-0.5">Depuis la galerie ou l'appareil photo</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs gap-1"><Camera className="h-3 w-3" />Appareil photo</Badge>
              <Badge variant="outline" className="text-xs gap-1"><Upload className="h-3 w-3" />Galerie</Badge>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={!hasApiKey}
            />
          </label>

          {/* Items list */}
          {items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {items.length} photo{items.length > 1 ? 's' : ''}
                  {doneCount > 0 && <span className="text-muted-foreground font-normal"> · {doneCount} analysé{doneCount > 1 ? 's' : ''}</span>}
                  {savedCount > 0 && <span className="text-green-600 font-normal"> · {savedCount} enregistré{savedCount > 1 ? 's' : ''}</span>}
                </p>
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Tout effacer
                </button>
              </div>

              {items.map((item, index) => (
                <ProductRow
                  key={item.id}
                  item={item}
                  index={index}
                  onChange={handleChange}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/50 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {doneCount - savedCount > 0
              ? `${doneCount - savedCount} produit${doneCount - savedCount > 1 ? 's' : ''} prêt${doneCount - savedCount > 1 ? 's' : ''} à créer`
              : 'Vérifiez et complétez les informations avant de créer'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Fermer</Button>
            <Button
              onClick={handleSaveAll}
              disabled={doneCount === 0 || doneCount === savedCount || saving}
              className="gap-2"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Création…</>
              ) : (
                <><Plus className="h-4 w-4" />Créer {doneCount - savedCount > 0 ? `${doneCount - savedCount} ` : ''}produit{doneCount - savedCount > 1 ? 's' : ''}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
