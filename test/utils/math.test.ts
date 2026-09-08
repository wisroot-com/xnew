import { clamp, ease } from '../../src/utils/math';

describe('clamp', () => {
    it('passes a value inside the range through', () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });

    it('pins values outside the range to the nearest bound', () => {
        expect(clamp(-1, 0, 10)).toBe(0);
        expect(clamp(11, 0, 10)).toBe(10);
    });

    it('keeps the bounds themselves', () => {
        expect(clamp(0, 0, 10)).toBe(0);
        expect(clamp(10, 0, 10)).toBe(10);
    });

    it('handles negative ranges', () => {
        expect(clamp(-5, -10, -1)).toBe(-5);
        expect(clamp(0, -10, -1)).toBe(-1);
    });
});

describe('ease', () => {
    const easings = ['ease', 'ease-in', 'ease-out', 'ease-in-out'];

    it('leaves progress untouched for linear and for an unknown name', () => {
        expect(ease(0.3)).toBe(0.3);
        expect(ease(0.3, 'linear')).toBe(0.3);
        expect(ease(0.3, 'nonsense')).toBe(0.3);
    });

    it('anchors every curve at 0 and 1', () => {
        for (const easing of easings) {
            expect(ease(0, easing)).toBeCloseTo(0, 10);
            expect(ease(1, easing)).toBeCloseTo(1, 10);
        }
    });

    it('stays monotonic and inside [0, 1] across every curve', () => {
        for (const easing of easings) {
            let previous = -Infinity;
            for (let p = 0; p <= 1.0001; p += 0.05) {
                const value = ease(Math.min(p, 1), easing);
                expect(value).toBeGreaterThanOrEqual(previous);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
                previous = value;
            }
        }
    });

    it('front-loads ease-out and back-loads ease-in relative to linear', () => {
        expect(ease(0.5, 'ease-out')).toBeGreaterThan(0.5);
        expect(ease(0.5, 'ease-in')).toBeLessThan(0.5);
    });

    it('keeps the symmetric curves centered at the midpoint', () => {
        expect(ease(0.5, 'ease-in-out')).toBeCloseTo(0.5, 10);
        expect(ease(0.5, 'ease')).toBeGreaterThan(0.5);
    });
});
