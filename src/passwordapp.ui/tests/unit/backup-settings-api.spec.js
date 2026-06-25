import { describe, it, expect } from 'vitest';
import {
  defaultBackupSettings,
  normalizeBackupSettings,
  getBackupSettings,
  putBackupSettings,
  runBackupNow,
} from '@/components/api/BackupSettings.Api.js';

describe('backup settings API helper', () => {
  it('normalizes PascalCase server settings', () => {
    const normalized = normalizeBackupSettings({
      Enabled: true,
      Frequency: 'weekly',
      TimeOfDay: '23:15',
      TimeZoneId: 'UTC',
      DayOfWeek: 4,
      DayOfMonth: 12,
      RetentionCount: 10,
      LastStatus: 'Backed up 10 document(s).',
    });

    expect(normalized).toMatchObject({
      enabled: true,
      frequency: 'weekly',
      timeOfDay: '23:15',
      dayOfWeek: 4,
      dayOfMonth: 12,
      retentionCount: 10,
      lastStatus: 'Backed up 10 document(s).',
    });
  });

  it('returns defaults for empty records', () => {
    expect(normalizeBackupSettings(null)).toEqual(defaultBackupSettings());
  });

  it('GETs /api/backup-settings', async () => {
    const http = {
      async get(url) {
        return { data: { Enabled: true, Frequency: 'daily', TimeOfDay: '01:00' }, url };
      },
    };

    await expect(getBackupSettings(http)).resolves.toMatchObject({ enabled: true, timeOfDay: '01:00' });
  });

  it('PUTs normalized server payload', async () => {
    const sent = [];
    const http = {
      async put(url, body) {
        sent.push({ url, body });
        return { data: body };
      },
    };

    await putBackupSettings({ enabled: true, frequency: 'monthly', dayOfMonth: '15', retentionCount: '20' }, http);

    expect(sent).toEqual([{
      url: '/api/backup-settings',
      body: {
        Enabled: true,
        Frequency: 'monthly',
        TimeOfDay: '02:00',
        TimeZoneId: 'UTC',
        DayOfWeek: 0,
        DayOfMonth: 15,
        RetentionCount: 20,
      },
    }]);
  });

  it('POSTs run-now backup requests', async () => {
    const sent = [];
    const http = {
      async post(url) {
        sent.push(url);
        return { data: { LastStatus: 'Backed up 2 document(s).' } };
      },
    };

    await expect(runBackupNow(http)).resolves.toMatchObject({ lastStatus: 'Backed up 2 document(s).' });
    expect(sent).toEqual(['/api/backup-settings/run-now']);
  });
});
