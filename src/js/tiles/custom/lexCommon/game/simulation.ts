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

import { createPeriscope, Periscope, stepPeriscope } from './periscope.js';

/**
 * Pure game simulation - no DOM, no canvas. Everything here
 * is just numbers, so it can be easily tested (or one day
 * rewritten to WebAssembly) without touching rendering.
 */

export interface Wave {
    /** height of the wave in px */
    amplitude: number;
    /** distance between two crests in px */
    length: number;
    /** horizontal speed in px per second */
    speed: number;
    /** initial phase shift in radians */
    phase: number;
}

export interface Glyph {
    char: string;
    /** horizontal offset of the glyph center from the word center in px */
    dx: number;
    width: number;
}

export interface FloatingWord {
    text: string;
    /** individual letters - each of them can bend with the surface */
    glyphs: Array<Glyph>;
    /** horizontal position of the word center in px */
    x: number;
    /** horizontal drift speed in px per second */
    vx: number;
    /** rendered width of the text in px (measured by the renderer) */
    width: number;
    /** seconds since the word appeared */
    age: number;
    /** how long the word stays on the surface (seconds) */
    lifetime: number;
}

/**
 * Text measuring depends on canvas (fonts), so the simulation
 * gets it as a function from outside.
 */
export type MeasureText = (text: string) => number;

/** font size of floating words in px (used for hit testing) */
export const WORD_FONT_SIZE = 20;

export interface PointerPosition {
    x: number;
    y: number;
}

export interface GameState {
    /** elapsed game time in seconds */
    time: number;
    /**
     * Time used for wave motion. It runs slower in calm mode, so we keep
     * it separately - changing speed of `time` itself would make waves
     * jump (their phase depends on speed * time).
     */
    waveTime: number;
    /** calm sea for users who prefer reduced motion */
    calm: boolean;
    width: number;
    height: number;
    /** y coordinate of the calm sea surface (ratio of height) */
    seaLevelRatio: number;
    waves: Array<Wave>;
    /** pool of words we can pick from */
    vocabulary: Array<string>;
    words: Array<FloatingWord>;
    /** seconds remaining until we try to spawn another word */
    spawnTimer: number;
    periscope: Periscope;
    /** pointer position over the canvas, null if outside */
    pointer: PointerPosition | null;
    /** text of the word under the pointer */
    hovered: string | null;
    random: () => number;
}

/** wave speed and amplitude multipliers in calm mode */
const CALM_WAVE_SPEED = 0.25;
const CALM_WAVE_AMPLITUDE = 0.35;

/** max. number of words floating at the same time */
const MAX_WORDS = 5;

/** time needed for a word to emerge/submerge (seconds) */
export const FADE_TIME = 1.2;

/** min. free space between two words in px */
const WORD_GAP = 24;

export function createState(
    width: number,
    height: number,
    vocabulary: Array<string>,
    random: () => number = Math.random
): GameState {
    return {
        time: 0,
        waveTime: 0,
        calm: false,
        width,
        height,
        seaLevelRatio: 0.45,
        // a few waves with "unrelated" lengths, so the sum
        // does not look periodic
        waves: [
            { amplitude: 6, length: 220, speed: 30, phase: 0 },
            { amplitude: 3, length: 97, speed: -18, phase: 1.3 },
            { amplitude: 1.5, length: 41, speed: 45, phase: 2.1 },
        ],
        vocabulary,
        words: [],
        spawnTimer: 0,
        periscope: createPeriscope(width / 2),
        pointer: null,
        hovered: null,
        random,
    };
}

export function resize(state: GameState, width: number, height: number): void {
    state.width = width;
    state.height = height;
}

function randomBetween(state: GameState, min: number, max: number): number {
    return min + state.random() * (max - min);
}

/**
 * Try to place a new word on a free spot of the surface.
 * Returns false if there is no room or no unused word.
 */
function trySpawnWord(state: GameState, measure: MeasureText): boolean {
    const unused = state.vocabulary.filter(
        (text) => !state.words.some((w) => w.text === text)
    );
    if (unused.length === 0) {
        return false;
    }
    const text = unused[Math.floor(state.random() * unused.length)];
    const width = measure(text);
    // glyph positions from widths of growing prefixes - this way
    // the kerning of the whole word is (mostly) preserved
    const glyphs = Array.from(text).map((char, i, chars) => {
        const left = measure(chars.slice(0, i).join(''));
        const glyphWidth = measure(char);
        return {
            char,
            dx: left + glyphWidth / 2 - width / 2,
            width: glyphWidth,
        };
    });

    // a few random attempts are simpler than computing free intervals
    for (let attempt = 0; attempt < 10; attempt++) {
        const x = randomBetween(state, width / 2, state.width - width / 2);
        const collides = state.words.some(
            (w) => Math.abs(w.x - x) < (w.width + width) / 2 + WORD_GAP
        );
        if (!collides) {
            state.words.push({
                text,
                glyphs,
                x,
                vx: randomBetween(state, -8, 8),
                width,
                age: 0,
                lifetime: randomBetween(state, 8, 14),
            });
            return true;
        }
    }
    return false;
}

/**
 * Advance the simulation by `dt` seconds. We mutate the state
 * in place - allocating new objects 60x per second would only
 * give work to the garbage collector.
 */
