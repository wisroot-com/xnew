import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { CPUAgent, CPUMove } from '../../../src/basics/stage/CPUAgent';

//----------------------------------------------------------------------------------------------------
// CPUAgent が持つのは「間合いと寿命」だけで、何を出すかは think、どう届けるかは play にある。
// なのでここで確かめるのはその 2 つだけ: いつ play が呼ばれ（待ってから / 手番が動いたら捨てて /
// 弾かれたら上限まで）、いつ呼ばれないか（isAgent が断る席、誰の番でもないとき、unit が消えた後）。
//----------------------------------------------------------------------------------------------------

describe('basics CPUAgent', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    // delay の幅を 0 にすると Math.random() が効かないので、間合いはちょうど 100ms になる
    const DELAY: [number, number] = [100, 100];

    function agent(props: any): { unit: xnew.Unit, played: string[] } {
        const played: string[] = [];
        const unit = xnew(CPUAgent, {
            delay: DELAY,
            play: (move: CPUMove, id: string) => played.push(`${id}:${move.type}`),
            ...props,
        });
        return { unit, played };
    }

    it('waits the delay, then plays what think returned', () => {
        let turn = 'cpu';
        const { played } = agent({ turn: () => turn, think: (id: string) => ({ type: 'play', data: { id } }) });

        jest.advanceTimersByTime(50);   // update は流れているが、まだ間合いの途中
        expect(played).toEqual([]);

        jest.advanceTimersByTime(100);
        expect(played).toEqual(['cpu:play']);
    });

    it('drops the move when the turn moved on while it was waiting', () => {
        let turn = 'cpu1';
        const { played } = agent({ turn: () => turn, think: () => ({ type: 'play' }) });

        jest.advanceTimersByTime(50);
        turn = 'cpu2';                  // 待っている間に手番が動いた
        jest.advanceTimersByTime(200);

        // cpu1 のぶんは捨てられ、動いた先の cpu2 のぶんが改めて間合いを取り直す
        expect(played).toEqual(['cpu2:play']);
    });

    it('places another when the move was refused, up to the attempt limit', () => {
        // 手番が動かない = 弾かれた、とみなす。ここでは play が何もしないので永遠に動かない
        const { played } = agent({ turn: () => 'cpu', think: () => ({ type: 'play' }), attempts: 3 });

        jest.advanceTimersByTime(1000);
        expect(played).toEqual(['cpu:play', 'cpu:play', 'cpu:play']);

        jest.advanceTimersByTime(1000);   // 上限で諦めるので、その先は増えない
        expect(played).toHaveLength(3);
    });

    it('never plays for a seat isAgent turns down, nor for an empty turn', () => {
        let turn = 'human';
        const { played } = agent({
            turn: () => turn,
            think: () => ({ type: 'play' }),
            isAgent: (id: string) => id.startsWith('cpu') === true,
            attempts: 1,
        });

        jest.advanceTimersByTime(500);
        turn = '';
        jest.advanceTimersByTime(500);
        expect(played).toEqual([]);

        turn = 'cpu1';
        jest.advanceTimersByTime(500);
        expect(played).toEqual(['cpu1:play']);
    });

    it('takes a pending move with it when the unit is destroyed', () => {
        const { unit, played } = agent({ turn: () => 'cpu', think: () => ({ type: 'play' }) });

        jest.advanceTimersByTime(50);
        unit.destroy();
        jest.advanceTimersByTime(1000);

        expect(played).toEqual([]);
    });

    it('plays nothing when think cannot decide, and still stops at the limit', () => {
        const { played } = agent({ turn: () => 'cpu', think: () => null, attempts: 2 });

        jest.advanceTimersByTime(1000);
        expect(played).toEqual([]);
    });
});
