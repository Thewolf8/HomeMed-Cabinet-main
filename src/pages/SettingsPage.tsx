import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Moon,
  Sun,
  Globe,
  Trash2,
  FileJson,
  Shield,
  Package,
  ChevronRight,
  AlertTriangle,
  Upload,
  Check,
  Monitor,
  Clock,
  Bell,
  BellOff,
  CalendarX2,
  Layers,
  Archive,
  RotateCcw,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n/I18nContext';
import { useSettings } from '@/hooks/useSettings';
import type { AppSettings, Language, Theme, NotificationPreferences } from '@/types/medication';
import { readFileFromInput } from '@/services/fileSystem';
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

interface SettingsPageProps {
  settings: AppSettings;
  onSettingsChange: {
    setLanguage: (lang: Language) => void;
    setTheme: (theme: Theme) => void;
    updateExportPreference: (key: string, value: boolean) => void;
    setAnimationsEnabled: (v: boolean) => void;
  };
  onResetData: () => void;
  onImport: (data: unknown, merge: boolean) => { success: number; failed: number };
  onRescheduleNotifications: (prefs: NotificationPreferences) => void;
  onRestoreAutoBackup: () => Promise<void>;
  onWriteBackupNow: () => Promise<void>;
  toast: any;
}

const languages: { code: Language; label: 'systemDefault' | 'english' | 'arabic' | 'french'; flag: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'system', label: 'systemDefault', flag: '', dir: 'ltr' },
  { code: 'en', label: 'english', flag: '', dir: 'ltr' },
  { code: 'ar', label: 'arabic', flag: '', dir: 'rtl' },
  { code: 'fr', label: 'french', flag: '', dir: 'ltr' },
];

const themeOptions: { value: Theme; labelKey: 'themeLight' | 'themeDark' | 'themeSystem'; icon: typeof Sun }[] = [
  { value: 'light', labelKey: 'themeLight', icon: Sun },
  { value: 'dark', labelKey: 'themeDark', icon: Moon },
  { value: 'system', labelKey: 'themeSystem', icon: Monitor },
];

