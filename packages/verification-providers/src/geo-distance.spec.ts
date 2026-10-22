import { haversineDistanceMeters } from './geo-distance';

describe('haversineDistanceMeters', () => {
  it('the same point distances at exactly 0', () => {
    expect(haversineDistanceMeters(24.8607, 67.0011, 24.8607, 67.0011)).toBe(0);
  });

  it('matches the real, well-known great-circle distance between London and Paris (~344 km)', () => {
    const london: [number, number] = [51.5074, -0.1278];
    const paris: [number, number] = [48.8566, 2.3522];
    const distanceMeters = haversineDistanceMeters(...london, ...paris);
    expect(distanceMeters).toBeGreaterThan(340_000);
    expect(distanceMeters).toBeLessThan(348_000);
  });

  it('one degree of latitude is close to the real ~111.2 km every mapping tool agrees on', () => {
    const distanceMeters = haversineDistanceMeters(0, 0, 1, 0);
    expect(distanceMeters).toBeGreaterThan(110_500);
    expect(distanceMeters).toBeLessThan(111_500);
  });

  it('is symmetric — distance(A, B) equals distance(B, A)', () => {
    const a = haversineDistanceMeters(24.8607, 67.0011, 31.5204, 74.3587);
    const b = haversineDistanceMeters(31.5204, 74.3587, 24.8607, 67.0011);
    expect(a).toBeCloseTo(b, 6);
  });
});
