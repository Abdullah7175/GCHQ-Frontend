/** Build a demo "best route" polyline between two points (stands in for Google Directions). */
export function buildDemoRoute(
  from: [number, number],
  to: [number, number],
  steps = 24,
): [number, number][] {
  const points: [number, number][] = [];
  const midLat = (from[0] + to[0]) / 2 + (to[1] - from[1]) * 0.15;
  const midLng = (from[1] + to[1]) / 2 - (to[0] - from[0]) * 0.15;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Quadratic Bezier for a realistic-looking corridor path
    const lat = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * midLat + t * t * to[0];
    const lng = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * midLng + t * t * to[1];
    points.push([lat, lng]);
  }
  return points;
}

export function interpolateRouteProgress(route: [number, number][], progress: number): [number, number] {
  if (route.length === 0) return [0, 0];
  if (progress <= 0) return route[0];
  if (progress >= 1) return route[route.length - 1];
  const idx = progress * (route.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  const a = route[i];
  const b = route[Math.min(i + 1, route.length - 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
