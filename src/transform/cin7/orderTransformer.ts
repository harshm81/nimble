import { Cin7SalesOrder } from '../../types/cin7.types';
import { OrderInput, OrderLineItemInput } from '../../db/repositories/cin7Repo';

export function transformOrder(raw: Cin7SalesOrder, syncedAt: Date): OrderInput {
  return {
    cin7Id: raw.id,
    orderNumber: raw.reference,
    customerEmail: raw.memberEmail ?? null,
    cin7MemberId: raw.memberId ?? null,
    status: raw.status,
    totalAmount: raw.total,
    taxTotal: raw.tax,
    lineItemTotal: raw.subTotal,
    shippingTotal: raw.shippingCost ?? null,
    paymentTerms: raw.priceTier ?? null,
    branchId: raw.branchId,
    currency: raw.currencyCode,
    orderDate: new Date(raw.createdDate),
    modifiedDate: new Date(raw.updatedDate),
    rawData: raw,
    syncedAt,
  };
}

export function transformOrderLineItems(raw: Cin7SalesOrder, syncedAt: Date): OrderLineItemInput[] {
  return raw.lineItems.map((li): OrderLineItemInput => ({
    orderId: raw.id,
    cin7LineItemId: li.id,
    productId: li.productId,
    code: li.code,
    name: li.name,
    qty: li.qty,
    unitPrice: li.unitPrice,
    discount: li.discount,
    tax: li.tax,
    total: li.total,
    unitCost: li.unitCost,
    lineItemType: li.lineItemType,
    sortOrder: li.sortOrder,
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
