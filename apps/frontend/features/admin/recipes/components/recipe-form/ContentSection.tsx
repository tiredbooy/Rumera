"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, FileText, Plus, Trash2 } from "lucide-react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";

import { ContentPreview } from "@/components/admin/content-preview";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  joinMethod,
  methodPreservesText,
  newStep,
  splitMethod,
  type MethodDocument,
  type MethodStep,
} from "@/features/admin/recipes/method-steps";
import type { RecipeFormValues } from "@/features/recipes/validations";
import { faNum } from "@/lib/products";

type MethodState = {
  preamble: string;
  steps: MethodStep[];
  appendix: string;
  /** The stored body was free text and was reshaped into steps on open. */
  converted: boolean;
  lossless: boolean;
  mode: "steps" | "prose";
};

function documentOf(
  state: Pick<MethodState, "preamble" | "steps" | "appendix">,
): MethodDocument {
  return {
    preamble: state.preamble,
    steps: state.steps,
    appendix: state.appendix,
    canonical: false,
  };
}

function initialise(content: string): MethodState {
  const split = splitMethod(content);
  return {
    preamble: split.preamble,
    steps: split.steps.length ? split.steps : [newStep()],
    appendix: split.appendix,
    converted: !split.canonical && split.steps.length > 0,
    lossless: methodPreservesText(content, joinMethod(split)),
    mode: "steps",
  };
}

/**
 * CE-5. The method is a list of steps, not one blob.
 *
 * Steps serialise into the same `content` field as a canonical `<ol>` — the
 * storefront renderer and the `HowToStep` extractor both already read that, so
 * no schema or storefront change is involved. An existing free-text recipe is
 * split into steps on open (losslessly — see `method-steps.ts`) and says so;
 * «متن آزاد» puts the whole body back in one editor for methods that genuinely
 * are not a list. Opening a recipe never rewrites `content` by itself — that
 * would dirty the form and trip the unsaved-changes guard on every legacy
 * recipe; the ordered list is written on the first real edit.
 */
export function ContentSection({
  control,
  errors,
  disabled,
}: {
  control: Control<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
  disabled?: boolean;
}) {
  return (
    <Controller
      control={control}
      name="content"
      render={({ field }) => (
        <MethodEditor
          value={field.value}
          onChange={field.onChange}
          error={errors.content?.message}
          disabled={disabled}
        />
      )}
    />
  );
}

function MethodEditor({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (content: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [state, setState] = React.useState<MethodState>(() =>
    initialise(value),
  );
  // What this editor last wrote into the form. Anything else arriving on
  // `value` came from outside (draft recovery, a form reset) and must re-split
  // — otherwise a restored draft would render the steps it replaced.
  const emitted = React.useRef(value);

  React.useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setState(initialise(value));
  }, [value]);

  function commit(steps: MethodStep[], converted = state.converted) {
    const html = joinMethod(
      documentOf({
        preamble: state.preamble,
        steps,
        appendix: state.appendix,
      }),
    );
    emitted.current = html;
    setState((current) => ({ ...current, steps, converted }));
    onChange(html);
  }

  function updateStep(id: string, html: string) {
    commit(
      state.steps.map((step) => (step.id === id ? { ...step, html } : step)),
      state.converted,
    );
  }

  function addStep() {
    commit([...state.steps, newStep()], state.converted);
  }

  function removeStep(id: string) {
    const rest = state.steps.filter((step) => step.id !== id);
    commit(rest.length ? rest : [newStep()], state.converted);
  }

  function moveStep(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= state.steps.length) return;
    const steps = [...state.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    commit(steps, state.converted);
  }

  function toProse() {
    emitted.current = value;
    setState((current) => ({ ...current, mode: "prose" }));
  }

  function toSteps() {
    const split = splitMethod(value);
    setState({
      preamble: split.preamble,
      steps: split.steps.length ? split.steps : [newStep()],
      appendix: split.appendix,
      converted: !split.canonical && split.steps.length > 0,
      lossless: methodPreservesText(value, joinMethod(split)),
      mode: "steps",
    });
    const html = joinMethod(split);
    emitted.current = html;
    onChange(html);
  }

  return (
    <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="eyebrow">
            <FileText className="size-3.5" aria-hidden />
            روش تهیه
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            هر گام را جداگانه بنویسید؛ گوگل همین گام‌ها را به‌عنوان مراحل دستور
            نمایه می‌کند.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          disabled={disabled}
          onClick={state.mode === "steps" ? toProse : toSteps}
        >
          {state.mode === "steps"
            ? "ویرایش به‌صورت متن آزاد"
            : "بازگشت به گام‌ها"}
        </Button>
      </header>

      {state.mode === "prose" ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground" role="note">
            در این حالت کل روش تهیه یک متن است. برای نمایه‌شدن مرحله‌به‌مرحله در
            نتایج جستجو، به گام‌ها بازگردید.
          </p>
          <RichTextEditor
            id="content"
            value={value}
            onChange={(html) => {
              emitted.current = html;
              onChange(html);
            }}
            ariaInvalid={!!error}
            ariaDescribedBy={error ? "content-error" : undefined}
            disabled={disabled}
          />
        </>
      ) : (
        <>
          {state.converted ? (
            <p
              role="status"
              className="mb-3 rounded-xl bg-info/10 px-3 py-2 text-xs leading-5 text-info ring-1 ring-info/20"
            >
              متن قبلی این دستور به {faNum(state.steps.length)} گام تقسیم شد.
              {state.lossless
                ? " چیزی حذف نشده است."
                : " پیش‌نمایش را قبل از ذخیره بررسی کنید — ممکن است بخشی از متن قبلی بیرون از گام‌ها مانده یا جابه‌جا شده باشد."}{" "}
              با نخستین ویرایش، همین ساختار ذخیره می‌شود.
            </p>
          ) : null}
          <ol className="flex list-none flex-col gap-4 p-0">
            {state.steps.map((step, index) => (
              <li
                key={step.id}
                className="rounded-xl border border-border/60 bg-muted/20 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    گام {faNum(index + 1)}
                  </p>
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={disabled || index === 0}
                      aria-label={`انتقال گام ${faNum(index + 1)} به بالا`}
                      onClick={() => moveStep(index, -1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={disabled || index === state.steps.length - 1}
                      aria-label={`انتقال گام ${faNum(index + 1)} به پایین`}
                      onClick={() => moveStep(index, 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      disabled={disabled}
                      aria-label={`حذف گام ${faNum(index + 1)}`}
                      onClick={() => removeStep(step.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <RichTextEditor
                  id={index === 0 ? "content" : undefined}
                  value={step.html}
                  onChange={(html) => updateStep(step.id, html)}
                  ariaLabel={`گام ${faNum(index + 1)}`}
                  ariaInvalid={index === 0 && !!error}
                  ariaDescribedBy={
                    index === 0 && error ? "content-error" : undefined
                  }
                  placeholder="این گام را بنویسید…"
                  disabled={disabled}
                />
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={disabled}
            onClick={addStep}
          >
            <Plus className="size-4" aria-hidden /> افزودن گام
          </Button>
        </>
      )}

      {error ? (
        <p
          id="content-error"
          role="alert"
          className="mt-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
      <ContentPreview
        content={value}
        emptyMessage="مراحل تهیهٔ این دستور هنوز ثبت نشده است."
      />
    </section>
  );
}
