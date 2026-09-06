//----------------------------------------------------------------------------------------------------
// ColorPicker — Sketch-style color picker: saturation map + preset row + hue / alpha bars + hex / RGBA fields
// Color state is held as HSVA in JS (no native control); hosts read / write `.value` (hex string)
// and observe user edits with `.on('-change', ({ value }) => …)`; native field noise never bubbles out.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

type Rgba = { r: number, g: number, b: number, a: number };
type Hsva = { h: number, s: number, v: number, a: number };

const PRESETS = [
    '#D0021B', '#F5A623', '#F8E71C', '#8B572A', '#7ED321', '#417505', '#BD10E0', '#9013FE',
    '#4A90E2', '#50E3C2', '#B8E986',
];

const CHECKERBOARD = 'conic-gradient(#ccc 0% 25%, #fff 25% 50%, #ccc 50% 75%, #fff 75% 100%)';

export function ColorPicker(unit: xnew.Unit,
    { value = '#4A90E2', presets = PRESETS, alpha = true, className = '', style = '', ...others }:
    { value?: string, presets?: string[], alpha?: boolean, className?: string, style?: string, [key: string]: any } = {}
) {
    const css = xnew.css('base', {
        container: `
            display: inline-block;
            box-sizing: content-box; width: 200px;
            padding: 10px 10px 0;
            background: #fff; border-radius: 4px;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.15);
            user-select: none;
        `,
        saturation: `
            position: relative; height: 150px;
            background-image: linear-gradient(to top, #000, rgba(0, 0, 0, 0)), linear-gradient(to right, #fff, rgba(255, 255, 255, 0));
            touch-action: none;
        `,
        circle: `
            position: absolute; width: 4px; height: 4px;
            border-radius: 50%;
            box-shadow: 0 0 0 1.5px #fff, inset 0 0 1px 1px rgba(0, 0, 0, 0.3), 0 0 1px 2px rgba(0, 0, 0, 0.4);
            transform: translate(-2px, -2px);
            pointer-events: none;
        `,
        controls: `display: flex; padding-top: 4px;`,
        bars: `flex: 1 1 0;`,
        bar: `position: relative; height: 10px; touch-action: none;`,
        hue: `background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);`,
        alphaTrack: `
            margin-top: 4px;
            background-image: ${CHECKERBOARD}; background-size: 8px 8px;
        `,
        overlay: `position: absolute; inset: 0; pointer-events: none;`,
        pointer: `
            position: absolute; top: 0; bottom: 0; width: 4px;
            background: #fff; border-radius: 1px;
            box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
            transform: translateX(-2px);
            pointer-events: none;
        `,
        swatch: `
            position: relative; width: 24px; margin-right: 4px;
            border-radius: 3px; overflow: hidden;
            background-image: ${CHECKERBOARD}; background-size: 8px 8px;
            &::after { content: ''; position: absolute; inset: 0; border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15); }
        `,
        fields: `display: flex; padding: 4px 0 10px;`,
        field: `
            flex: 1 1 0; padding-left: 6px;
            &:first-child { flex: 2 2 0; padding-left: 0; }
        `,
        fieldInput: `
            box-sizing: border-box; width: 100%;
            margin: 0; padding: 4px 0 3px;
            border: none; outline: none;
            box-shadow: inset 0 0 0 1px #ccc;
            background: #fff; color: #333;
            font: inherit; font-size: 11px; text-align: center;
            user-select: text;
        `,
        fieldLabel: `
            padding-top: 3px;
            font-size: 11px; text-align: center; color: #222;
        `,
        // 4px bottom margin + the controls row's 4px top padding = the same 8px gap as above
        presets: `
            display: flex; gap: 3px;
            margin: 8px 0 4px;
        `,
        preset: `
            flex: 1 1 0; height: 16px;
            border-radius: 3px;
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
            cursor: pointer;
        `,
    });

    let hsva = rgbaToHsva(parseHex(value) ?? { r: 74, g: 144, b: 226, a: 1 });
    if (alpha === false) {
        hsva = { ...hsva, a: 1 };
    }

    xnew.nest({ tag: 'div', className: `${css.container} ${className}`, style, ...others });
    unit.on('pointerdown', ({ event }: { event: PointerEvent }) => event.stopPropagation());

    // '-change' must fire on the picker unit, while apply() runs in the drag zones' scopes
    const notify = xnew.scope(function () {
        xnew.emit('-change', { value: formatHex(hsvaToRgba(hsva)) });
    });

    let saturationElement: HTMLElement;
    let circleElement: HTMLElement;
    let huePointer: HTMLElement;
    let alphaOverlay: HTMLElement | null = null;
    let alphaPointer: HTMLElement | null = null;
    let swatchOverlay: HTMLElement;
    let fieldHex: xnew.Unit;
    let fieldR: xnew.Unit;
    let fieldG: xnew.Unit;
    let fieldB: xnew.Unit;
    let fieldA: xnew.Unit | null = null;

    // saturation map: x = saturation, y = value (bright at the top)
    xnew((zone: xnew.Unit) => {
        saturationElement = xnew.nest({ tag: 'div', className: css.saturation }) as HTMLElement;
        circleElement = xnew({ tag: 'div', className: css.circle }).current as HTMLElement;
        zone.on('dragstart dragmove', ({ position }: { position: { x: number, y: number } }) => {
            const rect = zone.current.getBoundingClientRect();
            apply({ ...hsva, s: ratio(position.x, rect.width), v: 1 - ratio(position.y, rect.height) }, true);
        });
    });

    // one preset swatch row under the saturation map
    if (presets.length > 0) {
        xnew(() => {
            xnew.nest({ tag: 'div', className: css.presets });
            for (const preset of presets) {
                const rgba = parseHex(preset);
                if (rgba !== null) {
                    xnew((swatch: xnew.Unit) => {
                        xnew.nest({ tag: 'div', className: css.preset, style: `background: ${formatHex(rgba)};`, title: preset });
                        swatch.on('click', () => apply(rgbaToHsva(rgba), true));
                    });
                }
            }
        });
    }

    // the preview swatch beside the hue / alpha bars
    xnew(() => {
        xnew.nest({ tag: 'div', className: css.controls });
        xnew(() => {
            xnew.nest({ tag: 'div', className: css.swatch });
            swatchOverlay = xnew({ tag: 'div', className: css.overlay }).current as HTMLElement;
        });
        xnew(() => {
            xnew.nest({ tag: 'div', className: css.bars });
            xnew((zone: xnew.Unit) => {
                xnew.nest({ tag: 'div', className: `${css.bar} ${css.hue}` });
                huePointer = xnew({ tag: 'div', className: css.pointer }).current as HTMLElement;
                zone.on('dragstart dragmove', ({ position }: { position: { x: number, y: number } }) => {
                    const rect = zone.current.getBoundingClientRect();
                    apply({ ...hsva, h: ratio(position.x, rect.width) * 360 }, true);
                });
            });
            if (alpha === true) {
                xnew((zone: xnew.Unit) => {
                    xnew.nest({ tag: 'div', className: `${css.bar} ${css.alphaTrack}` });
                    alphaOverlay = xnew({ tag: 'div', className: css.overlay }).current as HTMLElement;
                    alphaPointer = xnew({ tag: 'div', className: css.pointer }).current as HTMLElement;
                    zone.on('dragstart dragmove', ({ position }: { position: { x: number, y: number } }) => {
                        const rect = zone.current.getBoundingClientRect();
                        apply({ ...hsva, a: ratio(position.x, rect.width) }, true);
                    });
                });
            }
        });
    });

    // hex / RGBA readouts: commit on change, restore the display when the text does not parse
    xnew(() => {
        xnew.nest({ tag: 'div', className: css.fields });
        fieldHex = xnew(Field, { label: 'Hex', commit: commitHex });
        fieldR = xnew(Field, { label: 'R', commit: (text: string) => commitChannel('r', text) });
        fieldG = xnew(Field, { label: 'G', commit: (text: string) => commitChannel('g', text) });
        fieldB = xnew(Field, { label: 'B', commit: (text: string) => commitChannel('b', text) });
        if (alpha === true) {
            fieldA = xnew(Field, { label: 'A', commit: commitAlpha });
        }
    });

    function Field(sub: xnew.Unit, { label, commit }: { label: string, commit: (text: string) => void }) {
        xnew.nest({ tag: 'div', className: css.field });
        const input = xnew({ tag: 'input', type: 'text', spellcheck: false, className: css.fieldInput }).current as HTMLInputElement;
        xnew({ tag: 'div', className: css.fieldLabel, textContent: label });
        // keep the native change inside the picker so hosts only see the canonical '-change'
        sub.on('change', ({ event, value }: { event: Event, value: string }) => {
            event.stopPropagation();
            commit(String(value));
        });
        return {
            set(text: string) {
                input.value = text;
            },
        };
    }

    function commitHex(text: string) {
        const rgba = parseHex(text);
        if (rgba === null) {
            render();
        } else {
            const stripped = text.trim().replace(/^#/, '');
            // 3 / 6-digit hex keeps the current alpha; only 4 / 8-digit text carries its own
            const merged = (stripped.length === 4 || stripped.length === 8) ? rgba : { ...rgba, a: hsva.a };
            apply(rgbaToHsva(merged), true);
        }
    }

    function commitChannel(key: 'r' | 'g' | 'b', text: string) {
        const parsed = Number.parseInt(text, 10);
        if (Number.isNaN(parsed) === true) {
            render();
        } else {
            apply(rgbaToHsva({ ...hsvaToRgba(hsva), [key]: clamp(parsed, 0, 255) }), true);
        }
    }

    function commitAlpha(text: string) {
        const parsed = Number.parseFloat(text);
        if (Number.isNaN(parsed) === true) {
            render();
        } else {
            apply({ ...hsva, a: clamp(parsed, 0, 100) / 100 }, true);
        }
    }

    function apply(next: Hsva, emit: boolean) {
        hsva = {
            h: clamp(next.h, 0, 360),
            s: clamp01(next.s),
            v: clamp01(next.v),
            a: alpha === true ? clamp01(next.a) : 1,
        };
        render();
        if (emit === true) {
            notify();
        }
    }

    function render() {
        const rgba = hsvaToRgba(hsva);
        saturationElement.style.backgroundColor = `hsl(${hsva.h}, 100%, 50%)`;
        circleElement.style.left = `${hsva.s * 100}%`;
        circleElement.style.top = `${(1 - hsva.v) * 100}%`;
        huePointer.style.left = `${hsva.h / 360 * 100}%`;
        if (alphaOverlay !== null && alphaPointer !== null) {
            alphaOverlay.style.background = `linear-gradient(to right, rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 0), rgb(${rgba.r}, ${rgba.g}, ${rgba.b}))`;
            alphaPointer.style.left = `${hsva.a * 100}%`;
        }
        swatchOverlay.style.background = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${hsva.a})`;
        fieldHex.set(formatHex({ ...rgba, a: 1 }).replace('#', '').toUpperCase());
        fieldR.set(String(rgba.r));
        fieldG.set(String(rgba.g));
        fieldB.set(String(rgba.b));
        if (fieldA !== null) {
            fieldA.set(String(Math.round(hsva.a * 100)));
        }
    }

    render();

    return {
        get value() {
            return formatHex(hsvaToRgba(hsva));
        },
        set value(text: string) {
            const rgba = parseHex(text);
            if (rgba !== null) {
                apply(rgbaToHsva(rgba), false);
            }
        },
    };
}

//----------------------------------------------------------------------------------------------------
// color conversion helpers
//----------------------------------------------------------------------------------------------------

function clamp(value: number, low: number, high: number): number {
    return Math.min(Math.max(value, low), high);
}

function clamp01(value: number): number {
    return clamp(value, 0, 1);
}

function ratio(position: number, span: number): number {
    return span > 0 ? clamp01(position / span) : 0;
}

function hsvaToRgba({ h, s, v, a }: Hsva): Rgba {
    const f = (n: number) => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255), a };
}

function rgbaToHsva({ r, g, b, a }: Rgba): Hsva {
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

function parseHex(text: string): Rgba | null {
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

function formatHex({ r, g, b, a }: Rgba): string {
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    const base = `#${hex(r)}${hex(g)}${hex(b)}`;
    return a < 1 ? `${base}${hex(Math.round(a * 255))}` : base;
}
