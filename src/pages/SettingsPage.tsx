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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n/I18nContext';
import { useSettings } from '@/hooks/useSettings';
import type { AppSettings, Language, Theme } from '@/types/medication';
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
  };
  onResetData: () => void;
  onImport: (data: unknown, merge: boolean) => { success: number; failed: number };
  toast: any;
}

const languages: { code: Language; label: 'systemDefault' | 'english' | 'arabic' | 'french'; flag: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'system', label: 'systemDefault', flag: '', dir: 'ltr' },
  { code: 'en', label: 'english', flag: '', dir: 'ltr' },
  { code: 'ar', label: 'arabic', flag: '', dir: 'rtl' },
  { code: 'fr', label: 'french', flag: '', dir: 'ltr' },
];

export default function SettingsPage({
  onResetData,
  onImport,
  toast,
}: SettingsPageProps) {
  const { t, language, setLanguage } = useI18n();
  const { settings, setTheme, updateExportPreference } = useSettings();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileFromInput(file);
      const data = JSON.parse(content);

      // Validate structure
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

    // Reset input
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

  const isDark = settings.theme === 'dark';

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
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              {t('appearance')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium">{t('darkMode')}</p>
                  <p className="text-xs text-muted-foreground">
                    {isDark ? 'Currently active' : 'Switch to dark'}
                  </p>
                </div>
              </div>
              <Switch checked={isDark} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
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
                    <div className="text-left">
                      <p className="font-medium text-sm">{t(lang.label)}</p>
                      {lang.code !== 'system' && (
                        <p className="text-xs text-muted-foreground">{lang.dir.toUpperCase()}</p>
                      )}
                    </div>
                  </div>
                  {language === lang.code && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="includeNotes" className="cursor-pointer">
                {t('includeNotes')}
              </Label>
              <Switch
                id="includeNotes"
                checked={settings.exportPreferences.includeNotes}
                onCheckedChange={(checked) => updateExportPreference('includeNotes', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="includeEmergency" className="cursor-pointer">
                {t('includeEmergencySection')}
              </Label>
              <Switch
                id="includeEmergency"
                checked={settings.exportPreferences.includeEmergencySection}
                onCheckedChange={(checked) => updateExportPreference('includeEmergencySection', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Import / Export Data */}
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
              {t('version')} 1.0.0
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
