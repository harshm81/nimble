import { Cin7SalesOrder } from '../../types/cin7.types';
import { OrderInput, OrderLineItemInput } from '../../db/repositories/cin7Repo';

export function transformOrder(raw: Cin7SalesOrder, syncedAt: Date): OrderInput {
  return {
    cin7Id: raw.id,
    orderNumber: raw.reference ?? null,
    customerEmail: raw.memberEmail ?? null,
    cin7MemberId: raw.memberId ?? null,
    status: raw.status ?? null,
    totalAmount: raw.total ?? null,
    taxTotal: raw.tax ?? null,
    lineItemTotal: raw.subTotal ?? null,
    shippingTotal: raw.shippingCost ?? null,
    paymentTerms: raw.priceTier ?? null,
    branchId: raw.branchId ?? null,
    currency: raw.currencyCode ?? null,
    srcCreatedAt: raw.createdDate ? new Date(raw.createdDate) : null,
    srcModifiedAt: raw.updatedDate ? new Date(raw.updatedDate) : null,
    rawData: raw,
    syncedAt,
  };
}

export function transformOrderLineItems(raw: Cin7SalesOrder, syncedAt: Date): OrderLineItemInput[] {
  return (raw.lineItems ?? []).map((li): OrderLineItemInput => ({
    orderId: raw.id,
    cin7LineItemId: li.id,
    productId: li.productId ?? null,
    code: li.code ?? null,
    name: li.name ?? null,
    qty: li.qty ?? null,
    unitPrice: li.unitPrice ?? null,
    discount: li.discount ?? null,
    tax: li.tax ?? null,
    total: li.total ?? null,
    unitCost: li.unitCost ?? null,
    lineItemType: li.lineItemType ?? null,
    sortOrder: li.sortOrder ?? null,
    option1: li.option1 ?? null,
    option2: li.option2 ?? null,
    option3: li.option3 ?? null,
    styleCode: li.styleCode ?? null,
    barcode: li.barcode ?? null,
    taxRule: li.taxRule ?? null,
    accountCode: li.accountCode ?? null,
    comment: li.comment ?? null,
    syncedAt,
  }));
}