export function step(state: GameState, dt: number, measure: MeasureText): void {
    state.time += dt;
    state.waveTime += dt * (state.calm ? CALM_WAVE_SPEED : 1);

    for (const w of state.words) {
        w.age += dt;
        // the word user points at must not escape or disappear
        // under their hands
        if (w.text === state.hovered) {
            w.age = Math.min(w.age, w.lifetime - FADE_TIME);
        } else {
            w.x += w.vx * dt;
        }
    }
    // words drift and could overlap - when two of them get too close
    // and move towards each other, they "bounce": in a 1D elastic
    // collision of equal masses the objects simply swap velocities
    for (let i = 0; i < state.words.length; i++) {
        for (let j = i + 1; j < state.words.length; j++) {
            const [a, b] =
                state.words[i].x < state.words[j].x
                    ? [state.words[i], state.words[j]]
                    : [state.words[j], state.words[i]];
            const minDist = (a.width + b.width) / 2 + WORD_GAP / 2;
            if (b.x - a.x < minDist && a.vx > b.vx) {
                [a.vx, b.vx] = [b.vx, a.vx];
            }
        }
    }
    // remove words which are too old or drifted away
    state.words = state.words.filter(
        (w) =>
            w.age < w.lifetime &&
            w.x > -w.width / 2 &&
            w.x < state.width + w.width / 2
    );

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.words.length < MAX_WORDS) {
        trySpawnWord(state, measure);
        state.spawnTimer = randomBetween(state, 0.8, 2.5);
    }

    const hovered = state.pointer
        ? wordAt(state, state.pointer.x, state.pointer.y)
        : null;
    state.hovered = hovered ? hovered.text : null;

    stepPeriscope(state, dt);
}

/**
 * Hit testing - which word is at the given point. We ignore the
 * small tilt of letters and use a box around the word baseline,
 * slightly enlarged so the words are easy to hit (also by fingers).
 */
export function wordAt(
    state: GameState,
    x: number,
    y: number
): FloatingWord | null {
    const padding = 6;
    for (const w of state.words) {
        if (wordVisibility(w) < 0.5) {
            continue;
        }
        const half = w.width / 2;
        if (x < w.x - half - padding || x > w.x + half + padding) {
            continue;
        }
        const baseline = wordBaselineY(state, w, wordPose(state, w), x - w.x);
        if (y > baseline - WORD_FONT_SIZE - padding && y < baseline + padding) {
            return w;
        }
    }
    return null;
}

/**
 * How much the word "emerged" from the sea: 0 = under water,
 * 1 = fully visible. Rises at the beginning, sinks at the end.
 */
export function wordVisibility(w: FloatingWord): number {
    const fadeIn = w.age / FADE_TIME;
    const fadeOut = (w.lifetime - w.age) / FADE_TIME;
    return Math.max(0, Math.min(1, fadeIn, fadeOut));
}

/**
 * Returns y coordinate of the sea surface at horizontal position x.
 * Surface is a sum of sine waves: y = A * sin(k * (x - v * t) + phase),
 * where k = 2π / length is the "wave number".
 */
export function surfaceY(state: GameState, x: number): number {
    let y = state.height * state.seaLevelRatio;
    const amplitudeScale = state.calm ? CALM_WAVE_AMPLITUDE : 1;
    for (const w of state.waves) {
        const k = (2 * Math.PI) / w.length;
        y += amplitudeScale * w.amplitude * Math.sin(k * (x - w.speed * state.waveTime) + w.phase);
    }
    return y;
}

/** number of surface samples under a word used to fit its pose */
const POSE_SAMPLES = 9;

/**
 * How much the word bends with the surface: 0 = rigid plank,
 * 1 = every letter follows the water exactly (a ribbon).
 */
export const WORD_FLEX = 0.5;

export interface WordPose {
    /** y of the fitted line at the word center */
    lineY: number;
    /** slope (dy/dx) of the fitted line */
    slope: number;
    /** downward shift which keeps the word from hovering */
    shift: number;
}

/**
 * Position and tilt of a floating word - like a slightly flexible
 * plank lying on water.
 *
 * 1) We sample the surface under the word and fit a line through
 *    the samples (least squares). Its slope gives the tilt - short
 *    ripples average out, long waves rock the word.
 * 2) Letters are then bent towards the real surface by WORD_FLEX
 *    (see wordBaselineY).
 * 3) Such a baseline would hover above water in troughs, so we shift
 *    it down just enough to touch the water at the deepest point.
 *    The word then sits on the water everywhere and is covered only
 *    where a crest rises - and the more flexible, the less.
 */
export function wordPose(state: GameState, w: FloatingWord): WordPose {
    const half = w.width / 2;
    const dx = (2 * half) / (POSE_SAMPLES - 1);

    // samples are symmetric around w.x, so mean x is w.x itself
    // and the least squares slope is sum(x * y) / sum(x * x)
    // (with x measured relative to the word center)
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < POSE_SAMPLES; i++) {
        const x = -half + i * dx;
        const y = surfaceY(state, w.x + x);
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }
    const lineY = sumY / POSE_SAMPLES;
    const slope = sumXX > 0 ? sumXY / sumXX : 0;

    // largest distance of the surface below the fitted line
    // (canvas y grows downwards, so "below" means bigger y)
    let maxDepth = 0;
    for (let i = 0; i < POSE_SAMPLES; i++) {
        const x = -half + i * dx;
        const depth = surfaceY(state, w.x + x) - (lineY + slope * x);
        maxDepth = Math.max(maxDepth, depth);
    }

    // the bent baseline is "line + FLEX * (surface - line)", so its
    // distance below the surface is (1 - FLEX) * (line - surface);
    // shifting by (1 - FLEX) * maxDepth makes it non-negative everywhere
    return { lineY, slope, shift: (1 - WORD_FLEX) * maxDepth };
}

/**
 * Baseline y of the word at horizontal offset dx from its center.
 */
export function wordBaselineY(
    state: GameState,
    w: FloatingWord,
    pose: WordPose,
    dx: number
): number {
    const line = pose.lineY + pose.slope * dx;
    const surface = surfaceY(state, w.x + dx);
    return line + WORD_FLEX * (surface - line) + pose.shift;
}
