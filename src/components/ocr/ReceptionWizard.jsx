import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import EntityRefSelect from "@/components/ui/EntityRefSelect";
import { 
  ChevronRight, ChevronLeft, Check, Package, Barcode, 
  Tag, Image as ImageIcon, Sparkles, ShoppingCart, 
  Smartphone, Upload, X
} from 'lucide-react';
import { useAppSettings } from "@/components/settings/SettingsContext";
import { fixit } from "@/api/fixitClient";
import { toast } from "sonner";

export default function ReceptionWizard({ open, onOpenChange, items: initialItems, onFinish }) {
  const { formatCurrency, settings } = useAppSettings();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && initialItems?.length > 0) {
      setItems(initialItems.map(it => ({
        ...it,
        category: it.category || 'Téléphone',
        brand: it.brand || '',
        model: it.model || '',
        sell_price: it.sell_price || (it.unit_price * 1.3), // Default 30% margin
        barcode: it.barcode || '',
        image_url: it.image_url || ''
      })));
      setCurrentIndex(0);
    }
  }, [open, initialItems]);

  if (!items || items.length === 0) return null;

  const current = items[currentIndex];

  const handleUpdate = (field, val) => {
    const n = [...items];
    n[currentIndex] = { ...n[currentIndex], [field]: val };
    setItems(n);
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(v => v + 1);
    } else {
      onFinish(items);
      onOpenChange(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(v => v - 1);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await fixit.integrations.Core.UploadFile({ file });
      handleUpdate('image_url', file_url);
      toast.success("Image téléchargée");
    } catch (e) {
      toast.error("Erreur téléchargement");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <div className="bg-primary/5 p-6 pb-4 border-b border-border/50">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Assistant de Réception</DialogTitle>
                <p className="text-sm text-muted-foreground">Configuration rapide des articles ({currentIndex + 1} / {items.length})</p>
              </div>
            </div>
            <div className="flex gap-1 bg-background/50 p-1 rounded-lg border border-border/40">
               {items.map((_, i) => (
                 <div key={i} className={`h-1.5 w-4 rounded-full transition-all ${i === currentIndex ? 'bg-primary w-8' : (i < currentIndex ? 'bg-primary/40' : 'bg-muted')}`} />
               ))}
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Product Header */}
          <div className="flex items-start gap-6 p-4 rounded-2xl bg-muted/30 border border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="relative group">
                <div className="h-32 w-32 rounded-xl bg-background border border-border/50 flex items-center justify-center overflow-hidden shadow-sm">
                  {current.image_url ? (
                    <img src={current.image_url} alt="Prod" className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-[10px] font-medium uppercase">Sans image</span>
                    </div>
                  )}
                </div>

                <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    <div className="bg-white/90 p-2 rounded-full text-black shadow-lg">
                      <Upload className="h-4 w-4" />
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
             </div>

             <div className="flex-1 min-w-0 pt-2">
                <h3 className="text-lg font-bold truncate leading-tight mb-1">{current.product_name}</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                   <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary-foreground/80 font-mono text-[10px]">
                      {current.quantity_ordered} UNITÉ(S)
                   </Badge>
                   <Badge variant="outline" className="bg-emerald-500/5 border-emerald-500/20 text-emerald-500 font-mono text-[10px]">
                      P.ACHAT: {formatCurrency(current.unit_price)}
                   </Badge>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-400 delay-100">
             <div className="space-y-4">
                <div className="space-y-1.5">
                   <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                      <Smartphone className="h-3 w-3" /> Catégorie & Modèle
                   </Label>
                   <EntityRefSelect 
                      entityType="category" 
                      value={current.category} 
                      onChange={v => handleUpdate('category', v)} 
                      placeholder="Choisir une catégorie..."
                   />
                   <div className="grid grid-cols-2 gap-2 mt-2">
                      <EntityRefSelect 
                        entityType="brand" 
                        parentFilters={{ category: current.category }}
                        value={current.brand} 
                        onChange={v => handleUpdate('brand', v)} 
                        placeholder="Marque"
                      />
                      <EntityRefSelect 
                        entityType="model" 
                        parentFilters={{ category: current.category, brand: current.brand }}
                        value={current.model} 
                        onChange={v => handleUpdate('model', v)} 
                        placeholder="Modèle"
                      />
                   </div>
                </div>

                <div className="space-y-1.5">
                   <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                      <Barcode className="h-3 w-3" /> Code-barres / SKU
                   </Label>
                   <Input 
                      placeholder="Scanner ou saisir le code..." 
                      value={current.barcode} 
                      onChange={e => handleUpdate('barcode', e.target.value)}
                      className="bg-muted/30 border-border/40 focus:ring-primary/20"
                   />
                </div>
             </div>

             <div className="space-y-4">
                <div className="space-y-1.5 p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                   <Label className="text-xs font-bold uppercase text-orange-600 flex items-center gap-1.5">
                      <Tag className="h-3 w-3" /> Prix de vente ({settings.currency_symbol || 'DT'})
                   </Label>
                   <Input 
                      type="number" 
                      step="0.001"
                      value={current.sell_price} 
                      onChange={e => handleUpdate('sell_price', parseFloat(e.target.value) || 0)}
                      className="h-12 text-xl font-bold border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20 bg-background"
                   />
                   <p className="text-[10px] text-muted-foreground mt-1">
                      Marge suggérée : +30% sur le prix d'achat
                   </p>
                </div>

                <div className="pt-4">
                   <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex justify-between items-center">
                      <span className="text-xs font-medium text-emerald-600">Bénéfice estimé</span>
                      <span className="font-bold text-emerald-500">
                         {formatCurrency((current.sell_price - current.unit_price) * current.quantity_ordered)}
                      </span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/10 border-t border-border/50 flex-row justify-between items-center">
          <Button variant="ghost" onClick={handlePrev} disabled={currentIndex === 0}>
             <ChevronLeft className="h-4 w-4 mr-2" /> Précédent
          </Button>
          
          <Button 
            onClick={handleNext} 
            className="px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 h-11"
          >
             {currentIndex < items.length - 1 ? (
               <>Suivant <ChevronRight className="h-4 w-4 ml-2" /></>
             ) : (
               <>Terminer <Check className="h-4 w-4 ml-2" /></>
             )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
