import { useState, useRef } from 'react';
import { ChevronDown, Plus, Pencil, Trash2, Check, X, Users } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProfile } from '@/context/ProfileContext';
import { useI18n } from '@/i18n/I18nContext';
import {
  PROFILE_COLORS,
  PROFILE_COLOR_CLASSES,
  MAX_PROFILES,
  type ProfileColor,
} from '@/types/profile';

// ── Small helpers ─────────────────────────────────────────────────────────────

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function ColorPicker({
  value,
  onChange,
}: {
  value: ProfileColor;
  onChange: (c: ProfileColor) => void;
}) {
  const cls = PROFILE_COLOR_CLASSES;
  return (
    <div className="flex gap-2 flex-wrap">
      {PROFILE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          onClick={() => onChange(c)}
          className={[
            'w-6 h-6 rounded-full transition-all',
            cls[c].bg,
            value === c
              ? `ring-2 ring-offset-2 ring-offset-background ${cls[c].ring}`
              : 'opacity-60 hover:opacity-100',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileSwitcher() {
  const {
    profiles,
    activeProfile,
    switchProfile,
    addProfile,
    renameProfile,
    changeProfileColor,
    deleteProfile,
  } = useProfile();
  const { t } = useI18n();
  const cls = PROFILE_COLOR_CLASSES;

  const [open, setOpen] = useState(false);

  // Inline-rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Add-new-profile state
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName]     = useState('');
  const [newColor, setNewColor]   = useState<ProfileColor>('emerald');
  const newInputRef = useRef<HTMLInputElement>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditName(name);
    // Focus happens on next paint via autoFocus on the input
  }

  function commitEdit() {
    if (editingId && editName.trim()) {
      renameProfile(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  }

  function commitAdd() {
    if (!newName.trim()) return;
    addProfile(newName.trim(), newColor);
    setAddingNew(false);
    setNewName('');
    setNewColor('emerald');
  }

  function handleSwitch(id: string) {
    if (id !== activeProfile.id) switchProfile(id);
    setOpen(false);
  }

  function handleDelete(id: string, name: string) {
    const msg = t('profileDeleteConfirm').replace('{name}', name);
    if (window.confirm(msg)) deleteProfile(id);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* ── Trigger chip ─────────────────────────────────────────────────── */}
      <SheetTrigger asChild>
        <button
          className={[
            'flex items-center gap-1.5 rounded-full py-1 px-2.5',
            'hover:bg-accent transition-colors',
            cls[activeProfile.color].light,
          ].join(' ')}
          aria-label={t('profilesTitle')}
        >
          {/* Avatar */}
          <div
            className={[
              'w-6 h-6 rounded-full flex items-center justify-center',
              'text-white text-[11px] font-bold flex-shrink-0',
              cls[activeProfile.color].bg,
            ].join(' ')}
          >
            {initial(activeProfile.name)}
          </div>
          {/* Name — hidden on very small screens */}
          <span className="text-xs font-medium max-w-[70px] truncate hidden xs:inline">
            {activeProfile.name}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        </button>
      </SheetTrigger>

      {/* ── Sheet ────────────────────────────────────────────────────────── */}
      <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            {t('profilesTitle')}
          </SheetTitle>
        </SheetHeader>

        {/* Profile list */}
        <div className="space-y-1.5">
          {profiles.map((p) => {
            const isActive  = p.id === activeProfile.id;
            const isEditing = editingId === p.id;

            return (
              <div
                key={p.id}
                className={[
                  'flex items-center gap-3 rounded-xl p-3 transition-colors',
                  isActive ? 'bg-accent' : 'hover:bg-accent/40',
                ].join(' ')}
              >
                {/* Avatar */}
                <button
                  type="button"
                  onClick={() => handleSwitch(p.id)}
                  className={[
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    'text-white font-bold text-sm flex-shrink-0',
                    cls[p.color].bg,
                    isActive ? '' : 'opacity-75',
                  ].join(' ')}
                >
                  {initial(p.name)}
                </button>

                {/* Name / inline edit */}
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      ref={editInputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm flex-1"
                      maxLength={20}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') { setEditingId(null); setEditName(''); }
                      }}
                    />
                    <button
                      type="button"
                      onClick={commitEdit}
                      className="p-1.5 rounded-lg hover:bg-muted"
                    >
                      <Check className="w-4 h-4 text-emerald-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(null); setEditName(''); }}
                      className="p-1.5 rounded-lg hover:bg-muted"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => handleSwitch(p.id)}
                    >
                      <span className="text-sm font-semibold">{p.name}</span>
                      {isActive && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {t('profileActive')}
                        </span>
                      )}
                    </button>

                    {/* Edit name */}
                    <button
                      type="button"
                      onClick={() => startEdit(p.id, p.name)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      aria-label="rename"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>

                    {/* Delete — only visible when >1 profile exists */}
                    {profiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                        aria-label="delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Color picker for the active profile */}
        <div className="mt-3 px-1">
          <p className="text-xs text-muted-foreground mb-2">{t('profileColorLabel')}</p>
          <ColorPicker
            value={activeProfile.color}
            onChange={(c) => changeProfileColor(activeProfile.id, c)}
          />
        </div>

        {/* ── Add new profile ─────────────────────────────────────────── */}
        {profiles.length < MAX_PROFILES ? (
          <div className="mt-4 pt-4 border-t border-border">
            {addingNew ? (
              <div className="space-y-3">
                <Input
                  ref={newInputRef}
                  placeholder={t('profileNamePlaceholder')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={20}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitAdd();
                    if (e.key === 'Escape') { setAddingNew(false); setNewName(''); }
                  }}
                />
                <ColorPicker value={newColor} onChange={setNewColor} />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setAddingNew(false); setNewName(''); }}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={!newName.trim()}
                    onClick={commitAdd}
                  >
                    {t('profileAdd')}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingNew(true)}
                className="w-full flex items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('profileAddNew')}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-4 pt-4 border-t text-xs text-muted-foreground text-center">
            {t('profileMaxReached')}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