export default function SettingsPage({
  onResetData,
  onImport,
  onRescheduleNotifications,
  onRestoreAutoBackup,
  onWriteBackupNow,
  toast,
  onSettingsChange,
}: SettingsPageProps) {
  const { t, language, setLanguage } = useI18n();
  const {
    settings,
    setTheme,
    updateExportPreference,
    setAnimationsEnabled,
    setDateFormat,
    setDatePickerType,
    setNotificationPreference,
    setAutoDeleteExpired,
    setSmartMergeEnabled,
  } = useSettings();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState<unknown>(null);
  const [daysInput, setDaysInput] = useState(String(settings.notifications.daysBeforeExpiry ?? 30));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNotificationToggle = (key: keyof NotificationPreferences, value: boolean) => {
    setNotificationPreference(key, value);
    onRescheduleNotifications({ ...settings.notifications, [key]: value });
  };

  const commitDaysBeforeExpiry = () => {
    const parsed = parseInt(daysInput, 10);
    const days = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
    setDaysInput(String(days));
    setNotificationPreference('daysBeforeExpiry', days);
    onRescheduleNotifications({ ...settings.notifications, daysBeforeExpiry: days });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileFromInput(file);
      const data = JSON.parse(content);

      if (data.medications && Array.isArray(data.medications)) {
        setImportData(data.medications);
        setShowImportDialog(true);
      } else if (Array.isArray(data)) {
        setImportData(data);
        setShowImportDialog(true);
      } else {
        toast(t('importError'));
      }
    } catch {
      toast(t('importError'));
    }

    e.target.value = '';
  };

  const handleImportConfirm = (merge: boolean) => {
    if (importData) {
      const result = onImport(importData, merge);
      toast(`${result.success} medicines imported`);
      setShowImportDialog(false);
      setImportData(null);
    }
  };

  const handleReset = () => {
    onResetData();
    setShowResetDialog(false);
    toast(t('resetSuccess'));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1">{t('settings')}</h1>
          <p className="text-muted-foreground">{t('generalSettings')}</p>
        </div>

        {/* Appearance */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="w-4 h-4" />
              {t('appearance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = settings.theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${
                      isActive
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'border-transparent hover:bg-accent text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs leading-tight text-center">{t(opt.labelKey)}</span>
                    {isActive && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>

            {/* Animation toggle */}
            <div className="flex items-start gap-3 mt-4 pt-4 border-t border-border">
              <Checkbox
                id="animations"
                checked={settings.animationsEnabled ?? true}
                onCheckedChange={(checked) => setAnimationsEnabled(!!checked)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="animations" className="cursor-pointer font-medium">
                  {t('enableAnimations')}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('enableAnimationsDesc')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t('language')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`flex items-center justify-between w-full p-3 rounded-xl transition-all ${
                    language === lang.code
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-accent border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{lang.flag}</span>
                    <div className="text-start">
                      <p className="font-medium text-sm">{t(lang.label)}</p>
                      {lang.code !== 'system' && (
                        <p className="text-xs text-muted-foreground">{lang.dir.toUpperCase()}</p>
                      )}
                    </div>
                  </div>
                  {language === lang.code && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Date Settings ─────────────────────────────────── */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t('dateSettings')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Display Format */}
            <div>
              <p className="text-sm font-medium mb-2">{t('dateFormat')}</p>
              <div className="grid grid-cols-3 gap-2">
                {(['DMY', 'MDY', 'YMD'] as const).map((fmt) => {
                  const isActive = (settings.dateFormat ?? 'DMY') === fmt;
                  return (
                    <button
                      key={fmt}
                      onClick={() => setDateFormat(fmt)}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-transparent hover:bg-accent text-muted-foreground'
                      }`}
                    >
                      {t(`dateFmt${fmt}` as any)}
                      {isActive && <Check className="w-3 h-3 mx-auto mt-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Picker Type */}
            <div>
              <p className="text-sm font-medium mb-2">{t('datePickerType')}</p>
              <div className="grid grid-cols-2 gap-2">
                {(['full', 'month-year'] as const).map((type) => {
                  const isActive = (settings.datePickerType ?? 'full') === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setDatePickerType(type)}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-transparent hover:bg-accent text-muted-foreground'
                      }`}
                    >
                      {type === 'full' ? t('datePickerFull') : t('datePickerMonthYear')}
                      {isActive && <Check className="w-3 h-3 mx-auto mt-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Notifications ─────────────────────────────────── */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {t('notificationsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="notif-expiring"
                checked={settings.notifications.expiringSoonEnabled}
                onCheckedChange={(checked) => handleNotificationToggle('expiringSoonEnabled', !!checked)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="notif-expiring" className="cursor-pointer font-medium">
                  {t('notifExpiringSoon')}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t('notifExpiringSoonDesc')}</p>
              </div>
            </div>

            {settings.notifications.expiringSoonEnabled && (
              <div className="ps-0 sm:ps-1">
                <Label htmlFor="days-before" className="text-xs text-muted-foreground mb-1.5 block">
                  {t('notifDaysBefore')}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="days-before"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={daysInput}
                    onChange={(e) => setDaysInput(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={commitDaysBeforeExpiry}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">{t('days')}</span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 pt-3 border-t border-border">
              <Checkbox
                id="notif-expired"
                checked={settings.notifications.expiredEnabled}
                onCheckedChange={(checked) => handleNotificationToggle('expiredEnabled', !!checked)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="notif-expired" className="cursor-pointer font-medium">
                  {t('notifExpired')}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t('notifExpiredDesc')}</p>
              </div>
            </div>

            {!settings.notifications.expiringSoonEnabled && !settings.notifications.expiredEnabled && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <BellOff className="w-3.5 h-3.5 shrink-0" />
                <span>{t('notifAllDisabled')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Smart Merge ─────────────────────────────────── */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4" />
              {t('smartMergeTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="smart-merge" className="cursor-pointer font-medium">
                  {t('smartMergeToggle')}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t('smartMergeDesc')}</p>
              </div>
              <Switch
                id="smart-merge"
                checked={settings.smartMergeEnabled}
                onCheckedChange={(checked) => setSmartMergeEnabled(checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Cleanup ─────────────────────────────────── */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarX2 className="w-4 h-4" />
              {t('cleanupTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <Checkbox
                id="auto-delete"
                checked={settings.autoDeleteExpired}
                onCheckedChange={(checked) => setAutoDeleteExpired(!!checked)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="auto-delete" className="cursor-pointer font-medium">
                  {t('autoDeleteToggle')}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t('autoDeleteDesc')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Preferences */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('exportPreferences')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="includeNotes"
                checked={settings.exportPreferences.includeNotes}
                onCheckedChange={(checked) => updateExportPreference('includeNotes', !!checked)}
              />
              <Label htmlFor="includeNotes" className="cursor-pointer">
                {t('includeNotes')}
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="includeEmergency"
                checked={settings.exportPreferences.includeEmergencySection}
                onCheckedChange={(checked) => updateExportPreference('includeEmergencySection', !!checked)}
              />
              <Label htmlFor="includeEmergency" className="cursor-pointer">
                {t('includeEmergencySection')}
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Import / Export Data */}
        {/* ── Auto-Backup ─────────────────────────────────── */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Archive className="w-4 h-4" />
              {t('autoBackupTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('autoBackupDesc')}</p>

            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={async () => { await onWriteBackupNow(); }}
            >
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                {t('autoBackupWriteNow')}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={async () => { await onRestoreAutoBackup(); }}
            >
              <span className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                {t('autoBackupRestore')}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileJson className="w-4 h-4" />
              {t('dataManagement')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={handleImportClick}
            >
              <span className="flex items-center">
                <Upload className="w-4 h-4 mr-2" />
                {t('importBackup')}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-between"
              onClick={() => setShowResetDialog(true)}
            >
              <span className="flex items-center">
                <Trash2 className="w-4 h-4 mr-2" />
                {t('resetData')}
              </span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {t('privacy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('privacyText1')}</p>
            <p className="text-sm text-muted-foreground">{t('privacyText2')}</p>
            <p className="text-sm text-muted-foreground">{t('privacyText3')}</p>
            <p className="text-sm text-muted-foreground">{t('privacyText4')}</p>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold text-lg">{t('appName')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t('appDescription')}</p>
            <p className="text-xs text-muted-foreground mt-3">
              {t('version')} 1.0.2
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t('resetConfirm')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('resetConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Confirmation Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('importBackup')}</AlertDialogTitle>
            <AlertDialogDescription>{t('importConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleImportConfirm(false)}>
              {t('replaceImport')}
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleImportConfirm(true)}>
              {t('mergeImport')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
