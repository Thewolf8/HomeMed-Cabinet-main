import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

export function FloatingActionButton() {
  const navigate = useNavigate();

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => navigate('/add')}
      className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-[#5F9E95] text-white shadow-lg shadow-[#5F9E95]/30 flex items-center justify-center md:hidden hover:bg-[#3D6B65] transition-colors"
    >
      <Plus className="w-6 h-6" />
    </motion.button>
  );
}
