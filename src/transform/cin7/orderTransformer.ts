import { Cin7SalesOrder } from '../../types/cin7.types';
import { OrderInput, OrderLineItemInput } from '../../db/repositories/cin7Repo';

export function transformOrder(raw: Cin7SalesOrder, syncedAt: Date): OrderInput {
  return {
    cin7Id: raw.id,
    orderNumber: raw.reference ?? '',
    customerEmail: raw.memberEmail ?? null,
    cin7MemberId: raw.memberId ?? null,
    status: raw.status ?? '',
    totalAmount: raw.total ?? 0,
    taxTotal: raw.tax ?? 0,
    lineItemTotal: raw.subTotal ?? 0,
    shippingTotal: raw.shippingCost ?? null,
    paymentTerms: raw.priceTier ?? null,
    branchId: raw.branchId ?? 0,
    currency: raw.currencyCode ?? '',
    srcCreatedAt: raw.createdDate ? new Date(raw.createdDate) : null,
    srcModifiedAt: raw.updatedDate ? new Date(raw.updatedDate) : null,
    rawData: raw,
    syncedAt,
  };
}

export function transformOrderLineItems(raw: Cin7SalesOrder, syncedAt: Date): OrderLineItemInput[] {
  return raw.lineItems.map((li): OrderLineItemInput => ({
    orderId: raw.id,
    cin7LineItemId: li.id,
    productId: li.productId ?? 0,
    code: li.code ?? '',
    name: li.name ?? '',
    qty: li.qty ?? 0,
    unitPrice: li.unitPrice ?? 0,
    discount: li.discount ?? 0,
    tax: li.tax ?? 0,
    total: li.total ?? 0,
    unitCost: li.unitCost ?? 0,
    lineItemType: li.lineItemType ?? '',
    sortOrder: li.sortOrder ?? 0,
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
