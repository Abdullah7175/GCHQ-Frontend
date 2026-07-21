/** Distinct polyline colors for concurrent corridors (markers keep fleet branding). */
export const CORRIDOR_ROUTE_COLORS = [
  '#0056b3',
  '#7c3aed',
  '#ea580c',
  '#0891b2',
  '#16a34a',
  '#db2777',
  '#ca8a04',
  '#4f46e5',
  '#0d9488',
  '#be123c',
] as const;

export function corridorRouteColor(index: number): string {
  return CORRIDOR_ROUTE_COLORS[index % CORRIDOR_ROUTE_COLORS.length];
}
