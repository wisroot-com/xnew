import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Panel, PanelGroup } from '../../../src/basics/widget/Panel';
import { Button } from '../../../src/basics/element/Button';
import { InputRange } from '../../../src/basics/element/InputRange';
import { InputCheckbox } from '../../../src/basics/element/InputCheckbox';
import { Listbox } from '../../../src/basics/element/Listbox';
import { Accordion } from '../../../src/basics/widget/Accordion';

describe('basics Panel', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    function newPanel(): { host: HTMLElement, panel: any } {
        const host = document.createElement('div');
        return { host, panel: xnew(host, Panel) };
    }

    describe('open', () => {
        test('an open value makes the panel collapsible, exposing its gate', () => {
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { name: 'GUI', open: true });
            panel.button({ name: 'one' });
            expect(host.textContent).toContain('GUI');
            expect(panel.gate).not.toBe(undefined);
            expect((panel.current as HTMLElement).querySelector('button')).not.toBe(null);
        });

        test('leaving open undefined keeps the rows always shown, with no header and no gate', () => {
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { name: 'GUI' });
            panel.button({ name: 'one' });
            expect(host.textContent).not.toContain('GUI');
            expect(panel.gate).toBe(undefined);
            expect(host.querySelector('button')).not.toBe(null);
        });
    });

    describe('tabs', () => {
        function tabButton(host: HTMLElement, name: string): HTMLElement {
            return [...host.querySelectorAll('button')].find((button) => button.textContent === name) as HTMLElement;
        }

        const NAMES = { left: 'Left', right: 'Right' };

        test('the strip switches the sibling groups its names key, the first one starting active', () => {
            const { host, panel } = newPanel();
            panel.tabs({ names: NAMES });
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ name: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ name: 'b' }));

            expect((left.container as HTMLElement).style.display).not.toBe('none');
            expect((right.container as HTMLElement).style.display).toBe('none');

            jest.advanceTimersByTime(1);
            tabButton(host, 'Right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((left.container as HTMLElement).style.display).toBe('none');
            expect((right.container as HTMLElement).style.display).not.toBe('none');
        });

        test('the strip can be built after its groups, so it goes wherever the caller wants it', () => {
            const { host, panel } = newPanel();
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ name: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ name: 'b' }));
            panel.tabs({ names: NAMES });

            expect((left.container as HTMLElement).style.display).not.toBe('none');
            expect((right.container as HTMLElement).style.display).toBe('none');

            jest.advanceTimersByTime(1);
            tabButton(host, 'Right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((right.container as HTMLElement).style.display).not.toBe('none');
        });

        test('leaves rows and groups no tab names alone', () => {
            const { host, panel } = newPanel();
            panel.tabs({ names: NAMES });
            panel.group({ key: 'right' }, (group: any) => group.button({ name: 'b' }));
            const row = panel.range({ name: 'a' });
            const plain = panel.group({}, (group: any) => group.button({ name: 'c' }));

            jest.advanceTimersByTime(1);
            tabButton(host, 'Right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((row.container as HTMLElement).style.display).toBe('flex');
            expect((plain.container as HTMLElement).style.display).toBe('');
        });

        test('a collapsible group switches as a whole, header included', () => {
            const { host, panel } = newPanel();
            panel.tabs({ names: NAMES });
            panel.group({ key: 'left' }, (group: any) => group.button({ name: 'a' }));
            const group = panel.group({ name: 'folder', open: true, key: 'right' }, (group: any) => {
                group.button({ name: 'inside' });
            });

            expect((group.container as HTMLElement).style.display).toBe('none');
            jest.advanceTimersByTime(1);
            tabButton(host, 'Right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((group.container as HTMLElement).textContent).toContain('folder');
            expect((group.container as HTMLElement).style.display).not.toBe('none');
        });

        test("select() switches from code and fires '-change' on the strip, like a press does", () => {
            const { host, panel } = newPanel();
            const values: string[] = [];
            const tabs = panel.tabs({ names: NAMES });
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ name: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ name: 'b' }));

            tabs.on('-change', ({ value }: { value: string }) => values.push(value));

            jest.advanceTimersByTime(1);
            tabButton(host, 'Right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(tabs.active).toBe('right');

            tabs.select('left');
            expect((left.container as HTMLElement).style.display).not.toBe('none');
            expect((right.container as HTMLElement).style.display).toBe('none');
            expect(tabs.active).toBe('left');
            expect(values).toEqual(['right', 'left']);
        });

        test('select() ignores a key the strip does not name', () => {
            const { panel } = newPanel();
            const tabs = panel.tabs({ names: NAMES });
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ name: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ name: 'b' }));

            tabs.select('nowhere');
            expect(tabs.active).toBe('left');
            expect((left.container as HTMLElement).style.display).not.toBe('none');
            expect((right.container as HTMLElement).style.display).toBe('none');
        });
    });

    describe('key', () => {
        test('a row key reaches its control, so xnew.find locates the row by that component', () => {
            const { panel } = newPanel();
            panel.button({ name: 'go', key: 'go-button' });
            panel.range({ name: 'data', key: 'data-range' });
            panel.checkbox({ name: 'flag', key: 'flag-box' });
            panel.listbox({ name: 'color', items: ['red', 'blue'], key: 'color-list' });

            expect(xnew.find(Button, { key: 'go-button' }).length).toBe(1);
            expect(xnew.find(InputRange, { key: 'data-range' }).length).toBe(1);
            expect(xnew.find(InputCheckbox, { key: 'flag-box' }).length).toBe(1);
            expect(xnew.find(Listbox, { key: 'color-list' }).length).toBe(1);
        });

        test('a group key reaches the group unit through PanelGroup, so a host outside can find it', () => {
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { key: 'panel' });
            const messages = panel.group({ key: 'messages' }, (group: any) => group.button({ name: 'one' }));

            expect(xnew.find(PanelGroup, { key: 'panel' })[0]).toBe(panel);
            expect(xnew.find(PanelGroup, { ancestor: panel, key: 'messages' })[0]).toBe(messages);
        });

        test('a group key reaches the group unit itself, so its own components find it', () => {
            const { panel } = newPanel();
            const group = panel.group({ name: 'settings', open: true, key: 'settings-group' }, (group: any) => {
                group.button({ name: 'one', key: 'inner-button' });
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
            panel.group({ name: 'settings', open: true }, (group: any) => {
                expect(group.gate).not.toBe(undefined);
                group.button({ name: 'one' });
                xnew('<p>', 'two');
            });
            expect(host.querySelectorAll('button').length).toBe(1);
            expect(host.querySelector('p')).not.toBe(null);
            expect(host.textContent).toContain('settings');
        });

        test('container wraps the header and the rows, so hiding it hides the group as a whole', () => {
            const { panel } = newPanel();
            const group = panel.group({ name: 'settings', open: true }, (group: any) => {
                group.button({ name: 'one' });
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
            panel.group({ name: 'outer', open: true }, (group: any) => {
                group.group({ name: 'inner', open: true }, (subgroup: any) => {
                    subgroup.checkbox({ name: 'flag', value: true })
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
