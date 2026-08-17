"use client";

import type { Ref } from "react";

import { fieldErrorId } from "@/components/ui/field";
import { ImageInput } from "@/features/image-uploader/ImageInput";

interface CategoryImageInputProps {
  id: string;
  value: string;
  onChange: (url: string) => void;
  onBlur?: () => void;
  onUploadingChange?: (uploading: boolean) => void;
  error?: string;
  name?: string;
  urlInputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
}

export function CategoryImageInput({
  id,
  value,
  onChange,
  onBlur,
  onUploadingChange,
  error,
  name,
  urlInputRef,
  disabled,
}: CategoryImageInputProps) {
  return (
    <ImageInput
      id={id}
      name={name}
      urlInputRef={urlInputRef}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onUploadingChange={onUploadingChange}
      legacyFolder="categories"
      ariaInvalid={Boolean(error)}
      ariaDescribedBy={error ? fieldErrorId(id) : undefined}
      placeholder="نشانی تصویر یا بارگذاری فایل"
      previewClassName="max-w-md"
      disabled={disabled}
    />
  );
}
