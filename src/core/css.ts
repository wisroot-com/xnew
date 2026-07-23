//----------------------------------------------------------------------------------------------------
// css — pseudo-scoped CSS backing xnew.css (local names → unique generated names)
// Scoping is emulated by renaming and made mandatory: every rule hangs off a renamed key, so a
// definition cannot emit a global rule. An optional layer wraps the whole block in @layer.
//----------------------------------------------------------------------------------------------------

import { Unit } from './unit';

interface CssEntry { names: Record<string, string>; refs: number; style: HTMLStyleElement; }

const registry = new Map<string, CssEntry>();
let counter = 0;

const localName = /^[A-Za-z][A-Za-z0-9_-]*$/;
const layerName = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z][A-Za-z0-9_-]*)*$/;
// a nameless at-rule fragment: the generated name is spliced in, so scoping stays mandatory
const atRule = /^@([a-z-]+)\s*\{([\s\S]*)\}\s*$/;
// a letter must follow '$', so attribute selectors like [href$="…"] are never rewritten
const reference = /\$([A-Za-z][A-Za-z0-9_-]*)/g;

export function applyCss(unit: Unit, layer: string | undefined, defs: Record<string, string>): Record<string, string> {
    if (globalThis.document?.head === undefined) {
        return Object.fromEntries(Object.keys(defs).map((name) => [name, name]));
    }

    const key = JSON.stringify([layer, defs]);
    let entry = registry.get(key);
    if (entry === undefined) {
        if (layer !== undefined && layerName.test(layer) === false) {
            throw new Error(`xnew.css: invalid layer "${layer}".`);
        }
        const id = counter++;
        const names: Record<string, string> = {};
        for (const name of Object.keys(defs)) {
            if (localName.test(name) === true) {
                names[name] = `xnew${id}-${name}`;
            } else {
                throw new Error(`xnew.css: invalid local name "${name}".`);
            }
        }
        const resolve = (body: string) => body.replace(reference, (_, ref: string) => {
            if (names[ref] === undefined) {
                throw new Error(`xnew.css: unknown reference "$${ref}".`);
            } else {
                return names[ref];
            }
        });
        const rules = Object.entries(defs).map(([name, value]) => {
            if (value.trim().startsWith('@') === true) {
                const match = value.trim().match(atRule);
                if (match === null) {
                    throw new Error(`xnew.css: at-rule "${name}" must be nameless, as "@type { … }".`);
                }
                return `@${match[1]} ${names[name]} {\n${resolve(match[2].trim())}\n}`;
            } else {
                return `.${names[name]} {\n${resolve(value)}\n}`;
            }
        }).join('\n');
        const text = layer === undefined ? rules : `@layer ${layer} {\n${rules}\n}`;

        const style = document.createElement('style');
        style.textContent = text;
        document.head.appendChild(style);

        entry = { names, refs: 0, style };
        registry.set(key, entry);
    }

    const held = entry;
    held.refs++;
    unit.on('finalize', () => {
        held.refs--;
        if (held.refs === 0) {
            held.style.remove();
            registry.delete(key);
        }
    });
    return held.names;
}
