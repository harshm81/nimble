import { transformBranch } from '../branchTransformer';
import { Cin7Branch } from '../../../types/cin7.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullBranch: Cin7Branch = {
  id:           5,
  name:         'Sydney Warehouse',
  code:         'SYD-WH',
  isActive:     true,
  isDefault:    true,
  address1:     '100 Industrial Drive',
  address2:     'Building A',
  city:         'Sydney',
  state:        'NSW',
  postCode:     '2150',
  country:      'Australia',
  phone:        '+61 2 7777 0001',
  email:        'sydney.warehouse@example.com',
  currencyCode: 'AUD',
  createdDate:  '2021-01-15T08:00:00Z',
  modifiedDate: '2026-04-09T16:20:00Z',
};

describe('transformBranch', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformBranch(fullBranch, SYNCED_AT);

    expect(result.cin7Id).toBe(5);
    expect(result.name).toBe('Sydney Warehouse');
    expect(result.code).toBe('SYD-WH');
    expect(result.isActive).toBe(true);
    expect(result.isDefault).toBe(true);
    expect(result.address1).toBe('100 Industrial Drive');
    expect(result.address2).toBe('Building A');
    expect(result.city).toBe('Sydney');
    expect(result.state).toBe('NSW');
    expect(result.postCode).toBe('2150');
    expect(result.country).toBe('Australia');
    expect(result.phone).toBe('+61 2 7777 0001');
    expect(result.email).toBe('sydney.warehouse@example.com');
    expect(result.currencyCode).toBe('AUD');
    expect(result.srcCreatedAt).toEqual(new Date('2021-01-15T08:00:00Z'));
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-09T16:20:00Z'));
    expect(result.rawData).toBe(fullBranch);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('srcModifiedAt comes from raw.modifiedDate (BUG-CIN7-04 fix)', () => {
    const result = transformBranch(fullBranch, SYNCED_AT);
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-09T16:20:00Z'));
  });

  it('srcCreatedAt comes from raw.createdDate', () => {
    const result = transformBranch(fullBranch, SYNCED_AT);
    expect(result.srcCreatedAt).toEqual(new Date('2021-01-15T08:00:00Z'));
  });

  it('srcCreatedAt and srcModifiedAt are Date instances when present', () => {
    const result = transformBranch(fullBranch, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
  });

  it('null modifiedDate produces null srcModifiedAt', () => {
    const branch: Cin7Branch = { ...fullBranch, modifiedDate: null };
    const result = transformBranch(branch, SYNCED_AT);
    expect(result.srcModifiedAt).toBeNull();
  });

  it('null createdDate produces null srcCreatedAt', () => {
    const branch: Cin7Branch = { ...fullBranch, createdDate: null };
    const result = transformBranch(branch, SYNCED_AT);
    expect(result.srcCreatedAt).toBeNull();
  });

  it('both date fields null produce both timestamp outputs null', () => {
    const branch: Cin7Branch = { ...fullBranch, createdDate: null, modifiedDate: null };
    const result = transformBranch(branch, SYNCED_AT);
    expect(result.srcCreatedAt).toBeNull();
    expect(result.srcModifiedAt).toBeNull();
  });

  it('false isActive is preserved as false, not coerced to null', () => {
    const branch: Cin7Branch = { ...fullBranch, isActive: false };
    const result = transformBranch(branch, SYNCED_AT);
    expect(result.isActive).toBe(false);
  });

  it('false isDefault is preserved as false, not coerced to null', () => {
    const branch: Cin7Branch = { ...fullBranch, isDefault: false };
    const result = transformBranch(branch, SYNCED_AT);
    expect(result.isDefault).toBe(false);
  });

  it('null isActive produces null', () => {
    const branch: Cin7Branch = { ...fullBranch, isActive: null };
    const result = transformBranch(branch, SYNCED_AT);
    expect(result.isActive).toBeNull();
  });

  it('null isDefault produces null', () => {
    const branch: Cin7Branch = { ...fullBranch, isDefault: null };
    const result = transformBranch(branch, SYNCED_AT);
    expect(result.isDefault).toBeNull();
  });

  it('null optional string fields produce nulls in output', () => {
    const branch: Cin7Branch = {
      ...fullBranch,
      name:         null,
      code:         null,
      address1:     null,
      address2:     null,
      city:         null,
      state:        null,
      postCode:     null,
      country:      null,
      phone:        null,
      email:        null,
      currencyCode: null,
    };
    const result = transformBranch(branch, SYNCED_AT);
    expect(result.name).toBeNull();
    expect(result.code).toBeNull();
    expect(result.address1).toBeNull();
    expect(result.address2).toBeNull();
    expect(result.city).toBeNull();
    expect(result.state).toBeNull();
    expect(result.postCode).toBeNull();
    expect(result.country).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.email).toBeNull();
    expect(result.currencyCode).toBeNull();
  });

  it('rawData is the original raw object reference', () => {
    const result = transformBranch(fullBranch, SYNCED_AT);
    expect(result.rawData).toBe(fullBranch);
  });

  it('syncedAt is the exact Date passed in', () => {
    const result = transformBranch(fullBranch, SYNCED_AT);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });
});
