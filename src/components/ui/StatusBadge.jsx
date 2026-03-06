import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles = {
  // Repair statuses
  reception: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  diagnostic: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  devis_envoye: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  en_attente_pieces: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  en_reparation: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  test: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  pret: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  livre: "bg-green-500/10 text-green-400 border-green-500/20",
  annule: "bg-red-500/10 text-red-400 border-red-500/20",
  // Sale / generic
  completee: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  en_cours: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  remboursee: "bg-red-500/10 text-red-400 border-red-500/20",
  // Warranty
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  expiree: "bg-red-500/10 text-red-400 border-red-500/20",
  utilisee: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  annulee: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  // Purchase
  brouillon: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  envoyee: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  partielle: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  recue: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  // Cash
  ouverte: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  fermee: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  // Priority
  basse: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  normale: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  haute: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  urgente: "bg-red-500/10 text-red-400 border-red-500/20",
  // Segments
  particulier: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  professionnel: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  revendeur: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  vip: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const labels = {
  reception: "Réception", diagnostic: "Diagnostic", devis_envoye: "Devis envoyé",
  en_attente_pieces: "Attente pièces", en_reparation: "En réparation", test: "Test",
  pret: "Prêt", livre: "Livré", annule: "Annulé", completee: "Complétée",
  en_cours: "En cours", remboursee: "Remboursée", active: "Active",
  expiree: "Expirée", utilisee: "Utilisée", annulee: "Annulée",
  brouillon: "Brouillon", envoyee: "Envoyée", partielle: "Partielle",
  recue: "Reçue", ouverte: "Ouverte", fermee: "Fermée",
  basse: "Basse", normale: "Normale", haute: "Haute", urgente: "Urgente",
  particulier: "Particulier", professionnel: "Professionnel",
  revendeur: "Revendeur", vip: "VIP",
};

export default function StatusBadge({ status, className }) {
  const style = statusStyles[status] || "bg-muted text-muted-foreground border-border";
  const label = labels[status] || status?.replace(/_/g, ' ');
  return (
    <Badge variant="outline" className={cn("text-xs font-medium border", style, className)}>
      {label}
    </Badge>
  );
}