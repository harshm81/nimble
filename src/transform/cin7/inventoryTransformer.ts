import { Cin7StockItem } from '../../types/cin7.types';
import { InventoryInput } from '../../db/repositories/cin7Repo';

export function transformInventory(raw: Cin7StockItem, syncedAt: Date): InventoryInput {
  return {
    cin7Id: raw.id,
    productId: raw.productId ?? 0,
    branchId: raw.branchId ?? 0,
    code: raw.code ?? '',
    name: raw.name ?? '',
    barcode: raw.barcode ?? null,
    option1: raw.option1 ?? null,
    option2: raw.option2 ?? null,
    option3: raw.option3 ?? null,
    styleCode: raw.styleCode ?? null,
    isActive: raw.isActive ?? false,
    stockOnHand: raw.stockOnHand ?? 0,
    available: raw.available ?? 0,
    committed: raw.committed ?? 0,
    incoming: raw.incoming ?? 0,
    binLocation: raw.binLocation ?? null,
    reorderPoint: raw.reorderPoint ?? null,
    reorderQty: raw.reorderQty ?? null,
    costPrice: raw.costPrice ?? null,
    unitPrice: raw.unitPrice ?? null,
    rawData: raw,
    syncedAt,
  };
}
