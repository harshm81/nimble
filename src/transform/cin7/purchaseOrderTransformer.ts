import { Cin7PurchaseOrder } from '../../types/cin7.types';
import { PurchaseOrderInput, PurchaseOrderLineItemInput } from '../../db/repositories/cin7Repo';

export function transformPurchaseOrderLineItems(raw: Cin7PurchaseOrder, syncedAt: Date): PurchaseOrderLineItemInput[] {
  return (raw.lineItems ?? []).map((li): PurchaseOrderLineItemInput => ({
    purchaseOrderId: raw.id,
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

export function transformPurchaseOrder(raw: Cin7PurchaseOrder, syncedAt: Date): PurchaseOrderInput {
  return {
    cin7Id: raw.id,
    reference: raw.reference ?? null,
    supplierId: raw.supplierId ?? null,
    supplierName: raw.supplierName ?? null,
    supplierEmail: raw.supplierEmail ?? null,
    status: raw.status ?? null,
    branchId: raw.branchId ?? null,
    taxInclusive: raw.taxInclusive ?? null,
    subTotal: raw.subTotal ?? null,
    tax: raw.tax ?? null,
    total: raw.total ?? null,
    currencyCode: raw.currencyCode ?? null,
    exchangeRate: raw.exchangeRate ?? null,
    note: raw.note ?? null,
    internalNote: raw.internalNote ?? null,
    shippingCompany: raw.shippingCompany ?? null,
    shippingMethod: raw.shippingMethod ?? null,
    shippingCost: raw.shippingCost ?? null,
    shippingTax: raw.shippingTax ?? null,
    account: raw.account ?? null,
    requiredDate: raw.requiredDate ? new Date(raw.requiredDate) : null,
    completedDate: raw.completedDate ? new Date(raw.completedDate) : null,
    srcCreatedAt: raw.createdDate ? new Date(raw.createdDate) : null,
    srcModifiedAt: raw.modifiedDate ? new Date(raw.modifiedDate) : null,
    rawData: raw,
    syncedAt,
  };
}
