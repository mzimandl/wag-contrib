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
 * Horizontal motion uses a damped spring, turning is a rotation
 * around the vertical axis of the tube.
 */

export interface Periscope {
    x: number;
    /** horizontal speed in px per second */
    vx: number;
    /**
     * Rotation around the vertical axis in radians, within [0, 2π):
     * 0 = looks right, π/2 = looks at the viewer, π = looks left,
     * 3π/2 = looks away from the viewer.
     */
    heading: number;
    /** heading the periscope is turning to (HEADING_RIGHT or HEADING_LEFT) */
    targetHeading: number;
    /** 1 = turns through the front (towards the viewer), -1 = through the back */
    turnDirection: number;
    /** 0 = under water, 1 = fully raised */
    lift: number;
    /**
     * y of the water level the periscope floats on - smoothed in space
     * and time, so it does not copy every ripple (null = not set yet)
     */
    floatY: number | null;
    /** text of the word the periscope is looking at */
    spotted: string | null;
    /** word chosen to visit when the user does not control the periscope */
    wanderTarget: string | null;
    /** seconds until a new wander target is chosen */
    wanderTimer: number;
    /** on the way to a distant target - then it looks only ahead */
    traveling: boolean;
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

/**
 * Distances (px) to the target for starting / ending a travel. Two
 * different limits (hysteresis) prevent quick switching back and forth
 * when the distance is just around a single limit.
 */
const TRAVEL_START_DISTANCE = 40;
const TRAVEL_END_DISTANCE = 12;

/**
 * The periscope floats on the average surface level under it
 * (sampled over FLOAT_SPAN px) - short ripples average out.
 */
const FLOAT_SPAN = 70;
const FLOAT_SAMPLES = 7;

/**
 * Time constant (s) of the vertical smoothing: after FLOAT_TAU seconds
 * the periscope gets ~63 % of the way to the new level. Bigger = calmer,
 * but also more "lagging" behind the waves.
 */
const FLOAT_TAU = 0.3;

/** surface height function, passed in to avoid a circular import */
export type SurfaceY = (state: GameState, x: number) => number;

function averageSurface(state: GameState, x: number, surfaceY: SurfaceY): number {
    let sum = 0;
    for (let i = 0; i < FLOAT_SAMPLES; i++) {
        sum += surfaceY(state, x - FLOAT_SPAN / 2 + (i * FLOAT_SPAN) / (FLOAT_SAMPLES - 1));
    }
    return sum / FLOAT_SAMPLES;
}

/**
 * Exponential smoothing: each frame move by a fraction of the remaining
 * distance. Using 1 - exp(-dt / tau) instead of a fixed fraction keeps
 * the motion the same at any frame rate (30, 60 or 144 fps).
 */
function updateFloat(state: GameState, p: Periscope, dt: number, surfaceY: SurfaceY): void {
    const target = averageSurface(state, p.x, surfaceY);
    if (p.floatY === null) {
        p.floatY = target;
        return;
    }
    p.floatY += (target - p.floatY) * (1 - Math.exp(-dt / FLOAT_TAU));
}

/** how fast the periscope turns (radians per second) */
const TURN_SPEED = 4.5;

export const HEADING_RIGHT = 0;
export const HEADING_LEFT = Math.PI;

/**
 * Horizontal component of the viewing direction:
 * 1 = looks right, -1 = looks left, 0 = looks at the viewer.
 */
export function periscopeFacing(p: Periscope): number {
    return Math.cos(p.heading);
}

/** how fast the periscope rises at the beginning (lift units per second) */
const LIFT_SPEED = 0.6;

/** max. distance (px) of words the periscope notices on its own */
const SIGHT_RANGE = 240;

/** distance (px) from a word edge where the periscope stops to watch it */
const WATCH_DISTANCE = 50;

/** horizontal padding (px) the periscope keeps from canvas edges */
const EDGE_PADDING = 32;

export function createPeriscope(x: number): Periscope {
    return {
        x,
        vx: 0,
        heading: HEADING_RIGHT,
        targetHeading: HEADING_RIGHT,
        turnDirection: 1,
        lift: 0,
        floatY: null,
        spotted: null,
        wanderTarget: null,
        wanderTimer: 0,
        traveling: false,
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
    // retired (sinking) words are not worth a visit
    const candidates = state.words.filter((w) => !w.retired);
    if ((!target || target.retired || p.wanderTimer <= 0) && candidates.length > 0) {
        target = candidates[Math.floor(state.random() * candidates.length)];
        p.wanderTarget = target.text;
        p.wanderTimer = 4 + state.random() * 4;
    }
    return target ? watchPosition(p, target) : p.x;
}

/**
 * Which word the periscope looks at:
 * 1) the one under the pointer always wins,
 * 2) on the way somewhere - none, it looks ahead,
 * 3) when it came to visit a word on its own - that word,
 * 4) otherwise the nearest one in sight.
 */
function findSpotted(state: GameState, p: Periscope): FloatingWord | null {
    const hovered = findWord(state, state.hovered);
    if (hovered) {
        return hovered;
    }
    if (p.traveling) {
        return null;
    }
    if (!state.pointer) {
        const visited = findWord(state, p.wanderTarget);
        if (visited) {
            return visited;
        }
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

export function stepPeriscope(
    state: GameState,
    dt: number,
    surfaceY: SurfaceY
): void {
    const p = state.periscope;
    p.lift = Math.min(1, p.lift + LIFT_SPEED * dt);

    const minX = EDGE_PADDING;
    const maxX = state.width - EDGE_PADDING;
    const targetX = Math.max(minX, Math.min(maxX, chooseTargetX(state, p, dt)));
    const distance = Math.abs(targetX - p.x);
    p.traveling = p.traveling
        ? distance > TRAVEL_END_DISTANCE
        : distance > TRAVEL_START_DISTANCE;

    // semi-implicit Euler integration: first update velocity from
    // acceleration, then position from the *new* velocity - simple
    // and (unlike the plain Euler method) stable for springs
    const accel = SPRING_STIFFNESS * (targetX - p.x) - SPRING_DAMPING * p.vx;
    p.vx += accel * dt;
    p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
    p.x += p.vx * dt;
    updateFloat(state, p, dt, surfaceY);

    const spotted = findSpotted(state, p);
    p.spotted = spotted ? spotted.text : null;

    // look at the spotted word, otherwise in the direction of travel
    let desired = p.targetHeading;
    if (spotted) {
        desired = spotted.x >= p.x ? HEADING_RIGHT : HEADING_LEFT;
    } else if (Math.abs(p.vx) > 15) {
        desired = p.vx > 0 ? HEADING_RIGHT : HEADING_LEFT;
    }
    if (desired !== p.targetHeading) {
        p.turnDirection = isTurning(p)
            ? // changed mind in the middle of a turn - go back the short way
              Math.sign(signedAngle(desired - p.heading)) || 1
            : // a new turn - through the front or the back, by chance
              state.random() < 0.5
              ? 1
              : -1;
        p.targetHeading = desired;
    }
    rotateTowardsTarget(p, TURN_SPEED * dt);
}

const TWO_PI = 2 * Math.PI;

/** angle normalized to [0, 2π) */
function normalizeAngle(a: number): number {
    return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

/** angle normalized to [-π, π) - the shortest rotation */
function signedAngle(a: number): number {
    return normalizeAngle(a + Math.PI) - Math.PI;
}

function isTurning(p: Periscope): boolean {
    return Math.abs(signedAngle(p.targetHeading - p.heading)) > 1e-6;
}

/**
 * Rotate in `turnDirection` by at most `maxStep` radians. The remaining
 * angle is measured in the direction of rotation, so it can be almost
 * a full circle - that is the "long way" through the back or the front.
 */
function rotateTowardsTarget(p: Periscope, maxStep: number): void {
    const remaining = normalizeAngle(
        (p.targetHeading - p.heading) * p.turnDirection
    );
    if (remaining < 1e-6) {
        p.heading = p.targetHeading;
        return;
    }
    const step = Math.min(remaining, maxStep);
    p.heading = normalizeAngle(p.heading + step * p.turnDirection);
}
