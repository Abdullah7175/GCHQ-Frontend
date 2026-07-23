import { City } from './api';

type Entity = Record<string, unknown>;
type RefData = {
  cities: City[];
  providers: Entity[];
  hospitals: Entity[];
  sectors: Entity[];
  paramedics: Entity[];
};

export interface AdminColumnDef {
  key: string;
  label: string;
  value: (item: Entity, refs: RefData) => unknown;
}

function lookupRef(refs: RefData, list: keyof RefData, id?: string): string {
  if (!id) return '—';
  const items = refs[list] as Entity[];
  const found = items.find((x) => x.id === id);
  if (!found) return '—';
  return String(found.name || found.unitNumber || found.code || '—');
}

function relLabel(
  item: Entity,
  rel: string,
  idKey: string,
  refs: RefData,
  refList?: keyof RefData,
): string {
  const nested = item[rel] as Entity | null | undefined;
  if (nested && typeof nested === 'object') {
    return String(nested.name || nested.unitNumber || nested.code || '—');
  }
  if (refList) return lookupRef(refs, refList, item[idKey] as string | undefined);
  return '—';
}

export const ADMIN_TABLE_COLUMNS: Record<string, AdminColumnDef[]> = {
  cities: [
    { key: 'name', label: 'Name', value: (i) => i.name },
    { key: 'code', label: 'Code', value: (i) => i.code },
    { key: 'province', label: 'Province', value: (i) => i.province },
    { key: 'country', label: 'Country', value: (i) => i.country },
    {
      key: 'mapCenter',
      label: 'Map center',
      value: (i) =>
        i.mapCenterLat != null && i.mapCenterLng != null
          ? `${Number(i.mapCenterLat).toFixed(4)}, ${Number(i.mapCenterLng).toFixed(4)}`
          : '—',
    },
    { key: 'isActive', label: 'Active', value: (i) => (i.isActive ? 'Yes' : 'No') },
  ],
  providers: [
    { key: 'name', label: 'Name', value: (i) => i.name },
    { key: 'code', label: 'Code', value: (i) => i.code },
    { key: 'markerLetter', label: 'Marker', value: (i) => i.markerLetter },
    { key: 'shape', label: 'Shape', value: (i) => i.shape },
    { key: 'color', label: 'Color', value: (i) => i.color },
    { key: 'description', label: 'Description', value: (i) => i.description },
  ],
  sectors: [
    { key: 'name', label: 'Name', value: (i) => i.name },
    { key: 'code', label: 'Code', value: (i) => i.code },
    { key: 'city', label: 'City', value: (i, refs) => relLabel(i, 'city', 'cityId', refs, 'cities') },
    { key: 'gridStatus', label: 'Grid', value: (i) => i.gridStatus },
    { key: 'color', label: 'Color', value: (i) => i.color },
  ],
  hospitals: [
    { key: 'name', label: 'Name', value: (i) => i.name },
    { key: 'city', label: 'City', value: (i, refs) => relLabel(i, 'city', 'cityId', refs, 'cities') },
    { key: 'sector', label: 'Sector', value: (i, refs) => relLabel(i, 'sector', 'sectorId', refs, 'sectors') },
    {
      key: 'emergencyTypes',
      label: 'Categories',
      value: (i) => Array.isArray(i.emergencyTypes)
        ? (i.emergencyTypes as { name?: string }[]).map((t) => t.name).filter(Boolean).join(', ')
        : '',
    },
    { key: 'address', label: 'Address', value: (i) => i.address },
    { key: 'latitude', label: 'Latitude', value: (i) => i.latitude },
    { key: 'longitude', label: 'Longitude', value: (i) => i.longitude },
  ],
  'emergency-types': [
    { key: 'name', label: 'Name', value: (i) => i.name },
    { key: 'code', label: 'Code', value: (i) => i.code },
    { key: 'severityLevel', label: 'Severity', value: (i) => i.severityLevel },
    { key: 'description', label: 'Description', value: (i) => i.description },
  ],
  'triage-codes': [
    { key: 'name', label: 'Name', value: (i) => i.name },
    { key: 'code', label: 'Code', value: (i) => i.code },
    { key: 'color', label: 'Color', value: (i) => i.color },
    { key: 'priority', label: 'Priority', value: (i) => i.priority },
    { key: 'description', label: 'Description', value: (i) => i.description },
  ],
  users: [
    { key: 'name', label: 'Name', value: (i) => i.name },
    { key: 'email', label: 'Email', value: (i) => i.email },
    { key: 'role', label: 'Role', value: (i) => i.role },
    { key: 'city', label: 'City', value: (i, refs) => relLabel(i, 'city', 'cityId', refs, 'cities') },
    { key: 'hospital', label: 'Hospital', value: (i, refs) => relLabel(i, 'hospital', 'hospitalId', refs, 'hospitals') },
    { key: 'provider', label: 'Provider', value: (i, refs) => relLabel(i, 'provider', 'providerId', refs, 'providers') },
    { key: 'sector', label: 'Sector', value: (i, refs) => relLabel(i, 'sector', 'sectorId', refs, 'sectors') },
    {
      key: 'permittedSectorIds',
      label: 'Sector Scope',
      value: (i) => Array.isArray(i.permittedSectorIds)
        ? `${i.permittedSectorIds.length} sector(s)`
        : '—',
    },
  ],
  ambulances: [
    { key: 'unitNumber', label: 'Unit', value: (i) => i.unitNumber },
    { key: 'city', label: 'City', value: (i, refs) => relLabel(i, 'city', 'cityId', refs, 'cities') },
    { key: 'provider', label: 'Provider', value: (i, refs) => relLabel(i, 'provider', 'providerId', refs, 'providers') },
    { key: 'status', label: 'Status', value: (i) => i.status },
    {
      key: 'assignedDrivers',
      label: 'Shift Drivers',
      value: (i) => Array.isArray(i.assignedDrivers)
        ? (i.assignedDrivers as { name?: string }[]).map((driver) => driver.name).filter(Boolean).join(', ')
        : '',
    },
    { key: 'driver', label: 'Active Driver', value: (i, refs) => relLabel(i, 'driver', 'driverId', refs) },
    {
      key: 'currentLat',
      label: 'Lat',
      value: (i) => (i.currentLat != null && i.currentLat !== '' ? Number(i.currentLat).toFixed(6) : null),
    },
    {
      key: 'currentLng',
      label: 'Lng',
      value: (i) => (i.currentLng != null && i.currentLng !== '' ? Number(i.currentLng).toFixed(6) : null),
    },
    {
      key: 'currentSpeed',
      label: 'Speed',
      value: (i) => (i.currentSpeed != null && i.currentSpeed !== '' ? Number(i.currentSpeed).toFixed(2) : '0.00'),
    },
  ],
  transits: [
    { key: 'transitId', label: 'Case ID', value: (i) => i.transitId },
    { key: 'status', label: 'Status', value: (i) => i.status },
    { key: 'city', label: 'City', value: (i, refs) => relLabel(i, 'city', 'cityId', refs, 'cities') },
    { key: 'ambulance', label: 'Unit', value: (i, refs) => relLabel(i, 'ambulance', 'ambulanceId', refs) },
    { key: 'hospital', label: 'Hospital', value: (i, refs) => relLabel(i, 'hospital', 'hospitalId', refs, 'hospitals') },
    { key: 'sector', label: 'Sector', value: (i, refs) => relLabel(i, 'sector', 'sectorId', refs, 'sectors') },
    {
      key: 'triage',
      label: 'Triage',
      value: (i) => {
        const t = i.triageCode as Entity | null | undefined;
        return t?.code || t?.name || '—';
      },
    },
    {
      key: 'emergency',
      label: 'Emergency',
      value: (i) => {
        const e = i.emergencyType as Entity | null | undefined;
        return e?.name || e?.code || '—';
      },
    },
    {
      key: 'claimedBy',
      label: 'Claimed by',
      value: (i) => {
        const u = i.claimedBy as Entity | null | undefined;
        return u?.name || '—';
      },
    },
    {
      key: 'hospitalChoiceConsent',
      label: 'Consent',
      value: (i) => {
        const v = String(i.hospitalChoiceConsent || '');
        if (v === 'pc') return 'PC — Patient Choice';
        if (v === 'ac') return 'AC — Ambulance Choice';
        return '—';
      },
    },
    {
      key: 'distance',
      label: 'Distance',
      value: (i) => {
        const m = i.routeDistanceMeters ?? i.totalDistanceMeters;
        if (m == null || m === '') return '—';
        const km = Number(m) / 1000;
        return Number.isFinite(km) ? `${km.toFixed(1)} km` : '—';
      },
    },
    { key: 'etaMinutes', label: 'ETA', value: (i) => (i.etaMinutes != null ? `${i.etaMinutes}m` : '—') },
  ],
  'audit-logs': [
    {
      key: 'createdAt',
      label: 'Time',
      value: (i) => i.createdAt ? new Date(String(i.createdAt)).toLocaleString() : '—',
    },
    { key: 'userEmail', label: 'User', value: (i) => i.userEmail },
    { key: 'userRole', label: 'Role', value: (i) => i.userRole },
    {
      key: 'resource',
      label: 'Resource',
      value: (i) => {
        const meta = i.metadata as { resourceLabel?: string; resource?: string } | null | undefined;
        return meta?.resourceLabel || meta?.resource || '—';
      },
    },
    {
      key: 'summary',
      label: 'What happened',
      value: (i) => {
        const meta = i.metadata as { summary?: string } | null | undefined;
        return meta?.summary || i.action || '—';
      },
    },
    { key: 'action', label: 'Action code', value: (i) => i.action },
    { key: 'statusCode', label: 'HTTP', value: (i) => i.statusCode },
    { key: 'ipAddress', label: 'IP Address', value: (i) => i.ipAddress },
    {
      key: 'location',
      label: 'Last Location',
      value: (i) => i.latitude != null && i.longitude != null
        ? `${Number(i.latitude).toFixed(6)}, ${Number(i.longitude).toFixed(6)}`
        : '—',
    },
    { key: 'userAgent', label: 'Device / Browser', value: (i) => i.userAgent },
  ],
  'latency-rules': [
    { key: 'name', label: 'Rule', value: (i) => i.name },
    {
      key: 'breachType',
      label: 'Type',
      value: (i) => (i.breachType === 'user_presence' ? 'User presence' : 'Transit ETA'),
    },
    {
      key: 'city',
      label: 'City',
      value: (i) => {
        const c = i.city as Entity | null | undefined;
        return c?.name || '—';
      },
    },
    {
      key: 'sector',
      label: 'Sector',
      value: (i) => {
        const s = i.sector as Entity | null | undefined;
        return s?.name || 'All';
      },
    },
    {
      key: 'targetRole',
      label: 'Role',
      value: (i) => (i.targetRole ? String(i.targetRole).replace('_', ' ') : '—'),
    },
    { key: 'thresholdMinutes', label: 'Threshold', value: (i) => `${i.thresholdMinutes} min` },
    { key: 'isActive', label: 'Active', value: (i) => (i.isActive === false ? 'No' : 'Yes') },
  ],
  'latency-recipients': [
    { key: 'name', label: 'Contact', value: (i) => i.name },
    { key: 'phone', label: 'Phone', value: (i) => i.phone },
    { key: 'channel', label: 'Channel', value: (i) => i.channel },
    {
      key: 'rule',
      label: 'Rule',
      value: (i) => {
        const r = i.rule as Entity | null | undefined;
        return r?.name || '—';
      },
    },
    {
      key: 'notificationCount',
      label: 'Alerts',
      value: (i) => {
        const count = Number(i.notificationCount) || 1;
        if (count <= 1) return '1 (once)';
        const interval = Number(i.notificationIntervalMinutes) || 15;
        return `${count} × every ${interval}m`;
      },
    },
    { key: 'isActive', label: 'Active', value: (i) => (i.isActive === false ? 'No' : 'Yes') },
  ],
  'latency-breaches': [
    {
      key: 'detectedAt',
      label: 'Detected',
      value: (i) => (i.detectedAt ? new Date(String(i.detectedAt)).toLocaleString() : '—'),
    },
    {
      key: 'breachType',
      label: 'Type',
      value: (i) => (i.breachType === 'user_presence' ? 'User offline' : 'Transit ETA'),
    },
    {
      key: 'userName',
      label: 'User',
      value: (i) => {
        if (i.breachType !== 'user_presence') return '—';
        const meta = i.metadata as { userName?: string; userEmail?: string; userRole?: string } | null | undefined;
        const name = meta?.userName || meta?.userEmail;
        if (!name) return '—';
        const role = meta?.userRole ? ` (${String(meta.userRole).replace(/_/g, ' ')})` : '';
        return `${name}${role}`;
      },
    },
    { key: 'delayMinutes', label: 'Delay', value: (i) => `${i.delayMinutes} min` },
    { key: 'thresholdMinutes', label: 'Threshold', value: (i) => `${i.thresholdMinutes} min` },
    {
      key: 'city',
      label: 'City',
      value: (i) => {
        const c = i.city as Entity | null | undefined;
        return c?.name || '—';
      },
    },
    {
      key: 'reference',
      label: 'Case / Ref',
      value: (i) => {
        const meta = i.metadata as { transitId?: string; userEmail?: string; userName?: string } | null | undefined;
        if (meta?.transitId) return meta.transitId;
        if (i.breachType === 'user_presence') {
          return meta?.userName || meta?.userEmail || '—';
        }
        return `${i.referenceType}:${String(i.referenceId).slice(0, 8)}`;
      },
    },
    {
      key: 'notifications',
      label: 'Alerts',
      value: (i) => {
        const notes = i.notifications as Entity[] | undefined;
        if (!notes?.length) return '0';
        const sent = notes.filter((n) => n.status === 'sent').length;
        const pending = notes.filter((n) => n.status === 'pending').length;
        const failed = notes.filter((n) => n.status === 'failed').length;
        const parts = [`${sent} sent`];
        if (pending) parts.push(`${pending} pending`);
        if (failed) parts.push(`${failed} failed`);
        return parts.join(', ');
      },
    },
  ],
  'messaging-providers': [
    { key: 'name', label: 'Name', value: (i) => i.name },
    { key: 'channel', label: 'Channel', value: (i) => i.channel },
    { key: 'authFieldName', label: 'Auth field', value: (i) => i.authFieldName || 'token' },
    { key: 'apiUrlMasked', label: 'API URL', value: (i) => i.apiUrlMasked },
    { key: 'secretKeyMasked', label: 'Secret', value: (i) => i.secretKeyMasked },
    { key: 'isActive', label: 'Active', value: (i) => (i.isActive === false ? 'No' : 'Yes (in use)') },
  ],
};

export function getAdminColumns(resource: string): AdminColumnDef[] {
  return ADMIN_TABLE_COLUMNS[resource] ?? [];
}
