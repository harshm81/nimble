# Klaviyo Integration — Client Discussion Questions


---

Klaviyo platform shows 1376 campaigns but we only have 1336 records in our database.
The reason is our integration currently fetches only "email" channel campaigns.
The remaining 40 campaigns are SMS campaigns which we are not fetching.

Do you want us to sync SMS campaigns as well, or only email campaigns?


---

Currently the klaviyo_campaign_stats table has only 41 records out of 1336 campaigns.
The reason is we are only fetching stats for the last 90 days (from 2026-01-17 to now).
Campaigns sent before January 17, 2026 are not getting any stats data.
Our database has campaigns going all the way back to 2018-11-21.

Do you want campaign stats for ALL campaigns (full history from 2018)?
Or is the last 90 days enough for your reporting needs?


---

How the campaign stats job works:
- Step 1: CAMPAIGNS job runs first and fetches all email campaigns from Klaviyo and inserts into klaviyo_campaigns table
- Step 2: After campaigns job completes successfully, it automatically triggers the CAMPAIGN_STATS job
- Step 3: CAMPAIGN_STATS job reads all campaign IDs from our database and then calls the Klaviyo API to get stats (opens, clicks, delivery, etc.) for those campaigns
- Step 4: Stats are fetched in batches of 100 campaigns at a time with a 35-second wait between each batch (this is required by Klaviyo API rate limit of 2 requests per minute)
- Step 5: Stats are inserted into klaviyo_campaign_stats table

So currently the stats table is mostly empty because of the 90-day date window issue mentioned above. Once we fix that window, all campaigns will get their stats.


---

Currently our klaviyo_profiles, klaviyo_events, and klaviyo_flows tables have 0 records.
These jobs (Profiles, Events, Flows) have not been triggered yet.
The cron schedules for all Klaviyo jobs are currently disabled and jobs need to be triggered manually from the Bull Board dashboard.

Do you want us to enable automatic scheduling for all Klaviyo jobs?
If yes, we will enable cron schedules for:
- Campaigns: daily at 5:00 AM
- Profiles: every 6 hours
- Events: every hour at :40
- Flows: daily at 5:05 AM


---

For campaign stats, Klaviyo supports conversion metrics (conversions, conversion rate, revenue per recipient).
To get this data, we need a Klaviyo Conversion Metric ID configured in our environment.
Currently this is not configured, so conversion-related columns in klaviyo_campaign_stats will be empty (null).

Do you want to track conversion stats? If yes, please provide the Klaviyo Conversion Metric ID from your Klaviyo account.


---

For Klaviyo Events (email click events, purchase events), Klaviyo can return all event types or we can filter to specific ones.
Currently the integration supports filtering by event type (e.g. "Placed Order", "Opened Email", "Clicked Email").
If no filter is set, all event types will be fetched which could be a very large amount of data.

Which specific event types do you want to sync?
For example: Placed Order, Ordered Product, Opened Email, Clicked Email, etc.


---

The Klaviyo campaign stats API (campaign-values-reports) has a strict rate limit of 2 requests per minute.
With 1336 campaigns divided into batches of 100, that means 14 batches total.
Each batch waits 35 seconds before the next one, so the campaign stats job takes approximately 8 minutes to complete each run.

Is this acceptable for your reporting schedule?


---

Currently we only store the channel field on campaigns (email or SMS).
We do not sync campaign message content, subject lines, or preview text.

Do you need this additional campaign content data stored in the database?
