import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Panel, PanelGroup } from '../../../src/basics/widget/Panel';
import { Button } from '../../../src/basics/element/Button';
import { InputRange } from '../../../src/basics/element/InputRange';
import { InputCheckbox } from '../../../src/basics/element/InputToggle';
import { Listbox } from '../../../src/basics/widget/Listbox';
import { Accordion } from '../../../src/basics/widget/Accordion';

describe('basics Panel', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    function newPanel(): { host: HTMLElement, panel: any } {
        const host = document.createElement('div');
        return { host, panel: xnew(host, Panel) };
    }

    describe('open', () => {
        test('an open value makes the panel collapsible, exposing its gate', () => {
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { label: 'GUI', open: true });
            panel.button({ label: 'one' });
            expect(host.textContent).toContain('GUI');
            expect(panel.gate).not.toBe(undefined);
            expect((panel.current as HTMLElement).querySelector('button')).not.toBe(null);
        });

        test('leaving open undefined keeps the rows always shown, with no header and no gate', () => {
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { label: 'GUI' });
            panel.button({ label: 'one' });
            expect(host.textContent).not.toContain('GUI');
            expect(panel.gate).toBe(undefined);
            expect(host.querySelector('button')).not.toBe(null);
        });
    });

    describe('tabs', () => {
        function tabButton(host: HTMLElement, name: string): HTMLElement {
            return [...host.querySelectorAll('button')].find((button) => button.textContent === name) as HTMLElement;
        }

        const ITEMS = [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }];

        test('the strip switches the sibling groups its item value names, the first one starting active', () => {
            const { host, panel } = newPanel();
            panel.tabs({ items: ITEMS });
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ label: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ label: 'b' }));

            expect((left.container as HTMLElement).style.display).not.toBe('none');
            expect((right.container as HTMLElement).style.display).toBe('none');

            jest.advanceTimersByTime(1);
            tabButton(host, 'Right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((left.container as HTMLElement).style.display).toBe('none');
            expect((right.container as HTMLElement).style.display).not.toBe('none');
        });

        test('the strip can be built after its groups, so it goes wherever the caller wants it', () => {
            const { host, panel } = newPanel();
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ label: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ label: 'b' }));
            panel.tabs({ items: ITEMS });

            expect((left.container as HTMLElement).style.display).not.toBe('none');
            expect((right.container as HTMLElement).style.display).toBe('none');

            jest.advanceTimersByTime(1);
            tabButton(host, 'Right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((right.container as HTMLElement).style.display).not.toBe('none');
        });

        test('leaves rows and groups no tab item names alone', () => {
            const { host, panel } = newPanel();
            panel.tabs({ items: ITEMS });
            panel.group({ key: 'right' }, (group: any) => group.button({ label: 'b' }));
            const row = panel.range({ label: 'a' });
            const plain = panel.group({}, (group: any) => group.button({ label: 'c' }));

            jest.advanceTimersByTime(1);
            tabButton(host, 'Right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((row.container as HTMLElement).style.display).toBe('flex');
            expect((plain.container as HTMLElement).style.display).toBe('');
        });

        test('a collapsible group switches as a whole, header included', () => {
            const { host, panel } = newPanel();
            panel.tabs({ items: ITEMS });
            panel.group({ key: 'left' }, (group: any) => group.button({ label: 'a' }));
            const group = panel.group({ label: 'folder', open: true, key: 'right' }, (group: any) => {
                group.button({ label: 'inside' });
            });

            expect((group.container as HTMLElement).style.display).toBe('none');
            jest.advanceTimersByTime(1);
            tabButton(host, 'Right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((group.container as HTMLElement).textContent).toContain('folder');
            expect((group.container as HTMLElement).style.display).not.toBe('none');
        });

        test("a .value set switches from code and fires 'change' on the strip, like a press does", () => {
            const { host, panel } = newPanel();
            const values: string[] = [];
            const tabs = panel.tabs({ items: ITEMS });
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ label: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ label: 'b' }));

            tabs.on('change', ({ value }: { value: string }) => values.push(value));

            jest.advanceTimersByTime(1);
            tabButton(host, 'Right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(tabs.value).toBe('right');

            tabs.value = 'left';
            expect((left.container as HTMLElement).style.display).not.toBe('none');
            expect((right.container as HTMLElement).style.display).toBe('none');
            expect(tabs.value).toBe('left');
            expect(values).toEqual(['right', 'left']);
        });

        // items take the same shape as a Listbox's: a bare string is both the group key and the caption
        test('a bare string item is the group key and its own caption', () => {
            const { host, panel } = newPanel();
            panel.tabs({ items: ['left', 'right'] });
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ label: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ label: 'b' }));

            jest.advanceTimersByTime(1);
            tabButton(host, 'right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((left.container as HTMLElement).style.display).toBe('none');
            expect((right.container as HTMLElement).style.display).not.toBe('none');
        });

        test('value picks the tab that starts active instead of the first item', () => {
            const { panel } = newPanel();
            const tabs = panel.tabs({ items: ITEMS, value: 'right' });
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ label: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ label: 'b' }));

            expect(tabs.value).toBe('right');
            expect((left.container as HTMLElement).style.display).toBe('none');
            expect((right.container as HTMLElement).style.display).not.toBe('none');
        });

        // a group key is any value, so a tab item must be able to carry a non-string one
        test('a non-string group key switches through its item value', () => {
            const { host, panel } = newPanel();
            panel.tabs({ items: [{ value: 1, label: 'One' }, { value: 2, label: 'Two' }] });
            const one = panel.group({ key: 1 }, (group: any) => group.button({ label: 'a' }));
            const two = panel.group({ key: 2 }, (group: any) => group.button({ label: 'b' }));

            jest.advanceTimersByTime(1);
            tabButton(host, 'Two').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((one.container as HTMLElement).style.display).toBe('none');
            expect((two.container as HTMLElement).style.display).not.toBe('none');
        });

        test('a .value set ignores a key the strip does not name', () => {
            const { panel } = newPanel();
            const tabs = panel.tabs({ items: ITEMS });
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ label: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ label: 'b' }));

            tabs.value = 'nowhere';
            expect(tabs.value).toBe('left');
            expect((left.container as HTMLElement).style.display).not.toBe('none');
            expect((right.container as HTMLElement).style.display).toBe('none');
        });
    });

    describe('row .value', () => {
        test('every value-bearing row reads its control through .value', () => {
            const { panel } = newPanel();
            const range = panel.range({ label: 'r', value: 30 });
            const checkbox = panel.checkbox({ label: 'c', value: true });
            const color = panel.color({ label: 'k', value: '#123456' });
            const listbox = panel.listbox({ label: 'l', items: ['a', 'b'] });
            jest.advanceTimersByTime(1);

            expect(range.value).toBe(30);
            expect(checkbox.value).toBe(true);
            expect(color.value).toBe('#123456');
            expect(listbox.value).toBe('a');
        });

        test('a .value set drives the control the row owns', () => {
            const { panel } = newPanel();
            const range = panel.range({ label: 'r', value: 30 });
            const checkbox = panel.checkbox({ label: 'c', value: true });
            const color = panel.color({ label: 'k', value: '#123456' });
            const listbox = panel.listbox({ label: 'l', items: ['a', 'b'] });
            jest.advanceTimersByTime(1);

            range.value = 70;
            checkbox.value = false;
            color.value = '#abcdef';
            listbox.value = 'b';
            jest.advanceTimersByTime(1);

            expect(range.value).toBe(70);
            expect((range.current as HTMLElement).querySelector('input')!.value).toBe('70');
            expect(checkbox.value).toBe(false);
            expect((checkbox.current as HTMLElement).querySelector('input')!.checked).toBe(false);
            expect(color.value).toBe('#abcdef');
            expect((color.current as HTMLElement).querySelector('button')!.style.background).toBe('rgb(171, 205, 239)');
            expect(listbox.value).toBe('b');
        });

        // 'change' bubbles like the native event, so one listener on the panel covers every row
        test("every row's change reaches a single listener on the panel itself", () => {
            const { panel } = newPanel();
            const received: unknown[] = [];
            panel.on('change', ({ value }: { value: unknown }) => received.push(value));
            const range = panel.range({ label: 'r', value: 0 });
            const checkbox = panel.checkbox({ label: 'c', value: false });
            const listbox = panel.listbox({ label: 'l', items: ['a', 'b'] });
            const color = panel.color({ label: 'k', value: '#000000' });
            jest.advanceTimersByTime(1);

            listbox.value = 'b';
            color.value = '#ffffff';
            range.value = 40;
            checkbox.value = true;

            expect(received).toEqual(['b', '#ffffff', 40, true]);
        });

        // a set is a committed edit, so it fires the native pair — input first, then change
        test('a .value set fires input then change, in that order', () => {
            const { panel } = newPanel();
            const seen: Array<[string, unknown]> = [];
            panel.on('input change', ({ event, value }: { event: Event, value: unknown }) => seen.push([event.type, value]));
            const listbox = panel.listbox({ label: 'l', items: ['a', 'b'] });
            jest.advanceTimersByTime(1);

            listbox.value = 'b';

            expect(seen).toEqual([['input', 'b'], ['change', 'b']]);
        });

        test('tabs has no select(): .value is the only write path', () => {
            const { panel } = newPanel();
            const tabs = panel.tabs({ items: ['left', 'right'] });

            expect(tabs.select).toBe(undefined);
        });
    });

    describe('listbox row', () => {
        test('takes the same items as a Listbox, showing the label while the value stays underneath', () => {
            const { host, panel } = newPanel();
            const row = panel.listbox({ label: 'fruit', items: [{ value: 'apple', label: 'りんご' }, 'banana'] });
            jest.advanceTimersByTime(1);

            expect(row.value).toBe('apple');
            expect(host.textContent).toContain('りんご');
            expect(host.textContent).not.toContain('apple');
        });
    });

    describe('key', () => {
        test('a row key reaches its control, so xnew.find locates the row by that component', () => {
            const { panel } = newPanel();
            panel.button({ label: 'go', key: 'go-button' });
            panel.range({ label: 'data', key: 'data-range' });
            panel.checkbox({ label: 'flag', key: 'flag-box' });
            panel.listbox({ label: 'color', items: ['red', 'blue'], key: 'color-list' });

            expect(xnew.find(Button, { key: 'go-button' }).length).toBe(1);
            expect(xnew.find(InputRange, { key: 'data-range' }).length).toBe(1);
            expect(xnew.find(InputCheckbox, { key: 'flag-box' }).length).toBe(1);
            expect(xnew.find(Listbox, { key: 'color-list' }).length).toBe(1);
        });

        test('a group key reaches the group unit through PanelGroup, so a host outside can find it', () => {
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { key: 'panel' });
            const messages = panel.group({ key: 'messages' }, (group: any) => group.button({ label: 'one' }));

            expect(xnew.find(PanelGroup, { key: 'panel' })[0]).toBe(panel);
            expect(xnew.find(PanelGroup, { ancestor: panel, key: 'messages' })[0]).toBe(messages);
        });

        test('a group key reaches the group unit itself, so its own components find it', () => {
            const { panel } = newPanel();
            const group = panel.group({ label: 'settings', open: true, key: 'settings-group' }, (group: any) => {
                group.button({ label: 'one', key: 'inner-button' });
            });
            expect(xnew.find(Accordion, { key: 'settings-group' })[0]).toBe(group);
            expect(xnew.find(Button, { key: 'inner-button', ancestor: group }).length).toBe(1);
        });
    });

    describe('frame', () => {
        test('the panel owns its frame element, and className / style land on it', () => {
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { className: 'w-56 bg-white', style: 'max-height: 20em;' });
            const frame = panel.container as HTMLElement;

            expect(host.firstElementChild).toBe(frame);
            expect(frame.className).toContain('w-56 bg-white');
            expect(frame.getAttribute('style')).toContain('max-height: 20em;');
            expect(frame.contains(panel.current)).toBe(true);
        });
    });

    describe('group', () => {
        test('builds the rows of its inner callback inside the created group', () => {
            const { host, panel } = newPanel();
            // the callback is handed the group unit with the row API already on it
            panel.group({ label: 'settings', open: true }, (group: any) => {
                expect(group.gate).not.toBe(undefined);
                group.button({ label: 'one' });
                xnew('<p>', 'two');
            });
            expect(host.querySelectorAll('button').length).toBe(1);
            expect(host.querySelector('p')).not.toBe(null);
            expect(host.textContent).toContain('settings');
        });

        test('container wraps the header and the rows, so hiding it hides the group as a whole', () => {
            const { panel } = newPanel();
            const group = panel.group({ label: 'settings', open: true }, (group: any) => {
                group.button({ label: 'one' });
            });
            const wrapper = group.container as HTMLElement;
            expect(wrapper.textContent).toContain('settings');
            expect(wrapper.querySelector('button')).not.toBe(null);
            expect(wrapper.contains(group.current)).toBe(true);
        });

        test('groups nest, and a row reports its edits through its own event', () => {
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel);
            const received: boolean[] = [];
            panel.group({ label: 'outer', open: true }, (group: any) => {
                group.group({ label: 'inner', open: true }, (subgroup: any) => {
                    subgroup.checkbox({ label: 'flag', value: true })
                        .on('input', ({ value }: { value: boolean }) => received.push(value));
                });
            });
            expect(host.textContent).toContain('outer');
            expect(host.textContent).toContain('inner');

            jest.advanceTimersByTime(0);
            const input = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
            expect(input.checked).toBe(true);
            input.checked = false;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            expect(received).toEqual([false]);
        });
    });
});
