/**
 * Seed script — Cin7 test data
 *
 * Inserts representative Cin7 fixtures into the database for manual inspection.
 * Run inside the Docker container:
 *
 *   npx tsx src/scripts/seedCin7TestData.ts
 *
 * Rows are NOT cleaned up automatically — use the cleanup queries logged at the end
 * to remove them after inspection.
 *
 * Seed IDs are distinct from integration-test IDs (888880xxx vs 999990xxx)
 * so both can coexist in the database simultaneously.
 */

import prisma from '../db/prismaClient';
import {
  Cin7SalesOrder,
  Cin7Contact,
  Cin7Product,
  Cin7StockItem,
  Cin7PurchaseOrder,
  Cin7CreditNote,
  Cin7StockAdjustment,
} from '../types/cin7.types';
import { transformOrder, transformOrderLineItems } from '../transform/cin7/orderTransformer';
import { transformContact } from '../transform/cin7/contactTransformer';
import { transformProduct } from '../transform/cin7/productTransformer';
import { transformInventory } from '../transform/cin7/inventoryTransformer';
import { transformPurchaseOrder, transformPurchaseOrderLineItems } from '../transform/cin7/purchaseOrderTransformer';
import { transformCreditNote, transformCreditNoteLineItems } from '../transform/cin7/creditNoteTransformer';
import { transformStockAdjustment, transformStockAdjustmentLineItems } from '../transform/cin7/stockAdjustmentTransformer';
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
} from '../db/repositories/cin7Repo';

// ---------------------------------------------------------------------------
// Seed IDs — distinct from integration-test IDs (999990xxx)
// ---------------------------------------------------------------------------

