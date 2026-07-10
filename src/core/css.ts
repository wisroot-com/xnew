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
//
// The optional `layer` argument emits the rules inside `@layer <name>`; without it they stay
// unlayered (normal strength). xbasics components pass 'xnew' so their defaults lose to any page
// CSS regardless of specificity or order. Pages should declare `@layer xnew;` up front (before
// other layered CSS) to pin it as the weakest layer; otherwise the runtime-injected layer lands
// after static layers and outranks them.
//----------------------------------------------------------------------------------------------------

import { Unit } from './unit';

interface CssEntry { names: Record<string, string>; refs: number; style: HTMLStyleElement; }

const registry = new Map<string, CssEntry>();
let counter = 0;

export function applyCss(unit: Unit, defs: Record<string, string>, layer?: string): Record<string, string> {
    if (globalThis.document?.head === undefined) {
        return Object.fromEntries(Object.keys(defs).map((name) => [name, name]));
    }

    const key = JSON.stringify([layer ?? '', defs]);
    let entry = registry.get(key);
    if (entry === undefined) {
        const id = counter++;
        const names: Record<string, string> = {};
        const text = Object.entries(defs).map(([name, block]) => {
            names[name] = `xnew${id}-${name}`;
            return `.${names[name]} {\n${block}\n}`;
        }).join('\n');

        const style = document.createElement('style');
        style.textContent = layer !== undefined ? `@layer ${layer} {\n${text}\n}` : text;
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
