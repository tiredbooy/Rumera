import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";

import type { CreateProductAlertInput, ProductAlert } from "./types";

export function listProductAlerts(): Promise<ProductAlert[]> {
  return storeRequest<ApiSuccess<ProductAlert[]>>("alerts").then(
    (body) => body.data,
  );
}

export function createProductAlert(
  input: CreateProductAlertInput,
): Promise<ProductAlert> {
  return storeRequest<ApiSuccess<ProductAlert>>("alerts", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}

export function deleteProductAlert(id: number): Promise<void> {
  return storeRequest<void>(`alerts/${id}`, {
    method: "DELETE",
  });
}
