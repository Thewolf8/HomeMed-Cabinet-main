import { PackageCheck } from 'lucide-react';
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
import { useI18n } from '@/i18n/I18nContext';
import type { Medication } from '@/types/medication';

interface ImportConflictModalProps {
  open: boolean;
  medications: Medication[] | null;
  onMerge: () => void;
  onReplace: () => void;
  onCancel: () => void;
}

export default function ImportConflictModal({
  open,
  medications,
  onMerge,
  onReplace,
  onCancel,
}: ImportConflictModalProps) {
  const { t } = useI18n();
  const count = medications?.length ?? 0;
  const description = t('homemedImportDesc').replace('{count}', String(count));

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-orange-500" />
            {t('homemedImportTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onCancel}>{t('homemedImportCancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onReplace} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {t('homemedImportReplace')}
          </AlertDialogAction>
          <AlertDialogAction onClick={onMerge}>{t('homemedImportMerge')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
