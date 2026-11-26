/*
 * Copyright 2026 Martin Zimandl <martin.zimandl@gmail.com>
 * Copyright 2026 Institute of the Czech National Corpus,
 *                Faculty of Arts, Charles University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { FloatingWord, GameState } from './simulation.js';

/**
 * Periscope simulation (pure numbers, same as simulation.ts).
 * Horizontal motion uses a damped spring, the "turning" of the
 * periscope is just a number going from -1 (looks left) to 1
 * (looks right) which the renderer uses as horizontal scale.
 */

export interface Periscope {
    x: number;
    /** horizontal speed in px per second */
    vx: number;
    /** -1 = looks left, 1 = looks right; values between = turning */
    facing: number;
    /** 0 = under water, 1 = fully raised */
    lift: number;
    /** text of the word the periscope is looking at */
    spotted: string | null;
    /** word chosen to visit when the user does not control the periscope */
    wanderTarget: string | null;
    /** seconds until a new wander target is chosen */
    wanderTimer: number;
}

/**
 * Spring stiffness (1/s²). Acceleration towards the target is
 * a = k * distance - c * velocity. With c = 2 * sqrt(k) the spring
 * is "critically damped" - it gets to the target as fast as
 * possible without overshooting and oscillating around it.
 */
const SPRING_STIFFNESS = 5;
const SPRING_DAMPING = 2 * Math.sqrt(SPRING_STIFFNESS);

const MAX_SPEED = 220;

/** how fast the periscope turns (facing units per second) */
const TURN_SPEED = 3.5;

/** how fast the periscope rises at the beginning (lift units per second) */
const LIFT_SPEED = 0.6;

/** max. distance (px) of words the periscope notices on its own */
const SIGHT_RANGE = 240;

/** distance (px) from a word edge where the periscope stops to watch it */
const WATCH_DISTANCE = 45;

/** horizontal padding (px) the periscope keeps from canvas edges */
const EDGE_PADDING = 25;

export function createPeriscope(x: number): Periscope {
    return {
        x,
        vx: 0,
        facing: 1,
        lift: 0,
        spotted: null,
        wanderTarget: null,
        wanderTimer: 0,
    };
}

function findWord(state: GameState, text: string | null): FloatingWord | null {
    return text === null
        ? null
        : state.words.find((w) => w.text === text) || null;
}

/** a place next to the word, on the side where the periscope already is */
function watchPosition(p: Periscope, w: FloatingWord): number {
    const side = p.x < w.x ? -1 : 1;
    return w.x + side * (w.width / 2 + WATCH_DISTANCE);
}

function chooseTargetX(state: GameState, p: Periscope, dt: number): number {
    // 1) user points at a word - go and watch it
    const hovered = findWord(state, state.hovered);
    if (hovered) {
        return watchPosition(p, hovered);
    }
    // 2) user moves the pointer over the sea - follow it
    if (state.pointer) {
        return state.pointer.x;
    }
    // 3) nobody plays with us - visit random words
    p.wanderTimer -= dt;
    let target = findWord(state, p.wanderTarget);
    if ((!target || p.wanderTimer <= 0) && state.words.length > 0) {
        target =
            state.words[Math.floor(state.random() * state.words.length)];
        p.wanderTarget = target.text;
        p.wanderTimer = 4 + state.random() * 4;
    }
    return target ? watchPosition(p, target) : p.x;
}

/** the nearest word in sight; the hovered one always wins */
function findSpotted(state: GameState, p: Periscope): FloatingWord | null {
    const hovered = findWord(state, state.hovered);
    if (hovered) {
        return hovered;
    }
    let best: FloatingWord | null = null;
    let bestDist = SIGHT_RANGE;
    for (const w of state.words) {
        const dist = Math.abs(w.x - p.x) - w.width / 2;
        if (dist < bestDist && w.age > 0.5) {
            best = w;
            bestDist = dist;
        }
    }
    return best;
}

export function stepPeriscope(state: GameState, dt: number): void {
    const p = state.periscope;
    p.lift = Math.min(1, p.lift + LIFT_SPEED * dt);

    const minX = EDGE_PADDING;
    const maxX = state.width - EDGE_PADDING;
    const targetX = Math.max(minX, Math.min(maxX, chooseTargetX(state, p, dt)));

    // semi-implicit Euler integration: first update velocity from
    // acceleration, then position from the *new* velocity - simple
    // and (unlike the plain Euler method) stable for springs
    const accel = SPRING_STIFFNESS * (targetX - p.x) - SPRING_DAMPING * p.vx;
    p.vx += accel * dt;
    p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
    p.x += p.vx * dt;

    const spotted = findSpotted(state, p);
    p.spotted = spotted ? spotted.text : null;

    // look at the spotted word, otherwise in the direction of travel
    let desired = p.facing >= 0 ? 1 : -1;
    if (spotted) {
        desired = spotted.x >= p.x ? 1 : -1;
    } else if (Math.abs(p.vx) > 15) {
        desired = p.vx > 0 ? 1 : -1;
    }
    const maxTurn = TURN_SPEED * dt;
    p.facing += Math.max(-maxTurn, Math.min(maxTurn, desired - p.facing));
}
