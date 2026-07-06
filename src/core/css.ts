//----------------------------------------------------------------------------------------------------
// css — pseudo-scoped CSS backing xnew.css (local class names → unique generated class names)
//
// True local CSS is impossible in the light DOM, so scoping is emulated by renaming: each local key
// becomes a page-unique class, so definitions in different components never collide by name.
//
// - applyCss : inject a <style> for a definition map and return { localName: generatedClassName }
//
// Each value is wrapped as `.generated { ...value... }`, so native CSS nesting applies inside
// (&:hover, @media, descendant selectors). Identical definition maps share one ref-counted <style>,
// removed when the last unit using it finalizes. @keyframes names stay global. Without a DOM
// (server side), nothing is injected and keys map to themselves.
//----------------------------------------------------------------------------------------------------

import { Unit } from './unit';

interface CssEntry { names: Record<string, string>; refs: number; style: HTMLStyleElement; }

const registry = new Map<string, CssEntry>();
let counter = 0;

export function applyCss(unit: Unit, defs: Record<string, string>): Record<string, string> {
    if (globalThis.document?.head === undefined) {
        return Object.fromEntries(Object.keys(defs).map((name) => [name, name]));
    }

    const key = JSON.stringify(defs);
    let entry = registry.get(key);
    if (entry === undefined) {
        const id = counter++;
        const names: Record<string, string> = {};
        const text = Object.entries(defs).map(([name, block]) => {
            names[name] = `xnew${id}-${name}`;
            return `.${names[name]} {\n${block}\n}`;
        }).join('\n');

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
