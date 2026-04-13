import { Cin7CreditNote } from '../../types/cin7.types';
import { CreditNoteInput, CreditNoteLineItemInput } from '../../db/repositories/cin7Repo';

export function transformCreditNoteLineItems(raw: Cin7CreditNote, syncedAt: Date): CreditNoteLineItemInput[] {
  return raw.lineItems.map((li): CreditNoteLineItemInput => ({
    creditNoteId: raw.id,
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

export function transformCreditNote(raw: Cin7CreditNote, syncedAt: Date): CreditNoteInput {
  return {
    cin7Id: raw.id,
    reference: raw.reference,
    memberId: raw.memberId ?? null,
    memberEmail: raw.memberEmail ?? null,
    memberName: raw.memberName ?? null,
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
    account: raw.account ?? null,
    creditDate: raw.creditDate ? new Date(raw.creditDate) : null,
    createdDate: new Date(raw.createdDate),
    updatedDate: new Date(raw.updatedDate),
    rawData: raw,
    syncedAt,
  };
}
