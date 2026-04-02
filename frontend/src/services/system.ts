import request from './request'

export interface SyncStatusResult {
  current_parquet_dir: string
  latest_version: {
    version: string
    parquet_dir: string
    synced_at: string | null
  } | null
  latest_sync_job: {
    version?: string
    status?: string
    error_msg?: string | null
    started_at?: string | null
    updated_at?: string | null
    msg?: string
  } | null
  next_sync: string
}

export const systemApi = {
  getSyncStatus: () =>
    request.get<any, any>('/system/sync-status').then((r) => r.data.data as SyncStatusResult),
}
