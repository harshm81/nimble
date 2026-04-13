import { ShopifyOrderNode } from '../../types/shopify.types';
import {
  OrderInput,
  OrderLineItemInput,
  RefundInput,
} from '../../db/repositories/shopifyRepo';

export function transformOrder(raw: ShopifyOrderNode, syncedAt: Date): OrderInput {
  return {
    shopifyId: raw.id,
    orderName: raw.name ?? null,
    customerEmail: raw.email ?? null,
    financialStatus: raw.displayFinancialStatus ?? null,
    fulfillmentStatus: raw.displayFulfillmentStatus ?? null,
    totalPrice: raw.totalPriceSet ? parseFloat(raw.totalPriceSet.shopMoney.amount) : null,
    subtotalPrice: raw.subtotalPriceSet ? parseFloat(raw.subtotalPriceSet.shopMoney.amount) : null,
    totalTax: raw.totalTaxSet ? parseFloat(raw.totalTaxSet.shopMoney.amount) : null,
    currency: raw.currencyCode ?? null,
    orderDate: raw.processedAt ? new Date(raw.processedAt) : null,
    srcModifiedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,
    rawData: raw,
    syncedAt,
  };
}

export function transformOrderLineItems(
  raw: ShopifyOrderNode,
  syncedAt: Date,
): OrderLineItemInput[] {
  return raw.lineItems.nodes.map((li): OrderLineItemInput => ({
    shopifyOrderId: raw.id,
    shopifyLineItemId: li.id,
    name: li.name ?? null,
    sku: li.sku ?? null,
    quantity: li.quantity,
    originalUnitPrice: li.originalUnitPriceSet ? parseFloat(li.originalUnitPriceSet.shopMoney.amount) : null,
    discountedUnitPrice: li.discountedUnitPriceSet ? parseFloat(li.discountedUnitPriceSet.shopMoney.amount) : null,
    totalDiscount: li.totalDiscountSet ? parseFloat(li.totalDiscountSet.shopMoney.amount) : null,
    srcModifiedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,
    syncedAt,
  }));
}

export function transformRefunds(
  raw: ShopifyOrderNode,
  syncedAt: Date,
): RefundInput[] {
  return raw.refunds.map((r): RefundInput => ({
    shopifyOrderId: raw.id,
    shopifyRefundId: r.id,
    refundedAt: new Date(r.createdAt),
    note: r.note ?? null,
    totalRefunded: r.totalRefundedSet ? parseFloat(r.totalRefundedSet.shopMoney.amount) : null,
    syncedAt,
  }));
}
