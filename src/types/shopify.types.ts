export interface ShopifyPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface ShopifyMoney {
  shopMoney: {
    amount: string;
  };
}

/* ---------------- ORDERS ---------------- */

export interface ShopifyLineItemNode {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  originalUnitPriceSet: ShopifyMoney | null;
  discountedUnitPriceSet: ShopifyMoney | null;
  totalDiscountSet: ShopifyMoney | null;
}

export interface ShopifyRefundNode {
  id: string;
  createdAt: string;
  note: string | null;
  totalRefundedSet: ShopifyMoney | null;
}

export interface ShopifyOrderNode {
  id: string;
  name: string;
  email: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  totalPriceSet: ShopifyMoney | null;
  subtotalPriceSet: ShopifyMoney | null;
  totalTaxSet: ShopifyMoney | null;
  currencyCode: string | null;
  processedAt: string | null;
  updatedAt: string | null;
  lineItems: {
    nodes: ShopifyLineItemNode[];
  };
  refunds: ShopifyRefundNode[];
}

/* ---------------- CUSTOMERS ---------------- */

export interface ShopifyCustomerNode {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------------- PRODUCTS ---------------- */

export interface ShopifyProductNode {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  variants: {
    nodes: ShopifyVariantNode[];
  };
}

/* ---------------- INVENTORY ---------------- */

export interface ShopifyInventoryLevelNode {
  id: string;
  available: number;
  updatedAt: string;
}

/* ---------------- CART WEBHOOK ---------------- */

export interface ShopifyCartLineItem {
  variant_id: number | null;
  product_id: number | null;
  quantity: number;
  price: string | null;
}

export interface ShopifyCartWebhookPayload {
  id: string;
  token: string | null;
  email: string | null;
  customer?: {
    id: number;
    email: string | null;
  } | null;
  line_items: ShopifyCartLineItem[];
  total_price: string | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}

/* ---------------- PRODUCT VARIANTS ---------------- */

export interface ShopifyVariantNode {
  id: string;
  title: string | null;
  sku: string | null;
  price: string | null;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  position: number | null;
  createdAt: string;
  updatedAt: string;
}
