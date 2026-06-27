import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pencil, ImagePlus, X, ScanLine, Info, Loader2, MapPin, Bell, Camera, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useSettings } from '@/hooks/useSettings';
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
import { useToast } from '@/hooks/use-toast';
import type { Medication } from '@/types/medication';
import { MEDICINE_FORMS, MEDICINE_CATEGORIES, STORAGE_LOCATIONS } from '@/types/medication';
import { getMedicationById } from '@/services/medicationService';
import {
  scanBarcodeOnce,
  findMedicationByBarcode,
  BarcodeNotSupportedError,
  BarcodePermissionDeniedError,
} from '@/services/barcodeService';
import DoseReminderEditor from '@/components/DoseReminderEditor';
import {
  scanBoxAndParse,
  mapOcrFormToMedicineForm,
  OcrNotSupportedError,
  OcrNoTextError,
} from '@/services/ocrScanService';
import { reminderToDraft, draftToReminder } from '@/services/doseReminderService';

interface EditMedicinePageProps {
  medId: string;
  onSave: (id: string, updates: Partial<Medication>) => void;
  onCancel: () => void;
}

export default function EditMedicinePage({ medId, onSave, onCancel }: EditMedicinePageProps) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const { toast } = useToast();
  const isMonthYear = settings.datePickerType === 'month-year';
  const [form, setForm] = useState<Medication | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const [showBarcodeInfo, setShowBarcodeInfo] = useState(false);
  const [reminderDraft, setReminderDraft] = useState(() =>
    reminderToDraft(null)
  );
  const [ocrScanning, setOcrScanning]         = useState(false);
  const [ocrFilledFields, setOcrFilledFields] = useState<Set<string>>(new Set());

  const ocrCls = (field: string) =>
    ocrFilledFields.has(field) ? 'ring-2 ring-emerald-500/40 border-emerald-500/50' : '';

  useEffect(() => {
    const med = getMedicationById(medId);
    if (med) {
      setForm(med);
      setReminderDraft(reminderToDraft(med.reminder));
    }
  }, [medId]);

  const handleScanBox = async () => {
    if (!form) return;
    setOcrScanning(true);
    try {
      const result  = await scanBoxAndParse();
      const filled  = new Set<string>();

      if (result.medicine_name)     { update('name',             result.medicine_name);    filled.add('name'); }
      if (result.active_ingredient) { update('activeIngredient', result.active_ingredient); filled.add('activeIngredient'); }
      if (result.dosage_strength)   { update('dosage',           result.dosage_strength);  filled.add('dosage'); }
      const mappedForm = mapOcrFormToMedicineForm(result.form);
      if (mappedForm)               { update('form',             mappedForm);              filled.add('form'); }
      if (result.additional_info)   { update('notes',            result.additional_info);  filled.add('notes'); }

      setOcrFilledFields(filled);
      toast(filled.size > 0 ? t('scanBoxSuccess') : t('scanBoxNoText'));
    } catch (err) {
      if (err instanceof OcrNotSupportedError)  toast(t('scanBoxNotSupported'));
      else if (err instanceof OcrNoTextError)   toast(t('scanBoxNoText'));
      else                                       toast(t('scanBoxError'));
    } finally {
      setOcrScanning(false);
    }
  };

  const handleScanBarcode = async () => {
    setScanning(true);
    try {
      const code = await scanBarcodeOnce();
      if (!code) {
        setScanning(false);
        return; // user cancelled
      }

      update('barcode', code);

      const known = findMedicationByBarcode(code);
      if (known && known.id !== medId) {
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
    const reminder = draftToReminder(reminderDraft, form.reminder);
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
      barcode: form.barcode,
      storageLocation: form.storageLocation,
      storageLocationNote: form.storageLocationNote,
      reminder: reminder ?? undefined,
    });
  };

  const update = (field: keyof Medication, value: any) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : null));
    setOcrFilledFields((prev) => {
      if (!prev.has(field as string)) return prev;
      const next = new Set(prev); next.delete(field as string); return next;
    });
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
            {/* ── Smart Camera Scan ──────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Camera className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{t('scanBoxTitle')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t('scanBoxDesc')}</p>
                </div>
              </div>
              {ocrFilledFields.size > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {t('scanBoxSuccess')}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={handleScanBox}
                disabled={ocrScanning || scanning}
              >
                {ocrScanning
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{t('scanBoxScanning')}</>
                  : <><Camera className="w-4 h-4" />{ocrFilledFields.size > 0 ? t('scanBoxScanAgain') : t('scanBoxButton')}</>
                }
              </Button>
            </div>

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
                className={[errors.name ? 'border-destructive' : '', ocrCls('name')].filter(Boolean).join(' ')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Barcode */}
            <div className="space-y-1.5">
              <Label htmlFor="barcode">{t('barcodeField')}</Label>
              <Input
                id="barcode"
                value={form.barcode ?? ''}
                onChange={(e) => update('barcode', e.target.value)}
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
                  className={ocrCls('activeIngredient')}
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
                  className={[errors.dosage ? 'border-destructive' : '', ocrCls('dosage')].filter(Boolean).join(' ')}
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
                  value={isMonthYear && form.expirationDate
                    ? form.expirationDate.substring(0, 7)
                    : form.expirationDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    update('expirationDate', isMonthYear && val ? val + '-01' : val);
                  }}
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

            {/* Storage Location */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {t('storageLocation')}
              </Label>
              <Select
                value={form.storageLocation ?? 'none'}
                onValueChange={(v) => update('storageLocation', v === 'none' ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('storageLocationPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('storageLocationNone')}</SelectItem>
                  {STORAGE_LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {t(`storage_${loc}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.storageLocation === 'other' && (
                <Input
                  value={form.storageLocationNote ?? ''}
                  onChange={(e) => update('storageLocationNote', e.target.value)}
                  placeholder={t('storageLocationNotePlaceholder')}
                  className="mt-2"
                />
              )}
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

            {/* Dose Reminder */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              <Label className="flex items-center gap-1.5 pt-2">
                <Bell className="w-3.5 h-3.5" />
                {t('reminderSectionTitle')}
              </Label>
              <DoseReminderEditor
                draft={reminderDraft}
                onChange={setReminderDraft}
                dosageHint={form.dosage}
              />
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
    </motion.div>
  );
}
