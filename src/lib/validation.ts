import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));
export const pincodeSchema = z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode");

export const addressSchema = z.object({
  label: trimmed(40).min(1).default("Home"),
  full_name: trimmed(120).min(2, "Enter the recipient's name"),
  phone: phoneSchema,
  house: trimmed(120).min(1, "Enter house / flat number"),
  street: trimmed(160).min(1, "Enter street"),
  area: trimmed(120).min(1, "Enter area"),
  landmark: trimmed(120).optional().transform((v) => v || null),
  city: trimmed(80).min(2).default("Chennai"),
  state: trimmed(80).min(2).default("Tamil Nadu"),
  pincode: pincodeSchema,
  delivery_instructions: trimmed(300).optional().transform((v) => v || null),
  is_default: z.boolean().default(false),
});

export const selectedOptionsSchema = z.record(z.string().max(40), z.array(z.string().max(40)).max(20));

export const cartLineSchema = z.object({
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
  selected_options: selectedOptionsSchema.default({}),
});

export const cartSchema = z.object({
  items: z.array(cartLineSchema).max(50),
  special_instructions: trimmed(500).optional().nullable(),
  coupon_code: trimmed(30).optional().nullable(),
});

export const checkoutSchema = z
  .object({
    items: z.array(cartLineSchema).min(1).max(50),
    fulfillment: z.enum(["delivery", "takeaway"]),
    address_id: z.string().uuid().optional(),
    pickup_slot_id: z.string().uuid().optional(),
    pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    coupon_code: trimmed(30).optional().nullable(),
    special_instructions: trimmed(500).optional().nullable(),
    idempotency_key: z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery" && !v.address_id)
      ctx.addIssue({ code: "custom", path: ["address_id"], message: "Choose a delivery address" });
    if (v.fulfillment === "takeaway" && (!v.pickup_slot_id || !v.pickup_date))
      ctx.addIssue({ code: "custom", path: ["pickup_slot_id"], message: "Choose a pickup time" });
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export const contactSchema = z.object({
  name: trimmed(120).min(2, "Please enter your name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.union([phoneSchema, z.literal("")]).optional(),
  message: trimmed(2000).min(5, "Message is too short"),
  website: z.string().max(0).optional(), // honeypot
});

export const optionGroupsSchema = z
  .array(
    z.object({
      id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
      name: trimmed(60).min(1),
      required: z.boolean(),
      max: z.number().int().min(1).max(20),
      choices: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
            label: trimmed(60).min(1),
            price_delta: z.number().min(0).max(100000),
          }),
        )
        .min(1)
        .max(30),
    }),
  )
  .max(10);

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid input";
}
