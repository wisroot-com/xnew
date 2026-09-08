//----------------------------------------------------------------------------------------------------
// color — color models and conversions shared by color-handling components
// RGBA is the interchange form (r / g / b in 0–255, a in 0–1); HSVA (h in 0–360, s / v / a in 0–1) is
// the editing form, since hue / saturation / value map straight onto picker geometry.
//----------------------------------------------------------------------------------------------------

export type Rgba = { r: number, g: number, b: number, a: number };
export type Hsva = { h: number, s: number, v: number, a: number };

// Converts HSVA to RGBA (alpha passes through unchanged).
export function hsvaToRgba({ h, s, v, a }: Hsva): Rgba {
    const f = (n: number) => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255), a };
}

// Converts RGBA to HSVA; grey and black collapse to h = 0 (hue is undefined there).
export function rgbaToHsva({ r, g, b, a }: Rgba): Hsva {
    const rf = r / 255;
    const gf = g / 255;
    const bf = b / 255;
    const max = Math.max(rf, gf, bf);
    const delta = max - Math.min(rf, gf, bf);
    let h = 0;
    if (delta === 0) {
        h = 0;
    } else if (max === rf) {
        h = 60 * (((gf - bf) / delta) % 6);
    } else if (max === gf) {
        h = 60 * ((bf - rf) / delta + 2);
    } else {
        h = 60 * ((rf - gf) / delta + 4);
    }
    if (h < 0) {
        h += 360;
    }
    return { h, s: max === 0 ? 0 : delta / max, v: max, a };
}

// Parses #rgb / #rgba / #rrggbb / #rrggbbaa (the leading '#' optional); null when the text is not a hex color.
export function parseHex(text: string): Rgba | null {
    const stripped = text.trim().replace(/^#/, '').toLowerCase();
    let expanded: string | null = null;
    if (/^[0-9a-f]{3}$/.test(stripped) === true || /^[0-9a-f]{4}$/.test(stripped) === true) {
        expanded = stripped.split('').map((c) => c + c).join('');
    } else if (/^[0-9a-f]{6}$/.test(stripped) === true || /^[0-9a-f]{8}$/.test(stripped) === true) {
        expanded = stripped;
    }
    if (expanded === null) {
        return null;
    } else {
        const channel = (i: number) => Number.parseInt((expanded as string).substring(i, i + 2), 16);
        return { r: channel(0), g: channel(2), b: channel(4), a: expanded.length === 8 ? channel(6) / 255 : 1 };
    }
}

// Formats RGBA as '#rrggbb', extended to '#rrggbbaa' only when the color is translucent.
export function formatHex({ r, g, b, a }: Rgba): string {
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    const base = `#${hex(r)}${hex(g)}${hex(b)}`;
    return a < 1 ? `${base}${hex(Math.round(a * 255))}` : base;
}

// True when hex text carries its own alpha (the 4 / 8-digit forms); the 3 / 6-digit forms say nothing about it.
export function hasHexAlpha(text: string): boolean {
    const length = text.trim().replace(/^#/, '').length;
    return length === 4 || length === 8;
}
