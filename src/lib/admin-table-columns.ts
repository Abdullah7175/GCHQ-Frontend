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
    { key: 'currentLat', label: 'Lat', value: (i) => i.currentLat },
    { key: 'currentLng', label: 'Lng', value: (i) => i.currentLng },
    { key: 'currentSpeed', label: 'Speed', value: (i) => i.currentSpeed },
  ],
};

export function getAdminColumns(resource: string): AdminColumnDef[] {
  return ADMIN_TABLE_COLUMNS[resource] ?? [];
}
