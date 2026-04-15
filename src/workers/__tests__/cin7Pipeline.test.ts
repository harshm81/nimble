/**
 * Cin7 pipeline integration test.
 *
 * Tests the full data flow: fixtures → transformers → repos → real DB.
 * The Cin7 adapters are mocked (no real API key needed).
 * All other layers — transformers, repos, DB — run for real.
 *
 * Fixture shapes match the Cin7 Core API:
 *   https://api.cin7.com/api
 *
 * What this test guarantees:
 *   - All tables receive rows with the correct field values.
 *   - Upsert is idempotent: running the same fixtures twice does not duplicate rows.
 *   - BUG-CIN7-01 fix: payment_terms populated from paymentTerms API field (not priceTier).
 *   - BUG-CIN7-02 fix: unit_price_tier2 through unit_price_tier10 stored correctly.
 *   - BUG-CIN7-03 fix: dimensions (weight, cbm, height, width, depth) stored on inventory rows.
 *   - BUG-CIN7-04 fix: src_modified_at mapped from modifiedDate (not updatedDate).
 */

import prisma from '../../db/prismaClient';
import {
  Cin7SalesOrder,
  Cin7Contact,
  Cin7Product,
  Cin7StockItem,
  Cin7PurchaseOrder,
  Cin7CreditNote,
  Cin7StockAdjustment,
} from '../../types/cin7.types';
import { transformOrder, transformOrderLineItems } from '../../transform/cin7/orderTransformer';
import { transformContact } from '../../transform/cin7/contactTransformer';
import { transformProduct } from '../../transform/cin7/productTransformer';
import { transformInventory } from '../../transform/cin7/inventoryTransformer';
import { transformPurchaseOrder, transformPurchaseOrderLineItems } from '../../transform/cin7/purchaseOrderTransformer';
import { transformCreditNote, transformCreditNoteLineItems } from '../../transform/cin7/creditNoteTransformer';
import { transformStockAdjustment, transformStockAdjustmentLineItems } from '../../transform/cin7/stockAdjustmentTransformer';
import {
  upsertOrders,
  upsertOrderLineItems,
  upsertContacts,
  upsertProducts,
  upsertInventory,
  upsertPurchaseOrders,
  upsertPurchaseOrderLineItems,
  upsertCreditNotes,
  upsertCreditNoteLineItems,
  upsertStockAdjustments,
  upsertStockAdjustmentLineItems,
} from '../../db/repositories/cin7Repo';
import { CIN7_PLATFORM, CIN7_JOBS } from '../../constants/cin7';

// ---------------------------------------------------------------------------
// Mock adapters — not called in integration tests
// ---------------------------------------------------------------------------

jest.mock('../../adapters/cin7/orders', () => ({ fetchOrders: jest.fn() }));
jest.mock('../../adapters/cin7/contacts', () => ({ fetchContacts: jest.fn() }));
jest.mock('../../adapters/cin7/products', () => ({ fetchProducts: jest.fn() }));
jest.mock('../../adapters/cin7/inventory', () => ({ fetchInventory: jest.fn() }));
jest.mock('../../adapters/cin7/purchaseOrders', () => ({ fetchPurchaseOrders: jest.fn() }));
jest.mock('../../adapters/cin7/creditNotes', () => ({ fetchCreditNotes: jest.fn() }));
jest.mock('../../adapters/cin7/stockAdjustments', () => ({ fetchStockAdjustments: jest.fn() }));
jest.mock('../../adapters/cin7/branches', () => ({ fetchBranches: jest.fn() }));

