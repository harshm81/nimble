import { Cin7Product } from '../../types/cin7.types';
import { ProductInput } from '../../db/repositories/cin7Repo';

export function transformProduct(raw: Cin7Product, syncedAt: Date): ProductInput {
  return {
    cin7Id: raw.id,
    name: raw.name ?? '',
    code: raw.code ?? '',
    barcode: raw.barcode ?? null,
    category: raw.category ?? null,
    brand: raw.brand ?? null,
    supplier: raw.supplier ?? null,
    supplierId: raw.supplierId ?? null,
    description: raw.description ?? null,
    shortDescription: raw.shortDescription ?? null,
    isActive: raw.isActive ?? false,
    type: raw.type ?? '',
    option1Name: raw.option1Name ?? null,
    option2Name: raw.option2Name ?? null,
    option3Name: raw.option3Name ?? null,
    unitPrice: raw.unitPrice ?? 0,
    costPrice: raw.costPrice ?? null,
    taxRule: raw.taxRule ?? null,
    accountCode: raw.accountCode ?? null,
    purchaseTaxRule: raw.purchaseTaxRule ?? null,
    purchaseAccountCode: raw.purchaseAccountCode ?? null,
    weight: raw.weight ?? null,
    cbm: raw.cbm ?? null,
    height: raw.height ?? null,
    width: raw.width ?? null,
    depth: raw.depth ?? null,
    srcCreatedAt: raw.createdDate ? new Date(raw.createdDate) : null,
    srcModifiedAt: raw.updatedDate ? new Date(raw.updatedDate) : null,
    rawData: raw,
    syncedAt,
  };
}
