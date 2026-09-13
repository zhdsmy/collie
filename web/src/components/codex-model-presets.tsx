import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Pencil,
  Plus,
  SlidersHorizontal,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BottomSheet } from "@/components/ui/sheet";
import { useLocale } from "@/hooks/use-locale";
import {
  CODEX_REASONING_EFFORTS,
  useCodexModelPresets,
  type CodexModelPreset,
  type CodexReasoningEffort,
} from "@/lib/codex-model-presets";
import { t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const EFFORT_LABELS = {
  none: "modelPresets.effort.none",
  minimal: "modelPresets.effort.minimal",
  low: "modelPresets.effort.low",
  medium: "modelPresets.effort.medium",
  high: "modelPresets.effort.high",
  xhigh: "modelPresets.effort.xhigh",
  max: "modelPresets.effort.max",
  ultra: "modelPresets.effort.ultra",
} satisfies Record<CodexReasoningEffort, MessageKey>;

export interface CodexModelPresetsSheetProps {
  open: boolean;
  onClose: () => void;
  current?: { model: string; effort?: CodexReasoningEffort | null };
  onSelect?: (preset: CodexModelPreset) => void;
  onNative?: () => void;
  disabledReason?: string;
  busy?: boolean;
  error?: string;
}

function copyPresets(presets: readonly CodexModelPreset[]): CodexModelPreset[] {
  return presets.map((preset) => ({ ...preset }));
}

function newPresetId(presets: readonly CodexModelPreset[]): string {
  const used = new Set(presets.map((preset) => preset.id));
  let id = "";
  do {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  } while (used.has(id));
  return id;
}

function modelIsValid(model: string): boolean {
  return model.length > 0 && !/[\p{C}\s]/u.test(model);
}

function effortIsValid(effort: string): effort is CodexReasoningEffort {
  return CODEX_REASONING_EFFORTS.some((candidate) => candidate === effort);
}

function invalidPresetIndexes(presets: readonly CodexModelPreset[]): Set<number> {
  const invalid = new Set<number>();
  const pairs = new Map<string, number>();
  presets.forEach((preset, index) => {
    if (!modelIsValid(preset.model) || !effortIsValid(preset.effort)) invalid.add(index);
    const pair = `${preset.model}\u0000${preset.effort}`;
    const previous = pairs.get(pair);
    if (previous !== undefined) invalid.add(index);
    else pairs.set(pair, index);
  });
  return invalid;
}

function effortLabel(effort: CodexReasoningEffort): string {
  return t(EFFORT_LABELS[effort]);
}

function PresetList({
  presets,
  current,
  disabled,
  onSelect,
}: {
  presets: readonly CodexModelPreset[];
  current: CodexModelPresetsSheetProps["current"];
  disabled: boolean;
  onSelect: (preset: CodexModelPreset) => void;
}) {
  const currentEffort = current?.effort;
  if (presets.length === 0) {
    return <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">{t("modelPresets.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={t("modelPresets.listAria")}>
      {presets.map((preset) => {
        const selected =
          current?.model === preset.model &&
          currentEffort !== undefined &&
          currentEffort !== null &&
          currentEffort === preset.effort;
        return (
          <Button
            key={preset.id}
            type="button"
            variant={selected ? "secondary" : "outline"}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onSelect(preset)}
            className="h-auto min-h-14 w-full justify-between gap-3 whitespace-normal px-3 py-2 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block break-words font-mono text-sm text-foreground">{preset.model}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{effortLabel(preset.effort)}</span>
            </span>
            {selected ? <Check className="size-4 shrink-0 text-primary" aria-label={t("modelPresets.current")} /> : null}
          </Button>
        );
      })}
    </div>
  );
}

