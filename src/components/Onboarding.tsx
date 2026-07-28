import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Bell,
  ShieldCheck,
  User,
  ChevronRight,
  ChevronLeft,
  Check,
  Minus,
  Cloud,
  BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n/I18nContext';
import AppLogo from '@/components/icons/AppLogo';
import { useProfile } from '@/context/ProfileContext';
import {
  PROFILE_COLORS,
  PROFILE_COLOR_CLASSES,
  type ProfileColor,
} from '@/types/profile';

export const ONBOARDED_KEY = 'homemed-onboarded';

// ── Slide illustrations ───────────────────────────────────────────────────────
// Built purely from Lucide icons + Tailwind — no image assets required.

function IllustrationWelcome() {
  return (
    <div className="relative flex items-center justify-center w-full h-52">
      {/* Central cabinet */}
      <AppLogo className="w-28 h-28" />

      {/* Floating medicine cards */}
      <div className="absolute top-5 left-8 w-14 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
        <div className="flex flex-col gap-1">
          <div className="w-8 h-1 rounded-full bg-emerald-500/50" />
          <div className="w-5 h-1 rounded-full bg-emerald-500/30" />
        </div>
      </div>
      <div className="absolute top-10 right-6 w-14 h-9 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
        <div className="flex flex-col gap-1">
          <div className="w-8 h-1 rounded-full bg-violet-500/50" />
          <div className="w-5 h-1 rounded-full bg-violet-500/30" />
        </div>
      </div>
      <div className="absolute bottom-6 left-14 w-14 h-9 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
        <div className="flex flex-col gap-1">
          <div className="w-8 h-1 rounded-full bg-rose-500/50" />
          <div className="w-5 h-1 rounded-full bg-rose-500/30" />
        </div>
      </div>
      <div className="absolute bottom-5 right-10 w-14 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
        <div className="flex flex-col gap-1">
          <div className="w-8 h-1 rounded-full bg-amber-500/50" />
          <div className="w-5 h-1 rounded-full bg-amber-500/30" />
        </div>
      </div>
    </div>
  );
}

function IllustrationProfiles() {
  return (
    <div className="relative flex items-center justify-center w-full h-52">
      {/* Connecting line behind everything */}
      <div className="absolute w-[220px] h-px bg-gradient-to-r from-blue-500/40 via-primary/25 to-rose-500/40" />

      {/* Profile A */}
      <div className="flex flex-col items-center gap-2.5 z-10">
        <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/30">
          <User className="w-7 h-7 text-white" />
        </div>
        {/* Their personal schedule bars */}
        <div className="space-y-1.5 w-16">
          <div className="h-1.5 rounded-full bg-blue-500/40 w-full" />
          <div className="h-1.5 rounded-full bg-blue-500/25 w-10" />
          <div className="h-1.5 rounded-full bg-blue-500/35 w-14" />
        </div>
      </div>

      {/* Shared cabinet — centre */}
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm mx-8 z-10">
        <Package className="w-8 h-8 text-primary" />
      </div>

      {/* Profile B */}
      <div className="flex flex-col items-center gap-2.5 z-10">
        <div className="w-14 h-14 rounded-full bg-rose-500 flex items-center justify-center shadow-md shadow-rose-500/30">
          <User className="w-7 h-7 text-white" />
        </div>
        {/* Their different personal schedule bars */}
        <div className="space-y-1.5 w-16">
          <div className="h-1.5 rounded-full bg-rose-500/35 w-12" />
          <div className="h-1.5 rounded-full bg-rose-500/40 w-full" />
          <div className="h-1.5 rounded-full bg-rose-500/25 w-8" />
        </div>
      </div>
    </div>
  );
}

