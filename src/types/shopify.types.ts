export interface ShopifyPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface ShopifyMoney {
  shopMoney: {
    amount: string;
  } | null;
}

/* ---------------- ORDERS ---------------- */

export interface ShopifyLineItemNode {
  id: string;
  name: string | null;
  sku: string | null;
  quantity: number | null;
  originalUnitPriceSet: ShopifyMoney | null;
  discountedUnitPriceSet: ShopifyMoney | null;
  totalDiscountSet: ShopifyMoney | null;
}

export interface ShopifyRefundNode {
  id: string;
  createdAt: string | null;
  note: string | null;
  totalRefundedSet: ShopifyMoney | null;
}

export interface ShopifyOrderNode {
  id: string;
  name: string | null;
  email: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  totalPriceSet: ShopifyMoney | null;
  subtotalPriceSet: ShopifyMoney | null;
  totalTaxSet: ShopifyMoney | null;
  currencyCode: string | null;
  createdAt: string | null;
  processedAt: string | null;
  updatedAt: string | null;
  lineItems: {
    nodes: ShopifyLineItemNode[];
    pageInfo: { hasNextPage: boolean };
  };
  refunds: ShopifyRefundNode[] | null;
}

/* ---------------- CUSTOMERS ---------------- */

export interface ShopifyCustomerNode {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/* ---------------- PRODUCTS ---------------- */

export interface ShopifyProductNode {
  id: string;
  title: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  variants: {
    nodes: ShopifyVariantNode[];
  };
}

/* ---------------- INVENTORY ---------------- */

export interface ShopifyInventoryLevelNode {
  id: string;
  available: number | null;
  updatedAt: string | null;
}

/* ---------------- CART WEBHOOK ---------------- */

export interface ShopifyCartLineItem {
  variant_id: number | null;
  product_id: number | null;
  quantity: number | null;
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
  line_items: ShopifyCartLineItem[] | null;
  total_price: string | null;
  currency: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  createdAt: string | null;
  updatedAt: string | null;
}
