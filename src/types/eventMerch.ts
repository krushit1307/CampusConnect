export interface EventMerchItem {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventMerchVariant {
  id: string;
  item_id: string;
  size: string;
  stock_quantity: number;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface EventMerchItemWithVariants extends EventMerchItem {
  variants: EventMerchVariant[];
}

export interface EventMerchOrder {
  id: string;
  event_id: string;
  user_id: string;
  stripe_checkout_session_id: string | null;
  total_amount: number;
  payment_status: "pending" | "captured" | "failed";
  fulfillment_status: "pending" | "fulfilled" | "cancelled";
  pickup_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventMerchOrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface EventMerchOrderWithItems extends EventMerchOrder {
  items: (EventMerchOrderItem & {
    variant?: EventMerchVariant & { item?: EventMerchItem };
  })[];
  buyer?: { full_name: string | null; email: string | null };
}
