//----------------------------------------------------------------------------------------------------
// css — pseudo-scoped CSS backing xnew.css (local names → unique generated names)
// Scoping is emulated by renaming and made mandatory: a string def is a class body, an at-rule def
// declares its kind as { rule, body }; unit-free — a ScopedCSS instance hands the lifetime back as release().
//----------------------------------------------------------------------------------------------------

// string = class declaration body; at-rules declare their kind ('@font-face' may list one body per face)
export type CSSDef =
    | string
    | { rule: '@keyframes' | '@property' | '@counter-style', body: string }
    | { rule: '@font-face', body: string | string[] };

// the injected stylesheet shared by every instance built from identical definitions
interface CSSEntry { names: Record<string, string>; refs: number; style: HTMLStyleElement; }

// One acquisition of a definition set: the generated names to embed, held until release(). The injected
// <style> is shared between identical definitions and reference counted, so the last release removes it.
// Outside the DOM nothing is injected and only the names are produced.
export class ScopedCSS {
    private static registry = new Map<string, CSSEntry>();
    private static counter = 0;

    private static localName = /^[A-Za-z][A-Za-z0-9_-]*$/;
    private static layerName = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z][A-Za-z0-9_-]*)*$/;
    private static atRules = ['@keyframes', '@property', '@counter-style', '@font-face'];

    public readonly names: Record<string, string>;
    private key: string | null = null;
    private entry: CSSEntry | null = null;

    constructor(layer: string | undefined, defs: Record<string, CSSDef>) {
        if (globalThis.document?.head === undefined) {
            this.names = Object.fromEntries(Object.entries(defs).map(([name, def]) => [name, ScopedCSS.generatedName(def, '', name)]));
        } else {
            const key = JSON.stringify([layer, defs]);
            let entry = ScopedCSS.registry.get(key);
            if (entry === undefined) {
                const { names, text } = ScopedCSS.build(layer, defs, ScopedCSS.counter++);

                const style = document.createElement('style');
                style.textContent = text;
                document.head.appendChild(style);

                entry = { names, refs: 0, style };
                ScopedCSS.registry.set(key, entry);
            }
            entry.refs++;
            this.key = key;
            this.entry = entry;
            this.names = entry.names;
        }
    }

    // Drops this reference; repeated calls are ignored, so a release does not steal another holder's.
    public release(): void {
        if (this.entry !== null) {
            const entry = this.entry;
            this.entry = null;
            entry.refs--;
            if (entry.refs === 0) {
                entry.style.remove();
                ScopedCSS.registry.delete(this.key as string);
            }
        }
    }

    // '@property' names must be dashed idents, so its generated name (and every $reference to it) carries '--'
    private static generatedName(def: CSSDef, prefix: string, name: string): string {
        if (typeof def === 'object' && def.rule === '@property') {
            return `--${prefix}${name}`;
        } else {
            return `${prefix}${name}`;
        }
    }

    // resolves $refs and enforces scoping in one pass: braces may not escape the wrapper, and string / comment content passes through untouched
    private static resolveBody(key: string, source: string, names: Record<string, string>): string {
        let out = '';
        let depth = 0;
        let i = 0;
        while (i < source.length) {
            const c = source[i];
            if (c === '/' && source[i + 1] === '*') {
                const end = source.indexOf('*/', i + 2);
                const next = end === -1 ? source.length : end + 2;
                out += source.slice(i, next);
                i = next;
            } else if (c === '"' || c === "'") {
                let j = i + 1;
                while (j < source.length && source[j] !== c) {
                    j += source[j] === '\\' ? 2 : 1;
                }
                const next = Math.min(j + 1, source.length);
                out += source.slice(i, next);
                i = next;
            } else if (c === '$' && /[A-Za-z]/.test(source[i + 1] ?? '')) {
                const ref = source.slice(i + 1).match(/^[A-Za-z][A-Za-z0-9_-]*/)![0];
                if (Object.prototype.hasOwnProperty.call(names, ref) === false) {
                    throw new Error(`xnew.css: unknown reference "$${ref}" in "${key}".`);
                }
                out += names[ref];
                i += 1 + ref.length;
            } else {
                if (c === '{') {
                    depth++;
                } else if (c === '}') {
                    depth--;
                }
                if (depth < 0) {
                    throw new Error(`xnew.css: unbalanced braces in "${key}".`);
                }
                out += c;
                i++;
            }
        }
        if (depth !== 0) {
            throw new Error(`xnew.css: unbalanced braces in "${key}".`);
        }
        return out;
    }

    // validates the definitions and renders them into one stylesheet text, with the generated name per local key
    private static build(layer: string | undefined, defs: Record<string, CSSDef>, id: number): { names: Record<string, string>, text: string } {
        if (layer !== undefined && ScopedCSS.layerName.test(layer) === false) {
            throw new Error(`xnew.css: invalid layer "${layer}".`);
        }
        const names: Record<string, string> = {};
        for (const [name, def] of Object.entries(defs)) {
            if (ScopedCSS.localName.test(name) === false) {
                throw new Error(`xnew.css: invalid local name "${name}".`);
            } else if (typeof def === 'object' && ScopedCSS.atRules.includes(def.rule) === false) {
                throw new Error(`xnew.css: unsupported rule "${def.rule}" in "${name}".`);
            } else if (typeof def === 'object' && Array.isArray(def.body) === true && def.rule !== '@font-face') {
                throw new Error(`xnew.css: only @font-face may take multiple bodies ("${name}").`);
            } else {
                names[name] = ScopedCSS.generatedName(def, `xnew${id}-`, name);
            }
        }
        const blocks = Object.entries(defs).map(([name, def]) => {
            if (typeof def === 'string') {
                // a string body is always wrapped in the class rule, where a definition at-rule would nest invalidly
                if (/^@(keyframes|property|counter-style|font-face)\b/.test(def.trim()) === true) {
                    throw new Error(`xnew.css: write "${name}" as { rule: '@…', body: '…' }.`);
                }
                return `.${names[name]} {\n${ScopedCSS.resolveBody(name, def, names)}\n}`;
            } else if (def.rule === '@font-face') {
                // the scoped identity of a face is its family: the generated name is injected as the font-family descriptor
                const bodies = Array.isArray(def.body) ? def.body : [def.body];
                return bodies.map((body) => `@font-face {\nfont-family: ${names[name]};\n${ScopedCSS.resolveBody(name, body, names)}\n}`).join('\n');
            } else {
                return `${def.rule} ${names[name]} {\n${ScopedCSS.resolveBody(name, def.body, names)}\n}`;
            }
        }).join('\n');
        const text = layer === undefined ? blocks : `@layer ${layer} {\n${blocks}\n}`;
        return { names, text };
    }
}
