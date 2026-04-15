import { transformCreditNote, transformCreditNoteLineItems } from '../creditNoteTransformer';
import { Cin7CreditNote, Cin7LineItem } from '../../../types/cin7.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullLineItem: Cin7LineItem = {
  id: 8001,
  productId: 1001,
  code: 'CT-001-S-BLK',
  name: 'Classic Tee - Small - Black',
  qty: 2,
  unitPrice: 29.99,
  discount: 0.0,
  tax: 5.45,
  total: 65.43,
  comment: 'Customer return',
  lineItemType: 'Product',
  sortOrder: 1,
  option1: 'Small',
  option2: 'Black',
  option3: null,
  styleCode: 'CT-001',
  barcode: '9780000000002',
  unitCost: 12.5,
  taxRule: 'GST on Income',
  accountCode: '200',
  weight: 0.25,
  cbm: 0.001,
  height: 5.0,
  width: 30.0,
  depth: 20.0,
};

const fullCreditNote: Cin7CreditNote = {
  id: 3001,
  reference: 'CN-2026-0015',
  memberId: 500,
  memberEmail: 'jane.doe@example.com',
  memberName: 'Jane Doe',
  status: 'Authorised',
  createdDate: '2026-03-15T11:00:00Z',
  modifiedDate: '2026-04-08T09:30:00Z',
  creditDate: '2026-04-07T00:00:00Z',
  branchId: 3,
  taxInclusive: true,
  subTotal: 59.98,
  tax: 5.45,
  total: 65.43,
  currencyCode: 'AUD',
  exchangeRate: 1.0,
  note: 'Return due to defect',
  internalNote: 'Reviewed by QA',
  account: '200',
  lineItems: [fullLineItem],
};

describe('transformCreditNote', () => {
  it('maps all header fields correctly from a complete fixture', () => {
    const result = transformCreditNote(fullCreditNote, SYNCED_AT);

    expect(result.cin7Id).toBe(3001);
    expect(result.reference).toBe('CN-2026-0015');
    expect(result.memberId).toBe(500);
    expect(result.memberEmail).toBe('jane.doe@example.com');
    expect(result.memberName).toBe('Jane Doe');
    expect(result.status).toBe('Authorised');
    expect(result.branchId).toBe(3);
    expect(result.taxInclusive).toBe(true);
    expect(result.subTotal).toBe(59.98);
    expect(result.tax).toBe(5.45);
    expect(result.total).toBe(65.43);
    expect(result.currencyCode).toBe('AUD');
    expect(result.exchangeRate).toBe(1.0);
    expect(result.note).toBe('Return due to defect');
    expect(result.internalNote).toBe('Reviewed by QA');
    expect(result.account).toBe('200');
    expect(result.syncedAt).toBe(SYNCED_AT);
    expect(result.rawData).toBe(fullCreditNote);
  });

  it('takes srcModifiedAt from modifiedDate — BUG-CIN7-04', () => {
    const result = transformCreditNote(fullCreditNote, SYNCED_AT);

    expect(result.srcModifiedAt).toEqual(new Date('2026-04-08T09:30:00Z'));
    expect(result.srcCreatedAt).toEqual(new Date('2026-03-15T11:00:00Z'));
  });

  it('parses creditDate to a Date object', () => {
    const result = transformCreditNote(fullCreditNote, SYNCED_AT);

    expect(result.creditDate).toEqual(new Date('2026-04-07T00:00:00Z'));
  });

  it('produces null creditDate when source is null', () => {
    const cn: Cin7CreditNote = { ...fullCreditNote, creditDate: null };
    const result = transformCreditNote(cn, SYNCED_AT);

    expect(result.creditDate).toBeNull();
  });

  it('produces null srcModifiedAt when modifiedDate is null', () => {
    const cn: Cin7CreditNote = { ...fullCreditNote, modifiedDate: null };
    const result = transformCreditNote(cn, SYNCED_AT);

    expect(result.srcModifiedAt).toBeNull();
  });

  it('produces null srcCreatedAt when createdDate is null', () => {
    const cn: Cin7CreditNote = { ...fullCreditNote, createdDate: null };
    const result = transformCreditNote(cn, SYNCED_AT);

    expect(result.srcCreatedAt).toBeNull();
  });
});

describe('transformCreditNoteLineItems', () => {
  it('returns empty array when lineItems is null', () => {
    const cn: Cin7CreditNote = { ...fullCreditNote, lineItems: null };
    const result = transformCreditNoteLineItems(cn, SYNCED_AT);

    expect(result).toEqual([]);
  });

  it('returns empty array when lineItems is an empty array', () => {
    const cn: Cin7CreditNote = { ...fullCreditNote, lineItems: [] };
    const result = transformCreditNoteLineItems(cn, SYNCED_AT);

    expect(result).toEqual([]);
  });

  it('maps all line item fields correctly from a fixture with 1 line item', () => {
    const result = transformCreditNoteLineItems(fullCreditNote, SYNCED_AT);

    expect(result).toHaveLength(1);
    const li = result[0];

    expect(li.creditNoteId).toBe(3001);
    expect(li.cin7LineItemId).toBe(8001);
    expect(li.productId).toBe(1001);
    expect(li.code).toBe('CT-001-S-BLK');
    expect(li.name).toBe('Classic Tee - Small - Black');
    expect(li.qty).toBe(2);
    expect(li.unitPrice).toBe(29.99);
    expect(li.discount).toBe(0.0);
    expect(li.tax).toBe(5.45);
    expect(li.total).toBe(65.43);
    expect(li.unitCost).toBe(12.5);
    expect(li.lineItemType).toBe('Product');
    expect(li.sortOrder).toBe(1);
    expect(li.option1).toBe('Small');
    expect(li.option2).toBe('Black');
    expect(li.option3).toBeNull();
    expect(li.styleCode).toBe('CT-001');
    expect(li.barcode).toBe('9780000000002');
    expect(li.taxRule).toBe('GST on Income');
    expect(li.accountCode).toBe('200');
    expect(li.comment).toBe('Customer return');
    expect(li.syncedAt).toBe(SYNCED_AT);
  });
});
