import { Cin7Branch } from '../../types/cin7.types';
import { BranchInput } from '../../db/repositories/cin7Repo';

export function transformBranch(raw: Cin7Branch, syncedAt: Date): BranchInput {
  return {
    cin7Id: raw.id,
    name: raw.name ?? null,
    code: raw.code ?? null,
    isActive: raw.isActive ?? null,
    isDefault: raw.isDefault ?? null,
    address1: raw.address1 ?? null,
    address2: raw.address2 ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    postCode: raw.postCode ?? null,
    country: raw.country ?? null,
    phone: raw.phone ?? null,
    email: raw.email ?? null,
    currencyCode: raw.currencyCode ?? null,
    srcCreatedAt: raw.createdDate ? new Date(raw.createdDate) : null,
    srcModifiedAt: raw.modifiedDate ? new Date(raw.modifiedDate) : null,
    rawData: raw,
    syncedAt,
  };
}
