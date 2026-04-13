import { Cin7PurchaseOrder } from '../../types/cin7.types';
import { PurchaseOrderInput, PurchaseOrderLineItemInput } from '../../db/repositories/cin7Repo';

export function transformPurchaseOrderLineItems(raw: Cin7PurchaseOrder, syncedAt: Date): PurchaseOrderLineItemInput[] {
  return raw.lineItems.map((li): PurchaseOrderLineItemInput => ({
    purchaseOrderId: raw.id,
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

export function transformPurchaseOrder(raw: Cin7PurchaseOrder, syncedAt: Date): PurchaseOrderInput {
  return {
    cin7Id: raw.id,
    reference: raw.reference,
    supplierId: raw.supplierId ?? null,
    supplierName: raw.supplierName ?? null,
    supplierEmail: raw.supplierEmail ?? null,
    status: raw.status,
    branchId: raw.branchId,
    taxInclusive: raw.taxInclusive,
    subTotal: raw.subTotal,
    tax: raw.tax,
    total: raw.total,
    currencyCode: raw.currencyCode,
    exchangeRate: raw.exchangeRate,
    note: raw.note ?? null,
    internalNote: raw.internalNote ?? null,
    shippingCompany: raw.shippingCompany ?? null,
    shippingMethod: raw.shippingMethod ?? null,
    shippingCost: raw.shippingCost ?? null,
    shippingTax: raw.shippingTax ?? null,
    account: raw.account ?? null,
    requiredDate: raw.requiredDate ? new Date(raw.requiredDate) : null,
    completedDate: raw.completedDate ? new Date(raw.completedDate) : null,
    createdDate: new Date(raw.createdDate),
    updatedDate: new Date(raw.updatedDate),
    rawData: raw,
    syncedAt,
  };
}
