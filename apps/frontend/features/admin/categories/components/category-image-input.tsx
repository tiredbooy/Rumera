"use client";

import { FlexibleImageInput } from "@/features/admin/uploads/components/flexible-image-input";
import { fieldErrorId } from "@/components/ui/field";

interface CategoryImageInputProps {
  id: string;
  value: string;
  onChange: (url: string) => void;
  onBlur?: () => void;
  onUploadingChange?: (uploading: boolean) => void;
  error?: string;
}

export function CategoryImageInput({
  id,
  value,
  onChange,
  onBlur,
  onUploadingChange,
  error,
}: CategoryImageInputProps) {
  return (
    <FlexibleImageInput
      id={id}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onUploadingChange={onUploadingChange}
      folder="categories"
      ariaInvalid={Boolean(error)}
      ariaDescribedBy={error ? fieldErrorId(id) : undefined}
      placeholder="نشانی تصویر یا بارگذاری فایل"
      previewClassName="max-w-md"
    />
  );
}
