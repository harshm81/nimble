import { FacebookAdsetInsightRaw, FacebookListResponse } from '../../types/facebook.types';
import { createFacebookClient, facebookGet } from './facebookClient';
import { sleep } from '../../utils/sleep';

export async function fetchAdsetInsights(date: string): Promise<FacebookAdsetInsightRaw[]> {
  const client = createFacebookClient();

  const baseParams: Record<string, string> = {
    level:          'adset',
    fields:         'adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,actions,action_values,date_start',
    time_range:     JSON.stringify({ since: date, until: date }),
    time_increment: '1',
    limit:          '100',
  };

  const initial = await facebookGet<{ async_status?: string; report_run_id?: string } & FacebookListResponse<FacebookAdsetInsightRaw>>(
    client,
    `/act_${client.adAccountId}/insights`,
    baseParams,
  );

  if (initial.async_status === 'Job Running') {
    const jobId = initial.report_run_id;
    if (!jobId) throw new Error('Facebook async insights job started but report_run_id is missing');

    let status = await facebookGet<{ async_status: string; async_percent_completion: number }>(client, `/${jobId}`);
    while (status.async_status === 'Job Running' || status.async_status === 'Job Not Started') {
      await sleep(5000);
      status = await facebookGet<{ async_status: string; async_percent_completion: number }>(client, `/${jobId}`);
    }

    if (status.async_status === 'Job Failed') {
      throw new Error(`Facebook async report job ${jobId} failed`);
    }

    const results: FacebookAdsetInsightRaw[] = [];
    let after: string | null = null;

    do {
      const params: Record<string, string> = after ? { after } : {};

      const page: FacebookListResponse<FacebookAdsetInsightRaw> = await facebookGet<FacebookListResponse<FacebookAdsetInsightRaw>>(
        client,
        `/${jobId}/insights`,
        params,
      );

      results.push(...page.data);
      after = page.paging?.cursors?.after ?? null;
    } while (after);

    return results;
  }

  const results: FacebookAdsetInsightRaw[] = [];
  let after: string | null = null;

  let currentPage: FacebookListResponse<FacebookAdsetInsightRaw> = initial;

  do {
    results.push(...currentPage.data);
    after = currentPage.paging?.cursors?.after ?? null;

    if (after) {
      currentPage = await facebookGet<FacebookListResponse<FacebookAdsetInsightRaw>>(
        client,
        `/act_${client.adAccountId}/insights`,
        { ...baseParams, after },
      );
    }
  } while (after);

  return results;
}
