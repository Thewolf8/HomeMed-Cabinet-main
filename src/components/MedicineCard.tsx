import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Pencil, Trash2, AlertTriangle, Clock, Package } from 'lucide-react';
import type { Medicine, MedicineCategory } from '@/types/medicine';
import { MEDICINE_CATEGORIES } from '@/lib/constants';
import { useMedicine } from '@/hooks/useMedicine';

interface MedicineCardProps {
  medicine: Medicine;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  index: number;
}

const categoryColors: Record<MedicineCategory, string> = {
  adult: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  children: 'bg-green-500/20 text-green-300 border-green-500/30',
  emergency: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  chronic: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  other: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const formIcons: Record<string, string> = {
  tablets: '💊',
  syrup: '🧪',
  injection: '💉',
  cream: '🧴',
  drops: '💧',
  other: '📦',
};

export function MedicineCard({ medicine, onEdit, onDelete, index }: MedicineCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { isExpired, isExpiringSoon, getDaysUntilExpiration } = useMedicine();

  const expired = isExpired(medicine.expirationDate);
  const expiringSoon = isExpiringSoon(medicine.expirationDate);
  const daysLeft = getDaysUntilExpiration(medicine.expirationDate);
  const lowStock = medicine.quantity <= 5;

  const statusBorder = expired ? 'border-rose-500/50' :
    expiringSoon ? 'border-amber-500/40' :
    lowStock ? 'border-[#E8B4B8]/40' : 'border-white/10';

  const statusGlow = expired ? 'shadow-rose-500/10' :
    expiringSoon ? 'shadow-amber-500/10' : '';

  const categoryLabel = MEDICINE_CATEGORIES.find(c => c.value === medicine.category)?.label || medicine.category;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ delay: index * 0.05, type: 'spring', damping: 25 }}
      layout
      className={`relative rounded-2xl border ${statusBorder} ${statusGlow} glass overflow-hidden transition-all hover:shadow-lg`}
    >
      {/* Status indicators */}
      {expired && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-rose-400" />
      )}
      {expiringSoon && !expired && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0">{formIcons[medicine.form] || '📦'}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-base truncate">{medicine.name}</h3>
              <p className="text-sm text-muted-foreground">{medicine.dosage} • {medicine.activeIngredient}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onEdit(medicine.id)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-[#5F9E95]"
            >
              <Pencil className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onDelete(medicine.id)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-rose-400"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${categoryColors[medicine.category]}`}>
            {categoryLabel}
          </span>

          {medicine.prescriptionRequired && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Prescription
            </span>
          )}

          {expired && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <AlertTriangle className="w-3 h-3" />
              Expired
            </span>
          )}

          {expiringSoon && !expired && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Clock className="w-3 h-3" />
              {daysLeft} days
            </span>
          )}

          {lowStock && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8B4B8]/20 text-[#E8B4B8] border border-[#E8B4B8]/30">
              <Package className="w-3 h-3" />
              Low: {medicine.quantity}
            </span>
          )}

          {!lowStock && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#5F9E95]/20 text-[#5F9E95] border border-[#5F9E95]/30">
              Qty: {medicine.quantity}
            </span>
          )}
        </div>

        {/* Expandable details */}
        <motion.button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-3 text-xs text-muted-foreground hover:text-[#5F9E95] transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
          {expanded ? 'Less details' : 'More details'}
        </motion.button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
                {medicine.usageInstructions && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Usage</p>
                    <p className="text-sm">{medicine.usageInstructions}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Expires</p>
                  <p className={`text-sm ${expired ? 'text-rose-400' : expiringSoon ? 'text-amber-400' : ''}`}>
                    {new Date(medicine.expirationDate).toLocaleDateString()}
                    {expired ? ` (${Math.abs(daysLeft)} days ago)` : expiringSoon ? ` (${daysLeft} days left)` : ''}
                  </p>
                </div>
                {medicine.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Notes</p>
                    <p className="text-sm text-muted-foreground">{medicine.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
