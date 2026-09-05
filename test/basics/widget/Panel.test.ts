import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Panel } from '../../../src/basics/widget/Panel';
import { Button } from '../../../src/basics/element/Button';
import { InputRange } from '../../../src/basics/element/InputRange';
import { InputCheckbox } from '../../../src/basics/element/InputCheckbox';
import { Listbox } from '../../../src/basics/element/Listbox';

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
            expect((panel.element as HTMLElement).querySelector('button')).not.toBe(null);
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

        test('shows the group keyed with the active tab and hides the groups keyed for the others', () => {
            const { host, panel } = newPanel();
            panel.tabs.items = ['left', 'right'];
            const left = panel.group({ key: 'left' }, (group: any) => group.button({ name: 'a' }));
            const right = panel.group({ key: 'right' }, (group: any) => group.button({ name: 'b' }));
            jest.advanceTimersByTime(1);

            expect((left.container as HTMLElement).style.display).not.toBe('none');
            expect((right.container as HTMLElement).style.display).toBe('none');

            tabButton(host, 'right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((left.container as HTMLElement).style.display).toBe('none');
            expect((right.container as HTMLElement).style.display).not.toBe('none');
        });

        test('leaves plain rows alone, even ones keyed with a tab name', () => {
            const { host, panel } = newPanel();
            panel.tabs.items = ['left', 'right'];
            const row = panel.range({ name: 'a', key: 'right' });
            const shared = panel.checkbox({ name: 'shared' });
            jest.advanceTimersByTime(1);

            expect((row.container as HTMLElement).style.display).toBe('flex');
            tabButton(host, 'right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((row.container as HTMLElement).style.display).toBe('flex');
            expect((shared.container as HTMLElement).style.display).toBe('flex');
        });

        test('a collapsible group switches as a whole, header included', () => {
            const { host, panel } = newPanel();
            panel.tabs.items = ['left', 'right'];
            const group = panel.group({ name: 'folder', open: true, key: 'right' }, (group: any) => {
                group.button({ name: 'inside' });
            });
            jest.advanceTimersByTime(1);

            expect((group.container as HTMLElement).style.display).toBe('none');
            tabButton(host, 'right').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect((group.container as HTMLElement).textContent).toContain('folder');
            expect((group.container as HTMLElement).style.display).not.toBe('none');
        });

        test('tabs.items reads back the names it was given', () => {
            const { panel } = newPanel();
            panel.tabs.items = ['left', 'right'];
            expect(panel.tabs.items).toEqual(['left', 'right']);
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

        test('a group key finds the group unit itself, since a group is a nested Panel', () => {
            const { panel } = newPanel();
            const group = panel.group({ name: 'settings', open: true, key: 'settings-group' }, (group: any) => {
                group.button({ name: 'one', key: 'inner-button' });
            });
            expect(xnew.find(Panel, { key: 'settings-group' })[0]).toBe(group);
            expect(xnew.find(Button, { key: 'inner-button', parent: group }).length).toBe(1);
        });
    });

    describe('group', () => {
        test('builds the rows of its inner callback inside the created group', () => {
            const { host, panel } = newPanel();
            panel.group({ name: 'settings', open: true }, (group: any) => {
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
            expect(wrapper.contains(group.element)).toBe(true);
        });

        test('groups nest, and a nested group shares the outer params object', () => {
            const params: Record<string, any> = {};
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { params });
            panel.group({ name: 'outer', open: true }, (group: any) => {
                group.group({ name: 'inner', open: true }, (subgroup: any) => {
                    subgroup.checkbox({ name: 'flag', value: true });
                });
            });
            expect(params.flag).toBe(true);
            expect(host.textContent).toContain('outer');
            expect(host.textContent).toContain('inner');
        });
    });
});
