import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { useAppSettings } from "@/components/settings/SettingsContext";
import { 
  Sparkles, Loader2, Image as ImageIcon, FileText, 
  Camera, Upload, Scan, AlertCircle, CheckCircle2 
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Config pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";



export default function InvoiceScanner({ onSave, open, onOpenChange, orders }) {
  const { settings } = useAppSettings();

  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;

    if (f.type === 'application/pdf') {
        setScanning(true);
        try {
            const canvas = await renderPdfPage(f);
            const dataUrl = canvas.toDataURL('image/jpeg');
            setFile(dataUrl);
            const blob = await (await fetch(dataUrl)).blob();
            const imageFile = new File([blob], "from-pdf.jpg", { type: "image/jpeg" });
            
            if (settings.ocr_provider === 'openai' && settings.openai_api_key) {
                doOpenAiVision(imageFile);
            } else if (settings.ocr_provider === 'google_vision' && settings.google_vision_api_key) {
                doCloudOCR(imageFile);
            } else {
                doOCR(imageFile);
            }
        } catch (err) {
            console.error("PDF Parsing Error:", err);
            toast({ title: "Erreur PDF", description: "Impossible de lire le document.", variant: "destructive" });
            setScanning(false);
        }
    } else {
        setFile(URL.createObjectURL(f)); 
        if (settings.ocr_provider === 'openai' && settings.openai_api_key) {
            doOpenAiVision(f);
        } else if (settings.ocr_provider === 'google_vision' && settings.google_vision_api_key) {
            doCloudOCR(f);
        } else {
            doOCR(f);
        }
    }
  };

  const renderPdfPage = async (pdfFile) => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport, canvas: canvas }).promise;
    return canvas;
  };




  const doOpenAiVision = async (fileObj) => {
    setScanning(true);
    setProgress(20);
    try {
        const base64 = await imageToBase64(fileObj);
        setProgress(50);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.openai_api_key}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: `Analyze this invoice image. 
                            Extract: supplier_name, order_number (ref), date (YYYY-MM-DD), 
                            items (array of {product_name, quantity_ordered, unit_price}),
                            total_amount (final invoice total),
                            amount_paid (already paid),
                            amount_due (remaining balance).
                            
                            STRICT VALIDATION RULES:
                            1. **QUANTITIES**: quantity_ordered must be the actual number of products (small integers like 1, 5, 20). 
                               NEVER mistake a Reference, Barcode, or EAN Code (large numbers like 1782, 619...) for a quantity. 
                               If unsure, assume quantity is 1.
                            2. **PRICES (TND)**: Values are in Tunisian Dinars. 
                               If you see "364 000" or "364.000" it's 364.000 Dinars (not 364 thousand).
                               Standardize all prices (unit_price, total_amount) to Dinar units with 3 decimals.
                               Example: "25 500" -> 25.500, "1 200" -> 1.200.
                            3. **TOTAL**: If total_amount seems unusually high (>3000 DT) while items are low-cost, check if you missed a decimal.
                            Return ONLY valid JSON.

` },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
                        ]

                    }
                ],
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("Réponse IA vide");

        const parsed = JSON.parse(content);
        
        // Helper to normalize TND prices (handle 2,5 vs 2.5 and millimes)
        const normalizeTND = (val) => {
            if (!val) return 0;
            // Handle commas as decimal separators
            let s = String(val).replace(',', '.');
            let n = parseFloat(s) || 0;
            
            // Heuristic for Tunisian Millimes:
            // If the price is huge (e.g. > 10000), it's almost certainly written in millimes (25000 = 25 DT)
            // But if it's 1500, it could be a laptop.
            // If it's a typical unit price, we keep it.
            // Typical max unit price in this shop might be 5000 DT.
            if (n >= 10000) return n / 1000;
            return n;
        };


        const cleanedItems = (parsed.items || [])
            .map(item => {
                // Remove any non-digits from quantity (ex: "20 pcs" -> 20)
                let q = parseInt(String(item.quantity_ordered).replace(/[^\d]/g, '')) || 0;
                
                // Robust check: references/barcodes are usually very large
                // If it's a huge number, it's likely a reference, not quantity
                if (q > 500) q = 1; 

                return {
                    ...item,
                    product_name: String(item.product_name || "").trim(),
                    quantity_ordered: q,
                    unit_price: normalizeTND(item.unit_price)
                };
            })
            // Filter out garbage: items with no name or where name is just a number (likely a barcode row)
            .filter(item => {
                const name = item.product_name;
                if (!name || name.length < 2) return false;
                // If name is purely numeric and long, it's a code
                if (/^\d{5,}$/.test(name)) return false;
                return true;
            });

        const finalResult = {
            supplier_name: parsed.supplier_name || "",
            order_number: parsed.order_number || "",
            date: parsed.date || new Date().toISOString().split('T')[0],
            items: cleanedItems,
            total_amount: normalizeTND(parsed.total_amount) || cleanedItems.reduce((s,i) => s + (i.quantity_ordered * i.unit_price), 0),
            amount_paid: normalizeTND(parsed.amount_paid) || 0,
            amount_due: normalizeTND(parsed.amount_due) || 0
        };

        setResult(finalResult);

        // Duplicate check
        if (orders && finalResult.order_number && finalResult.supplier_name) {
           const exists = orders.find(o => 
             o.supplier_name?.toLowerCase().trim() === finalResult.supplier_name?.toLowerCase().trim() &&
             o.order_number?.toLowerCase().trim() === finalResult.order_number?.toLowerCase().trim()
           );
           if (exists) {
              toast({
                  title: "⚠️ Facture déjà existante !",
                  description: `Le numéro ${finalResult.order_number} est déjà enregistré pour ce fournisseur.`,
                  variant: "destructive"
              });
           }
        }




        toast.success("Analyse terminée", { description: "Données extraites avec succès." });

    } catch (err) {
        console.error("OpenAI Vision Error:", err);
        toast.error("Échec de l'analyse", { description: "Erreur lors du traitement intelligent." });

        doCloudOCR(fileObj); // Fallback to Google
    } finally {
        setScanning(false);
        setProgress(0);
    }
  };


  const imageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
          const result = reader.result;
          if (typeof result === 'string') {
              resolve(result.split(',')[1]);
          } else {
              reject(new Error("Format de fichier invalide"));
          }
      };
      reader.onerror = error => reject(error);
    });
  };


  const doCloudOCR = async (fileObj) => {
      setScanning(true);
      setProgress(10);
      try {
          const base64 = await imageToBase64(fileObj);
          setProgress(40);
          
          const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${settings.google_vision_api_key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  requests: [{
                      image: { content: base64 },
                      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
                  }]
              })
          });
          setProgress(80);
          const data = await response.json();
          const fullText = data.responses?.[0]?.fullTextAnnotation?.text || "";
          
          if (!fullText) throw new Error("Aucun texte détecté");
          
          setResult(parseInvoice(fullText));
          toast({ title: "Scan Pro terminé", description: "Données extraites via Google IA." });
      } catch (err) {
          console.error("Cloud OCR Error:", err);
          toast({ title: "Erreur Cloud Vision", description: "Vérifiez votre clé API ou connexion.", variant: "destructive" });
          doOCR(fileObj); // Fallback to local
      } finally {
          setScanning(false);
          setProgress(0);
      }
  };

  const doOCR = async (image) => {

    setScanning(true);
    setProgress(0);
    try {
      const { data: { text } } = await Tesseract.recognize(image, 'fra+eng', {
        logger: m => {
          if (m.status === 'recognizing text') setProgress(Math.floor(m.progress * 100));
        }
      });
      console.log("OCR RAW:", text);
      const parsed = parseInvoice(text);
      setResult(parsed);
    } catch (err) {
      toast({ title: "Erreur OCR", description: "Impossible de lire le document", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const parseInvoice = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    
    // Simple heuristic extraction
    const res = {
      supplier_name: '',
      order_number: '',
      date: new Date().toISOString().split('T')[0],
      items: [],
      total_amount: 0,
      amount_paid: 0,
      amount_due: 0
    };


    // 1. Guess Supplier (usually first lines of invoice)
    if (lines.length > 0) res.supplier_name = lines[0].toUpperCase();

    // 2. Guess Invoice Number
    const refMatch = text.match(/(?:Facture|REC|REF|N|INV)[^\d]*(\d+[\w-]*)/i);
    if (refMatch) res.order_number = refMatch[1];

    // Paye/Reste heuristic
    const paidMatch = text.match(/(?:Payé|Versé|Versement)[^\d]*(\d+[.,]\d{3})/i);
    if (paidMatch) res.amount_paid = parseFloat(paidMatch[1].replace(',', '.'));
    const dueMatch = text.match(/(?:Reste|Solde|Reliquat|Net à payer)[^\d]*(\d+[.,]\d{3})/i);
    if (dueMatch) res.amount_due = parseFloat(dueMatch[1].replace(',', '.'));


    // 3. Guess Date
    const dateMatch = text.match(/(\d{2}[/-]\d{2}[/-]\d{2,4})/);
    if (dateMatch) {
      // Basic normalization DD/MM/YYYY -> YYYY-MM-DD
      const d = dateMatch[1].split(/[/-]/);
      if (d.length === 3) {
          const year = d[2].length === 2 ? '20' + d[2] : d[2];
          res.date = `${year}-${d[1]}-${d[0]}`;
      }
    }

    // 4. Guess Items (look for lines with numbers at the end)
    // Format usually: [Name] [Qty] [Price] [Total]
    lines.forEach(line => {
        const parts = line.split(/\s+/);
        const prices = parts.filter(p => !isNaN(p.replace(',', '.')) && p.includes('.'));
        const qtyMatch = line.match(/\b(\d+)\b/); // Simple digit for qty
        
        if (prices.length >= 1 && parts.length > 2) {
            const lastPrice = parseFloat(prices[prices.length - 1].replace(',', '.'));
            const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
            const name = parts.slice(0, parts.length - prices.length).join(' ').replace(/\d+$/, '').trim();
            
            if (name.length > 3 && lastPrice > 0) {
                res.items.push({
                    product_id: '', // Will be matched later
                    product_name: name,
                    quantity_ordered: qty,
                    quantity_received: qty,
                    unit_price: lastPrice / (qty || 1)
                });
            }
        }
    });

    res.total_amount = res.items.reduce((s, i) => s + (i.quantity_ordered * i.unit_price), 0);
    return res;
  };

  const handleConfirm = () => {
    if (result) onSave(result);
    onOpenChange(false);
    setResult(null);
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-primary" /> Scan Intelligent de Facture
          </DialogTitle>
        </DialogHeader>

        {!file ? (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-xl bg-muted/20 gap-4">
             <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                 <Upload className="h-8 w-8 text-primary" />
             </div>
             <div className="text-center">
                 <p className="font-semibold">Glissez une facture ou cliquez pour parcourir</p>
                 <p className="text-xs text-muted-foreground mt-1 tracking-tight">Images (JPG, PNG) ou documents PDF supportés</p>
             </div>
             <Button onClick={() => fileRef.current?.click()} className="mt-2">Choisir un fichier</Button>
             <input type="file" ref={fileRef} className="hidden" accept="image/*,.pdf" onChange={handleFile} />

          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
               <div className="aspect-[3/4] rounded-lg border bg-black/5 flex items-center justify-center overflow-hidden relative">
                   <img src={file} className="max-w-full max-h-full object-contain" alt="Preview" />
                   {scanning && (
                       <div className="absolute inset-x-0 top-0 h-1 bg-primary animate-scan-line shadow-[0_0_15px_rgba(var(--primary),0.8)]" />
                   )}
               </div>
               {scanning && (
                   <div className="space-y-2">
                       <div className="flex justify-between text-xs font-mono">
                           <span>Analyse OCR en cours...</span>
                           <span>{progress}%</span>
                       </div>
                       <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                           <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                       </div>
                   </div>
               )}
            </div>

            <div className="space-y-5">
                {scanning ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-12">
                        <Loader2 className="h-10 w-10 animate-spin" />
                        <p className="text-sm font-medium">Extraction des données...</p>
                    </div>
                ) : result ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Analyse terminée avec succès</p>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Fournisseur détecté</Label>
                                <Input value={result.supplier_name} onChange={e => setResult({...result, supplier_name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">N° Facture</Label>
                                    <Input value={result.order_number} onChange={e => setResult({...result, order_number: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Date</Label>
                                    <Input type="date" value={result.date} onChange={e => setResult({...result, date: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                             <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Articles ({result.items.length})</Label>
                                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setResult({...result, items: [...result.items, { product_name: 'Nouvel article', quantity_ordered: 1, unit_price: 0 }]})}>+ Ajouter manuellement</Button>
                             </div>
                             <div className="border rounded-lg overflow-hidden">
                                <div className="max-h-[250px] overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="text-left p-2 border-b">Produit</th>
                                                <th className="text-right p-2 border-b w-12">Qté</th>
                                                <th className="text-right p-2 border-b w-24">Prix U.</th>
                                                <th className="text-right p-2 border-b w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y relative">
                                            {result.items.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-muted/50">
                                                    <td className="p-1">
                                                        <input className="w-full bg-transparent p-1 outline-none focus:bg-white dark:focus:bg-zinc-800" value={item.product_name} onChange={e => {
                                                            const n = [...result.items]; n[idx].product_name = e.target.value;
                                                            setResult({...result, items: n});
                                                        }} />
                                                    </td>
                                                    <td className="p-1 text-right">
                                                        <input type="number" className="w-full bg-transparent p-1 text-right outline-none focus:bg-white dark:focus:bg-zinc-800" value={item.quantity_ordered} onChange={e => {
                                                            const n = [...result.items]; n[idx].quantity_ordered = parseInt(e.target.value) || 0;
                                                            setResult({...result, items: n, total_amount: n.reduce((s,i)=>s+(i.quantity_ordered*i.unit_price),0)});
                                                        }} />
                                                    </td>
                                                    <td className="p-1 text-right">
                                                        <input type="number" step="0.001" className="w-full bg-transparent p-1 text-right outline-none focus:bg-white dark:focus:bg-zinc-800" value={item.unit_price} onChange={e => {
                                                            const n = [...result.items]; n[idx].unit_price = parseFloat(e.target.value) || 0;
                                                            setResult({...result, items: n, total_amount: n.reduce((s,i)=>s+(i.quantity_ordered*i.unit_price),0)});
                                                        }} />
                                                    </td>
                                                    <td className="p-1 text-center">
                                                        <button onClick={() => {
                                                            const n = result.items.filter((_, i) => i !== idx);
                                                            setResult({...result, items: n, total_amount: n.reduce((s,i)=>s+(i.quantity_ordered*i.unit_price),0)});
                                                        }} className="text-destructive hover:bg-destructive/10 p-1 rounded">×</button>
                                                    </td>
                                                </tr>
                                            ))}

                                            {result.items.length === 0 && (
                                                <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Aucun article détecté</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-muted/30 p-3 border-t space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold uppercase text-muted-foreground">Total Articles</span>
                                        <span className="font-bold text-primary">{result.total_amount.toFixed(3)} DT</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-1.5">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Montant Payé
                                            </Label>
                                            <div className="relative">
                                                <Input 
                                                    type="number" 
                                                    step="0.001" 
                                                    className="h-8 pl-7 font-bold border-emerald-500/30 focus-visible:ring-emerald-500" 
                                                    value={result.amount_paid} 
                                                    onChange={e => {
                                                        const p = parseFloat(e.target.value) || 0;
                                                        setResult({...result, amount_paid: p, amount_due: Math.max(0, result.total_amount - p)});
                                                    }} 
                                                />
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">DT</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-1.5">
                                                <div className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Reste à Payer
                                            </Label>
                                            <div className="relative">
                                                <Input 
                                                    type="number" 
                                                    step="0.001" 
                                                    className="h-8 pl-7 font-bold border-orange-500/30 focus-visible:ring-orange-500" 
                                                    value={result.amount_due} 
                                                    onChange={e => setResult({...result, amount_due: parseFloat(e.target.value) || 0})} 
                                                />
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">DT</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                             </div>
                             <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Vérifiez et ajustez les montants payés si nécessaire.
                             </p>

                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground py-12">
                        Prêt pour l'analyse
                    </div>
                )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => { setFile(null); setResult(null); }}>Effacer</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={!result || scanning}>Importer les données</Button>
        </DialogFooter>
      </DialogContent>
      <style>{`
        @keyframes scan-line {
            0% { top: 0; }
            50% { top: 100%; }
            100% { top: 0; }
        }
        .animate-scan-line {
            animation: scan-line 2s infinite ease-in-out;
        }
      `}</style>
    </Dialog>
  );
}
