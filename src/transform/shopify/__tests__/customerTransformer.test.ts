import { transformCustomer } from '../customerTransformer';
import { ShopifyCustomerNode } from '../../../types/shopify.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullCustomer: ShopifyCustomerNode = {
  id: 'gid://shopify/Customer/5001',
  email: 'jane.doe@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '+61412345678',
  createdAt: '2025-06-01T08:00:00+10:00',
  updatedAt: '2026-03-20T14:30:00+10:00',
};

describe('transformCustomer', () => {
  it('maps all fields correctly from a full customer', () => {
    const result = transformCustomer(fullCustomer, SYNCED_AT);

    expect(result.shopifyId).toBe('gid://shopify/Customer/5001');
    expect(result.email).toBe('jane.doe@example.com');
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Doe');
    expect(result.phone).toBe('+61412345678');
    expect(result.rawData).toBe(fullCustomer);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('parses ISO 8601 date strings with timezone to Date objects', () => {
    const result = transformCustomer(fullCustomer, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.srcCreatedAt?.getUTCFullYear()).toBe(2025);
    expect(result.srcModifiedAt?.getUTCFullYear()).toBe(2026);
  });

  it('returns null email when email is null', () => {
    const customer: ShopifyCustomerNode = { ...fullCustomer, email: null };
    expect(transformCustomer(customer, SYNCED_AT).email).toBeNull();
  });

  it('returns null firstName when firstName is null', () => {
    const customer: ShopifyCustomerNode = { ...fullCustomer, firstName: null };
    expect(transformCustomer(customer, SYNCED_AT).firstName).toBeNull();
  });

  it('returns null lastName when lastName is null', () => {
    const customer: ShopifyCustomerNode = { ...fullCustomer, lastName: null };
    expect(transformCustomer(customer, SYNCED_AT).lastName).toBeNull();
  });

  it('returns null phone when phone is null', () => {
    const customer: ShopifyCustomerNode = { ...fullCustomer, phone: null };
    expect(transformCustomer(customer, SYNCED_AT).phone).toBeNull();
  });

  it('returns null srcCreatedAt when createdAt is null', () => {
    const customer: ShopifyCustomerNode = { ...fullCustomer, createdAt: null };
    expect(transformCustomer(customer, SYNCED_AT).srcCreatedAt).toBeNull();
  });

  it('returns null srcModifiedAt when updatedAt is null', () => {
    const customer: ShopifyCustomerNode = { ...fullCustomer, updatedAt: null };
    expect(transformCustomer(customer, SYNCED_AT).srcModifiedAt).toBeNull();
  });

  it('handles a minimal customer with all optional fields null', () => {
    const minimal: ShopifyCustomerNode = {
      id: 'gid://shopify/Customer/9999',
      email: null,
      firstName: null,
      lastName: null,
      phone: null,
      createdAt: null,
      updatedAt: null,
    };
    const result = transformCustomer(minimal, SYNCED_AT);
    expect(result.shopifyId).toBe('gid://shopify/Customer/9999');
    expect(result.email).toBeNull();
    expect(result.firstName).toBeNull();
    expect(result.lastName).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.srcCreatedAt).toBeNull();
    expect(result.srcModifiedAt).toBeNull();
    expect(result.syncedAt).toBe(SYNCED_AT);
  });
});
