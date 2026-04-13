import { Cin7Contact } from '../../types/cin7.types';
import { ContactInput } from '../../db/repositories/cin7Repo';

export function transformContact(raw: Cin7Contact, syncedAt: Date): ContactInput {
  return {
    cin7Id: raw.id,
    type: raw.type,
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    mobile: raw.mobile ?? null,
    fax: raw.fax ?? null,
    company: raw.company ?? null,
    website: raw.website ?? null,
    address1: raw.address1 ?? null,
    address2: raw.address2 ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    postCode: raw.postCode ?? null,
    country: raw.country ?? null,
    isActive: raw.isActive,
    accountCode: raw.accountCode ?? null,
    priceTier: raw.priceTier ?? null,
    discount: raw.discount ?? null,
    creditLimit: raw.creditLimit ?? null,
    currencyCode: raw.currencyCode ?? null,
    taxNumber: raw.taxNumber ?? null,
    taxRule: raw.taxRule ?? null,
    note: raw.note ?? null,
    group: raw.group ?? null,
    memberSince: new Date(raw.memberSince),
    createdDate: new Date(raw.createdDate),
    updatedDate: new Date(raw.updatedDate),
    rawData: raw,
    syncedAt,
  };
}
