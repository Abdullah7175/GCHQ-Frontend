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
    { key: 'isActive', label: 'Active', value: (i) => (i.isActive ? 'Yes' : 'No') },
  ],
  providers: [
    { key: 'name', label: 'Name', value: (i) => i.name },
    { key: 'code', label: 'Code', value: (i) => i.code },
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
  ],
  ambulances: [
    { key: 'unitNumber', label: 'Unit', value: (i) => i.unitNumber },
    { key: 'city', label: 'City', value: (i, refs) => relLabel(i, 'city', 'cityId', refs, 'cities') },
    { key: 'provider', label: 'Provider', value: (i, refs) => relLabel(i, 'provider', 'providerId', refs, 'providers') },
    { key: 'status', label: 'Status', value: (i) => i.status },
    { key: 'driver', label: 'Driver', value: (i, refs) => relLabel(i, 'driver', 'driverId', refs) },
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
    { key: 'ambulance', label: 'Unit', value: (i) => relLabel(i, 'ambulance', 'ambulanceId', refs) },
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
    { key: 'etaMinutes', label: 'ETA', value: (i) => (i.etaMinutes != null ? `${i.etaMinutes}m` : '—') },
  ],
};

export function getAdminColumns(resource: string): AdminColumnDef[] {
  return ADMIN_TABLE_COLUMNS[resource] ?? [];
}