function IllustrationReminders() {
  return (
    <div className="relative flex items-center justify-center w-full h-52">
      {/* Central bell */}
      <div className="w-28 h-28 rounded-[28px] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10">
        <Bell className="w-14 h-14 text-amber-500" />
      </div>

      {/* "Dose confirmed" badge — top right */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-xl px-3 py-1.5">
        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          ✓
        </span>
      </div>

      {/* "–1 unit" deduction badge — bottom left */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-1.5">
        <Minus className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
        <div className="flex items-end gap-0.5">
          <span className="text-xs font-bold text-rose-500">1</span>
          <div className="mb-0.5 w-4 h-1 rounded-full bg-rose-400/50" />
        </div>
      </div>

      {/* Stock decrease visual — pill stack shrinking */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-1 items-center">
        <div className="w-5 h-3 rounded-md bg-amber-400/60" />
        <div className="w-5 h-3 rounded-md bg-amber-400/40" />
        <div className="w-5 h-3 rounded-md bg-amber-400/20" />
      </div>
    </div>
  );
}

function IllustrationPrivacy() {
  return (
    <div className="relative flex items-center justify-center w-full h-52">
      {/* Central shield */}
      <div className="w-28 h-28 rounded-[28px] bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shadow-lg shadow-teal-500/10">
        <ShieldCheck className="w-14 h-14 text-teal-500" />
      </div>

      {/* Crossed-out cloud — top left */}
      <div className="absolute top-4 left-4 relative flex items-center gap-1.5 bg-muted/80 border border-border rounded-xl px-3 py-1.5 opacity-60">
        <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
        {/* Red diagonal slash */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-px bg-destructive rotate-[-22deg] scale-x-[1.1]" />
        </div>
      </div>

      {/* Crossed-out analytics — bottom right */}
      <div className="absolute bottom-4 right-4 relative flex items-center gap-1.5 bg-muted/80 border border-border rounded-xl px-3 py-1.5 opacity-60">
        <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
        {/* Red diagonal slash */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-px bg-destructive rotate-[-22deg] scale-x-[1.1]" />
        </div>
      </div>

      {/* "On device" indicator — bottom left */}
      <div className="absolute bottom-6 left-6 flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/20 rounded-xl px-3 py-1.5">
        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
      </div>
    </div>
  );
}

// ── Slide motion variants ─────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '80%' : '-80%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? '-80%' : '80%',
    opacity: 0,
  }),
};

const transition = { type: 'spring', stiffness: 320, damping: 32 };

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

const TOTAL_SLIDES = 4;

export default function Onboarding({ onComplete }: Props) {
  const { t } = useI18n();
  const { activeProfile, renameProfile, changeProfileColor } = useProfile();
  const cls = PROFILE_COLOR_CLASSES;

  // step 0-3 = info slides, step 4 = name step
  const [step, setStep]           = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName]           = useState('');
  const [color, setColor]         = useState<ProfileColor>('blue');

  const isNameStep = step === TOTAL_SLIDES;

  const goTo = useCallback((next: number, dir: 1 | -1) => {
    setDirection(dir);
    setStep(next);
  }, []);

  const handleNext = useCallback(() => {
    goTo(step < TOTAL_SLIDES - 1 ? step + 1 : TOTAL_SLIDES, 1);
  }, [step, goTo]);

  const handleBack = useCallback(() => {
    if (step > 0) goTo(step - 1, -1);
  }, [step, goTo]);

  const handleSkip = useCallback(() => {
    goTo(TOTAL_SLIDES, 1);
  }, [goTo]);

  const handleComplete = useCallback(() => {
    const finalName = name.trim() || 'Me';
    // Rename and recolor the auto-created default profile
    if (finalName !== activeProfile.name) {
      renameProfile(activeProfile.id, finalName);
    }
    if (color !== activeProfile.color) {
      changeProfileColor(activeProfile.id, color);
    }
    localStorage.setItem(ONBOARDED_KEY, 'true');
    onComplete();
  }, [name, color, activeProfile, renameProfile, changeProfileColor, onComplete]);

  const slides = [
    {
      illustration: <IllustrationWelcome />,
      title: t('onboardingSlide1Title'),
      body:  t('onboardingSlide1Body'),
    },
    {
      illustration: <IllustrationProfiles />,
      title: t('onboardingSlide2Title'),
      body:  t('onboardingSlide2Body'),
    },
    {
      illustration: <IllustrationReminders />,
      title: t('onboardingSlide3Title'),
      body:  t('onboardingSlide3Body'),
    },
    {
      illustration: <IllustrationPrivacy />,
      title: t('onboardingSlide4Title'),
      body:  t('onboardingSlide4Body'),
    },
  ];

  const avatarInitial = (name.trim() || 'M').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col select-none">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2 min-h-[48px]">
        {/* Back chevron — visible on slides 2-3, hidden on slide 0/1 and name step */}
        {!isNameStep && step > 0 ? (
          <button
            onClick={handleBack}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
            aria-label={t('onboardingBack')}
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        ) : (
          <div className="w-9" /> // spacer to keep skip right-aligned
        )}

        {/* Skip — only on info slides */}
        {!isNameStep && (
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg"
          >
            {t('onboardingSkip')}
          </button>
        )}
      </div>

      {/* ── Animated content area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          {!isNameStep ? (
            /* ── Info slides ── */
            <motion.div
              key={`slide-${step}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="w-full max-w-sm flex flex-col items-center text-center gap-7"
            >
              {slides[step].illustration}

              <div className="space-y-3 px-2">
                <h1 className="text-[22px] font-bold leading-snug">
                  {slides[step].title}
                </h1>
                <p className="text-muted-foreground leading-relaxed text-[15px]">
                  {slides[step].body}
                </p>
              </div>
            </motion.div>
          ) : (
            /* ── Name step ── */
            <motion.div
              key="name-step"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="w-full max-w-sm flex flex-col items-center gap-7"
            >
              {/* Live avatar preview */}
              <div
                className={[
                  'w-24 h-24 rounded-full flex items-center justify-center',
                  'text-white text-4xl font-bold shadow-lg transition-colors duration-200',
                  cls[color].bg,
                ].join(' ')}
              >
                {avatarInitial}
              </div>

              <div className="text-center space-y-2">
                <h1 className="text-[22px] font-bold leading-snug">
                  {t('onboardingNameTitle')}
                </h1>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  {t('onboardingNameBody')}
                </p>
              </div>

              <div className="w-full space-y-5">
                {/* Name input */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t('onboardingNameLabel')}
                  </Label>
                  <Input
                    placeholder={t('onboardingNamePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={20}
                    autoFocus
                    className="h-12 text-center text-base"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleComplete(); }}
                  />
                </div>

                {/* Color picker */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t('profileColorLabel')}
                  </Label>
                  <div className="flex gap-3 flex-wrap">
                    {PROFILE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={c}
                        onClick={() => setColor(c)}
                        className={[
                          'w-9 h-9 rounded-full transition-all duration-150',
                          cls[c].bg,
                          color === c
                            ? `ring-2 ring-offset-2 ring-offset-background ${cls[c].ring} scale-110`
                            : 'opacity-55 hover:opacity-85',
                        ].join(' ')}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom controls ───────────────────────────────────────────────── */}
      <div className="px-6 pb-10 space-y-5">
        {/* Progress dots — slides only */}
        {!isNameStep && (
          <div className="flex justify-center items-center gap-2">
            {slides.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === step ? 24 : 8,
                  opacity: i === step ? 1 : 0.35,
                }}
                transition={{ duration: 0.25 }}
                className={[
                  'h-2 rounded-full',
                  i === step ? 'bg-primary' : 'bg-muted-foreground',
                ].join(' ')}
              />
            ))}
          </div>
        )}

        {/* Action button */}
        {!isNameStep ? (
          <Button
            onClick={handleNext}
            className="w-full h-13 rounded-2xl font-semibold text-[15px] gap-1.5"
            size="lg"
          >
            {t('onboardingNext')}
            <ChevronRight className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            className="w-full h-13 rounded-2xl font-semibold text-[15px]"
            size="lg"
          >
            {t('onboardingGetStarted')}
          </Button>
        )}
      </div>
    </div>
  );
}
