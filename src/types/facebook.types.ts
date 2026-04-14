export interface FacebookCampaignRaw {
  id:           string | null;
  name:         string | null;
  status:       string | null;
  objective:    string | null;
  created_time: string | null;
  updated_time: string | null;
}

export interface FacebookAdsetRaw {
  id:              string | null;
  name:            string | null;
  campaign_id:     string | null;
  status:          string | null;
  daily_budget:    string | null;
  lifetime_budget: string | null;
  created_time:    string | null;
  updated_time:    string | null;
}

export interface FacebookAdRaw {
  id:           string | null;
  name:         string | null;
  adset_id:     string | null;
  campaign_id:  string | null;
  status:       string | null;
  created_time: string | null;
  updated_time: string | null;
}

export interface FacebookAction {
  action_type: string | null;
  value:       string | null;
}

export interface FacebookCampaignInsightRaw {
  campaign_id:   string | null;
  campaign_name: string | null;
  date_start:    string | null;
  spend:         string | null;
  impressions:   string | null;
  clicks:        string | null;
  reach:         string | null;
  frequency:     string | null;
  ctr:           string | null;
  cpc:           string | null;
  cpm:           string | null;
  actions:       FacebookAction[] | null;
  action_values: FacebookAction[] | null;
}

export interface FacebookAdsetInsightRaw {
  adset_id:      string | null;
  adset_name:    string | null;
  campaign_id:   string | null;
  campaign_name: string | null;
  date_start:    string | null;
  spend:         string | null;
  impressions:   string | null;
  clicks:        string | null;
  reach:         string | null;
  frequency:     string | null;
  ctr:           string | null;
  cpc:           string | null;
  cpm:           string | null;
  actions:       FacebookAction[] | null;
  action_values: FacebookAction[] | null;
}

export interface FacebookAdInsightRaw {
  ad_id:         string | null;
  ad_name:       string | null;
  adset_id:      string | null;
  adset_name:    string | null;
  campaign_id:   string | null;
  campaign_name: string | null;
  date_start:    string | null;
  spend:         string | null;
  impressions:   string | null;
  clicks:        string | null;
  reach:         string | null;
  ctr:           string | null;
  cpc:           string | null;
  cpm:           string | null;
  actions:       FacebookAction[] | null;
  action_values: FacebookAction[] | null;
}

export interface FacebookPagingCursors {
  after:  string | null;
  before: string | null;
}

export interface FacebookPaging {
  cursors: FacebookPagingCursors | null;
  next:    string | null;
}

export interface FacebookListResponse<T> {
  data:   T[];
  paging: FacebookPaging | null;
}
