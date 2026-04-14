import { config } from '../../config';
import { FACEBOOK_PLATFORM, FACEBOOK_BASE_URL } from '../../constants/facebook';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';

export interface FacebookClientOptions {
  accessToken: string;
  adAccountId: string;
}

export function createFacebookClient(): FacebookClientOptions {
  return {
    accessToken: config.FACEBOOK_ACCESS_TOKEN ?? '',
    adAccountId: config.FACEBOOK_AD_ACCOUNT_ID ?? '',
  };
}

export async function facebookGet<T>(
  client: FacebookClientOptions,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${FACEBOOK_BASE_URL}${path}`);
  url.searchParams.set('access_token', client.accessToken);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());

  const usageHeader = response.headers.get('x-business-use-case-usage');
  if (usageHeader) {
    try {
      const usage = JSON.parse(usageHeader) as Record<string, Array<{ call_count: number; total_cputime: number; total_time: number; type: string; estimated_time_to_regain_access: number }>>;
      for (const [accountId, entries] of Object.entries(usage)) {
        for (const entry of entries) {
          if (entry.call_count > 75 || entry.total_cputime > 75 || entry.total_time > 75) {
            const waitSeconds = entry.estimated_time_to_regain_access > 0 ? entry.estimated_time_to_regain_access * 60 : 30;
            logger.warn({ platform: FACEBOOK_PLATFORM, accountId, usage: entry, waitSeconds }, 'Facebook rate limit usage high — throttling');
            await sleep(waitSeconds * 1000);
          } else {
            logger.debug({ platform: FACEBOOK_PLATFORM, accountId, usage: entry }, 'Facebook rate limit usage');
          }
        }
      }
    } catch {
      // header parse failure is non-fatal
    }
  }

  const body = await response.json() as { error?: { code: number; message: string } } & T;

  if (body.error) {
    if (body.error.code === 190) {
      logger.fatal(
        { platform: FACEBOOK_PLATFORM, errorCode: 190, message: body.error.message },
        'Facebook token invalid — stop retrying',
      );
    } else {
      logger.error(
        { platform: FACEBOOK_PLATFORM, errorCode: body.error.code, message: body.error.message },
        'Facebook API error',
      );
    }
    throw new Error(`Facebook API error ${body.error.code}: ${body.error.message}`);
  }

  return body;
}
