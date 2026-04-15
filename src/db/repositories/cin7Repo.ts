import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { chunk } from '../../utils/chunk';

export interface OrderInput {
  cin7Id: number;
  orderNumber: string | null;
  customerEmail: string | null;
  cin7MemberId: number | null;
  status: string | null;
  totalAmount: number | null;
  taxTotal: number | null;
  lineItemTotal: number | null;
  shippingTotal: number | null;
  paymentTerms: string | null;
  branchId: number | null;
  currency: string | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface OrderLineItemInput {
  orderId: number;
  cin7LineItemId: number;
  productId: number | null;
  code: string | null;
  name: string | null;
  qty: number | null;
  unitPrice: number | null;
  discount: number | null;
  tax: number | null;
  total: number | null;
  unitCost: number | null;
  lineItemType: string | null;
  sortOrder: number | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  styleCode: string | null;
  barcode: string | null;
  taxRule: string | null;
  accountCode: string | null;
  comment: string | null;
  syncedAt: Date;
}

export interface ContactInput {
  cin7Id: number;
  type: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  company: string | null;
  website: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postCode: string | null;
  country: string | null;
  isActive: boolean | null;
  accountCode: string | null;
  priceTier: string | null;
  discount: number | null;
  creditLimit: number | null;
  currencyCode: string | null;
  taxNumber: string | null;
  taxRule: string | null;
  note: string | null;
  group: string | null;
  memberSince: Date | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface ProductInput {
  cin7Id: number;
  name: string | null;
  code: string | null;
  barcode: string | null;
  category: string | null;
  brand: string | null;
  supplier: string | null;
  supplierId: number | null;
  description: string | null;
  shortDescription: string | null;
  isActive: boolean | null;
  type: string | null;
  option1Name: string | null;
  option2Name: string | null;
  option3Name: string | null;
  unitPrice: number | null;
  unitPriceTier2: number | null;
  unitPriceTier3: number | null;
  unitPriceTier4: number | null;
  unitPriceTier5: number | null;
  unitPriceTier6: number | null;
  unitPriceTier7: number | null;
  unitPriceTier8: number | null;
  unitPriceTier9: number | null;
  unitPriceTier10: number | null;
  costPrice: number | null;
  taxRule: string | null;
  accountCode: string | null;
  purchaseTaxRule: string | null;
  purchaseAccountCode: string | null;
  weight: number | null;
  cbm: number | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface InventoryInput {
  cin7Id: number;
  productId: number | null;
  branchId: number | null;
  code: string | null;
  name: string | null;
  barcode: string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  styleCode: string | null;
  isActive: boolean | null;
  stockOnHand: number | null;
  available: number | null;
  committed: number | null;
  incoming: number | null;
  weight: number | null;
  cbm: number | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  binLocation: string | null;
  reorderPoint: number | null;
  reorderQty: number | null;
  costPrice: number | null;
  unitPrice: number | null;
  rawData: object;
  syncedAt: Date;
}

export interface PurchaseOrderInput {
  cin7Id: number;
  reference: string | null;
  supplierId: number | null;
  supplierName: string | null;
  supplierEmail: string | null;
  status: string | null;
  branchId: number | null;
  taxInclusive: boolean | null;
  subTotal: number | null;
  tax: number | null;
  total: number | null;
  currencyCode: string | null;
  exchangeRate: number | null;
  note: string | null;
  internalNote: string | null;
  shippingCompany: string | null;
  shippingMethod: string | null;
  shippingCost: number | null;
  shippingTax: number | null;
  account: string | null;
  requiredDate: Date | null;
  completedDate: Date | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface CreditNoteInput {
  cin7Id: number;
  reference: string | null;
  memberId: number | null;
  memberEmail: string | null;
  memberName: string | null;
  status: string | null;
  branchId: number | null;
  taxInclusive: boolean | null;
  subTotal: number | null;
  tax: number | null;
  total: number | null;
  currencyCode: string | null;
  exchangeRate: number | null;
  note: string | null;
  internalNote: string | null;
  account: string | null;
  creditDate: Date | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface StockAdjustmentInput {
  cin7Id: number;
  reference: string | null;
  branchId: number | null;
  status: string | null;
  note: string | null;
  completedDate: Date | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface PurchaseOrderLineItemInput {
  purchaseOrderId: number;
  cin7LineItemId: number;
  productId: number | null;
  code: string | null;
  name: string | null;
  qty: number | null;
  unitPrice: number | null;
  discount: number | null;
  tax: number | null;
  total: number | null;
  unitCost: number | null;
  lineItemType: string | null;
  sortOrder: number | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  styleCode: string | null;
  barcode: string | null;
  taxRule: string | null;
  accountCode: string | null;
  comment: string | null;
  syncedAt: Date;
}

export interface CreditNoteLineItemInput {
  creditNoteId: number;
  cin7LineItemId: number;
  productId: number | null;
  code: string | null;
  name: string | null;
  qty: number | null;
  unitPrice: number | null;
  discount: number | null;
  tax: number | null;
  total: number | null;
  unitCost: number | null;
  lineItemType: string | null;
  sortOrder: number | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  styleCode: string | null;
  barcode: string | null;
  taxRule: string | null;
  accountCode: string | null;
  comment: string | null;
  syncedAt: Date;
}

export interface StockAdjustmentLineItemInput {
  stockAdjustmentId: number;
  cin7LineItemId: number;
  productId: number | null;
  code: string | null;
  name: string | null;
  qty: number | null;
  unitPrice: number | null;
  discount: number | null;
  tax: number | null;
  total: number | null;
  unitCost: number | null;
  lineItemType: string | null;
  sortOrder: number | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  styleCode: string | null;
  barcode: string | null;
  taxRule: string | null;
  accountCode: string | null;
  comment: string | null;
  syncedAt: Date;
}

export interface BranchInput {
  cin7Id: number;
  name: string | null;
  code: string | null;
  isActive: boolean | null;
  isDefault: boolean | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  currencyCode: string | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export async function upsertOrders(rows: OrderInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.cin7Id}, ${r.orderNumber}, ${r.customerEmail}, ${r.cin7MemberId}, ${r.status}, ${r.totalAmount}, ${r.taxTotal}, ${r.lineItemTotal}, ${r.shippingTotal}, ${r.paymentTerms}, ${r.branchId}, ${r.currency}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_orders (cin7_id, order_number, customer_email, cin7_member_id, status, total_amount, tax_total, line_item_total, shipping_total, payment_terms, branch_id, currency, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        order_number = VALUES(order_number),
        customer_email = VALUES(customer_email),
        cin7_member_id = VALUES(cin7_member_id),
        status = VALUES(status),
        total_amount = VALUES(total_amount),
        tax_total = VALUES(tax_total),
        line_item_total = VALUES(line_item_total),
        shipping_total = VALUES(shipping_total),
        payment_terms = VALUES(payment_terms),
        branch_id = VALUES(branch_id),
        currency = VALUES(currency),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertOrderLineItems(rows: OrderLineItemInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.orderId}, ${r.cin7LineItemId}, ${r.productId}, ${r.code}, ${r.name}, ${r.qty}, ${r.unitPrice}, ${r.discount}, ${r.tax}, ${r.total}, ${r.unitCost}, ${r.lineItemType}, ${r.sortOrder}, ${r.option1}, ${r.option2}, ${r.option3}, ${r.styleCode}, ${r.barcode}, ${r.taxRule}, ${r.accountCode}, ${r.comment}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_order_line_items (order_id, cin7_line_item_id, product_id, code, name, qty, unit_price, discount, tax, total, unit_cost, line_item_type, sort_order, option1, option2, option3, style_code, barcode, tax_rule, account_code, comment, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        product_id = VALUES(product_id),
        code = VALUES(code),
        name = VALUES(name),
        qty = VALUES(qty),
        unit_price = VALUES(unit_price),
        discount = VALUES(discount),
        tax = VALUES(tax),
        total = VALUES(total),
        unit_cost = VALUES(unit_cost),
        line_item_type = VALUES(line_item_type),
        sort_order = VALUES(sort_order),
        option1 = VALUES(option1),
        option2 = VALUES(option2),
        option3 = VALUES(option3),
        style_code = VALUES(style_code),
        barcode = VALUES(barcode),
        tax_rule = VALUES(tax_rule),
        account_code = VALUES(account_code),
        comment = VALUES(comment),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertContacts(rows: ContactInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.cin7Id}, ${r.type}, ${r.firstName}, ${r.lastName}, ${r.email}, ${r.phone}, ${r.mobile}, ${r.fax}, ${r.company}, ${r.website}, ${r.address1}, ${r.address2}, ${r.city}, ${r.state}, ${r.postCode}, ${r.country}, ${r.isActive}, ${r.accountCode}, ${r.priceTier}, ${r.discount}, ${r.creditLimit}, ${r.currencyCode}, ${r.taxNumber}, ${r.taxRule}, ${r.note}, ${r.group}, ${r.memberSince}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_contacts (cin7_id, type, first_name, last_name, email, phone, mobile, fax, company, website, address1, address2, city, state, post_code, country, is_active, account_code, price_tier, discount, credit_limit, currency_code, tax_number, tax_rule, note, \`group\`, member_since, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        type = VALUES(type),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        email = VALUES(email),
        phone = VALUES(phone),
        mobile = VALUES(mobile),
        fax = VALUES(fax),
        company = VALUES(company),
        website = VALUES(website),
        address1 = VALUES(address1),
        address2 = VALUES(address2),
        city = VALUES(city),
        state = VALUES(state),
        post_code = VALUES(post_code),
        country = VALUES(country),
        is_active = VALUES(is_active),
        account_code = VALUES(account_code),
        price_tier = VALUES(price_tier),
        discount = VALUES(discount),
        credit_limit = VALUES(credit_limit),
        currency_code = VALUES(currency_code),
        tax_number = VALUES(tax_number),
        tax_rule = VALUES(tax_rule),
        note = VALUES(note),
        \`group\` = VALUES(\`group\`),
        member_since = VALUES(member_since),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertProducts(rows: ProductInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.cin7Id}, ${r.name}, ${r.code}, ${r.barcode}, ${r.category}, ${r.brand}, ${r.supplier}, ${r.supplierId}, ${r.description}, ${r.shortDescription}, ${r.isActive}, ${r.type}, ${r.option1Name}, ${r.option2Name}, ${r.option3Name}, ${r.unitPrice}, ${r.unitPriceTier2}, ${r.unitPriceTier3}, ${r.unitPriceTier4}, ${r.unitPriceTier5}, ${r.unitPriceTier6}, ${r.unitPriceTier7}, ${r.unitPriceTier8}, ${r.unitPriceTier9}, ${r.unitPriceTier10}, ${r.costPrice}, ${r.taxRule}, ${r.accountCode}, ${r.purchaseTaxRule}, ${r.purchaseAccountCode}, ${r.weight}, ${r.cbm}, ${r.height}, ${r.width}, ${r.depth}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_products (cin7_id, name, code, barcode, category, brand, supplier, supplier_id, description, short_description, is_active, type, option1_name, option2_name, option3_name, unit_price, unit_price_tier2, unit_price_tier3, unit_price_tier4, unit_price_tier5, unit_price_tier6, unit_price_tier7, unit_price_tier8, unit_price_tier9, unit_price_tier10, cost_price, tax_rule, account_code, purchase_tax_rule, purchase_account_code, weight, cbm, height, width, depth, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        code = VALUES(code),
        barcode = VALUES(barcode),
        category = VALUES(category),
        brand = VALUES(brand),
        supplier = VALUES(supplier),
        supplier_id = VALUES(supplier_id),
        description = VALUES(description),
        short_description = VALUES(short_description),
        is_active = VALUES(is_active),
        type = VALUES(type),
        option1_name = VALUES(option1_name),
        option2_name = VALUES(option2_name),
        option3_name = VALUES(option3_name),
        unit_price = VALUES(unit_price),
        unit_price_tier2 = VALUES(unit_price_tier2),
        unit_price_tier3 = VALUES(unit_price_tier3),
        unit_price_tier4 = VALUES(unit_price_tier4),
        unit_price_tier5 = VALUES(unit_price_tier5),
        unit_price_tier6 = VALUES(unit_price_tier6),
        unit_price_tier7 = VALUES(unit_price_tier7),
        unit_price_tier8 = VALUES(unit_price_tier8),
        unit_price_tier9 = VALUES(unit_price_tier9),
        unit_price_tier10 = VALUES(unit_price_tier10),
        cost_price = VALUES(cost_price),
        tax_rule = VALUES(tax_rule),
        account_code = VALUES(account_code),
        purchase_tax_rule = VALUES(purchase_tax_rule),
        purchase_account_code = VALUES(purchase_account_code),
        weight = VALUES(weight),
        cbm = VALUES(cbm),
        height = VALUES(height),
        width = VALUES(width),
        depth = VALUES(depth),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertInventory(rows: InventoryInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.cin7Id}, ${r.productId}, ${r.branchId}, ${r.code}, ${r.name}, ${r.barcode}, ${r.option1}, ${r.option2}, ${r.option3}, ${r.styleCode}, ${r.isActive}, ${r.stockOnHand}, ${r.available}, ${r.committed}, ${r.incoming}, ${r.weight}, ${r.cbm}, ${r.height}, ${r.width}, ${r.depth}, ${r.binLocation}, ${r.reorderPoint}, ${r.reorderQty}, ${r.costPrice}, ${r.unitPrice}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_inventory (cin7_id, product_id, branch_id, code, name, barcode, option1, option2, option3, style_code, is_active, stock_on_hand, available, committed, incoming, weight, cbm, height, width, depth, bin_location, reorder_point, reorder_qty, cost_price, unit_price, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        product_id = VALUES(product_id),
        branch_id = VALUES(branch_id),
        code = VALUES(code),
        name = VALUES(name),
        barcode = VALUES(barcode),
        option1 = VALUES(option1),
        option2 = VALUES(option2),
        option3 = VALUES(option3),
        style_code = VALUES(style_code),
        is_active = VALUES(is_active),
        stock_on_hand = VALUES(stock_on_hand),
        available = VALUES(available),
        committed = VALUES(committed),
        incoming = VALUES(incoming),
        weight = VALUES(weight),
        cbm = VALUES(cbm),
        height = VALUES(height),
        width = VALUES(width),
        depth = VALUES(depth),
        bin_location = VALUES(bin_location),
        reorder_point = VALUES(reorder_point),
        reorder_qty = VALUES(reorder_qty),
        cost_price = VALUES(cost_price),
        unit_price = VALUES(unit_price),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertPurchaseOrders(rows: PurchaseOrderInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.cin7Id}, ${r.reference}, ${r.supplierId}, ${r.supplierName}, ${r.supplierEmail}, ${r.status}, ${r.branchId}, ${r.taxInclusive}, ${r.subTotal}, ${r.tax}, ${r.total}, ${r.currencyCode}, ${r.exchangeRate}, ${r.note}, ${r.internalNote}, ${r.shippingCompany}, ${r.shippingMethod}, ${r.shippingCost}, ${r.shippingTax}, ${r.account}, ${r.requiredDate}, ${r.completedDate}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_purchase_orders (cin7_id, reference, supplier_id, supplier_name, supplier_email, status, branch_id, tax_inclusive, sub_total, tax, total, currency_code, exchange_rate, note, internal_note, shipping_company, shipping_method, shipping_cost, shipping_tax, account, required_date, completed_date, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        reference = VALUES(reference),
        supplier_id = VALUES(supplier_id),
        supplier_name = VALUES(supplier_name),
        supplier_email = VALUES(supplier_email),
        status = VALUES(status),
        branch_id = VALUES(branch_id),
        tax_inclusive = VALUES(tax_inclusive),
        sub_total = VALUES(sub_total),
        tax = VALUES(tax),
        total = VALUES(total),
        currency_code = VALUES(currency_code),
        exchange_rate = VALUES(exchange_rate),
        note = VALUES(note),
        internal_note = VALUES(internal_note),
        shipping_company = VALUES(shipping_company),
        shipping_method = VALUES(shipping_method),
        shipping_cost = VALUES(shipping_cost),
        shipping_tax = VALUES(shipping_tax),
        account = VALUES(account),
        required_date = VALUES(required_date),
        completed_date = VALUES(completed_date),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertCreditNotes(rows: CreditNoteInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.cin7Id}, ${r.reference}, ${r.memberId}, ${r.memberEmail}, ${r.memberName}, ${r.status}, ${r.branchId}, ${r.taxInclusive}, ${r.subTotal}, ${r.tax}, ${r.total}, ${r.currencyCode}, ${r.exchangeRate}, ${r.note}, ${r.internalNote}, ${r.account}, ${r.creditDate}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_credit_notes (cin7_id, reference, member_id, member_email, member_name, status, branch_id, tax_inclusive, sub_total, tax, total, currency_code, exchange_rate, note, internal_note, account, credit_date, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        reference = VALUES(reference),
        member_id = VALUES(member_id),
        member_email = VALUES(member_email),
        member_name = VALUES(member_name),
        status = VALUES(status),
        branch_id = VALUES(branch_id),
        tax_inclusive = VALUES(tax_inclusive),
        sub_total = VALUES(sub_total),
        tax = VALUES(tax),
        total = VALUES(total),
        currency_code = VALUES(currency_code),
        exchange_rate = VALUES(exchange_rate),
        note = VALUES(note),
        internal_note = VALUES(internal_note),
        account = VALUES(account),
        credit_date = VALUES(credit_date),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertStockAdjustments(rows: StockAdjustmentInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.cin7Id}, ${r.reference}, ${r.branchId}, ${r.status}, ${r.note}, ${r.completedDate}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_stock_adjustments (cin7_id, reference, branch_id, status, note, completed_date, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        reference = VALUES(reference),
        branch_id = VALUES(branch_id),
        status = VALUES(status),
        note = VALUES(note),
        completed_date = VALUES(completed_date),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertPurchaseOrderLineItems(rows: PurchaseOrderLineItemInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.purchaseOrderId}, ${r.cin7LineItemId}, ${r.productId}, ${r.code}, ${r.name}, ${r.qty}, ${r.unitPrice}, ${r.discount}, ${r.tax}, ${r.total}, ${r.unitCost}, ${r.lineItemType}, ${r.sortOrder}, ${r.option1}, ${r.option2}, ${r.option3}, ${r.styleCode}, ${r.barcode}, ${r.taxRule}, ${r.accountCode}, ${r.comment}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_purchase_order_line_items (purchase_order_id, cin7_line_item_id, product_id, code, name, qty, unit_price, discount, tax, total, unit_cost, line_item_type, sort_order, option1, option2, option3, style_code, barcode, tax_rule, account_code, comment, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        product_id = VALUES(product_id),
        code = VALUES(code),
        name = VALUES(name),
        qty = VALUES(qty),
        unit_price = VALUES(unit_price),
        discount = VALUES(discount),
        tax = VALUES(tax),
        total = VALUES(total),
        unit_cost = VALUES(unit_cost),
        line_item_type = VALUES(line_item_type),
        sort_order = VALUES(sort_order),
        option1 = VALUES(option1),
        option2 = VALUES(option2),
        option3 = VALUES(option3),
        style_code = VALUES(style_code),
        barcode = VALUES(barcode),
        tax_rule = VALUES(tax_rule),
        account_code = VALUES(account_code),
        comment = VALUES(comment),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertCreditNoteLineItems(rows: CreditNoteLineItemInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.creditNoteId}, ${r.cin7LineItemId}, ${r.productId}, ${r.code}, ${r.name}, ${r.qty}, ${r.unitPrice}, ${r.discount}, ${r.tax}, ${r.total}, ${r.unitCost}, ${r.lineItemType}, ${r.sortOrder}, ${r.option1}, ${r.option2}, ${r.option3}, ${r.styleCode}, ${r.barcode}, ${r.taxRule}, ${r.accountCode}, ${r.comment}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_credit_note_line_items (credit_note_id, cin7_line_item_id, product_id, code, name, qty, unit_price, discount, tax, total, unit_cost, line_item_type, sort_order, option1, option2, option3, style_code, barcode, tax_rule, account_code, comment, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        product_id = VALUES(product_id),
        code = VALUES(code),
        name = VALUES(name),
        qty = VALUES(qty),
        unit_price = VALUES(unit_price),
        discount = VALUES(discount),
        tax = VALUES(tax),
        total = VALUES(total),
        unit_cost = VALUES(unit_cost),
        line_item_type = VALUES(line_item_type),
        sort_order = VALUES(sort_order),
        option1 = VALUES(option1),
        option2 = VALUES(option2),
        option3 = VALUES(option3),
        style_code = VALUES(style_code),
        barcode = VALUES(barcode),
        tax_rule = VALUES(tax_rule),
        account_code = VALUES(account_code),
        comment = VALUES(comment),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertStockAdjustmentLineItems(rows: StockAdjustmentLineItemInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.stockAdjustmentId}, ${r.cin7LineItemId}, ${r.productId}, ${r.code}, ${r.name}, ${r.qty}, ${r.unitPrice}, ${r.discount}, ${r.tax}, ${r.total}, ${r.unitCost}, ${r.lineItemType}, ${r.sortOrder}, ${r.option1}, ${r.option2}, ${r.option3}, ${r.styleCode}, ${r.barcode}, ${r.taxRule}, ${r.accountCode}, ${r.comment}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_stock_adjustment_line_items (stock_adjustment_id, cin7_line_item_id, product_id, code, name, qty, unit_price, discount, tax, total, unit_cost, line_item_type, sort_order, option1, option2, option3, style_code, barcode, tax_rule, account_code, comment, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        product_id = VALUES(product_id),
        code = VALUES(code),
        name = VALUES(name),
        qty = VALUES(qty),
        unit_price = VALUES(unit_price),
        discount = VALUES(discount),
        tax = VALUES(tax),
        total = VALUES(total),
        unit_cost = VALUES(unit_cost),
        line_item_type = VALUES(line_item_type),
        sort_order = VALUES(sort_order),
        option1 = VALUES(option1),
        option2 = VALUES(option2),
        option3 = VALUES(option3),
        style_code = VALUES(style_code),
        barcode = VALUES(barcode),
        tax_rule = VALUES(tax_rule),
        account_code = VALUES(account_code),
        comment = VALUES(comment),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertBranches(rows: BranchInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.cin7Id}, ${r.name}, ${r.code}, ${r.isActive}, ${r.isDefault}, ${r.address1}, ${r.address2}, ${r.city}, ${r.state}, ${r.postCode}, ${r.country}, ${r.phone}, ${r.email}, ${r.currencyCode}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO cin7_branches (cin7_id, name, code, is_active, is_default, address1, address2, city, state, post_code, country, phone, email, currency_code, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        code = VALUES(code),
        is_active = VALUES(is_active),
        is_default = VALUES(is_default),
        address1 = VALUES(address1),
        address2 = VALUES(address2),
        city = VALUES(city),
        state = VALUES(state),
        post_code = VALUES(post_code),
        country = VALUES(country),
        phone = VALUES(phone),
        email = VALUES(email),
        currency_code = VALUES(currency_code),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}
