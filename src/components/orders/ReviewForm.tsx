"use client";

import { useState, useTransition } from "react";
import { submitReview } from "@/app/(site)/account/actions";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";

export function ReviewForm({ orderId }: { orderId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="text-sm text-leaf" role="status">Thank you for your review! It will appear on our site after a quick check.</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError("Please choose a rating.");
        start(async () => {
          const res = await submitReview({ order_id: orderId, rating, comment, display_name: name });
          if (res.error) setError(res.error);
          else setDone(true);
        });
      }}
    >
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className={n <= rating ? "text-brand-500" : "text-charcoal/20"}>
            <Icon name="star" className="h-7 w-7 fill-current" />
          </button>
        ))}
      </div>
      <textarea className="input" rows={3} maxLength={1000} placeholder="How was your food?" value={comment} onChange={(e) => setComment(e.target.value)} />
      <input className="input" maxLength={60} placeholder="Name to display (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      {error && <p className="field-error">{error}</p>}
      <button className="btn-primary" disabled={pending}>{pending && <Spinner />} Submit review</button>
    </form>
  );
}
