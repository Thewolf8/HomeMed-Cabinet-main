import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill, AlertTriangle, Package, HeartPulse,
  Baby, FileDown, ShieldCheck, ChevronRight, Sparkles
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { useMedicine } from '@/hooks/useMedicine';
import { CAROUSEL_IMAGES } from '@/lib/constants';

export function Dashboard() {
  const navigate = useNavigate();
  const { stats, getExpiringSoonMedicines, getExpiredMedicines, getLowStockMedicines } = useMedicine();
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridTransform, setGridTransform] = useState({ x: 0, y: 0 });
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Mouse tilt effect for the grid
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = (0.5 - (e.clientX - rect.left) / width) * 10;
    const y = (0.5 - (e.clientY - rect.top) / height) * 10;
    setGridTransform({ x, y });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setGridTransform({ x: 0, y: 0 });
  }, []);

  // Carousel auto-rotation
  useState(() => {
    const interval = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  });

  const expiringSoon = getExpiringSoonMedicines();
  const expired = getExpiredMedicines();
  const lowStock = getLowStockMedicines();

  const readinessColor = stats.readinessScore >= 80 ? 'text-emerald-400' :
    stats.readinessScore >= 50 ? 'text-amber-400' : 'text-rose-400';

  const readinessBg = stats.readinessScore >= 80 ? 'bg-emerald-500/20' :
    stats.readinessScore >= 50 ? 'bg-amber-500/20' : 'bg-rose-500/20';

  return (
    <div className="pb-24 md:pb-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden"
      >
        <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight">
              Your <span className="text-[#5F9E95]">Medicine</span> Cabinet
            </h2>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Privacy-first inventory management for your household
            </p>
          </motion.div>

          {/* 3D Perspective Grid */}
          <div
            ref={gridRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="hidden md:block perspective-[1000px] mb-8"
          >
            <motion.div
              animate={{
                rotateX: gridTransform.y,
                rotateY: gridTransform.x,
              }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              style={{ transformStyle: 'preserve-3d' }}
              className="grid grid-cols-4 gap-4 will-change-transform"
            >
              {/* Main Stat Card */}
              <motion.div
                whileHover={{ scale: 1.05, z: 50 }}
                className="col-span-2 row-span-2 glass rounded-3xl p-6 flex flex-col justify-between min-h-[240px] cursor-pointer"
                onClick={() => navigate('/medicines')}
              >
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Pill className="w-4 h-4 text-[#5F9E95]" />
                    <span className="text-xs uppercase tracking-wide">Total Medicines</span>
                  </div>
                  <p className="text-5xl font-serif font-semibold mt-2">{stats.totalMedicines}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Expiring Soon</span>
                    <span className="font-medium text-amber-400">{stats.expiringSoon}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Expired</span>
                    <span className="font-medium text-rose-400">{stats.expired}</span>
                  </div>
                </div>
              </motion.div>

              {/* Expiring Alert */}
              <motion.div
                whileHover={{ scale: 1.05, z: 50 }}
                className="glass rounded-3xl p-4 cursor-pointer"
                onClick={() => navigate('/medicines')}
              >
                <AlertTriangle className="w-5 h-5 text-amber-400 mb-2" />
                <p className="text-2xl font-serif font-semibold">{stats.expiringSoon}</p>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
              </motion.div>

              {/* Carousel Image */}
              <motion.div
                whileHover={{ scale: 1.05, z: 50 }}
                className="glass rounded-3xl overflow-hidden relative row-span-2"
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={carouselIndex}
                    src={CAROUSEL_IMAGES[carouselIndex]}
                    alt="Wellness"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="w-full h-full object-cover absolute inset-0"
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-white text-xs font-medium">Wellness at Home</p>
                </div>
              </motion.div>

              {/* Readiness Score */}
              <motion.div
                whileHover={{ scale: 1.05, z: 50 }}
                className={`rounded-3xl p-4 ${readinessBg} border border-white/10 cursor-pointer`}
                onClick={() => navigate('/medicines')}
              >
                <ShieldCheck className={`w-5 h-5 ${readinessColor} mb-2`} />
                <p className={`text-2xl font-serif font-semibold ${readinessColor}`}>{stats.readinessScore}%</p>
                <p className="text-xs text-muted-foreground capitalize">{stats.readinessStatus}</p>
              </motion.div>

              {/* Emergency Count */}
              <motion.div
                whileHover={{ scale: 1.05, z: 50 }}
                className="glass rounded-3xl p-4 cursor-pointer"
                onClick={() => navigate('/medicines')}
              >
                <HeartPulse className="w-5 h-5 text-rose-400 mb-2" />
                <p className="text-2xl font-serif font-semibold">{stats.emergencyCount}</p>
                <p className="text-xs text-muted-foreground">Emergency Items</p>
              </motion.div>

              {/* Children Count */}
              <motion.div
                whileHover={{ scale: 1.05, z: 50 }}
                className="glass rounded-3xl p-4 cursor-pointer"
                onClick={() => navigate('/medicines')}
              >
                <Baby className="w-5 h-5 text-green-400 mb-2" />
                <p className="text-2xl font-serif font-semibold">{stats.childrenCount}</p>
                <p className="text-xs text-muted-foreground">Children</p>
              </motion.div>

              {/* Low Stock */}
              <motion.div
                whileHover={{ scale: 1.05, z: 50 }}
                className="glass rounded-3xl p-4 cursor-pointer"
                onClick={() => navigate('/medicines')}
              >
                <Package className="w-5 h-5 text-[#E8B4B8] mb-2" />
                <p className="text-2xl font-serif font-semibold">{stats.lowStock}</p>
                <p className="text-xs text-muted-foreground">Low Stock</p>
              </motion.div>
            </motion.div>
          </div>

          {/* Mobile Stats Grid */}
          <div className="md:hidden grid grid-cols-2 gap-3 mb-6">
            <StatCard
              title="Total"
              value={stats.totalMedicines}
              icon={Pill}
              color="bg-[#5F9E95]/20 text-[#5F9E95]"
              delay={0}
              onClick={() => navigate('/medicines')}
            />
            <StatCard
              title="Expiring Soon"
              value={stats.expiringSoon}
              icon={AlertTriangle}
              color="bg-amber-500/20 text-amber-400"
              delay={0.1}
              onClick={() => navigate('/medicines')}
            />
            <StatCard
              title="Emergency"
              value={stats.emergencyCount}
              icon={HeartPulse}
              color="bg-rose-500/20 text-rose-400"
              delay={0.2}
              onClick={() => navigate('/medicines')}
            />
            <StatCard
              title="Readiness"
              value={`${stats.readinessScore}%`}
              subtitle={stats.readinessStatus}
              icon={ShieldCheck}
              color={`${readinessBg} ${readinessColor}`}
              delay={0.3}
              onClick={() => navigate('/medicines')}
            />
          </div>

          {/* Alerts Section */}
          <AnimatePresence>
            {expired.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="glass rounded-2xl p-4 border border-rose-500/30 bg-rose-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    <h3 className="font-semibold text-rose-400">Expired Medicines</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {expired.length} medicine(s) have expired and should be disposed of properly.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {expired.slice(0, 3).map(m => (
                      <span key={m.id} className="text-xs px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {m.name}
                      </span>
                    ))}
                    {expired.length > 3 && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        +{expired.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {expiringSoon.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="glass rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-amber-400">Expiring Soon</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {expiringSoon.length} medicine(s) will expire within 30 days.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {expiringSoon.slice(0, 3).map(m => (
                      <span key={m.id} className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {m.name}
                      </span>
                    ))}
                    {expiringSoon.length > 3 && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        +{expiringSoon.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Low Stock Alert */}
          <AnimatePresence>
            {lowStock.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="glass rounded-2xl p-4 border border-[#E8B4B8]/30 bg-[#E8B4B8]/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-[#E8B4B8]" />
                    <h3 className="font-semibold text-[#E8B4B8]">Low Stock</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {lowStock.length} medicine(s) are running low (5 or fewer remaining).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lowStock.slice(0, 3).map(m => (
                      <span key={m.id} className="text-xs px-2.5 py-1 rounded-full bg-[#E8B4B8]/20 text-[#E8B4B8] border border-[#E8B4B8]/30">
                        {m.name} ({m.quantity} left)
                      </span>
                    ))}
                    {lowStock.length > 3 && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-[#E8B4B8]/20 text-[#E8B4B8] border border-[#E8B4B8]/30">
                        +{lowStock.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/add')}
              className="flex items-center gap-3 p-4 rounded-2xl glass text-left hover:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[#5F9E95]/20 flex items-center justify-center flex-shrink-0">
                <Pill className="w-5 h-5 text-[#5F9E95]" />
              </div>
              <div>
                <p className="font-medium text-sm">Add Medicine</p>
                <p className="text-xs text-muted-foreground">New entry</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/export')}
              className="flex items-center gap-3 p-4 rounded-2xl glass text-left hover:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[#5F9E95]/20 flex items-center justify-center flex-shrink-0">
                <FileDown className="w-5 h-5 text-[#5F9E95]" />
              </div>
              <div>
                <p className="font-medium text-sm">Export Report</p>
                <p className="text-xs text-muted-foreground">PDF / TXT / JSON</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </motion.button>
          </div>

          {/* Disclaimer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 p-3 rounded-xl bg-white/5 border border-white/5 text-center"
          >
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <ShieldCheck className="w-3 h-3 inline mr-1 text-[#5F9E95]" />
              HomeMed Cabinet stores all data locally on your device. No cloud connection. No account required. Not medical advice.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
