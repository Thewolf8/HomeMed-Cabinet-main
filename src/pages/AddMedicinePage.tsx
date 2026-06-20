import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pill, ImagePlus, X, ScanLine, Info, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useI18n } from '@/i18n/I18nContext';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import type { Medication } from '@/types/medication';
import { MEDICINE_FORMS, MEDICINE_CATEGORIES } from '@/types/medication';
import {
  scanBarcodeOnce,
  cancelBarcodeScan,
  findMedicationByBarcode,
  BarcodeNotSupportedError,
  BarcodePermissionDeniedError,
} from '@/services/barcodeService';

interface AddMedicinePageProps {
  onSave: (med: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const initialForm = {
  name: '',
  activeIngredient: '',
  dosage: '',
  form: 'tablets' as Medication['form'],
  quantity: 1,
  expirationDate: '',
  usageInstructions: '',
  category: 'adult' as Medication['category'],
  prescriptionRequired: false,
  notes: '',
  image: '',
  barcode: '',
};

export default function AddMedicinePage({ onSave, onCancel }: AddMedicinePageProps) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const { toast } = useToast();
  const isMonthYear = settings.datePickerType === 'month-year';
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const [showBarcodeInfo, setShowBarcodeInfo] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Convert stored YYYY-MM-DD ↔ YYYY-MM for month input
  const dateInputValue = isMonthYear && form.expirationDate
    ? form.expirationDate.substring(0, 7)
    : form.expirationDate;

  const handleDateChange = (val: string) => {
    update('expirationDate', isMonthYear && val ? val + '-01' : val);
  };

  const handleScanBarcode = async () => {
    setAutoFilled(false);
    setScanning(true);
    try {
      const code = await scanBarcodeOnce();
      if (!code) {
        setScanning(false);
        return; // user cancelled
      }

      update('barcode', code);

      // Offline auto-recognition: if this barcode was linked to a medicine
      // before, fill in the rest of the form automatically.
      const known = findMedicationByBarcode(code);
      if (known) {
        setForm((prev) => ({
          ...prev,
          name: known.name,
          activeIngredient: known.activeIngredient,
          dosage: known.dosage,
          form: known.form,
          category: known.category,
          usageInstructions: known.usageInstructions,
          prescriptionRequired: known.prescriptionRequired,
          barcode: code,
        }));
        setAutoFilled(true);
        toast(t('barcodeAutoFilledToast'));
      } else {
        toast(t('barcodeScannedToast'));
      }
    } catch (err) {
      if (err instanceof BarcodePermissionDeniedError) {
        toast(t('barcodePermissionDenied'));
      } else if (err instanceof BarcodeNotSupportedError) {
        toast(t('barcodeNotSupported'));
      } else {
        toast(t('barcodeScanError'));
      }
    } finally {
      setScanning(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = t('requiredField');
    if (!form.dosage.trim()) newErrors.dosage = t('requiredField');
    if (!form.expirationDate) newErrors.expirationDate = t('requiredField');
    if (form.quantity < 0) newErrors.quantity = 'Invalid';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ ...form });
    setForm(initialForm);
    setAutoFilled(false);
  };

  const update = (field: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary" />
            {t('addMedicine')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="name">
                  {t('medicineName')} <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowBarcodeInfo(true)}
                    className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label={t('barcodeInfoTitle')}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleScanBarcode}
                    disabled={scanning}
                  >
                    {scanning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ScanLine className="w-4 h-4" />
                    )}
                    <span className="ms-1.5">{t('scanBarcode')}</span>
                  </Button>
                </div>
              </div>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder={t('medicineName')}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Barcode */}
            <div className="space-y-1.5">
              <Label htmlFor="barcode" className="flex items-center gap-1.5">
                {t('barcodeField')}
                {autoFilled && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </Label>
              <Input
                id="barcode"
                value={form.barcode}
                onChange={(e) => { setAutoFilled(false); update('barcode', e.target.value); }}
                placeholder={t('barcodeFieldPlaceholder')}
              />
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
                <Select value={form.form} onValueChange={(v) => update('form', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDICINE_FORMS.map((form) => (
                      <SelectItem key={form} value={form}>
                        {t(form)}
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.quantity === 0 ? '' : form.quantity}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    update('quantity', raw === '' ? 0 : parseInt(raw, 10));
                  }}
                />
              </div>

              {/* Expiration Date */}
              <div className="space-y-1.5">
                <Label htmlFor="expirationDate">
                  {t('expirationDate')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="expirationDate"
                  type={isMonthYear ? 'month' : 'date'}
                  value={dateInputValue}
                  onChange={(e) => handleDateChange(e.target.value)}
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
            <div className="flex items-center gap-3 py-2">
              <Checkbox
                id="prescription"
                checked={form.prescriptionRequired}
                onCheckedChange={(checked) => update('prescriptionRequired', !!checked)}
              />
              <Label htmlFor="prescription" className="cursor-pointer">
                {t('prescriptionRequired')}
              </Label>
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
                    onClick={() => update('image', '')}
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
                {t('saveMedicine')}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Barcode privacy/info dialog */}
      <Dialog open={showBarcodeInfo} onOpenChange={setShowBarcodeInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-primary" />
              {t('barcodeInfoTitle')}
            </DialogTitle>
            <DialogDescription className="text-start pt-2">
              {t('barcodeInfoDesc')}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Camera scan overlay — shown while the native camera preview is
          visible behind the (now transparent) WebView. See App.css. */}
      {scanning && (
        <div className="barcode-scan-overlay fixed inset-0 z-[9999] flex flex-col items-center justify-between py-12 px-6 pointer-events-none">
          <div className="bg-black/60 text-white text-sm rounded-full px-4 py-2 pointer-events-none">
            {t('barcodeScanHint')}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="pointer-events-auto shadow-lg"
            onClick={() => cancelBarcodeScan()}
          >
            <X className="w-4 h-4 me-1.5" />
            {t('cancel')}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
