"use client";

import * as React from "react";
import { Loader2, PenLine, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRecordInteraction } from "@/features/recommendations/hooks";
import { ReviewMutationError, useCreateReview } from "@/features/reviews/hooks";
import type {
  CreateReviewInput,
  Review,
  ReviewRating,
} from "@/features/reviews/types";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

const REVIEW_RATINGS: ReviewRating[] = [1, 2, 3, 4, 5];

export function WriteReviewDialog({
  productId,
  onCreated,
}: {
  productId: number;
  onCreated: (review: Review) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState<ReviewRating>(5);
  const [hover, setHover] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const createReview = useCreateReview(productId);
  const recordInteraction = useRecordInteraction();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      const input: CreateReviewInput = {
        product_id: productId,
        rating,
        title: title.trim(),
        content: content.trim(),
      };
      const review = await createReview.mutateAsync(input);
      onCreated(review);
      recordInteraction.mutate({
        product_id: productId,
        interaction_type: "review",
        source: "pdp",
      });
      toast.success("نظر شما ثبت شد", {
        description: "پس از تأیید نمایش داده می‌شود.",
      });
      setOpen(false);
      setTitle("");
      setContent("");
      setRating(5);
    } catch (error) {
      if (error instanceof ReviewMutationError && error.status === 409) {
        toast.error("قبلاً برای این محصول نظر ثبت کرده‌اید");
        return;
      }
      if (error instanceof ReviewMutationError && error.status === 403) {
        toast.error("اجازهٔ ثبت نظر برای این حساب وجود ندارد");
        return;
      }
      toast.error("ثبت نظر ناموفق بود. دوباره تلاش کنید.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <PenLine /> ثبت نظر
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">نظر شما</DialogTitle>
          <p className="text-sm text-muted-foreground">
            اگر این محصول را خریده باشید، نظر شما با نشان «خرید تأییدشده» نمایش
            داده می‌شود.
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label className="mb-2 block">امتیاز شما</Label>
            <div
              className="flex items-center gap-1"
              onMouseLeave={() => setHover(0)}
            >
              {REVIEW_RATINGS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHover(value)}
                  aria-label={`${faNum(value)} ستاره`}
                  aria-pressed={rating === value}
                  className="cursor-pointer p-0.5"
                >
                  <Star
                    aria-hidden
                    className={cn(
                      "size-7 transition-colors",
                      value <= (hover || rating)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="review-title" className="mb-2 block">
              عنوان
            </Label>
            <Input
              id="review-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={255}
              placeholder="جمع‌بندی تجربه‌تان"
            />
          </div>
          <div>
            <Label htmlFor="review-content" className="mb-2 block">
              متن نظر
            </Label>
            <Textarea
              id="review-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              rows={4}
              placeholder="از کیفیت، طعم و تجربهٔ خریدتان بنویسید…"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                createReview.isPending || !title.trim() || !content.trim()
              }
            >
              {createReview.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {createReview.isPending ? "در حال ثبت…" : "ثبت نظر"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
