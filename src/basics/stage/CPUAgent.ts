//----------------------------------------------------------------------------------------------------
// CPUAgent — plays the turns a machine holds: waits a beat, asks `think` for a move, hands it to `play`
// It owns only the timing and the lifetime. What to play is `think`'s and how to deliver it is `play`'s,
// so the same agent drives a local game and a networked one (play → xsync.cpu.dispatch) unchanged.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

// the move as the game already receives it from a person, so a machine's turn takes the same path and the same checks
export interface CPUMove {
    type: string;
    data?: Record<string, any>;
}

export function CPUAgent(unit: xnew.Unit,
    { turn, think, play, isAgent = () => true, delay = [600, 1400], attempts = 3 }:
    {
        turn: () => string,
        think: (id: string) => CPUMove | null,
        play: (move: CPUMove, id: string) => void,
        isAgent?: (id: string) => boolean,
        delay?: [number, number],
        attempts?: number,
    }
): void {
    let current = '';
    let tried = 0;
    let timer: xnew.Timer | null = null;

    function act(): void {
        timer = null;

        // the turn may have moved on while this was waiting, and that move is stale by now
        if (turn() !== current || isAgent(current) === false) {
            return;
        }

        const move = think(current);

        if (move !== null) {
            play(move, current);
        }

        // the same turn still standing means the move was refused or never decided: place another, up to the limit
        if (turn() === current) {
            tried++;
            if (tried < attempts) {
                schedule();
            }
        }
    }

    // a beat before the move, so a person can read that the machine has just played
    function schedule(): void {
        const [min, max] = delay;

        timer = xnew.timeout(act, min + Math.random() * (max - min));
    }

    // the turn arrives as state rather than as an event, so update is the only place its change shows
    unit.on('update', () => {
        const id = turn();

        if (id === current) {
            return;
        }
        current = id;
        tried = 0;
        timer?.clear();
        timer = null;

        // '' is nobody's turn; the timer hangs on this unit, so a teardown takes the pending move with it
        if (id !== '' && isAgent(id) === true) {
            schedule();
        }
    });
}
