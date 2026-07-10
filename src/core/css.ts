//----------------------------------------------------------------------------------------------------
// css — pseudo-scoped CSS backing xnew.css (local names → unique generated names, scoping enforced)
//
// True local CSS is impossible in the light DOM, so scoping is emulated by renaming — and made
// mandatory: every rule hangs off a renamed key, so a definition cannot emit a global rule.
//
// - applyCss : inject a <style> for a definition map and return { name: generatedName }
// - CssDef   : object entry form { layer?, type?, body }
//
// Each key is a local name (validated; anything else throws). A value is either a declaration
// block string, wrapped as `.xnewN-key { … }` (native CSS nesting applies inside: &:hover, @media,
// descendant selectors), or a CssDef object: `type` names an at-rule (without '@') to hang the
// generated name on — `turn: { type: 'keyframes', body: '…' }` emits `@keyframes xnewN-turn { … }`
// (absent: a class rule) — and `layer` wraps that entry in `@layer`. Types and layers are
// validated (injection throws). `$key` inside a body resolves to another entry's generated name
// (unknown references throw). Identical definition maps share one ref-counted <style>, removed
// when the last unit using it finalizes. Without a DOM (server side), nothing is injected and
// keys map to themselves.
//
// Layering: entries without `layer` stay unlayered (normal strength). xbasics components set
// `layer: 'xbasics'` on every entry so their defaults lose to any page CSS regardless of
// specificity or order. Pages should declare `@layer xbasics;` up front (before other layered CSS)
// to pin it as the weakest layer; otherwise the runtime-injected layer lands after static layers
// and outranks them.
//----------------------------------------------------------------------------------------------------

import { Unit } from './unit';

export interface CssDef { layer?: string; type?: string; body: string; }

interface CssEntry { names: Record<string, string>; refs: number; style: HTMLStyleElement; }

const registry = new Map<string, CssEntry>();
let counter = 0;

const localName = /^[A-Za-z][A-Za-z0-9_-]*$/;
const layerName = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z][A-Za-z0-9_-]*)*$/;
const typeName = /^[a-z-]+$/;
// a letter must follow '$', so attribute selectors like [href$="…"] are never rewritten
const reference = /\$([A-Za-z][A-Za-z0-9_-]*)/g;

export function applyCss(unit: Unit, defs: Record<string, string | CssDef>): Record<string, string> {
    if (globalThis.document?.head === undefined) {
        return Object.fromEntries(Object.keys(defs).map((name) => [name, name]));
    }

    const key = JSON.stringify(defs);
    let entry = registry.get(key);
    if (entry === undefined) {
        const id = counter++;
        const names: Record<string, string> = {};
        for (const name of Object.keys(defs)) {
            if (localName.test(name) === true) {
                names[name] = `xnew${id}-${name}`;
            } else {
                throw new Error(`xnew.css: invalid local name "${name}".`);
            }
        }
        const resolve = (block: string) => block.replace(reference, (_, ref: string) => {
            if (names[ref] === undefined) {
                throw new Error(`xnew.css: unknown reference "$${ref}".`);
            } else {
                return names[ref];
            }
        });
        const text = Object.entries(defs).map(([name, value]) => {
            const def = typeof value === 'string' ? { body: value } : value;

            let rule: string;
            if (def.type === undefined) {
                rule = `.${names[name]} {\n${resolve(def.body)}\n}`;
            } else if (typeName.test(def.type) === true) {
                rule = `@${def.type} ${names[name]} {\n${resolve(def.body)}\n}`;
            } else {
                throw new Error(`xnew.css: invalid type "${def.type}".`);
            }

            if (def.layer === undefined) {
                return rule;
            } else if (layerName.test(def.layer) === true) {
                return `@layer ${def.layer} {\n${rule}\n}`;
            } else {
                throw new Error(`xnew.css: invalid layer "${def.layer}".`);
            }
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
