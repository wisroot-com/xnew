import { formatHex, hasHexAlpha, hsvaToRgba, parseHex, rgbaToHsva } from '../../src/utils/color';

describe('parseHex', () => {
    it('parses 6-digit hex with or without "#", opaque', () => {
        expect(parseHex('#4A90E2')).toEqual({ r: 74, g: 144, b: 226, a: 1 });
        expect(parseHex('4a90e2')).toEqual({ r: 74, g: 144, b: 226, a: 1 });
    });

    it('expands 3 / 4-digit shorthand', () => {
        expect(parseHex('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
        expect(parseHex('#f00f')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('reads alpha from the 8-digit form', () => {
        expect(parseHex('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 });
    });

    it('trims surrounding whitespace', () => {
        expect(parseHex('  #ffffff ')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    });

    it('returns null for non-hex text and unsupported digit counts', () => {
        expect(parseHex('rgb(0,0,0)')).toBeNull();
        expect(parseHex('#12345')).toBeNull();
        expect(parseHex('')).toBeNull();
    });
});

describe('formatHex', () => {
    it('formats an opaque color as 6 digits', () => {
        expect(formatHex({ r: 74, g: 144, b: 226, a: 1 })).toBe('#4a90e2');
    });

    it('pads single-digit channels', () => {
        expect(formatHex({ r: 0, g: 1, b: 15, a: 1 })).toBe('#00010f');
    });

    it('appends the alpha byte only when translucent', () => {
        expect(formatHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080');
    });
});

describe('hasHexAlpha', () => {
    it('is true only for the 4 / 8-digit forms', () => {
        expect(hasHexAlpha('#f00f')).toBe(true);
        expect(hasHexAlpha('00000080')).toBe(true);
        expect(hasHexAlpha('#f00')).toBe(false);
        expect(hasHexAlpha('#4A90E2')).toBe(false);
    });
});

describe('rgbaToHsva / hsvaToRgba', () => {
    it('converts primaries to their hue angles', () => {
        expect(rgbaToHsva({ r: 255, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 1, v: 1, a: 1 });
        expect(rgbaToHsva({ r: 0, g: 255, b: 0, a: 1 })).toEqual({ h: 120, s: 1, v: 1, a: 1 });
        expect(rgbaToHsva({ r: 0, g: 0, b: 255, a: 1 })).toEqual({ h: 240, s: 1, v: 1, a: 1 });
    });

    it('normalizes the negative hue branch (magenta between blue and red)', () => {
        expect(rgbaToHsva({ r: 255, g: 0, b: 255, a: 1 }).h).toBe(300);
    });

    it('reports zero hue and saturation for greys, and zero saturation for black', () => {
        expect(rgbaToHsva({ r: 128, g: 128, b: 128, a: 1 })).toEqual({ h: 0, s: 0, v: 128 / 255, a: 1 });
        expect(rgbaToHsva({ r: 0, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 0, v: 0, a: 1 });
    });

    it('round-trips rgba through hsva', () => {
        for (const rgba of [{ r: 74, g: 144, b: 226, a: 1 }, { r: 245, g: 166, b: 35, a: 0.5 }, { r: 1, g: 2, b: 3, a: 1 }]) {
            expect(hsvaToRgba(rgbaToHsva(rgba))).toEqual(rgba);
        }
    });

    it('carries alpha through both directions untouched', () => {
        expect(rgbaToHsva({ r: 0, g: 0, b: 0, a: 0.25 }).a).toBe(0.25);
        expect(hsvaToRgba({ h: 0, s: 0, v: 0, a: 0.25 }).a).toBe(0.25);
    });
});
