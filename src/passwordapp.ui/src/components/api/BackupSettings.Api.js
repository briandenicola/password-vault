import Axios from 'axios';

const API_ENDPOINT = '/api/backup-settings';

export const defaultBackupSettings = () => ({
  enabled: false,
  frequency: 'daily',
  timeOfDay: '02:00',
  timeZoneId: 'UTC',
  dayOfWeek: 0,
  dayOfMonth: 1,
  retentionCount: 30,
  lastBackupAt: null,
  lastBackupBlobName: '',
  lastCheckedAt: null,
  lastStatus: 'Not configured',
  lastError: '',
});

export function normalizeBackupSettings(record) {
  const defaults = defaultBackupSettings();
  if (!record) {
    return defaults;
  }

  return {
    enabled: record.enabled ?? record.Enabled ?? defaults.enabled,
    frequency: record.frequency ?? record.Frequency ?? defaults.frequency,
    timeOfDay: record.timeOfDay ?? record.TimeOfDay ?? defaults.timeOfDay,
    timeZoneId: record.timeZoneId ?? record.TimeZoneId ?? defaults.timeZoneId,
    dayOfWeek: record.dayOfWeek ?? record.DayOfWeek ?? defaults.dayOfWeek,
    dayOfMonth: record.dayOfMonth ?? record.DayOfMonth ?? defaults.dayOfMonth,
    retentionCount: record.retentionCount ?? record.RetentionCount ?? defaults.retentionCount,
    lastBackupAt: record.lastBackupAt ?? record.LastBackupAt ?? defaults.lastBackupAt,
    lastBackupBlobName: record.lastBackupBlobName ?? record.LastBackupBlobName ?? defaults.lastBackupBlobName,
    lastCheckedAt: record.lastCheckedAt ?? record.LastCheckedAt ?? defaults.lastCheckedAt,
    lastStatus: record.lastStatus ?? record.LastStatus ?? defaults.lastStatus,
    lastError: record.lastError ?? record.LastError ?? defaults.lastError,
  };
}

function toServerRecord(settings) {
  const normalized = normalizeBackupSettings(settings);
  return {
    Enabled: Boolean(normalized.enabled),
    Frequency: normalized.frequency,
    TimeOfDay: normalized.timeOfDay,
    TimeZoneId: normalized.timeZoneId,
    DayOfWeek: Number(normalized.dayOfWeek),
    DayOfMonth: Number(normalized.dayOfMonth),
    RetentionCount: Number(normalized.retentionCount),
  };
}

export async function getBackupSettings(http = Axios) {
  const response = await http.get(API_ENDPOINT);
  return normalizeBackupSettings(response.data);
}

export async function putBackupSettings(settings, http = Axios) {
  const response = await http.put(API_ENDPOINT, toServerRecord(settings));
  return normalizeBackupSettings(response.data);
}

export async function runBackupNow(http = Axios) {
  const response = await http.post(`${API_ENDPOINT}/run-now`);
  return normalizeBackupSettings(response.data);
}
