import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, SlidersHorizontal, Pill, X, AlertTriangle,
  Clock, HeartPulse, Baby
} from 'lucide-react';
import { MedicineCard } from '@/components/MedicineCard';
import { useMedicine } from '@/hooks/useMedicine';
import { useToast } from '@/hooks/useToast';
import type { FilterState } from '@/types/medicine';

const categoryFilters = [
  { value: 'all' as const, label: 'All', icon: Pill },
  { value: 'emergency' as const, label: 'Emergency', icon: HeartPulse },
  { value: 'children' as const, label: 'Children', icon: Baby },
  { value: 'adult' as const, label: 'Adult', icon: Pill },
  { value: 'chronic' as const, label: 'Chronic', icon: Clock },
];

const expirationFilters = [
  { value: 'all' as const, label: 'All' },
  { value: 'expired' as const, label: 'Expired' },
  { value: 'expiring-soon' as const, label: 'Expiring Soon' },
  { value: 'good' as const, label: 'Good' },
];

const sortOptions = [
  { value: 'expiration' as const, label: 'Expiration' },
  { value: 'name' as const, label: 'Name' },
  { value: 'quantity' as const, label: 'Quantity' },
  { value: 'category' as const, label: 'Category' },
];

export function MedicineList() {
  const navigate = useNavigate();
  const { medicines, filterMedicines, deleteMedicine, isExpired, isExpiringSoon } = useMedicine();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: 'all',
    expiration: 'all',
    emergencyOnly: false,
    sort: 'expiration',
  });

  const filteredMedicines = useMemo(() => {
    return filterMedicines({ ...filters, search });
  }, [filters, search, filterMedicines]);

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      deleteMedicine(id);
      setDeleteConfirm(null);
      addToast('Medicine deleted', 'success');
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  // Smart sections
  const expiredMeds = medicines.filter(m => isExpired(m.expirationDate));
  const expiringSoonMeds = medicines.filter(m => isExpiringSoon(m.expirationDate) && !isExpired(m.expirationDate));
  const emergencyMeds = medicines.filter(m => m.category === 'emergency');
  const childrenMeds = medicines.filter(m => m.category === 'children');

  const hasSmartSections = expiredMeds.length > 0 || expiringSoonMeds.length > 0 || emergencyMeds.length > 0 || childrenMeds.length > 0;

  return (
    <div className="pb-24 md:pb-8">
      <div className="px-4 py-4 max-w-7xl mx-auto">
        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-4"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search medicines..."
            className="w-full pl-10 pr-12 py-3 rounded-2xl glass border border-white/10 focus:border-[#5F9E95]/50 focus:outline-none transition-colors text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0 ${
              showFilters ? 'bg-[#5F9E95] text-white' : 'glass'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </motion.button>

          {categoryFilters.map(cat => {
            const Icon = cat.icon;
            const isActive = filters.category === cat.value;
            return (
              <motion.button
                key={cat.value}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilters(prev => ({ ...prev, category: isActive ? 'all' : cat.value }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors flex-shrink-0 ${
                  isActive ? 'bg-[#5F9E95] text-white' : 'glass'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </motion.button>
            );
          })}
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-2xl p-4 mb-4 space-y-3">
                {/* Expiration Filter */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Expiration Status</p>
                  <div className="flex flex-wrap gap-2">
                    {expirationFilters.map(ef => (
                      <button
                        key={ef.value}
                        onClick={() => setFilters(prev => ({ ...prev, expiration: ef.value }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          filters.expiration === ef.value
                            ? 'bg-[#5F9E95] text-white'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        {ef.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Sort By</p>
                  <div className="flex flex-wrap gap-2">
                    {sortOptions.map(so => (
                      <button
                        key={so.value}
                        onClick={() => setFilters(prev => ({ ...prev, sort: so.value }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          filters.sort === so.value
                            ? 'bg-[#5F9E95] text-white'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        {so.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emergency Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm">Emergency Only</span>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, emergencyOnly: !prev.emergencyOnly }))}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      filters.emergencyOnly ? 'bg-[#5F9E95]' : 'bg-white/10'
                    }`}
                  >
                    <motion.div
                      animate={{ x: filters.emergencyOnly ? 24 : 2 }}
                      className="absolute top-1 w-4 h-4 rounded-full bg-white"
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Smart Organization Sections (only when no search/filters active) */}
        {!search && filters.category === 'all' && filters.expiration === 'all' && !filters.emergencyOnly && hasSmartSections && (
          <div className="space-y-4 mb-6">
            {expiredMeds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-semibold text-rose-400">Expired — Dispose Immediately</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{expiredMeds.length} items</span>
                </div>
                <div className="space-y-2">
                  {expiredMeds.slice(0, 3).map((m, i) => (
                    <MedicineCard
                      key={m.id}
                      medicine={m}
                      onEdit={id => navigate(`/edit/${id}`)}
                      onDelete={handleDelete}
                      index={i}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {expiringSoonMeds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-400">Expiring Soon</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{expiringSoonMeds.length} items</span>
                </div>
                <div className="space-y-2">
                  {expiringSoonMeds.slice(0, 3).map((m, i) => (
                    <MedicineCard
                      key={m.id}
                      medicine={m}
                      onEdit={id => navigate(`/edit/${id}`)}
                      onDelete={handleDelete}
                      index={i}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {emergencyMeds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <HeartPulse className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-semibold">Emergency Items</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{emergencyMeds.length} items</span>
                </div>
                <div className="space-y-2">
                  {emergencyMeds.slice(0, 3).map((m, i) => (
                    <MedicineCard
                      key={m.id}
                      medicine={m}
                      onEdit={id => navigate(`/edit/${id}`)}
                      onDelete={handleDelete}
                      index={i}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {childrenMeds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Baby className="w-4 h-4 text-green-400" />
                  <h3 className="text-sm font-semibold">Children Medicines</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{childrenMeds.length} items</span>
                </div>
                <div className="space-y-2">
                  {childrenMeds.slice(0, 3).map((m, i) => (
                    <MedicineCard
                      key={m.id}
                      medicine={m}
                      onEdit={id => navigate(`/edit/${id}`)}
                      onDelete={handleDelete}
                      index={i}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Main Medicine List */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            {search || filters.category !== 'all' || filters.expiration !== 'all'
              ? 'Search Results'
              : 'All Medicines'}
          </h3>
          <span className="text-xs text-muted-foreground">{filteredMedicines.length} items</span>
        </div>

        <AnimatePresence mode="popLayout">
          {filteredMedicines.length > 0 ? (
            <div className="space-y-3">
              {filteredMedicines.map((medicine, i) => (
                <MedicineCard
                  key={medicine.id}
                  medicine={medicine}
                  onEdit={id => navigate(`/edit/${id}`)}
                  onDelete={handleDelete}
                  index={i}
                />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mb-4">
                <Pill className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No medicines found</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {search
                  ? 'Try a different search term'
                  : 'Your medicine cabinet is empty. Add your first medicine to get started.'}
              </p>
              {!search && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/add')}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-[#5F9E95] text-white text-sm font-medium hover:bg-[#3D6B65] transition-colors"
                >
                  Add Medicine
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Toast */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-24 left-4 right-4 z-50 glass rounded-2xl p-4 border border-rose-500/30 md:bottom-8 md:left-auto md:right-8 md:w-80"
            >
              <p className="text-sm font-medium mb-2">Tap again to confirm delete</p>
              <p className="text-xs text-muted-foreground">This action cannot be undone</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