const ORDER_ID           = 888880001;
const ORDER_LINE_ITEM_ID = 888881001;
const CONTACT_ID         = 888880100;
const PRODUCT_ID         = 888880200;
const INVENTORY_ID       = 888880300;
const PO_ID              = 888880400;
const PO_LINE_ITEM_ID    = 888881400;
const CN_ID              = 888880500;
const CN_LINE_ITEM_ID    = 888881500;
const SA_ID              = 888880600;
const SA_LINE_ITEM_ID    = 888881600;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const orderFixtures: Cin7SalesOrder[] = [
  {
    id: ORDER_ID,
    reference: 'SO-SEED-001',
    memberId: 42,
    memberEmail: 'seed.customer@example.com',
    memberName: 'Seed Customer',
    status: 'Approved',
    createdDate: '2026-04-01T09:00:00Z',
    modifiedDate: '2026-04-10T14:30:00Z',
    completedDate: null,
    invoiceDate: '2026-04-01T09:00:00Z',
    invoiceNumber: 20001,
    dueDate: '2026-05-01T00:00:00Z',
    branchId: 1,
    priceTier: 'Tier1',
    paymentTerms: '30 Days',
    taxInclusive: false,
    subTotal: 450.00,
    tax: 45.00,
    total: 495.00,
    paid: 495.00,
    balance: 0.00,
    currencyCode: 'AUD',
    exchangeRate: 1.0,
    note: 'Seed order note',
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
    firstName: 'Seed',
    lastName: 'Customer',
    email: 'seed.customer@example.com',
    phone: '0298765432',
    mobile: null,
    company: 'Seed Co Pty Ltd',
    billingAddress1: '1 Seed St',
    billingAddress2: null,
    billingCity: 'Sydney',
    billingState: 'NSW',
    billingPostCode: '2000',
    billingCountry: 'Australia',
    shippingAddress1: '1 Seed St',
    shippingAddress2: null,
    shippingCity: 'Sydney',
    shippingState: 'NSW',
    shippingPostCode: '2000',
    shippingCountry: 'Australia',
    lineItems: [
      {
        id: ORDER_LINE_ITEM_ID,
        productId: PRODUCT_ID,
        code: 'WIDGET-SEED',
        name: 'Seed Widget',
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
        barcode: '8888800010001',
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
  },
];

const contactFixtures: Cin7Contact[] = [
  {
    id: CONTACT_ID,
    memberSince: '2024-03-01T00:00:00Z',
    type: 'Customer',
    firstName: 'Seed',
    lastName: 'Contact',
    email: 'seed.contact@example.com',
    phone: '0312345678',
    mobile: '0412345678',
    fax: null,
    company: 'Seed Enterprises Pty Ltd',
    website: 'https://seedenterprises.example.com',
    twitter: null,
    address1: '88 Seed Road',
    address2: null,
    city: 'Melbourne',
    state: 'VIC',
    postCode: '3000',
    country: 'Australia',
    priceTier: 'Tier2',
    accountCode: 'SEED-001',
    isActive: true,
    discount: 10.00,
    creditLimit: 25000.00,
    currencyCode: 'AUD',
    taxNumber: '88 888 888 888',
    taxRule: 'GST on Income',
    note: 'Seed contact for inspection',
    group: 'Wholesale',
    createdDate: '2024-03-01T00:00:00Z',
    modifiedDate: '2026-03-20T10:00:00Z',
  },
];

const productFixtures: Cin7Product[] = [
  {
    id: PRODUCT_ID,
    name: 'Seed Widget',
    code: 'WIDGET-SEED',
    barcode: '8888802000001',
    category: 'Widgets',
    brand: 'SeedCo',
    supplier: 'Seed Supplies Pty Ltd',
    supplierId: 77,
    description: 'A representative seed widget for manual DB inspection.',
    shortDescription: 'Seed Widget',
    isActive: true,
    option1Name: 'Colour',
    option2Name: 'Size',
    option3Name: null,
    unitPrice: 99.95,
    unitPriceTier2: 89.95,
    unitPriceTier3: 79.95,
    unitPriceTier4: 69.95,
    unitPriceTier5: 59.95,
    unitPriceTier6: 54.95,
    unitPriceTier7: 49.95,
    unitPriceTier8: 44.95,
    unitPriceTier9: 39.95,
    unitPriceTier10: null,
    costPrice: 40.00,
    taxRule: 'GST on Income',
    accountCode: '200',
    purchaseTaxRule: 'GST on Expenses',
    purchaseAccountCode: '300',
    weight: 0.75,
    cbm: 0.002,
    height: 12.0,
    width: 10.0,
    depth: 6.0,
    type: 'Stock',
    createdDate: '2025-06-01T08:00:00Z',
    modifiedDate: '2026-04-01T12:00:00Z',
  },
];

const inventoryFixtures: Cin7StockItem[] = [
  {
    id: INVENTORY_ID,
    productId: PRODUCT_ID,
    code: 'WIDGET-SEED',
    name: 'Seed Widget',
    barcode: '8888803000001',
    option1: 'Blue',
    option2: 'Large',
    option3: null,
    styleCode: 'WIDGET',
    isActive: true,
    costPrice: 40.00,
    unitPrice: 99.95,
    weight: 0.75,
    cbm: 0.002,
    height: 12.0,
    width: 10.0,
    depth: 6.0,
    branchId: 1,
    available: 85,
    stockOnHand: 100,
    committed: 15,
    incoming: 50,
    binLocation: 'B-02-03',
    reorderPoint: 20,
    reorderQty: 200,
  },
];

const purchaseOrderFixtures: Cin7PurchaseOrder[] = [
  {
    id: PO_ID,
    reference: 'PO-SEED-001',
    supplierId: 77,
    supplierName: 'Seed Supplies Pty Ltd',
    supplierEmail: 'orders@seedsupplies.example.com',
    status: 'Approved',
    createdDate: '2026-04-05T08:00:00Z',
    modifiedDate: '2026-04-07T14:00:00Z',
    completedDate: null,
    requiredDate: '2026-04-25T00:00:00Z',
    branchId: 1,
    taxInclusive: false,
    subTotal: 8000.00,
    tax: 800.00,
    total: 8800.00,
    currencyCode: 'AUD',
    exchangeRate: 1.0,
    note: 'Quarterly restock',
    internalNote: null,
    shippingCompany: null,
    shippingMethod: null,
    shippingCost: null,
    shippingTax: null,
    account: '300',
    billingAddress1: '1 Seed St',
    billingAddress2: null,
    billingCity: 'Sydney',
    billingState: 'NSW',
    billingPostCode: '2000',
    billingCountry: 'Australia',
    deliveryAddress1: '88 Warehouse Rd',
    deliveryAddress2: null,
    deliveryCity: 'Sydney',
    deliveryState: 'NSW',
    deliveryPostCode: '2010',
    deliveryCountry: 'Australia',
    lineItems: [
      {
        id: PO_LINE_ITEM_ID,
        productId: PRODUCT_ID,
        code: 'WIDGET-SEED',
        name: 'Seed Widget',
        qty: 200,
        unitPrice: 40.00,
        discount: 0,
        tax: 800.00,
        total: 8000.00,
        comment: null,
        lineItemType: 'stock',
        sortOrder: 1,
        option1: 'Blue',
        option2: 'Large',
        option3: null,
        styleCode: 'WIDGET',
        barcode: '8888804000001',
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
  },
];

const creditNoteFixtures: Cin7CreditNote[] = [
  {
    id: CN_ID,
    reference: 'CN-SEED-001',
    memberId: 42,
    memberEmail: 'seed.customer@example.com',
    memberName: 'Seed Customer',
    status: 'Complete',
    createdDate: '2026-04-12T09:00:00Z',
    modifiedDate: '2026-04-12T11:00:00Z',
    creditDate: '2026-04-12T09:00:00Z',
    branchId: 1,
    taxInclusive: false,
    subTotal: 180.00,
    tax: 18.00,
    total: 198.00,
    currencyCode: 'AUD',
    exchangeRate: 1.0,
    note: 'Two faulty items returned',
    internalNote: null,
    account: '200',
    lineItems: [
      {
        id: CN_LINE_ITEM_ID,
        productId: PRODUCT_ID,
        code: 'WIDGET-SEED',
        name: 'Seed Widget',
        qty: 2,
        unitPrice: 90.00,
        discount: 0,
        tax: 18.00,
        total: 180.00,
        comment: 'Faulty units',
        lineItemType: 'stock',
        sortOrder: 1,
        option1: 'Blue',
        option2: 'Large',
        option3: null,
        styleCode: 'WIDGET',
        barcode: '8888805000001',
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
  },
];

const stockAdjustmentFixtures: Cin7StockAdjustment[] = [
  {
    id: SA_ID,
    reference: 'ADJ-SEED-001',
    branchId: 1,
    status: 'Complete',
    createdDate: '2026-04-13T08:00:00Z',
    modifiedDate: '2026-04-13T10:00:00Z',
    completedDate: '2026-04-13T10:00:00Z',
    note: 'Annual stock count correction',
    lineItems: [
      {
        id: SA_LINE_ITEM_ID,
        productId: PRODUCT_ID,
        code: 'WIDGET-SEED',
        name: 'Seed Widget',
        qty: -5,
        unitPrice: 99.95,
        discount: 0,
        tax: 0,
        total: -499.75,
        comment: 'Written off — stock count discrepancy',
        lineItemType: 'stock',
        sortOrder: 1,
        option1: 'Blue',
        option2: 'Large',
        option3: null,
        styleCode: 'WIDGET',
        barcode: '8888806000001',
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
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  const syncedAt = new Date();
  console.log(`\nSeeding Cin7 test data at ${syncedAt.toISOString()}\n`);

  const orders              = orderFixtures.map((r) => transformOrder(r, syncedAt));
  const orderLineItems      = orderFixtures.flatMap((r) => transformOrderLineItems(r, syncedAt));
  const contacts            = contactFixtures.map((r) => transformContact(r, syncedAt));
  const products            = productFixtures.map((r) => transformProduct(r, syncedAt));
  const inventory           = inventoryFixtures.map((r) => transformInventory(r, syncedAt));
  const purchaseOrders      = purchaseOrderFixtures.map((r) => transformPurchaseOrder(r, syncedAt));
  const poLineItems         = purchaseOrderFixtures.flatMap((r) => transformPurchaseOrderLineItems(r, syncedAt));
  const creditNotes         = creditNoteFixtures.map((r) => transformCreditNote(r, syncedAt));
  const cnLineItems         = creditNoteFixtures.flatMap((r) => transformCreditNoteLineItems(r, syncedAt));
  const stockAdjustments    = stockAdjustmentFixtures.map((r) => transformStockAdjustment(r, syncedAt));
  const saLineItems         = stockAdjustmentFixtures.flatMap((r) => transformStockAdjustmentLineItems(r, syncedAt));

  const ordersSaved              = await upsertOrders(orders);
  const orderLineItemsSaved      = await upsertOrderLineItems(orderLineItems);
  const contactsSaved            = await upsertContacts(contacts);
  const productsSaved            = await upsertProducts(products);
  const inventorySaved           = await upsertInventory(inventory);
  const purchaseOrdersSaved      = await upsertPurchaseOrders(purchaseOrders);
  const poLineItemsSaved         = await upsertPurchaseOrderLineItems(poLineItems);
  const creditNotesSaved         = await upsertCreditNotes(creditNotes);
  const cnLineItemsSaved         = await upsertCreditNoteLineItems(cnLineItems);
  const stockAdjustmentsSaved    = await upsertStockAdjustments(stockAdjustments);
  const saLineItemsSaved         = await upsertStockAdjustmentLineItems(saLineItems);

  console.log(`Orders inserted:                      ${ordersSaved}`);
  console.log(`Order line items inserted:            ${orderLineItemsSaved}`);
  console.log(`Contacts inserted:                    ${contactsSaved}`);
  console.log(`Products inserted:                    ${productsSaved}`);
  console.log(`Inventory rows inserted:              ${inventorySaved}`);
  console.log(`Purchase orders inserted:             ${purchaseOrdersSaved}`);
  console.log(`Purchase order line items inserted:   ${poLineItemsSaved}`);
  console.log(`Credit notes inserted:                ${creditNotesSaved}`);
  console.log(`Credit note line items inserted:      ${cnLineItemsSaved}`);
  console.log(`Stock adjustments inserted:           ${stockAdjustmentsSaved}`);
  console.log(`Stock adjustment line items inserted: ${saLineItemsSaved}`);

  console.log('\n-- Inspect queries --');
  console.log(`SELECT cin7_id, order_number, status, payment_terms, total_amount, src_modified_at FROM cin7_orders WHERE cin7_id = ${ORDER_ID};`);
  console.log(`SELECT * FROM cin7_order_line_items WHERE order_id = ${ORDER_ID};`);
  console.log(`SELECT cin7_id, first_name, last_name, email, company, credit_limit FROM cin7_contacts WHERE cin7_id = ${CONTACT_ID};`);
  console.log(`SELECT cin7_id, name, code, unit_price, unit_price_tier2, unit_price_tier9, weight, cbm, height, width, depth FROM cin7_products WHERE cin7_id = ${PRODUCT_ID};`);
  console.log(`SELECT cin7_id, name, available, stock_on_hand, weight, cbm, height, width, depth FROM cin7_inventory WHERE cin7_id = ${INVENTORY_ID};`);
  console.log(`SELECT cin7_id, reference, supplier_name, status, total, required_date FROM cin7_purchase_orders WHERE cin7_id = ${PO_ID};`);
  console.log(`SELECT * FROM cin7_purchase_order_line_items WHERE purchase_order_id = ${PO_ID};`);
  console.log(`SELECT cin7_id, reference, member_email, status, total, credit_date FROM cin7_credit_notes WHERE cin7_id = ${CN_ID};`);
  console.log(`SELECT * FROM cin7_credit_note_line_items WHERE credit_note_id = ${CN_ID};`);
  console.log(`SELECT cin7_id, reference, status, note, completed_date FROM cin7_stock_adjustments WHERE cin7_id = ${SA_ID};`);
  console.log(`SELECT * FROM cin7_stock_adjustment_line_items WHERE stock_adjustment_id = ${SA_ID};`);

  console.log('\n-- Cleanup queries --');
  console.log(`DELETE FROM cin7_order_line_items WHERE order_id = ${ORDER_ID};`);
  console.log(`DELETE FROM cin7_orders WHERE cin7_id = ${ORDER_ID};`);
  console.log(`DELETE FROM cin7_contacts WHERE cin7_id = ${CONTACT_ID};`);
  console.log(`DELETE FROM cin7_products WHERE cin7_id = ${PRODUCT_ID};`);
  console.log(`DELETE FROM cin7_inventory WHERE cin7_id = ${INVENTORY_ID};`);
  console.log(`DELETE FROM cin7_purchase_order_line_items WHERE purchase_order_id = ${PO_ID};`);
  console.log(`DELETE FROM cin7_purchase_orders WHERE cin7_id = ${PO_ID};`);
  console.log(`DELETE FROM cin7_credit_note_line_items WHERE credit_note_id = ${CN_ID};`);
  console.log(`DELETE FROM cin7_credit_notes WHERE cin7_id = ${CN_ID};`);
  console.log(`DELETE FROM cin7_stock_adjustment_line_items WHERE stock_adjustment_id = ${SA_ID};`);
  console.log(`DELETE FROM cin7_stock_adjustments WHERE cin7_id = ${SA_ID};`);

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
