export interface GA4DimensionHeader {
  name: string | null;
}

export interface GA4MetricHeader {
  name: string | null;
  type: string | null;
}

export interface GA4DimensionValue {
  value: string | null;
}

export interface GA4MetricValue {
  value: string | null;
}

export interface GA4ReportRow {
  dimensionValues: Array<GA4DimensionValue> | null;
  metricValues: Array<GA4MetricValue> | null;
}

export interface GA4PropertyQuota {
  tokensPerDay: { consumed: number | null; remaining: number | null } | null;
  tokensPerHour: { consumed: number | null; remaining: number | null } | null;
}

export interface GA4ReportResponse {
  rows: Array<GA4ReportRow> | null;
  rowCount: number | null;
  dimensionHeaders: Array<GA4DimensionHeader> | null;
  metricHeaders: Array<GA4MetricHeader> | null;
  propertyQuota: GA4PropertyQuota | null;
}

export interface GA4SessionRow {
  date: string;
  source: string;
  medium: string;
  campaign: string;
  deviceCategory: string;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  pageViews: number;
  engagementSeconds: number;
}

export interface GA4EcommerceEventRow {
  date: string;
  eventName: string;
  source: string;
  medium: string;
  transactions: number;
  revenue: number;
  addToCarts: number;
  checkouts: number;
  viewItemEvents: number;
}

export interface GA4ProductDataRow {
  date: string;
  itemId: string | null;
  itemName: string | null;
  itemBrand: string | null;
  itemCategory: string | null;
  itemListViews: number;
  itemListClicks: number;
  itemViews: number;
  addToCarts: number;
  purchases: number;
  revenue: number;
}
