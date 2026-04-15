import { Cin7StockAdjustment } from '../../types/cin7.types';
import { StockAdjustmentInput, StockAdjustmentLineItemInput } from '../../db/repositories/cin7Repo';

export function transformStockAdjustmentLineItems(raw: Cin7StockAdjustment, syncedAt: Date): StockAdjustmentLineItemInput[] {
  return (raw.lineItems ?? []).map((li): StockAdjustmentLineItemInput => ({
    stockAdjustmentId: raw.id,
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

export function transformStockAdjustment(raw: Cin7StockAdjustment, syncedAt: Date): StockAdjustmentInput {
  return {
    cin7Id: raw.id,
    reference: raw.reference ?? null,
    branchId: raw.branchId ?? null,
    status: raw.status ?? null,
    note: raw.note ?? null,
    completedDate: raw.completedDate ? new Date(raw.completedDate) : null,
    srcCreatedAt: raw.createdDate ? new Date(raw.createdDate) : null,
    srcModifiedAt: raw.updatedDate ? new Date(raw.updatedDate) : null,
    rawData: raw,
    syncedAt,
  };
}
