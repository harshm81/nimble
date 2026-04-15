import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { chunk } from '../../utils/chunk';

export interface SessionInput {
  propertyId: string;
  reportDate: Date;
  source: string;
  medium: string;
  campaign: string;
  deviceCategory: string;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  pageViews: number;
  engagementSeconds: number;
  newVsReturning: string | null;
  rawData: object;
  syncedAt: Date;
}

export interface EcommerceEventInput {
  propertyId: string;
  reportDate: Date;
  eventName: string;
  source: string;
  medium: string;
  transactions: number;
  revenue: Prisma.Decimal;
  addToCarts: number;
  checkouts: number;
  rawData: object;
  syncedAt: Date;
}

export interface ProductDataInput {
  propertyId: string;
  reportDate: Date;
  itemId: string;         // never null — use '(not set)' sentinel; NULL breaks unique index
  itemName: string;       // never null — use '(not set)' sentinel; NULL breaks unique index
  itemBrand: string | null;
  itemCategory: string | null;
  itemListViews: number;
  itemListClicks: number;
  itemViews: number;
  addToCarts: number;
  purchases: number;
  revenue: Prisma.Decimal;
  rawData: object;
  syncedAt: Date;
}

export async function upsertSessions(rows: SessionInput[]): Promise<number> {
  if (!rows.length) return 0;

  let total = 0;

  for (const batch of chunk(rows, 200)) {
    const values = batch.map((r) => Prisma.sql`
      (${r.propertyId}, ${r.reportDate}, ${r.source}, ${r.medium}, ${r.campaign}, ${r.deviceCategory},
       ${r.sessions}, ${r.totalUsers}, ${r.newUsers}, ${r.pageViews}, ${r.engagementSeconds},
       ${r.newVsReturning}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})
    `);

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO ga4_sessions
      (property_id, report_date, source, medium, campaign, device_category,
       sessions, total_users, new_users, page_views, engagement_seconds,
       new_vs_returning, raw_data, synced_at)
      VALUES ${Prisma.join(values)}
      ON DUPLICATE KEY UPDATE
        sessions = VALUES(sessions),
        total_users = VALUES(total_users),
        new_users = VALUES(new_users),
        page_views = VALUES(page_views),
        engagement_seconds = VALUES(engagement_seconds),
        new_vs_returning = VALUES(new_vs_returning),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `);

    total += batch.length;
  }

  return total;
}

export async function upsertEcommerceEvents(rows: EcommerceEventInput[]): Promise<number> {
  if (!rows.length) return 0;

  let total = 0;

  for (const batch of chunk(rows, 200)) {
    const values = batch.map((r) => Prisma.sql`
      (${r.propertyId}, ${r.reportDate}, ${r.eventName}, ${r.source}, ${r.medium},
       ${r.transactions}, ${r.revenue}, ${r.addToCarts}, ${r.checkouts},
       ${JSON.stringify(r.rawData)}, ${r.syncedAt})
    `);

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO ga4_ecommerce_events
      (property_id, report_date, event_name, source, medium,
       transactions, revenue, add_to_carts, checkouts,
       raw_data, synced_at)
      VALUES ${Prisma.join(values)}
      ON DUPLICATE KEY UPDATE
        transactions = VALUES(transactions),
        revenue = VALUES(revenue),
        add_to_carts = VALUES(add_to_carts),
        checkouts = VALUES(checkouts),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `);

    total += batch.length;
  }

  return total;
}

export async function upsertProductData(rows: ProductDataInput[]): Promise<number> {
  if (!rows.length) return 0;

  let total = 0;

  for (const batch of chunk(rows, 200)) {
    const values = batch.map((r) => Prisma.sql`
      (${r.propertyId}, ${r.reportDate}, ${r.itemId}, ${r.itemName}, ${r.itemBrand}, ${r.itemCategory},
       ${r.itemListViews}, ${r.itemListClicks}, ${r.itemViews}, ${r.addToCarts}, ${r.purchases}, ${r.revenue},
       ${JSON.stringify(r.rawData)}, ${r.syncedAt})
    `);

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO ga4_product_data
      (property_id, report_date, item_id, item_name, item_brand, item_category,
       item_list_views, item_list_clicks, item_views, add_to_carts, purchases, revenue,
       raw_data, synced_at)
      VALUES ${Prisma.join(values)}
      ON DUPLICATE KEY UPDATE
        item_brand = VALUES(item_brand),
        item_category = VALUES(item_category),
        item_list_views = VALUES(item_list_views),
        item_list_clicks = VALUES(item_list_clicks),
        item_views = VALUES(item_views),
        add_to_carts = VALUES(add_to_carts),
        purchases = VALUES(purchases),
        revenue = VALUES(revenue),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `);

    total += batch.length;
  }

  return total;
}
