import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, FileSpreadsheet, FileJson, Share2, Download, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nContext';
import type { AppSettings } from '@/types/medication';
import { exportInventory } from '@/services/exportService';

interface ExportPageProps {
  settings: AppSettings;
}

const exportFormats: {
  key: 'pdf' | 'txt' | 'json';
  label: 'exportPDF' | 'exportTXT' | 'exportJSON';
  desc: string;
  icon: typeof FileText;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    key: 'pdf',
    label: 'exportPDF',
    desc: 'Beautiful formatted report with tables and sections',
    icon: FileText,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  {
    key: 'txt',
    label: 'exportTXT',
    desc: 'Plain text format optimized for AI analysis',
    icon: FileSpreadsheet,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  {
    key: 'json',
    label: 'exportJSON',
    desc: 'Structured JSON for backup and data portability',
    icon: FileJson,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
];

export default function ExportPage({ settings }: ExportPageProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = async (format: 'pdf' | 'txt' | 'json') => {
    setExporting(format);
    try {
      await exportInventory(format, {
        includeNotes: settings.exportPreferences.includeNotes,
        includeEmergencySection: settings.exportPreferences.includeEmergencySection,
      });
      toast(t('exportSuccess'));
    } catch (error) {
      toast(t('exportError'));
    } finally {
      setExporting(null);
    }
  };

  const aiPrompt = `Analyze this medicine inventory and determine:
- Which prescribed medicines are already available
- Possible alternatives based on active ingredients
- Medicines nearing expiration
- Potential duplicates
- Missing emergency essentials
- Possible medicine interactions

This report is not medical advice.`;

  const copyPrompt = () => {
    navigator.clipboard.writeText(aiPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast(t('copied'));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1">{t('exportInventory')}</h1>
          <p className="text-muted-foreground">{t('exportDesc')}</p>
        </div>

        <div className="space-y-4">
          {exportFormats.map((fmt, index) => {
            const Icon = fmt.icon;
            return (
              <motion.div
                key={fmt.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`${fmt.borderColor} border overflow-hidden`}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${fmt.bgColor}`}>
                        <Icon className={`w-6 h-6 ${fmt.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{t(fmt.label)}</h3>
                        <p className="text-sm text-muted-foreground">{fmt.desc}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport(fmt.key)}
                          disabled={!!exporting}
                        >
                          {exporting === fmt.key ? (
                            <span className="animate-spin mr-2">&#9696;</span>
                          ) : (
                            <Share2 className="w-4 h-4 mr-2" />
                          )}
                          {t('share')}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleExport(fmt.key)}
                          disabled={!!exporting}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {t('download')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* AI Analysis Prompt Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {t('aiPromptTitle')}
            </CardTitle>
            <CardDescription>{t('aiPromptDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-sm font-mono whitespace-pre-wrap">
              {aiPrompt}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={copyPrompt}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {t('copied')}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  {t('copyPrompt')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