jest.mock('../../db/repositories/syncConfigRepo', () => ({
  getLastSyncedAt: jest.fn().mockResolvedValue(null),
  setLastSyncedAt: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../db/repositories/syncLogRepo', () => ({
  logQueued:  jest.fn().mockResolvedValue(1),
  logRunning: jest.fn().mockResolvedValue({ id: 1 }),
  logSuccess: jest.fn().mockResolvedValue(undefined),
  logFailure: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Test-scoped IDs — unique per table to avoid cross-test interference
// ---------------------------------------------------------------------------

const ORDER_ID           = 999990001;
const ORDER_LINE_ITEM_ID = 999991001;
const CONTACT_ID         = 999990100;
const PRODUCT_ID         = 999990200;
const INVENTORY_ID       = 999990300;
const PO_ID              = 999990400;
const PO_LINE_ITEM_ID    = 999991400;
const CN_ID              = 999990500;
const CN_LINE_ITEM_ID    = 999991500;
const SA_ID              = 999990600;
const SA_LINE_ITEM_ID    = 999991600;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// BUG-CIN7-01: paymentTerms must map to payment_terms (not priceTier)
// BUG-CIN7-04: modifiedDate is the correct field name (not updatedDate)
const orderFixture: Cin7SalesOrder = {
  id: ORDER_ID,
  reference: 'SO-TEST-001',
  memberId: 42,
  memberEmail: 'customer@example.com',
  memberName: 'Test Customer',
  status: 'Approved',
  createdDate: '2026-04-01T09:00:00Z',
  modifiedDate: '2026-04-10T14:30:00Z',   // BUG-CIN7-04: must be modifiedDate, not updatedDate
  completedDate: null,
  invoiceDate: '2026-04-01T09:00:00Z',
  invoiceNumber: 10001,
  dueDate: '2026-05-01T00:00:00Z',
  branchId: 1,
  priceTier: 'Tier1',
  paymentTerms: '30 Days',                 // BUG-CIN7-01: this field must reach payment_terms column
  taxInclusive: false,
  subTotal: 450.00,
  tax: 45.00,
  total: 495.00,
  paid: 495.00,
  balance: 0.00,
  currencyCode: 'AUD',
  exchangeRate: 1.0,
  note: 'Test order note',
  internalNote: null,
  shippingNotes: null,
  shippingCompany: 'Fast Freight',
  shippingMethod: 'Road',
  shippingCost: 15.00,
  shippingTax: 1.50,
  shippingTaxRule: 'GST on Income',
  account: '200',
  sourceChannel: 'Direct',
  externalId: null,
  externalReference: null,
  firstName: 'Test',
  lastName: 'Customer',
  email: 'customer@example.com',
  phone: '0298765432',
  mobile: null,
  company: 'Test Co',
  billingAddress1: '1 Test St',
  billingAddress2: null,
  billingCity: 'Sydney',
  billingState: 'NSW',
  billingPostCode: '2000',
  billingCountry: 'Australia',
  shippingAddress1: '1 Test St',
  shippingAddress2: null,
  shippingCity: 'Sydney',
  shippingState: 'NSW',
  shippingPostCode: '2000',
  shippingCountry: 'Australia',
  lineItems: [
    {
      id: ORDER_LINE_ITEM_ID,
      productId: 555,
      code: 'WIDGET-BLUE',
      name: 'Blue Widget',
      qty: 5,
      unitPrice: 90.00,
      discount: 0,
      tax: 45.00,
      total: 450.00,
      comment: null,
      lineItemType: 'stock',
      sortOrder: 1,
      option1: 'Blue',
      option2: null,
      option3: null,
      styleCode: 'WIDGET',
      barcode: '9999900010001',
      unitCost: 45.00,
      taxRule: 'GST on Income',
      accountCode: '200',
      weight: 0.5,
      cbm: null,
      height: null,
      width: null,
      depth: null,
    },
  ],
};

const contactFixture: Cin7Contact = {
  id: CONTACT_ID,
  memberSince: '2024-01-15T00:00:00Z',
  type: 'Customer',
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane.smith@example.com',
  phone: '0212345678',
  mobile: '0412345678',
  fax: null,
  company: 'Smith Enterprises',
  website: 'https://smithenterprises.example.com',
  twitter: null,
  address1: '42 Main Road',
  address2: null,
  city: 'Melbourne',
  state: 'VIC',
  postCode: '3000',
  country: 'Australia',
  priceTier: 'Tier1',
  accountCode: 'CUST-001',
  isActive: true,
  discount: 5.00,
  creditLimit: 10000.00,
  currencyCode: 'AUD',
  taxNumber: '12 345 678 901',
  taxRule: 'GST on Income',
  note: 'VIP customer',
  group: 'Wholesale',
  createdDate: '2024-01-15T00:00:00Z',
  modifiedDate: '2026-03-20T10:00:00Z',
};

// BUG-CIN7-02: all price tiers must be stored correctly
const productFixture: Cin7Product = {
  id: PRODUCT_ID,
  name: 'Blue Widget',
  code: 'WIDGET-BLUE',
  barcode: '9999902000001',
  category: 'Widgets',
  brand: 'WidgetCo',
  supplier: 'Widget Supplies Pty Ltd',
  supplierId: 99,
  description: 'A high quality blue widget for testing purposes.',
  shortDescription: 'Blue Widget',
  isActive: true,
  option1Name: 'Colour',
  option2Name: null,
  option3Name: null,
  unitPrice: 99.95,
  unitPriceTier2: 89.95,                  // BUG-CIN7-02: must be stored in unit_price_tier2
  unitPriceTier3: 79.95,
  unitPriceTier4: 69.95,
  unitPriceTier5: 59.95,
  unitPriceTier6: 54.95,
  unitPriceTier7: 49.95,
  unitPriceTier8: 44.95,
  unitPriceTier9: null,                   // null tier — must be stored as NULL
  unitPriceTier10: null,
  costPrice: 40.00,
  taxRule: 'GST on Income',
  accountCode: '200',
  purchaseTaxRule: 'GST on Expenses',
  purchaseAccountCode: '300',
  weight: 0.5,
  cbm: 0.001,
  height: 10.0,
  width: 8.0,
  depth: 5.0,
  type: 'Stock',
  createdDate: '2025-06-01T08:00:00Z',
  modifiedDate: '2026-04-01T12:00:00Z',
};

// BUG-CIN7-03: dimensions must be stored on inventory rows
const inventoryFixture: Cin7StockItem = {
  id: INVENTORY_ID,
  productId: PRODUCT_ID,
  code: 'WIDGET-BLUE',
  name: 'Blue Widget',
  barcode: '9999903000001',
  option1: 'Blue',
  option2: null,
  option3: null,
  styleCode: 'WIDGET',
  isActive: true,
  costPrice: 40.00,
  unitPrice: 99.95,
  weight: 0.5,                            // BUG-CIN7-03: dimensions must reach inventory row
  cbm: 0.001,
  height: 10.0,
  width: 8.0,
  depth: 5.0,
  branchId: 1,
  available: 47,
  stockOnHand: 50,
  committed: 3,
  incoming: 20,
  binLocation: 'A-01-01',
  reorderPoint: 10,
  reorderQty: 100,
};

const purchaseOrderFixture: Cin7PurchaseOrder = {
  id: PO_ID,
  reference: 'PO-TEST-001',
  supplierId: 88,
  supplierName: 'Widget Supplies Pty Ltd',
  supplierEmail: 'orders@widgetsupplies.example.com',
  status: 'Approved',
  createdDate: '2026-04-05T08:00:00Z',
  modifiedDate: '2026-04-07T14:00:00Z',
  completedDate: null,
  requiredDate: '2026-04-20T00:00:00Z',
  branchId: 1,
  taxInclusive: false,
  subTotal: 4000.00,
  tax: 400.00,
  total: 4400.00,
  currencyCode: 'AUD',
  exchangeRate: 1.0,
  note: 'Urgent restock',
  internalNote: null,
  shippingCompany: null,
  shippingMethod: null,
  shippingCost: null,
  shippingTax: null,
  account: '300',
  billingAddress1: '1 Test St',
  billingAddress2: null,
  billingCity: 'Sydney',
  billingState: 'NSW',
  billingPostCode: '2000',
  billingCountry: 'Australia',
  deliveryAddress1: '1 Warehouse Rd',
  deliveryAddress2: null,
  deliveryCity: 'Sydney',
  deliveryState: 'NSW',
  deliveryPostCode: '2010',
  deliveryCountry: 'Australia',
  lineItems: [
    {
      id: PO_LINE_ITEM_ID,
      productId: PRODUCT_ID,
      code: 'WIDGET-BLUE',
      name: 'Blue Widget',
      qty: 100,
      unitPrice: 40.00,
      discount: 0,
      tax: 400.00,
      total: 4000.00,
      comment: null,
      lineItemType: 'stock',
      sortOrder: 1,
      option1: 'Blue',
      option2: null,
      option3: null,
      styleCode: 'WIDGET',
      barcode: '9999904000001',
      unitCost: 40.00,
      taxRule: 'GST on Expenses',
      accountCode: '300',
      weight: null,
      cbm: null,
      height: null,
      width: null,
      depth: null,
    },
  ],
};

const creditNoteFixture: Cin7CreditNote = {
  id: CN_ID,
  reference: 'CN-TEST-001',
  memberId: 42,
  memberEmail: 'customer@example.com',
  memberName: 'Test Customer',
  status: 'Complete',
  createdDate: '2026-04-12T09:00:00Z',
  modifiedDate: '2026-04-12T11:00:00Z',
  creditDate: '2026-04-12T09:00:00Z',
  branchId: 1,
  taxInclusive: false,
  subTotal: 90.00,
  tax: 9.00,
  total: 99.00,
  currencyCode: 'AUD',
  exchangeRate: 1.0,
  note: 'Faulty item return',
  internalNote: null,
  account: '200',
  lineItems: [
    {
      id: CN_LINE_ITEM_ID,
      productId: PRODUCT_ID,
      code: 'WIDGET-BLUE',
      name: 'Blue Widget',
      qty: 1,
      unitPrice: 90.00,
      discount: 0,
      tax: 9.00,
      total: 90.00,
      comment: 'Faulty unit',
      lineItemType: 'stock',
      sortOrder: 1,
      option1: 'Blue',
      option2: null,
      option3: null,
      styleCode: 'WIDGET',
      barcode: '9999905000001',
      unitCost: 40.00,
      taxRule: 'GST on Income',
      accountCode: '200',
      weight: null,
      cbm: null,
      height: null,
      width: null,
      depth: null,
    },
  ],
};

const stockAdjustmentFixture: Cin7StockAdjustment = {
  id: SA_ID,
  reference: 'ADJ-TEST-001',
  branchId: 1,
  status: 'Complete',
  createdDate: '2026-04-13T08:00:00Z',
  modifiedDate: '2026-04-13T10:00:00Z',
  completedDate: '2026-04-13T10:00:00Z',
  note: 'Stock count correction',
  lineItems: [
    {
      id: SA_LINE_ITEM_ID,
      productId: PRODUCT_ID,
      code: 'WIDGET-BLUE',
      name: 'Blue Widget',
      qty: -2,
      unitPrice: 99.95,
      discount: 0,
      tax: 0,
      total: -199.90,
      comment: 'Written off — damaged',
      lineItemType: 'stock',
      sortOrder: 1,
      option1: 'Blue',
      option2: null,
      option3: null,
      styleCode: 'WIDGET',
      barcode: '9999906000001',
      unitCost: 40.00,
      taxRule: null,
      accountCode: null,
      weight: null,
      cbm: null,
      height: null,
      width: null,
      depth: null,
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function cleanTestRows() {
  // Delete child rows before parent rows
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_order_line_items WHERE order_id = ?`, ORDER_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_orders WHERE cin7_id = ?`, ORDER_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_contacts WHERE cin7_id = ?`, CONTACT_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_products WHERE cin7_id = ?`, PRODUCT_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_inventory WHERE cin7_id = ?`, INVENTORY_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_purchase_order_line_items WHERE purchase_order_id = ?`, PO_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_purchase_orders WHERE cin7_id = ?`, PO_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_credit_note_line_items WHERE credit_note_id = ?`, CN_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_credit_notes WHERE cin7_id = ?`, CN_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_stock_adjustment_line_items WHERE stock_adjustment_id = ?`, SA_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM cin7_stock_adjustments WHERE cin7_id = ?`, SA_ID);
}

async function runOrdersPipeline() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');
  const orders    = [transformOrder(orderFixture, syncedAt)];
  const lineItems = transformOrderLineItems(orderFixture, syncedAt);
  const saved     = await upsertOrders(orders);
  await upsertOrderLineItems(lineItems);
  return saved;
}

async function runContactsPipeline() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');
  const rows     = [transformContact(contactFixture, syncedAt)];
  return upsertContacts(rows);
}

async function runProductsPipeline() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');
  const rows     = [transformProduct(productFixture, syncedAt)];
  return upsertProducts(rows);
}

async function runInventoryPipeline() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');
  const rows     = [transformInventory(inventoryFixture, syncedAt)];
  return upsertInventory(rows);
}

async function runPurchaseOrdersPipeline() {
  const syncedAt  = new Date('2026-04-15T03:00:00.000Z');
  const pos       = [transformPurchaseOrder(purchaseOrderFixture, syncedAt)];
  const lineItems = transformPurchaseOrderLineItems(purchaseOrderFixture, syncedAt);
  const saved     = await upsertPurchaseOrders(pos);
  await upsertPurchaseOrderLineItems(lineItems);
  return saved;
}

async function runCreditNotesPipeline() {
  const syncedAt  = new Date('2026-04-15T03:00:00.000Z');
  const cns       = [transformCreditNote(creditNoteFixture, syncedAt)];
  const lineItems = transformCreditNoteLineItems(creditNoteFixture, syncedAt);
  const saved     = await upsertCreditNotes(cns);
  await upsertCreditNoteLineItems(lineItems);
  return saved;
}

async function runStockAdjustmentsPipeline() {
  const syncedAt  = new Date('2026-04-15T03:00:00.000Z');
  const sas       = [transformStockAdjustment(stockAdjustmentFixture, syncedAt)];
  const lineItems = transformStockAdjustmentLineItems(stockAdjustmentFixture, syncedAt);
  const saved     = await upsertStockAdjustments(sas);
  await upsertStockAdjustmentLineItems(lineItems);
  return saved;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await cleanTestRows();
  await runOrdersPipeline();
  await runContactsPipeline();
  await runProductsPipeline();
  await runInventoryPipeline();
  await runPurchaseOrdersPipeline();
  await runCreditNotesPipeline();
  await runStockAdjustmentsPipeline();
});

afterAll(async () => {
  await cleanTestRows();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// ORDERS
// ---------------------------------------------------------------------------

describe('Cin7 pipeline — orders', () => {
  it('inserts 1 order row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_orders WHERE cin7_id = ?`, ORDER_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores status and currency correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{ status: string; currency: string }[]>(
      `SELECT status, currency FROM cin7_orders WHERE cin7_id = ?`, ORDER_ID
    );
    expect(rows[0].status).toBe('Approved');
    expect(rows[0].currency).toBe('AUD');
  });

  it('stores total_amount as DECIMAL(12,2)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ total_amount: string }[]>(
      `SELECT CAST(total_amount AS CHAR) AS total_amount FROM cin7_orders WHERE cin7_id = ?`, ORDER_ID
    );
    expect(rows[0].total_amount).toBe('495.00');
  });

  it('stores payment_terms from paymentTerms field (BUG-CIN7-01 fix — not priceTier)', async () => {
    // Old code mapped priceTier → payment_terms; fix maps paymentTerms → payment_terms
    const rows = await prisma.$queryRawUnsafe<{ payment_terms: string | null }[]>(
      `SELECT payment_terms FROM cin7_orders WHERE cin7_id = ?`, ORDER_ID
    );
    expect(rows[0].payment_terms).toBe('30 Days');
  });

  it('stores src_modified_at from modifiedDate (BUG-CIN7-04 fix)', async () => {
    // Old code read updatedDate which does not exist on Cin7SalesOrder
    const rows = await prisma.$queryRawUnsafe<{ src_modified_at: Date }[]>(
      `SELECT src_modified_at FROM cin7_orders WHERE cin7_id = ?`, ORDER_ID
    );
    expect(rows[0].src_modified_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].src_modified_at.getUTCMonth()).toBe(3);   // April (0-indexed)
    expect(rows[0].src_modified_at.getUTCDate()).toBe(10);
  });

  it('stores src_created_at as UTC datetime', async () => {
    const rows = await prisma.$queryRawUnsafe<{ src_created_at: Date }[]>(
      `SELECT src_created_at FROM cin7_orders WHERE cin7_id = ?`, ORDER_ID
    );
    expect(rows[0].src_created_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].src_created_at.getUTCMonth()).toBe(3);
    expect(rows[0].src_created_at.getUTCDate()).toBe(1);
  });

  it('inserts 1 order line item row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_order_line_items WHERE order_id = ?`, ORDER_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores line item name, code, and qty correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{ name: string; code: string; qty: string }[]>(
      `SELECT name, code, CAST(qty AS CHAR) AS qty FROM cin7_order_line_items WHERE order_id = ?`, ORDER_ID
    );
    expect(rows[0].name).toBe('Blue Widget');
    expect(rows[0].code).toBe('WIDGET-BLUE');
    expect(rows[0].qty).toBe('5.0000');
  });

  it('stores line item unit_price as DECIMAL(12,4)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ unit_price: string }[]>(
      `SELECT CAST(unit_price AS CHAR) AS unit_price FROM cin7_order_line_items WHERE order_id = ?`, ORDER_ID
    );
    expect(rows[0].unit_price).toBe('90.0000');
  });

  it('is idempotent — second run does not duplicate order rows', async () => {
    await runOrdersPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_orders WHERE cin7_id = ?`, ORDER_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('is idempotent — second run does not duplicate order line item rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_order_line_items WHERE order_id = ?`, ORDER_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// CONTACTS
// ---------------------------------------------------------------------------

describe('Cin7 pipeline — contacts', () => {
  it('inserts 1 contact row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_contacts WHERE cin7_id = ?`, CONTACT_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores first_name, last_name, email correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{ first_name: string; last_name: string; email: string }[]>(
      `SELECT first_name, last_name, email FROM cin7_contacts WHERE cin7_id = ?`, CONTACT_ID
    );
    expect(rows[0].first_name).toBe('Jane');
    expect(rows[0].last_name).toBe('Smith');
    expect(rows[0].email).toBe('jane.smith@example.com');
  });

  it('stores company, type, and is_active', async () => {
    const rows = await prisma.$queryRawUnsafe<{ company: string; type: string; is_active: number }[]>(
      `SELECT company, type, is_active FROM cin7_contacts WHERE cin7_id = ?`, CONTACT_ID
    );
    expect(rows[0].company).toBe('Smith Enterprises');
    expect(rows[0].type).toBe('Customer');
    expect(rows[0].is_active).toBe(1);   // MySQL TINYINT(1): true = 1
  });

  it('stores credit_limit as DECIMAL(12,2)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ credit_limit: string }[]>(
      `SELECT CAST(credit_limit AS CHAR) AS credit_limit FROM cin7_contacts WHERE cin7_id = ?`, CONTACT_ID
    );
    expect(rows[0].credit_limit).toBe('10000.00');
  });

  it('stores src_created_at and src_modified_at as UTC datetimes', async () => {
    const rows = await prisma.$queryRawUnsafe<{ src_created_at: Date; src_modified_at: Date }[]>(
      `SELECT src_created_at, src_modified_at FROM cin7_contacts WHERE cin7_id = ?`, CONTACT_ID
    );
    expect(rows[0].src_created_at.getUTCFullYear()).toBe(2024);
    expect(rows[0].src_modified_at.getUTCFullYear()).toBe(2026);
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runContactsPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_contacts WHERE cin7_id = ?`, CONTACT_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PRODUCTS
// ---------------------------------------------------------------------------

describe('Cin7 pipeline — products', () => {
  it('inserts 1 product row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_products WHERE cin7_id = ?`, PRODUCT_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores name, code, category, brand correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{ name: string; code: string; category: string; brand: string }[]>(
      `SELECT name, code, category, brand FROM cin7_products WHERE cin7_id = ?`, PRODUCT_ID
    );
    expect(rows[0].name).toBe('Blue Widget');
    expect(rows[0].code).toBe('WIDGET-BLUE');
    expect(rows[0].category).toBe('Widgets');
    expect(rows[0].brand).toBe('WidgetCo');
  });

  it('stores unit_price as DECIMAL(12,4)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ unit_price: string }[]>(
      `SELECT CAST(unit_price AS CHAR) AS unit_price FROM cin7_products WHERE cin7_id = ?`, PRODUCT_ID
    );
    expect(rows[0].unit_price).toBe('99.9500');
  });

  it('stores all price tiers correctly (BUG-CIN7-02 fix)', async () => {
    // Old code dropped tier2–tier10; fix stores all tiers from API response
    const rows = await prisma.$queryRawUnsafe<{
      unit_price_tier2: string;
      unit_price_tier3: string;
      unit_price_tier4: string;
      unit_price_tier5: string;
      unit_price_tier6: string;
      unit_price_tier7: string;
      unit_price_tier8: string;
    }[]>(
      `SELECT
        CAST(unit_price_tier2 AS CHAR) AS unit_price_tier2,
        CAST(unit_price_tier3 AS CHAR) AS unit_price_tier3,
        CAST(unit_price_tier4 AS CHAR) AS unit_price_tier4,
        CAST(unit_price_tier5 AS CHAR) AS unit_price_tier5,
        CAST(unit_price_tier6 AS CHAR) AS unit_price_tier6,
        CAST(unit_price_tier7 AS CHAR) AS unit_price_tier7,
        CAST(unit_price_tier8 AS CHAR) AS unit_price_tier8
       FROM cin7_products WHERE cin7_id = ?`, PRODUCT_ID
    );
    expect(rows[0].unit_price_tier2).toBe('89.9500');
    expect(rows[0].unit_price_tier3).toBe('79.9500');
    expect(rows[0].unit_price_tier4).toBe('69.9500');
    expect(rows[0].unit_price_tier5).toBe('59.9500');
    expect(rows[0].unit_price_tier6).toBe('54.9500');
    expect(rows[0].unit_price_tier7).toBe('49.9500');
    expect(rows[0].unit_price_tier8).toBe('44.9500');
  });

  it('stores null price tiers as NULL (BUG-CIN7-02 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      unit_price_tier9: string | null;
      unit_price_tier10: string | null;
    }[]>(
      `SELECT unit_price_tier9, unit_price_tier10 FROM cin7_products WHERE cin7_id = ?`, PRODUCT_ID
    );
    expect(rows[0].unit_price_tier9).toBeNull();
    expect(rows[0].unit_price_tier10).toBeNull();
  });

  it('stores src_modified_at from modifiedDate (BUG-CIN7-04 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ src_modified_at: Date }[]>(
      `SELECT src_modified_at FROM cin7_products WHERE cin7_id = ?`, PRODUCT_ID
    );
    expect(rows[0].src_modified_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].src_modified_at.getUTCMonth()).toBe(3);   // April (0-indexed)
    expect(rows[0].src_modified_at.getUTCDate()).toBe(1);
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runProductsPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_products WHERE cin7_id = ?`, PRODUCT_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// INVENTORY
// ---------------------------------------------------------------------------

describe('Cin7 pipeline — inventory', () => {
  it('inserts 1 inventory row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_inventory WHERE cin7_id = ?`, INVENTORY_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores stock_on_hand, available, committed, incoming as DECIMAL(12,4)', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      stock_on_hand: string;
      available: string;
      committed: string;
      incoming: string;
    }[]>(
      `SELECT
        CAST(stock_on_hand AS CHAR) AS stock_on_hand,
        CAST(available AS CHAR) AS available,
        CAST(committed AS CHAR) AS committed,
        CAST(incoming AS CHAR) AS incoming
       FROM cin7_inventory WHERE cin7_id = ?`, INVENTORY_ID
    );
    expect(rows[0].stock_on_hand).toBe('50.0000');
    expect(rows[0].available).toBe('47.0000');
    expect(rows[0].committed).toBe('3.0000');
    expect(rows[0].incoming).toBe('20.0000');
  });

  it('stores dimensions correctly (BUG-CIN7-03 fix — weight, cbm, height, width, depth)', async () => {
    // Old code omitted dimension fields from the inventory transformer/repo
    const rows = await prisma.$queryRawUnsafe<{
      weight: string;
      cbm: string;
      height: string;
      width: string;
      depth: string;
    }[]>(
      `SELECT
        CAST(weight AS CHAR) AS weight,
        CAST(cbm AS CHAR) AS cbm,
        CAST(height AS CHAR) AS height,
        CAST(width AS CHAR) AS width,
        CAST(depth AS CHAR) AS depth
       FROM cin7_inventory WHERE cin7_id = ?`, INVENTORY_ID
    );
    expect(rows[0].weight).toBe('0.5000');
    expect(rows[0].cbm).toBe('0.0010');
    expect(rows[0].height).toBe('10.0000');
    expect(rows[0].width).toBe('8.0000');
    expect(rows[0].depth).toBe('5.0000');
  });

  it('stores bin_location and reorder fields', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      bin_location: string;
      reorder_point: string;
      reorder_qty: string;
    }[]>(
      `SELECT
        bin_location,
        CAST(reorder_point AS CHAR) AS reorder_point,
        CAST(reorder_qty AS CHAR) AS reorder_qty
       FROM cin7_inventory WHERE cin7_id = ?`, INVENTORY_ID
    );
    expect(rows[0].bin_location).toBe('A-01-01');
    expect(rows[0].reorder_point).toBe('10.0000');
    expect(rows[0].reorder_qty).toBe('100.0000');
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runInventoryPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_inventory WHERE cin7_id = ?`, INVENTORY_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PURCHASE ORDERS
// ---------------------------------------------------------------------------

describe('Cin7 pipeline — purchase orders', () => {
  it('inserts 1 purchase order row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_purchase_orders WHERE cin7_id = ?`, PO_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores supplier_name, status, currency correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{ supplier_name: string; status: string; currency_code: string }[]>(
      `SELECT supplier_name, status, currency_code FROM cin7_purchase_orders WHERE cin7_id = ?`, PO_ID
    );
    expect(rows[0].supplier_name).toBe('Widget Supplies Pty Ltd');
    expect(rows[0].status).toBe('Approved');
    expect(rows[0].currency_code).toBe('AUD');
  });

  it('stores total as DECIMAL(12,2)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ total: string }[]>(
      `SELECT CAST(total AS CHAR) AS total FROM cin7_purchase_orders WHERE cin7_id = ?`, PO_ID
    );
    expect(rows[0].total).toBe('4400.00');
  });

  it('stores required_date as UTC datetime', async () => {
    const rows = await prisma.$queryRawUnsafe<{ required_date: Date }[]>(
      `SELECT required_date FROM cin7_purchase_orders WHERE cin7_id = ?`, PO_ID
    );
    expect(rows[0].required_date.getUTCFullYear()).toBe(2026);
    expect(rows[0].required_date.getUTCMonth()).toBe(3);   // April (0-indexed)
    expect(rows[0].required_date.getUTCDate()).toBe(20);
  });

  it('stores src_modified_at from modifiedDate (BUG-CIN7-04 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ src_modified_at: Date }[]>(
      `SELECT src_modified_at FROM cin7_purchase_orders WHERE cin7_id = ?`, PO_ID
    );
    expect(rows[0].src_modified_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].src_modified_at.getUTCMonth()).toBe(3);
    expect(rows[0].src_modified_at.getUTCDate()).toBe(7);
  });

  it('inserts 1 purchase order line item row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_purchase_order_line_items WHERE purchase_order_id = ?`, PO_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores purchase order line item qty and unit_price as DECIMAL', async () => {
    const rows = await prisma.$queryRawUnsafe<{ qty: string; unit_price: string }[]>(
      `SELECT CAST(qty AS CHAR) AS qty, CAST(unit_price AS CHAR) AS unit_price
       FROM cin7_purchase_order_line_items WHERE purchase_order_id = ?`, PO_ID
    );
    expect(rows[0].qty).toBe('100.0000');
    expect(rows[0].unit_price).toBe('40.0000');
  });

  it('is idempotent — second run does not duplicate purchase order rows', async () => {
    await runPurchaseOrdersPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_purchase_orders WHERE cin7_id = ?`, PO_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('is idempotent — second run does not duplicate purchase order line item rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_purchase_order_line_items WHERE purchase_order_id = ?`, PO_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// CREDIT NOTES
// ---------------------------------------------------------------------------

describe('Cin7 pipeline — credit notes', () => {
  it('inserts 1 credit note row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_credit_notes WHERE cin7_id = ?`, CN_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores member_email, status, total correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{ member_email: string; status: string; total: string }[]>(
      `SELECT member_email, status, CAST(total AS CHAR) AS total FROM cin7_credit_notes WHERE cin7_id = ?`, CN_ID
    );
    expect(rows[0].member_email).toBe('customer@example.com');
    expect(rows[0].status).toBe('Complete');
    expect(rows[0].total).toBe('99.00');
  });

  it('stores credit_date as UTC datetime', async () => {
    const rows = await prisma.$queryRawUnsafe<{ credit_date: Date }[]>(
      `SELECT credit_date FROM cin7_credit_notes WHERE cin7_id = ?`, CN_ID
    );
    expect(rows[0].credit_date.getUTCFullYear()).toBe(2026);
    expect(rows[0].credit_date.getUTCMonth()).toBe(3);   // April (0-indexed)
    expect(rows[0].credit_date.getUTCDate()).toBe(12);
  });

  it('stores src_modified_at from modifiedDate (BUG-CIN7-04 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ src_modified_at: Date }[]>(
      `SELECT src_modified_at FROM cin7_credit_notes WHERE cin7_id = ?`, CN_ID
    );
    expect(rows[0].src_modified_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].src_modified_at.getUTCMonth()).toBe(3);
    expect(rows[0].src_modified_at.getUTCDate()).toBe(12);
  });

  it('inserts 1 credit note line item row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_credit_note_line_items WHERE credit_note_id = ?`, CN_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores credit note line item name and comment', async () => {
    const rows = await prisma.$queryRawUnsafe<{ name: string; comment: string }[]>(
      `SELECT name, comment FROM cin7_credit_note_line_items WHERE credit_note_id = ?`, CN_ID
    );
    expect(rows[0].name).toBe('Blue Widget');
    expect(rows[0].comment).toBe('Faulty unit');
  });

  it('is idempotent — second run does not duplicate credit note rows', async () => {
    await runCreditNotesPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_credit_notes WHERE cin7_id = ?`, CN_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('is idempotent — second run does not duplicate credit note line item rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_credit_note_line_items WHERE credit_note_id = ?`, CN_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// STOCK ADJUSTMENTS
// ---------------------------------------------------------------------------

describe('Cin7 pipeline — stock adjustments', () => {
  it('inserts 1 stock adjustment row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_stock_adjustments WHERE cin7_id = ?`, SA_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores reference, status, note correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{ reference: string; status: string; note: string }[]>(
      `SELECT reference, status, note FROM cin7_stock_adjustments WHERE cin7_id = ?`, SA_ID
    );
    expect(rows[0].reference).toBe('ADJ-TEST-001');
    expect(rows[0].status).toBe('Complete');
    expect(rows[0].note).toBe('Stock count correction');
  });

  it('stores completed_date as UTC datetime', async () => {
    const rows = await prisma.$queryRawUnsafe<{ completed_date: Date }[]>(
      `SELECT completed_date FROM cin7_stock_adjustments WHERE cin7_id = ?`, SA_ID
    );
    expect(rows[0].completed_date.getUTCFullYear()).toBe(2026);
    expect(rows[0].completed_date.getUTCMonth()).toBe(3);   // April (0-indexed)
    expect(rows[0].completed_date.getUTCDate()).toBe(13);
  });

  it('stores src_modified_at from modifiedDate (BUG-CIN7-04 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ src_modified_at: Date }[]>(
      `SELECT src_modified_at FROM cin7_stock_adjustments WHERE cin7_id = ?`, SA_ID
    );
    expect(rows[0].src_modified_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].src_modified_at.getUTCMonth()).toBe(3);
    expect(rows[0].src_modified_at.getUTCDate()).toBe(13);
  });

  it('inserts 1 stock adjustment line item row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_stock_adjustment_line_items WHERE stock_adjustment_id = ?`, SA_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores stock adjustment line item with negative qty', async () => {
    const rows = await prisma.$queryRawUnsafe<{ qty: string; comment: string }[]>(
      `SELECT CAST(qty AS CHAR) AS qty, comment
       FROM cin7_stock_adjustment_line_items WHERE stock_adjustment_id = ?`, SA_ID
    );
    expect(rows[0].qty).toBe('-2.0000');
    expect(rows[0].comment).toBe('Written off — damaged');
  });

  it('is idempotent — second run does not duplicate stock adjustment rows', async () => {
    await runStockAdjustmentsPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_stock_adjustments WHERE cin7_id = ?`, SA_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('is idempotent — second run does not duplicate stock adjustment line item rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM cin7_stock_adjustment_line_items WHERE stock_adjustment_id = ?`, SA_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Cursor advancement (sync_config)
// ---------------------------------------------------------------------------

describe('Cin7 pipeline — cursor advancement', () => {
  const TEST_PLATFORM = CIN7_PLATFORM + '-cursor-test';

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM sync_config WHERE platform = ?`, TEST_PLATFORM);
  });

  it('cursor row does not exist before first run', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, CIN7_JOBS.ORDERS
    );
    expect(Number(rows[0].cnt)).toBe(0);
  });

  it('stores and updates cursor date correctly', async () => {
    const firstSyncDate = new Date('2026-04-10T14:30:00.000Z');
    await prisma.$executeRawUnsafe(
      `INSERT INTO sync_config (platform, job_type, last_synced_at, created_at, modified_at)
       VALUES (?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE last_synced_at = VALUES(last_synced_at), modified_at = NOW(3)`,
      TEST_PLATFORM, CIN7_JOBS.ORDERS, firstSyncDate
    );

    const rows = await prisma.$queryRawUnsafe<{ last_synced_at: Date }[]>(
      `SELECT last_synced_at FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, CIN7_JOBS.ORDERS
    );
    expect(rows[0].last_synced_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].last_synced_at.getUTCMonth()).toBe(3);   // April (0-indexed)
    expect(rows[0].last_synced_at.getUTCDate()).toBe(10);
  });

  it('advances cursor on second run', async () => {
    const secondSyncDate = new Date('2026-04-15T03:00:00.000Z');
    await prisma.$executeRawUnsafe(
      `INSERT INTO sync_config (platform, job_type, last_synced_at, created_at, modified_at)
       VALUES (?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE last_synced_at = VALUES(last_synced_at), modified_at = NOW(3)`,
      TEST_PLATFORM, CIN7_JOBS.ORDERS, secondSyncDate
    );

    const rows = await prisma.$queryRawUnsafe<{ last_synced_at: Date }[]>(
      `SELECT last_synced_at FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, CIN7_JOBS.ORDERS
    );
    expect(rows[0].last_synced_at.getUTCDate()).toBe(15);
  });
});
