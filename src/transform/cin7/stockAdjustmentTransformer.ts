import { Cin7StockAdjustment } from '../../types/cin7.types';
import { StockAdjustmentInput, StockAdjustmentLineItemInput } from '../../db/repositories/cin7Repo';

export function transformStockAdjustmentLineItems(raw: Cin7StockAdjustment, syncedAt: Date): StockAdjustmentLineItemInput[] {
  return raw.lineItems.map((li): StockAdjustmentLineItemInput => ({
    stockAdjustmentId: raw.id,
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

export function transformStockAdjustment(raw: Cin7StockAdjustment, syncedAt: Date): StockAdjustmentInput {
  return {
    cin7Id: raw.id,
    reference: raw.reference ?? '',
    branchId: raw.branchId ?? 0,
    status: raw.status ?? '',
    note: raw.note ?? null,
    completedDate: raw.completedDate ? new Date(raw.completedDate) : null,
    srcCreatedAt: raw.createdDate ? new Date(raw.createdDate) : null,
    srcModifiedAt: raw.updatedDate ? new Date(raw.updatedDate) : null,
    rawData: raw,
    syncedAt,
  };
}
