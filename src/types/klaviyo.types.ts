// JSON:API wrapper
export interface KlaviyoApiResponse<T> {
  data: Array<{ id: string; type: string; attributes: T }>;
  links: { next: string | null; prev: string | null };
}

// Campaign

export interface KlaviyoCampaignAttributes {
  name: string | null;
  status: string | null;
  // channel is on campaign-message, not campaign. fetchCampaigns stamps it here via _channel
  // after resolving the included campaign-messages relationship.
  _channel: string | null;
  send_time: string | null;
  created_at: string | null;
  updated_at: string | null;
  audiences: unknown | null;
  send_options: unknown | null;
}

export interface KlaviyoCampaignMessageAttributes {
  // As of revision 2026-04-15, channel moved from a top-level attribute to
  // definition.channel (discriminator on the EmailMessageDefinition | SMSMessageDefinition union)
  definition: {
    channel: string | null;
  } | null;
}

export interface KlaviyoCampaign {
  id: string;
  type: string;
  attributes: KlaviyoCampaignAttributes;
  // campaign-message is an included relationship carrying the channel field
  relationships: {
    'campaign-messages': {
      data: Array<{ id: string; type: string }> | null;
    } | null;
  } | null;
}

// Campaign Stats
// revision 2026-04-15: response shape changed — results are now grouped by
// { groupings: { campaign_id, ... }, statistics: { delivered, opens, ... } }

export interface KlaviyoCampaignStatResult {
  groupings: {
    campaign_id: string | null;
    send_channel: string | null;
  };
  statistics: {
    delivered: number | null;
    opens: number | null;
    opens_unique: number | null;
    open_rate: number | null;
    clicks: number | null;
    clicks_unique: number | null;
    click_rate: number | null;
    unsubscribes: number | null;
    bounced: number | null;
    // Only present when KLAVIYO_CONVERSION_METRIC_ID is configured
    conversions?: number | null;
    conversion_rate?: number | null;
    conversion_value?: number | null;
    revenue_per_recipient?: number | null;
  };
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
  value: number | null;          // Klaviyo returns numeric — converted to Prisma.Decimal in transformer
  datetime: string | null;
  metric_name: string | null;    // stamped onto event from included metric resource after fetch
  properties: {
    $attributed_message?: string | null;  // message ID, not campaign ID
    $attributed_flow?: string | null;
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
