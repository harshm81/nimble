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
  source: string | null;
  medium: string | null;
  campaign: string | null;
  deviceCategory: string | null;
  sessions: string | null;
  totalUsers: string | null;
  newUsers: string | null;
  pageViews: string | null;
  engagementSeconds: string | null;
}

export interface GA4EcommerceEventRow {
  date: string;
  eventName: string | null;
  source: string | null;
  medium: string | null;
  transactions: string | null;
  revenue: string | null;
  addToCarts: string | null;
  checkouts: string | null;
  viewItemEvents: string | null;
}

export interface GA4ProductDataRow {
  date: string;
  itemId: string | null;
  itemName: string | null;
  itemBrand: string | null;
  itemCategory: string | null;
  itemListViews: string | null;
  itemListClicks: string | null;
  itemViews: string | null;
  addToCarts: string | null;
  purchases: string | null;
  revenue: string | null;
}
