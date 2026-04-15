import { Cin7StockItem } from '../../types/cin7.types';
import { InventoryInput } from '../../db/repositories/cin7Repo';

export function transformInventory(raw: Cin7StockItem, syncedAt: Date): InventoryInput {
  return {
    cin7Id: raw.id,
    productId: raw.productId ?? null,
    branchId: raw.branchId ?? null,
    code: raw.code ?? null,
    name: raw.name ?? null,
    barcode: raw.barcode ?? null,
    option1: raw.option1 ?? null,
    option2: raw.option2 ?? null,
    option3: raw.option3 ?? null,
    styleCode: raw.styleCode ?? null,
    isActive: raw.isActive ?? null,
    stockOnHand: raw.stockOnHand ?? null,
    available: raw.available ?? null,
    committed: raw.committed ?? null,
    incoming: raw.incoming ?? null,
    weight: raw.weight ?? null,
    cbm: raw.cbm ?? null,
    height: raw.height ?? null,
    width: raw.width ?? null,
    depth: raw.depth ?? null,
    binLocation: raw.binLocation ?? null,
    reorderPoint: raw.reorderPoint ?? null,
    reorderQty: raw.reorderQty ?? null,
    costPrice: raw.costPrice ?? null,
    unitPrice: raw.unitPrice ?? null,
    rawData: raw,
    syncedAt,
  };
}
