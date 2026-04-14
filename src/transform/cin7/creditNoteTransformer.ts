import { Cin7CreditNote } from '../../types/cin7.types';
import { CreditNoteInput, CreditNoteLineItemInput } from '../../db/repositories/cin7Repo';

export function transformCreditNoteLineItems(raw: Cin7CreditNote, syncedAt: Date): CreditNoteLineItemInput[] {
  return raw.lineItems.map((li): CreditNoteLineItemInput => ({
    creditNoteId: raw.id,
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

export function transformCreditNote(raw: Cin7CreditNote, syncedAt: Date): CreditNoteInput {
  return {
    cin7Id: raw.id,
    reference: raw.reference ?? '',
    memberId: raw.memberId ?? null,
    memberEmail: raw.memberEmail ?? null,
    memberName: raw.memberName ?? null,
    status: raw.status ?? '',
    branchId: raw.branchId ?? 0,
    taxInclusive: raw.taxInclusive ?? false,
    subTotal: raw.subTotal ?? 0,
    tax: raw.tax ?? 0,
    total: raw.total ?? 0,
    currencyCode: raw.currencyCode ?? '',
    exchangeRate: raw.exchangeRate ?? 0,
    note: raw.note ?? null,
    internalNote: raw.internalNote ?? null,
    account: raw.account ?? null,
    creditDate: raw.creditDate ? new Date(raw.creditDate) : null,
    srcCreatedAt: raw.createdDate ? new Date(raw.createdDate) : null,
    srcModifiedAt: raw.updatedDate ? new Date(raw.updatedDate) : null,
    rawData: raw,
    syncedAt,
  };
}
