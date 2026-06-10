import { useCallback, useMemo } from 'react';
import type { Medicine, FilterState, DashboardStats, EmergencyCheckResult } from '@/types/medicine';
import { EMERGENCY_ITEMS } from '@/lib/constants';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '@/lib/constants';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function getDaysUntilExpiration(expirationDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);
  const diffTime = expDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isExpired(expirationDate: string): boolean {
  return getDaysUntilExpiration(expirationDate) < 0;
}

function isExpiringSoon(expirationDate: string): boolean {
  const days = getDaysUntilExpiration(expirationDate);
  return days >= 0 && days <= 30;
}

export function useMedicine() {
  const [medicines, setMedicines] = useLocalStorage<Medicine[]>(STORAGE_KEYS.medicines, []);

  const addMedicine = useCallback((medicineData: Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newMedicine: Medicine = {
      ...medicineData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMedicines(prev => [newMedicine, ...prev]);
    return newMedicine;
  }, [setMedicines]);

  const updateMedicine = useCallback((id: string, updates: Partial<Medicine>) => {
    setMedicines(prev => prev.map(m =>
      m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
    ));
  }, [setMedicines]);

  const deleteMedicine = useCallback((id: string) => {
    setMedicines(prev => prev.filter(m => m.id !== id));
  }, [setMedicines]);

  const getMedicineById = useCallback((id: string) => {
    return medicines.find(m => m.id === id);
  }, [medicines]);

  const stats = useMemo<DashboardStats>(() => {
    const totalMedicines = medicines.length;
    const expiringSoon = medicines.filter(m => isExpiringSoon(m.expirationDate) && !isExpired(m.expirationDate)).length;
    const expired = medicines.filter(m => isExpired(m.expirationDate)).length;
    const lowStock = medicines.filter(m => m.quantity <= 5).length;
    const emergencyCount = medicines.filter(m => m.category === 'emergency').length;
    const childrenCount = medicines.filter(m => m.category === 'children').length;

    // Calculate readiness
    const emergencyCheck = EMERGENCY_ITEMS.map(item => {
      const found = medicines.some(m =>
        item.keywords.some(kw =>
          m.name.toLowerCase().includes(kw.toLowerCase()) ||
          m.activeIngredient.toLowerCase().includes(kw.toLowerCase())
        )
      );
      return found;
    });
    const readinessScore = Math.round((emergencyCheck.filter(Boolean).length / emergencyCheck.length) * 100);
    const readinessStatus = readinessScore >= 80 ? 'excellent' : readinessScore >= 50 ? 'moderate' : 'weak';

    return {
      totalMedicines,
      expiringSoon,
      expired,
      lowStock,
      emergencyCount,
      childrenCount,
      readinessScore,
      readinessStatus,
    };
  }, [medicines]);

  const emergencyCheck = useMemo<EmergencyCheckResult[]>(() => {
    return EMERGENCY_ITEMS.map(item => {
      const matchedMedicine = medicines.find(m =>
        item.keywords.some(kw =>
          m.name.toLowerCase().includes(kw.toLowerCase()) ||
          m.activeIngredient.toLowerCase().includes(kw.toLowerCase())
        )
      );
      return {
        item,
        found: !!matchedMedicine,
        matchedMedicine,
      };
    });
  }, [medicines]);

  const filterMedicines = useCallback((filters: FilterState): Medicine[] => {
    let filtered = [...medicines];

    // Search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(searchLower) ||
        m.activeIngredient.toLowerCase().includes(searchLower) ||
        m.dosage.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(m => m.category === filters.category);
    }

    // Expiration filter
    if (filters.expiration !== 'all') {
      filtered = filtered.filter(m => {
        if (filters.expiration === 'expired') return isExpired(m.expirationDate);
        if (filters.expiration === 'expiring-soon') return isExpiringSoon(m.expirationDate);
        if (filters.expiration === 'good') return getDaysUntilExpiration(m.expirationDate) > 30;
        return true;
      });
    }

    // Emergency only
    if (filters.emergencyOnly) {
      filtered = filtered.filter(m => m.category === 'emergency');
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sort) {
        case 'expiration':
          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'quantity':
          return a.quantity - b.quantity;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    return filtered;
  }, [medicines]);

  const getExpiredMedicines = useCallback(() => {
    return medicines.filter(m => isExpired(m.expirationDate));
  }, [medicines]);

  const getExpiringSoonMedicines = useCallback(() => {
    return medicines.filter(m => isExpiringSoon(m.expirationDate) && !isExpired(m.expirationDate));
  }, [medicines]);

  const getEmergencyMedicines = useCallback(() => {
    return medicines.filter(m => m.category === 'emergency');
  }, [medicines]);

  const getChildrenMedicines = useCallback(() => {
    return medicines.filter(m => m.category === 'children');
  }, [medicines]);

  const getLowStockMedicines = useCallback(() => {
    return medicines.filter(m => m.quantity <= 5);
  }, [medicines]);

  return {
    medicines,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    getMedicineById,
    stats,
    emergencyCheck,
    filterMedicines,
    getExpiredMedicines,
    getExpiringSoonMedicines,
    getEmergencyMedicines,
    getChildrenMedicines,
    getLowStockMedicines,
    isExpired,
    isExpiringSoon,
    getDaysUntilExpiration,
  };
}
