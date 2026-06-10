import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Camera, X, Check } from 'lucide-react';
import type { MedicineForm, MedicineCategory } from '@/types/medicine';
import { useMedicine } from '@/hooks/useMedicine';
import { useToast } from '@/hooks/useToast';
import { MEDICINE_FORMS, MEDICINE_CATEGORIES } from '@/lib/constants';

interface FormData {
  name: string;
  activeIngredient: string;
  dosage: string;
  form: MedicineForm;
  quantity: number;
  expirationDate: string;
  usageInstructions: string;
  category: MedicineCategory;
  prescriptionRequired: boolean;
  notes: string;
  image: string;
}

const initialForm: FormData = {
  name: '',
  activeIngredient: '',
  dosage: '',
  form: 'tablets',
  quantity: 1,
  expirationDate: '',
  usageInstructions: '',
  category: 'adult',
  prescriptionRequired: false,
  notes: '',
  image: '',
};

const formFields: { id: 'name' | 'activeIngredient' | 'dosage' | 'quantity' | 'expirationDate'; label: string; placeholder: string; required?: boolean; type?: string }[] = [
  { id: 'name', label: 'Medicine Name', placeholder: 'e.g., Paracetamol', required: true },
  { id: 'activeIngredient', label: 'Active Ingredient', placeholder: 'e.g., Acetaminophen', required: true },
  { id: 'dosage', label: 'Dosage', placeholder: 'e.g., 500mg', required: true },
  { id: 'quantity', label: 'Quantity', placeholder: 'Number of units', required: true, type: 'number' },
  { id: 'expirationDate', label: 'Expiration Date', placeholder: '', required: true, type: 'date' },
];

export function AddMedicine() {
  const navigate = useNavigate();
  const { addMedicine } = useMedicine();
  const { addToast } = useToast();
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Medicine name is required';
    if (!form.activeIngredient.trim()) newErrors.activeIngredient = 'Active ingredient is required';
    if (!form.dosage.trim()) newErrors.dosage = 'Dosage is required';
    if (form.quantity < 1) newErrors.quantity = 'Quantity must be at least 1';
    if (!form.expirationDate) newErrors.expirationDate = 'Expiration date is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      addToast('Please fill in all required fields', 'error');
      return;
    }

    addMedicine({
      name: form.name.trim(),
      activeIngredient: form.activeIngredient.trim(),
      dosage: form.dosage.trim(),
      form: form.form,
      quantity: Number(form.quantity),
      expirationDate: form.expirationDate,
      usageInstructions: form.usageInstructions.trim(),
      category: form.category,
      prescriptionRequired: form.prescriptionRequired,
      notes: form.notes.trim(),
      image: form.image,
    });

    addToast('Medicine added successfully', 'success');
    navigate('/medicines');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateField('image', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="pb-24 md:pb-8">
      <div className="px-4 py-4 max-w-2xl mx-auto">
        {/* Description */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="font-serif text-2xl font-semibold mb-2">Add New Medicine</h2>
          <p className="text-sm text-muted-foreground">
            Keep your medicine cabinet organized and up to date. All data stays on your device.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Image Upload */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Medicine Photo (Optional)
            </label>
            <div className="flex items-center gap-4">
              {form.image ? (
                <div className="relative">
                  <img
                    src={form.image}
                    alt="Medicine"
                    className="w-20 h-20 rounded-2xl object-cover border border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('image', '')}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="w-20 h-20 rounded-2xl glass border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-[#5F9E95]/50 transition-colors">
                  <Camera className="w-6 h-6 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground mt-1">Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">
                Take a photo of the medicine packaging for quick reference
              </p>
            </div>
          </motion.div>

          {/* Basic Info Fields */}
          {formFields.map((field, i) => (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {field.label}
                {field.required && <span className="text-rose-400 ml-1">*</span>}
              </label>
              <input
                type={field.type || 'text'}
                value={form[field.id]}
                onChange={e => {
                  const val = field.type === 'number' ? Number(e.target.value) : e.target.value;
                  updateField(field.id, val as any);
                }}
                placeholder={field.placeholder}
                min={field.type === 'number' ? 1 : undefined}
                className={`w-full px-4 py-3 rounded-2xl glass border ${
                  errors[field.id] ? 'border-rose-500/50' : 'border-white/10 focus:border-[#5F9E95]/50'
                } focus:outline-none transition-colors text-sm`}
              />
              {errors[field.id] && (
                <p className="text-xs text-rose-400 mt-1">{errors[field.id]}</p>
              )}
            </motion.div>
          ))}

          {/* Form Type */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Form Type
            </label>
            <div className="flex flex-wrap gap-2">
              {MEDICINE_FORMS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => updateField('form', f.value)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    form.form === f.value
                      ? 'bg-[#5F9E95] text-white shadow-lg shadow-[#5F9E95]/20'
                      : 'glass hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Category */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {MEDICINE_CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => updateField('category', c.value)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    form.category === c.value
                      ? 'bg-[#5F9E95] text-white shadow-lg shadow-[#5F9E95]/20'
                      : 'glass hover:bg-white/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Usage Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Usage Instructions
            </label>
            <textarea
              value={form.usageInstructions}
              onChange={e => updateField('usageInstructions', e.target.value)}
              placeholder="e.g., Take 1 tablet after meals"
              rows={3}
              className="w-full px-4 py-3 rounded-2xl glass border border-white/10 focus:border-[#5F9E95]/50 focus:outline-none transition-colors text-sm resize-none"
            />
          </motion.div>

          {/* Prescription Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-between py-2"
          >
            <div>
              <p className="text-sm font-medium">Prescription Required</p>
              <p className="text-xs text-muted-foreground">Is this a prescription-only medicine?</p>
            </div>
            <button
              type="button"
              onClick={() => updateField('prescriptionRequired', !form.prescriptionRequired)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                form.prescriptionRequired ? 'bg-[#5F9E95]' : 'bg-white/10'
              }`}
            >
              <motion.div
                animate={{ x: form.prescriptionRequired ? 24 : 2 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white"
              />
            </button>
          </motion.div>

          {/* Notes */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              placeholder="Any additional notes about this medicine..."
              rows={2}
              className="w-full px-4 py-3 rounded-2xl glass border border-white/10 focus:border-[#5F9E95]/50 focus:outline-none transition-colors text-sm resize-none"
            />
          </motion.div>

          {/* Submit */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="pt-4"
          >
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-2xl bg-[#5F9E95] text-white font-medium text-sm hover:bg-[#3D6B65] transition-colors shadow-lg shadow-[#5F9E95]/20 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Add to Cabinet
            </motion.button>
          </motion.div>
        </form>
      </div>
    </div>
  );
}
