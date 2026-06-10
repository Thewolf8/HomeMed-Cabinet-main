import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  PackageOpen,
  Clock,
  AlertTriangle,
  X,
  Shield,
  Baby,
  HeartPulse,
  Stethoscope,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n/I18nContext';
import type { Medication, MedicationFilters, SortField, SortOrder, MedicineCategory } from '@/types/medication';
import { MEDICINE_CATEGORIES } from '@/types/medication';
import { getDaysUntilExpiration } from '@/services/exportService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ToastType } from '@/hooks/use-toast';

interface MedicinesPageProps {
  medications: Medication[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => boolean;
  onAddNew: () => void;
  toast: ToastType;
}

export default function MedicinesPage({ medications, onEdit, onDelete, onAddNew, toast }: MedicinesPageProps) {
  const { t, isRTL } = useI18n();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filters, setFilters] = useState<MedicationFilters>({
    search: '',
    category: 'all',
    expiration: 'all',
    emergencyOnly: false,
  });

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSearch = (value: string) => {
    setSearch(value);
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      toast(t('medicineDeleted'));
      setDeleteId(null);
    }
  };

  // Filter and sort medications
  let filtered = [...medications];

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(
      (med) =>
        med.name.toLowerCase().includes(searchLower) ||
        med.activeIngredient.toLowerCase().includes(searchLower) ||
        med.dosage.toLowerCase().includes(searchLower)
    );
  }

  if (filters.category !== 'all') {
    filtered = filtered.filter((med) => med.category === filters.category);
  }

  if (filters.expiration !== 'all') {
    filtered = filtered.filter((med) => {
      const days = getDaysUntilExpiration(med.expirationDate);
      if (filters.expiration === 'expired') return days < 0;
      if (filters.expiration === 'expiring-soon') return days >= 0 && days <= 30;
      if (filters.expiration === 'valid') return days > 30;
      return true;
    });
  }

  if (filters.emergencyOnly) {
    filtered = filtered.filter((med) => med.category === 'emergency');
  }

  filtered.sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'expirationDate':
        comparison = new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
        break;
      case 'quantity':
        comparison = a.quantity - b.quantity;
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const getExpirationBadge = (med: Medication) => {
    const days = getDaysUntilExpiration(med.expirationDate);
    if (days < 0) {
      return (
        <Badge variant="destructive" className="text-[10px]">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {t('expiredTag')}
        </Badge>
      );
    }
    if (days <= 30) {
      return (
        <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
          <Clock className="w-3 h-3 mr-1" />
          {days}d
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
        {days}d
      </Badge>
    );
  };

  const getCategoryBadge = (category: MedicineCategory) => {
    const icons = {
      adult: Stethoscope,
      children: Baby,
      emergency: Shield,
      chronic: HeartPulse,
      other: HelpCircle,
    };
    const Icon = icons[category];
    return (
      <Badge variant="outline" className="text-[10px] flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {t(category)}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${
              isRTL ? 'right-3' : 'left-3'
            }`}
          />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className={isRTL ? 'pr-10' : 'pl-10'}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? 'bg-primary/10 text-primary' : ''}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
        >
          <ArrowUpDown className="w-4 h-4" />
        </Button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('category')}
                    </label>
                    <Select
                      value={filters.category}
                      onValueChange={(v) => setFilters((prev) => ({ ...prev, category: v as MedicineCategory | 'all' }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allCategories')}</SelectItem>
                        {MEDICINE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {t(cat)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('expirationDate')}
                    </label>
                    <Select
                      value={filters.expiration}
                      onValueChange={(v) =>
                        setFilters((prev) => ({ ...prev, expiration: v as MedicationFilters['expiration'] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allStatuses')}</SelectItem>
                        <SelectItem value="expired">{t('expiredFilter')}</SelectItem>
                        <SelectItem value="expiring-soon">{t('expiringSoonFilter')}</SelectItem>
                        <SelectItem value="valid">{t('validFilter')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('sortBy')}
                    </label>
                    <Select
                      value={sortField}
                      onValueChange={(v) => setSortField(v as SortField)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">{t('sortName')}</SelectItem>
                        <SelectItem value="expirationDate">{t('sortExpiration')}</SelectItem>
                        <SelectItem value="quantity">{t('sortQuantity')}</SelectItem>
                        <SelectItem value="category">{t('sortCategory')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={filters.emergencyOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, emergencyOnly: !prev.emergencyOnly }))
                    }
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    {t('emergencyOnly')}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilters({ search: '', category: 'all', expiration: 'all', emergencyOnly: false });
                      setSearch('');
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    {t('close')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} {t('medicines').toLowerCase()}
      </p>

      {/* Medicine Cards */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <PackageOpen className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t('noMedicines')}</h3>
          <p className="text-muted-foreground text-sm mb-4">{t('noMedicinesDesc')}</p>
          <Button onClick={onAddNew}>{t('addFirstMedicine')}</Button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((med, index) => {
              const isExpanded = expandedId === med.id;
              const days = getDaysUntilExpiration(med.expirationDate);
              const isExpired = days < 0;

              return (
                <motion.div
                  key={med.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card
                    className={`overflow-hidden transition-all duration-200 ${
                      isExpired ? 'border-red-500/30 bg-red-500/5' : 'hover:border-primary/30'
                    }`}
                  >
                    <CardContent className="p-4">
                      {/* Main row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0" onClick={() => setExpandedId(isExpanded ? null : med.id)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm truncate">{med.name}</h3>
                            {getExpirationBadge(med)}
                            {med.quantity <= 5 && (
                              <Badge variant="secondary" className="text-[10px] bg-orange-500/10 text-orange-500">
                                {t('lowStockTag')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {med.dosage} &bull; {t('remaining')}: {med.quantity}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEdit(med.id)}
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-destructive"
                            onClick={() => setDeleteId(med.id)}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setExpandedId(isExpanded ? null : med.id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-border space-y-2">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">{t('activeIngredient')}:</span>
                                  <p className="font-medium">{med.activeIngredient}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">{t('form')}:</span>
                                  <p className="font-medium">{t(med.form)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">{t('category')}:</span>
                                  <p>{getCategoryBadge(med.category)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">{t('prescriptionRequired')}:</span>
                                  <p className="font-medium">{med.prescriptionRequired ? t('yes') : t('no')}</p>
                                </div>
                              </div>
                              {med.usageInstructions && (
                                <p className="text-xs">
                                  <span className="text-muted-foreground">{t('usageInstructions')}:</span>{' '}
                                  {med.usageInstructions}
                                </p>
                              )}
                              {med.notes && (
                                <p className="text-xs">
                                  <span className="text-muted-foreground">{t('notes')}:</span>{' '}
                                  {med.notes}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
