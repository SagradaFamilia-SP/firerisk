export type Coordinate = [number, number];

export const SITE: Coordinate = [39.7178, -6.2631];
export const FIRE: Coordinate = [39.681, -6.347];

export function destination(origin: Coordinate, bearing: number, distanceKm: number): Coordinate {
  const radius = 6371;
  const angle = bearing * Math.PI / 180;
  const lat1 = origin[0] * Math.PI / 180;
  const lon1 = origin[1] * Math.PI / 180;
  const distance = distanceKm / radius;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance) + Math.cos(lat1) * Math.sin(distance) * Math.cos(angle));
  const lon2 = lon1 + Math.atan2(
    Math.sin(angle) * Math.sin(distance) * Math.cos(lat1),
    Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2),
  );
  return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];
}

export function percentagePolygonToCoordinates(points: number[][]): Coordinate[] {
  const north = 39.76;
  const south = 39.64;
  const west = -6.39;
  const east = -6.21;
  return points.map(([x, y]) => [north - (y / 100) * (north - south), west + (x / 100) * (east - west)]);
}

