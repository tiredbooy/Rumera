import { Loader2, MapPin, Plus, RefreshCw } from "lucide-react";

import { QueryStateRegion } from "@/components/query-state-region";
import { Button } from "@/components/ui/button";
import type { Address } from "@/features/addresses/types";
import { AddAddressForm } from "./add-address-form";
import {
  CheckoutChoiceGroup,
  CheckoutSection,
  CheckoutSelectRow,
} from "./checkout-step-presentation";

export function CheckoutAddressStep({
  addresses,
  isLoading,
  isError,
  isRetrying,
  addressId,
  adding,
  defaultNewAddress,
  onRetry,
  onSelectAddress,
  onStartAdding,
  onAddressCreated,
  onCancelAdding,
}: {
  addresses?: Address[];
  isLoading: boolean;
  isError: boolean;
  isRetrying: boolean;
  addressId?: number;
  adding: boolean;
  defaultNewAddress: boolean;
  onRetry: () => void;
  onSelectAddress: (addressId: number) => void;
  onStartAdding: () => void;
  onAddressCreated: (address: Address) => void;
  onCancelAdding: () => void;
}) {
  const unavailable = isError && addresses === undefined;

  return (
    <CheckoutSection icon={MapPin} title="آدرس تحویل">
      {isLoading ? (
        <QueryStateRegion
          state="loading"
          aria-label="در حال دریافت آدرس‌ها"
          className="flex flex-col gap-2"
        >
          {[0, 1].map((i) => (
            <span
              key={i}
              className="h-16 animate-pulse rounded-xl bg-muted/50"
              aria-hidden="true"
            />
          ))}
          <span className="sr-only">در حال دریافت آدرس‌ها…</span>
        </QueryStateRegion>
      ) : unavailable ? (
        <QueryStateRegion
          state="error"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p>دریافت آدرس‌ها انجام نشد.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={isRetrying}
            onClick={onRetry}
          >
            {isRetrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            تلاش دوباره
          </Button>
        </QueryStateRegion>
      ) : (
        <>
          {isError ? (
            <QueryStateRegion
              state="error"
              className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              <span>تازه‌سازی آدرس‌ها انجام نشد؛ اطلاعات قبلی نمایش داده می‌شود.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRetrying}
                onClick={onRetry}
              >
                {isRetrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                تلاش دوباره
              </Button>
            </QueryStateRegion>
          ) : null}

          {addresses?.length ? (
            <CheckoutChoiceGroup label="انتخاب آدرس تحویل">
              {addresses.map((a) => (
                <CheckoutSelectRow
                  key={a.id}
                  name="checkout-address"
                  value={String(a.id)}
                  selected={addressId === a.id}
                  onClick={() => onSelectAddress(a.id)}
                >
                  <span className="block font-medium">{a.full_name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {a.address_line1}، {a.city}
                  </span>
                </CheckoutSelectRow>
              ))}
            </CheckoutChoiceGroup>
          ) : (
            <p className="text-sm text-muted-foreground">
              هنوز آدرسی ثبت نشده است. برای ادامه یک آدرس اضافه کنید.
            </p>
          )}

          {adding ? (
            <div className="mt-3">
              <AddAddressForm
                onCreated={onAddressCreated}
                onCancel={onCancelAdding}
                isDefault={defaultNewAddress}
              />
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onStartAdding}
            >
              <Plus className="size-4" /> آدرس جدید
            </Button>
          )}
        </>
      )}
    </CheckoutSection>
  );
}
