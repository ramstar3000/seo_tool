import { createClient, type ClickHouseClient } from '@clickhouse/client';
import {
  getClickHouseDatabase,
  getClickHousePassword,
  getClickHouseUrl,
  getClickHouseUser,
  hasClickHouseConfig,
} from '@/lib/env';

export { hasClickHouseConfig };


/** JSONEachRow-safe DateTime64(3) for inserts (ISO `Z` can fail on some ClickHouse builds). */
export function formatClickHouseDateTime64(date: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
}

let client: ClickHouseClient | null = null;

export function getClickHouseClient(): ClickHouseClient | null {
  if (!hasClickHouseConfig()) return null;

  if (!client) {
    client = createClient({
      url: getClickHouseUrl()!,
      username: getClickHouseUser(),
      password: getClickHousePassword(),
      database: getClickHouseDatabase(),
      application: 'synapsecro',
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
      },
    });
  }

  return client;
}

export async function pingClickHouse(): Promise<boolean> {
  const ch = getClickHouseClient();
  if (!ch) return false;

  try {
    const result = await ch.ping();
    return result.success === true;
  } catch {
    return false;
  }
}
