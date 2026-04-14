// JSON:API wrapper
export interface KlaviyoApiResponse<T> {
  data: Array<{ id: string; type: string; attributes: T }>;
  links: { next: string | null; prev: string | null };
}

// Campaign

export interface KlaviyoCampaignAttributes {
  name: string | null;
  status: string | null;
  channel: string | null;
  send_time: string | null;
  created_at: string | null;
  updated_at: string | null;
  audiences: unknown | null;
  send_options: unknown | null;
}

export interface KlaviyoCampaign {
  id: string;
  type: string;
  attributes: KlaviyoCampaignAttributes;
}

// Campaign Stats

export interface KlaviyoCampaignStatResult {
  campaign_id: string | null;
  delivered: number | null;
  opens: number | null;
  opens_unique: number | null;
  open_rate: number | null;
  clicks: number | null;
  clicks_unique: number | null;
  click_rate: number | null;
  unsubscribes: number | null;
  bounces: number | null;
  conversions: number | null;
  conversion_rate: number | null;
  conversion_value: number | null;
  revenue_per_recipient: number | null;
}

// Profile

export interface KlaviyoProfileAttributes {
  email: string | null;
  phone_number: string | null;
  first_name: string | null;
  last_name: string | null;

  subscriptions: {
    email: { marketing: { consent: string | null } } | null;
    sms: { marketing: { consent: string | null } } | null;
  } | null;

  location: {
    country: string | null;
    city: string | null;
    region: string | null;
    zip: string | null;
    timezone: string | null;
  } | null;

  properties: {
    lifecycle_stage?: string | null;
    signup_source?: string | null;
    [key: string]: unknown;
  } | null;

  created: string | null;
  updated: string | null;
}

export interface KlaviyoProfile {
  id: string;
  type: string;
  attributes: KlaviyoProfileAttributes;
}

// Event

export interface KlaviyoEventAttributes {
  value: number | null;
  datetime: string | null;
  metric_name: string | null;
  properties: {
    $attributed_message?: string | null;
    [key: string]: unknown;
  } | null;
}

// metric_id and profile_id live in relationships, not attributes, per Klaviyo JSON:API spec
export interface KlaviyoEventRelationships {
  metric:  { data: { id: string; type: string } | null } | null;
  profile: { data: { id: string; type: string } | null } | null;
}

export interface KlaviyoEvent {
  id: string;
  type: string;
  attributes: KlaviyoEventAttributes;
  relationships: KlaviyoEventRelationships | null;
}

// Metric (included resource alongside events)

export interface KlaviyoMetricAttributes {
  name: string | null;
}

export interface KlaviyoMetric {
  id: string;
  type: string;
  attributes: KlaviyoMetricAttributes;
}

// Flow

export interface KlaviyoFlowAttributes {
  name: string | null;
  status: string | null;
  archived: boolean | null;
  trigger_type: string | null;
  created: string | null;
  updated: string | null;
}

export interface KlaviyoFlow {
  id: string;
  type: string;
  attributes: KlaviyoFlowAttributes;
}
