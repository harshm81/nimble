import { transformContact } from '../contactTransformer';
import { Cin7Contact } from '../../../types/cin7.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullContact: Cin7Contact = {
  id:           3301,
  memberSince:  '2023-06-01T00:00:00Z',
  type:         'Customer',
  firstName:    'Alice',
  lastName:     'Johnson',
  email:        'alice.johnson@example.com',
  phone:        '+61 2 8888 0001',
  mobile:       '+61 411 000 001',
  fax:          '+61 2 8888 0002',
  company:      'Johnson Trading Co',
  website:      'https://johnsontradingco.example.com',
  twitter:      '@alicejohnson',
  address1:     '55 Market Street',
  address2:     'Level 3',
  city:         'Melbourne',
  state:        'VIC',
  postCode:     '3000',
  country:      'Australia',
  priceTier:    'Wholesale',
  accountCode:  'CUST-3301',
  isActive:     true,
  discount:     5.0000,
  creditLimit:  10000.00,
  currencyCode: 'AUD',
  taxNumber:    'ABN 12 345 678 901',
  taxRule:      'GST',
  note:         'Preferred supplier contact',
  group:        'VIP',
  createdDate:  '2023-06-01T09:00:00Z',
  modifiedDate: '2026-04-10T11:30:00Z',
};

describe('transformContact', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformContact(fullContact, SYNCED_AT);

    expect(result.cin7Id).toBe(3301);
    expect(result.type).toBe('Customer');
    expect(result.firstName).toBe('Alice');
    expect(result.lastName).toBe('Johnson');
    expect(result.email).toBe('alice.johnson@example.com');
    expect(result.phone).toBe('+61 2 8888 0001');
    expect(result.mobile).toBe('+61 411 000 001');
    expect(result.fax).toBe('+61 2 8888 0002');
    expect(result.company).toBe('Johnson Trading Co');
    expect(result.website).toBe('https://johnsontradingco.example.com');
    expect(result.address1).toBe('55 Market Street');
    expect(result.address2).toBe('Level 3');
    expect(result.city).toBe('Melbourne');
    expect(result.state).toBe('VIC');
    expect(result.postCode).toBe('3000');
    expect(result.country).toBe('Australia');
    expect(result.isActive).toBe(true);
    expect(result.accountCode).toBe('CUST-3301');
    expect(result.priceTier).toBe('Wholesale');
    expect(result.discount).toBe(5.0000);
    expect(result.creditLimit).toBe(10000.00);
    expect(result.currencyCode).toBe('AUD');
    expect(result.taxNumber).toBe('ABN 12 345 678 901');
    expect(result.taxRule).toBe('GST');
    expect(result.note).toBe('Preferred supplier contact');
    expect(result.group).toBe('VIP');
    expect(result.memberSince).toEqual(new Date('2023-06-01T00:00:00Z'));
    expect(result.srcCreatedAt).toEqual(new Date('2023-06-01T09:00:00Z'));
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-10T11:30:00Z'));
    expect(result.rawData).toBe(fullContact);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('srcModifiedAt comes from raw.modifiedDate (BUG-CIN7-04 fix)', () => {
    const result = transformContact(fullContact, SYNCED_AT);
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-10T11:30:00Z'));
  });

  it('memberSince parses from string to Date', () => {
    const result = transformContact(fullContact, SYNCED_AT);
    expect(result.memberSince).toBeInstanceOf(Date);
    expect(result.memberSince).toEqual(new Date('2023-06-01T00:00:00Z'));
  });

  it('null memberSince produces null', () => {
    const contact: Cin7Contact = { ...fullContact, memberSince: null };
    const result = transformContact(contact, SYNCED_AT);
    expect(result.memberSince).toBeNull();
  });

  it('null modifiedDate produces null srcModifiedAt', () => {
    const contact: Cin7Contact = { ...fullContact, modifiedDate: null };
    const result = transformContact(contact, SYNCED_AT);
    expect(result.srcModifiedAt).toBeNull();
  });

  it('null createdDate produces null srcCreatedAt', () => {
    const contact: Cin7Contact = { ...fullContact, createdDate: null };
    const result = transformContact(contact, SYNCED_AT);
    expect(result.srcCreatedAt).toBeNull();
  });

  it('null isActive produces null, not a coerced boolean', () => {
    const contact: Cin7Contact = { ...fullContact, isActive: null };
    const result = transformContact(contact, SYNCED_AT);
    expect(result.isActive).toBeNull();
  });

  it('false isActive is preserved as false, not coerced to null', () => {
    const contact: Cin7Contact = { ...fullContact, isActive: false };
    const result = transformContact(contact, SYNCED_AT);
    expect(result.isActive).toBe(false);
  });

  it('null optional string fields produce nulls in output', () => {
    const contact: Cin7Contact = {
      ...fullContact,
      type:         null,
      firstName:    null,
      lastName:     null,
      email:        null,
      phone:        null,
      mobile:       null,
      fax:          null,
      company:      null,
      website:      null,
      address1:     null,
      address2:     null,
      city:         null,
      state:        null,
      postCode:     null,
      country:      null,
      accountCode:  null,
      priceTier:    null,
      currencyCode: null,
      taxNumber:    null,
      taxRule:      null,
      note:         null,
      group:        null,
    };
    const result = transformContact(contact, SYNCED_AT);
    expect(result.type).toBeNull();
    expect(result.firstName).toBeNull();
    expect(result.lastName).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.mobile).toBeNull();
    expect(result.fax).toBeNull();
    expect(result.company).toBeNull();
    expect(result.website).toBeNull();
    expect(result.address1).toBeNull();
    expect(result.address2).toBeNull();
    expect(result.city).toBeNull();
    expect(result.state).toBeNull();
    expect(result.postCode).toBeNull();
    expect(result.country).toBeNull();
    expect(result.accountCode).toBeNull();
    expect(result.priceTier).toBeNull();
    expect(result.currencyCode).toBeNull();
    expect(result.taxNumber).toBeNull();
    expect(result.taxRule).toBeNull();
    expect(result.note).toBeNull();
    expect(result.group).toBeNull();
  });

  it('null optional numeric fields produce nulls in output', () => {
    const contact: Cin7Contact = { ...fullContact, discount: null, creditLimit: null };
    const result = transformContact(contact, SYNCED_AT);
    expect(result.discount).toBeNull();
    expect(result.creditLimit).toBeNull();
  });

  it('srcCreatedAt and srcModifiedAt are Date instances when present', () => {
    const result = transformContact(fullContact, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
  });
});