function Editor({
  presets,
  onChange,
  onAdd,
  onDelete,
  onMove,
  onCancel,
  onSave,
  error,
}: {
  presets: CodexModelPreset[];
  onChange: (index: number, patch: Partial<CodexModelPreset>) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onCancel: () => void;
  onSave: () => void;
  error?: string;
}) {
  const invalid = invalidPresetIndexes(presets);
  return (
    <div className="flex flex-col gap-3" data-slot="model-presets-editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">{t("modelPresets.editing")}</p>
        <Button type="button" variant="outline" size="sm" className="h-auto min-h-11 max-w-full whitespace-normal text-left" onClick={onAdd}>
          <Plus className="size-4" />
          {t("modelPresets.add")}
        </Button>
      </div>

      {presets.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {t("modelPresets.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {presets.map((preset, index) => (
            <div key={preset.id} className="rounded-md border border-border bg-muted/20 p-3">
              <label className="block min-w-0 text-xs font-medium text-muted-foreground">
                {t("modelPresets.model")}
                <input
                  type="text"
                  value={preset.model}
                  onChange={(event) => onChange(index, { model: event.target.value })}
                  placeholder={t("modelPresets.modelPlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={invalid.has(index)}
                  className={cn(
                    "mt-1 min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 font-mono text-base font-normal text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                    invalid.has(index) ? "border-destructive" : "border-border/60",
                  )}
                />
              </label>
              <div className="mt-2 flex items-end gap-2">
                <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                  {t("modelPresets.effort")}
                  <select
                    value={preset.effort}
                    onChange={(event) => {
                      if (effortIsValid(event.target.value)) onChange(index, { effort: event.target.value });
                    }}
                    className="mt-1 min-h-11 w-full appearance-none rounded-md border border-border/60 bg-background px-3 py-2 text-base font-normal text-foreground"
                  >
                    {CODEX_REASONING_EFFORTS.map((effort) => (
                      <option key={effort} value={effort}>
                        {effortLabel(effort)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                    aria-label={t("modelPresets.moveUp")}
                    title={t("modelPresets.moveUp")}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    disabled={index === presets.length - 1}
                    onClick={() => onMove(index, 1)}
                    aria-label={t("modelPresets.moveDown")}
                    title={t("modelPresets.moveDown")}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 text-destructive hover:text-destructive"
                    onClick={() => onDelete(index)}
                    aria-label={t("modelPresets.deleteAria", { model: preset.model || t("modelPresets.unnamed") })}
                    title={t("modelPresets.delete")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="flex gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal" onClick={onCancel}>
          <X className="size-4" />
          {t("modelPresets.cancel")}
        </Button>
        <Button type="button" className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal" onClick={onSave}>
          <Check className="size-4" />
          {t("modelPresets.save")}
        </Button>
      </div>
    </div>
  );
}

export function CodexModelPresetsSheet({
  open,
  onClose,
  current,
  onSelect,
  onNative,
  disabledReason,
  busy = false,
  error,
}: CodexModelPresetsSheetProps) {
  useLocale();
  const { presets, save, error: storeError } = useCodexModelPresets();
  const [editing, setEditing] = useState(onSelect === undefined);
  const [draft, setDraft] = useState<CodexModelPreset[]>(() => copyPresets(presets));
  const [formError, setFormError] = useState<string>();
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(copyPresets(presets));
      setEditing(onSelect === undefined);
      setFormError(undefined);
    }
    wasOpen.current = open;
  }, [open, onSelect, presets]);

  function enterEdit() {
    setDraft(copyPresets(presets));
    setEditing(true);
    setFormError(undefined);
  }

  function cancelEdit() {
    setDraft(copyPresets(presets));
    setFormError(undefined);
    if (onSelect !== undefined) setEditing(false);
  }

  function updatePreset(index: number, patch: Partial<CodexModelPreset>) {
    setDraft((currentDraft) =>
      currentDraft.map((preset, currentIndex) =>
        currentIndex === index ? { ...preset, ...patch } : preset,
      ),
    );
    setFormError(undefined);
  }

  function addPreset() {
    setDraft((currentDraft) => [
      ...currentDraft,
      { id: newPresetId(currentDraft), model: "", effort: "medium" },
    ]);
    setFormError(undefined);
  }

  function deletePreset(index: number) {
    setDraft((currentDraft) => currentDraft.filter((_, currentIndex) => currentIndex !== index));
    setFormError(undefined);
  }

  function movePreset(index: number, delta: -1 | 1) {
    setDraft((currentDraft) => {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= currentDraft.length) return currentDraft;
      const next = [...currentDraft];
      const [item] = next.splice(index, 1);
      if (item !== undefined) next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function saveDraft() {
    const invalid = invalidPresetIndexes(draft);
    if (invalid.size > 0) {
      setFormError(t("modelPresets.invalid"));
      return;
    }
    if (!save(draft)) {
      setFormError(storeError === "invalid" ? t("modelPresets.invalid") : t("modelPresets.storageError"));
      return;
    }
    setFormError(undefined);
    if (onSelect !== undefined) setEditing(false);
  }

  const selectionDisabled = busy || disabledReason !== undefined;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={<span className="text-base font-bold text-muted-foreground">{t("modelPresets.title")}</span>}
    >
      <div className="flex flex-col gap-3" data-slot="codex-model-presets">
        {busy || disabledReason ? (
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm" role="status">
            <span className="font-medium">{busy ? t("modelPresets.busy") : t("modelPresets.blocked")}</span>
            {disabledReason ? <span className="text-muted-foreground">: {disabledReason}</span> : null}
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

        {editing ? (
          <Editor
            presets={draft}
            onChange={updatePreset}
            onAdd={addPreset}
            onDelete={deletePreset}
            onMove={movePreset}
            onCancel={cancelEdit}
            onSave={saveDraft}
            error={formError}
          />
        ) : (
          <>
            <PresetList
              presets={presets}
              current={current}
              disabled={selectionDisabled}
              onSelect={(preset) => onSelect?.(preset)}
            />
            <div className="flex flex-wrap gap-2">
              {onNative ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal"
                  disabled={selectionDisabled}
                  onClick={onNative}
                >
                  <TerminalSquare className="size-4" />
                  {t("modelPresets.native")}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal" onClick={enterEdit}>
                <Pencil className="size-4" />
                {t("modelPresets.manage")}
              </Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

export function CodexModelPresetsSettings() {
  useLocale();
  const [open, setOpen] = useState(false);

  return (
    <Card className="gap-0 py-0">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label={t("modelPresets.openAria")}
        className="h-auto w-full justify-start gap-3 whitespace-normal p-4 text-left font-normal active:bg-muted/60"
      >
        <SlidersHorizontal className="size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{t("modelPresets.title")}</span>
          <span className="block text-sm text-muted-foreground">{t("modelPresets.description")}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      </Button>
      <CodexModelPresetsSheet open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
