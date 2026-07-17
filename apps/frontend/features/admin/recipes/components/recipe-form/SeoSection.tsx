"use client";

import { Sparkles } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RecipeFormValues } from "@/features/recipes/validations";
import { Field } from "./FormLayout";

export function SeoSection({
  register,
  errors,
}: {
  register: UseFormRegister<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      className="bg-card ring-1 ring-foreground/[0.04]"
    >
      <AccordionItem value="seo">
        <AccordionTrigger>
          <span className="eyebrow">
            <Sparkles className="size-3.5" aria-hidden />
            سئو و متادیتا
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="meta_title"
              label="عنوان سئو"
              error={errors.meta_title?.message}
              full
            >
              <Input id="meta_title" {...register("meta_title")} />
            </Field>
            <Field
              id="meta_description"
              label="توضیحات سئو"
              error={errors.meta_description?.message}
              full
            >
              <Textarea
                id="meta_description"
                rows={2}
                {...register("meta_description")}
              />
            </Field>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
