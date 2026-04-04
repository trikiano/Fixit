import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Info, Trash2, HelpCircle } from 'lucide-react';

export default function ConfirmDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  title = "Confirmation", 
  description = "Êtes-vous sûr de vouloir effectuer cette action ?",
  confirmText = "Confirmer",
  cancelText = "Annuler",
  variant = "danger" // danger, info, warning
}) {
  
  const getIcon = () => {
    switch(variant) {
      case 'danger': return <Trash2 className="h-6 w-6 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-6 w-6 text-amber-500" />;
      default: return <HelpCircle className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass border-border/40 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <AlertDialogHeader>
          <div className="flex items-center gap-4 mb-2">
            <div className={`p-3 rounded-full ${variant === 'danger' ? 'bg-destructive/10' : variant === 'warning' ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
              {getIcon()}
            </div>
            <AlertDialogTitle className="text-xl font-bold tracking-tight">
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="rounded-full px-6 border-border/40 hover:bg-muted font-medium">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className={`rounded-full px-6 font-semibold shadow-lg transition-all active:scale-95 ${
              variant === 'danger' 
                ? 'bg-destructive hover:bg-destructive/90 shadow-destructive/20' 
                : 'bg-primary hover:bg-primary/90 shadow-primary/20'
            }`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
