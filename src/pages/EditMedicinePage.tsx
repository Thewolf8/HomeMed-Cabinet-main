import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pencil, ImagePlus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/i18n/I18nContext';
import type { Medication } from '@/types/medication';
import { MEDICINE_FORMS, MEDICINE_CATEGORIES } from '@/types/medication';
import { getMedicationById } from '@/services/medicationService';

interface EditMedicinePageProps {
  medId: string;
  onSave: (id: string, updates: Partial<Medication>) => void;
  onCancel: () => void;
}

export default function EditMedicinePage({ medId, onSave, onCancel }: EditMedicinePageProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<Medication | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const med = getMedicationById(medId);
    if (med) {
      setForm(med);
    }
  }, [medId]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form) return false;
    if (!form.name.trim()) newErrors.name = t('requiredField');
    if (!form.dosage.trim()) newErrors.dosage = t('requiredField');
    if (!form.expirationDate) newErrors.expirationDate = t('requiredField');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !validate()) return;
    onSave(medId, {
      name: form.name,
      activeIngredient: form.activeIngredient,
      dosage: form.dosage,
      form: form.form,
      quantity: form.quantity,
      expirationDate: form.expirationDate,
      usageInstructions: form.usageInstructions,
      category: form.category,
      prescriptionRequired: form.prescriptionRequired,
      notes: form.notes,
      image: form.image,
    });
  };

  const update = (field: keyof Medication, value: any) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : null));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => update('image', reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (!form) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            {t('editMedicine')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                {t('medicineName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder={t('medicineName')}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Active Ingredient */}
              <div className="space-y-1.5">
                <Label htmlFor="activeIngredient">{t('activeIngredient')}</Label>
                <Input
                  id="activeIngredient"
                  value={form.activeIngredient}
                  onChange={(e) => update('activeIngredient', e.target.value)}
                  placeholder={t('activeIngredient')}
                />
              </div>

              {/* Dosage */}
              <div className="space-y-1.5">
                <Label htmlFor="dosage">
                  {t('dosage')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dosage"
                  value={form.dosage}
                  onChange={(e) => update('dosage', e.target.value)}
                  placeholder={t('dosageExample')}
                  className={errors.dosage ? 'border-destructive' : ''}
                />
                {errors.dosage && <p className="text-xs text-destructive">{errors.dosage}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Form */}
              <div className="space-y-1.5">
                <Label>{t('form')}</Label>
                <Select value={form.form} onValueChange={(v) => update('form', v as Medication['form'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDICINE_FORMS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {t(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <Label htmlFor="quantity">{t('quantity')}</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => update('quantity', parseInt(e.target.value) || 0)}
                />
              </div>

              {/* Expiration Date */}
              <div className="space-y-1.5">
                <Label htmlFor="expirationDate">
                  {t('expirationDate')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={form.expirationDate}
                  onChange={(e) => update('expirationDate', e.target.value)}
                  className={errors.expirationDate ? 'border-destructive' : ''}
                />
                {errors.expirationDate && (
                  <p className="text-xs text-destructive">{errors.expirationDate}</p>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>{t('category')}</Label>
              <div className="flex flex-wrap gap-2">
                {MEDICINE_CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    variant={form.category === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => update('category', cat)}
                  >
                    {t(cat)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Usage Instructions */}
            <div className="space-y-1.5">
              <Label htmlFor="usageInstructions">{t('usageInstructions')}</Label>
              <Textarea
                id="usageInstructions"
                value={form.usageInstructions}
                onChange={(e) => update('usageInstructions', e.target.value)}
                placeholder={t('usageInstructions')}
                rows={2}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">
                {t('notes')} <span className="text-muted-foreground">({t('optional')})</span>
              </Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder={t('notes')}
                rows={2}
              />
            </div>

            {/* Prescription Required */}
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="prescription" className="cursor-pointer">
                {t('prescriptionRequired')}
              </Label>
              <Switch
                id="prescription"
                checked={form.prescriptionRequired}
                onCheckedChange={(checked) => update('prescriptionRequired', checked)}
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>{t('imageUpload')}</Label>
              {form.image ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden">
                  <img src={form.image} alt="Medicine" className="w-full h-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => update('image', undefined)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">{t('imageUpload')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">
                {t('updateMedicine')}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
