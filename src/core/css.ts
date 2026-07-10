//----------------------------------------------------------------------------------------------------
// css — pseudo-scoped CSS backing xnew.css ($names in plain CSS → unique generated names)
//
// True local CSS is impossible in the light DOM, so scoping is emulated by renaming: every $name
// in the text is replaced with a page-unique identifier, so definitions in different components
// never collide by name.
//
// - applyCss : substitute $names in a plain-CSS text, inject it verbatim as a <style>,
//              and return { name: generatedName }
//
// The text is plain CSS injected as-is, so @layer / @keyframes / @media / selectors need no
// special casing; class names and @keyframes names are scoped alike by marking them with $.
// Identical texts share one ref-counted <style>, removed when the last unit using it finalizes.
// Without a DOM (server side), nothing is injected and $names map to themselves.
//----------------------------------------------------------------------------------------------------

import { Unit } from './unit';

interface CssEntry { names: Record<string, string>; refs: number; style: HTMLStyleElement; }

const registry = new Map<string, CssEntry>();
let counter = 0;

// a letter must follow '$', so attribute selectors like [href$="…"] are never rewritten
const namePattern = /\$([A-Za-z][A-Za-z0-9_-]*)/g;

export function applyCss(unit: Unit, source: string): Record<string, string> {
    if (globalThis.document?.head === undefined) {
        const names: Record<string, string> = {};
        for (const match of source.matchAll(namePattern)) {
            names[match[1]] = match[1];
        }
        return names;
    }

    let entry = registry.get(source);
    if (entry === undefined) {
        const id = counter++;
        const names: Record<string, string> = {};
        const text = source.replace(namePattern, (_, name) => (names[name] = `xnew${id}-${name}`));

        const style = document.createElement('style');
        style.textContent = text;
        document.head.appendChild(style);

        entry = { names, refs: 0, style };
        registry.set(source, entry);
    }

    const held = entry;
    held.refs++;
    unit.on('finalize', () => {
        held.refs--;
        if (held.refs === 0) {
            held.style.remove();
            registry.delete(source);
        }
    });
    return held.names;
}
