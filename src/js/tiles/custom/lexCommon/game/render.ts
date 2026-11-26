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

import { Color } from 'cnc-tskit';
import { Theme } from '../../../../page/theme.js';
import {
    GameState,
    MeasureText,
    surfaceY,
    WORD_FONT_SIZE,
    wordBaselineY,
    wordPose,
    wordVisibility,
} from './simulation.js';

export interface GameStyle {
    sky: string;
    seaTop: string;
    seaBottom: string;
    word: string;
    wordSpotted: string;
    periscope: string;
    periscopeAccent: string;
    /** CSS font shorthand used for words (canvas accepts the same syntax) */
    font: string;
}

/** colors of the Slovoskop logo */
const LOGO_BLUE = '#093b79';
const LOGO_BLUE_DARK_VARIANT = '#ced8e4';
const LOGO_RED = '#f80d39';

function isDarkColor(color: string): boolean {
    const [r, g, b] = Color.importColor(1, color);
    // perceived brightness - human eye is most sensitive to green
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

/**
 * Game colors derived from the current page theme. The sky blends
 * with the tile background; on a dark background we use the colors
 * of the dark logo variant (light blue instead of the dark one).
 */
export function createGameStyle(theme: Theme): GameStyle {
    const sky = theme.tileBackgroundColor || '#ffffff';
    const font = `600 ${WORD_FONT_SIZE}px ${theme.defaultFontFamily}`;
    if (isDarkColor(sky)) {
        return {
            sky,
            seaTop: '#0d3a66',
            seaBottom: '#04182e',
            word: LOGO_BLUE_DARK_VARIANT,
            wordSpotted: '#ff4d6a',
            periscope: LOGO_BLUE_DARK_VARIANT,
            periscopeAccent: LOGO_RED,
            font,
        };
    }
    return {
        sky,
        seaTop: '#2f68b0',
        seaBottom: LOGO_BLUE,
        word: LOGO_BLUE,
        wordSpotted: LOGO_RED,
        periscope: LOGO_BLUE,
        periscopeAccent: LOGO_RED,
        font,
    };
}

/** how deep (px) is the text baseline under the surface */
const WORD_DRAFT = 2;

/** how deep (px) the word sinks when it disappears */
const WORD_SINK_DEPTH = 28;

/**
 * Creates text measuring function for the simulation. Font must be
 * the same as the one used for drawing, otherwise widths will not fit.
 */
export function createMeasure(
    ctx: CanvasRenderingContext2D,
    style: GameStyle
): MeasureText {
    return (text) => {
        ctx.font = style.font;
        return ctx.measureText(text).width;
    };
}

/** horizontal distance between sampled surface points in px */
const SURFACE_STEP = 8;

function drawSea(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    style: GameStyle
): void {
    // the surface is approximated by a polyline sampled every few pixels
    ctx.beginPath();
    ctx.moveTo(0, state.height);
    for (let x = 0; x <= state.width + SURFACE_STEP; x += SURFACE_STEP) {
        ctx.lineTo(x, surfaceY(state, x));
    }
    ctx.lineTo(state.width, state.height);
    ctx.closePath();

    const seaTop = state.height * state.seaLevelRatio;
    const gradient = ctx.createLinearGradient(0, seaTop, 0, state.height);
    gradient.addColorStop(0, style.seaTop);
    gradient.addColorStop(1, style.seaBottom);
    ctx.fillStyle = gradient;
    ctx.fill();
}

function drawWords(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    style: GameStyle
): void {
    ctx.font = style.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const w of state.words) {
        ctx.fillStyle =
            w.text === state.periscope.spotted
                ? style.wordSpotted
                : style.word;
        const pose = wordPose(state, w);
        const visibility = wordVisibility(w);
        const sink = WORD_DRAFT + (1 - visibility) * WORD_SINK_DEPTH;
        ctx.globalAlpha = visibility;
        for (const g of w.glyphs) {
            // each letter sits on the bent baseline and is tilted
            // along the chord between baseline points under its edges
            const half = g.width / 2;
            const y = wordBaselineY(state, w, pose, g.dx);
            const yLeft = wordBaselineY(state, w, pose, g.dx - half);
            const yRight = wordBaselineY(state, w, pose, g.dx + half);
            // save/restore keeps the transformation local to this letter
            ctx.save();
            // move the origin to the letter and rotate around it -
            // easier than computing rotated coordinates by hand
            ctx.translate(w.x + g.dx, y);
            ctx.rotate(Math.atan2(yRight - yLeft, g.width));
            ctx.fillText(g.char, 0, sink);
            ctx.restore();
        }
    }
    ctx.globalAlpha = 1;
}

// -------------------- periscope ------------------------------------------

/*
 * The periscope is the mark from the Slovoskop logo. Coordinates
 * below are copied from the logo SVG (its viewBox units): a tall
 * tube, a red triangular head and a "lens" pointing to the right.
 * (The logo has also the bottom part, but that one is under water.)
 */
const PERISCOPE_SHAPES = {
    tube: 'M35,57 h48 v84.188 h-48 z',
    head: 'M83,48 L83,0 L35,48 z',
    lens: 'M92,0 h26 v48 h-26 z',
};

type PeriscopePaths = Record<keyof typeof PERISCOPE_SHAPES, Path2D>;

let periscopePaths: PeriscopePaths | null = null;

/**
 * Path2D parses an SVG path once and can be filled many times.
 * It exists only in browsers, so we create it lazily - creating
 * it at module level would crash server side rendering.
 */
function getPeriscopePaths(): PeriscopePaths {
    if (!periscopePaths) {
        periscopePaths = {
            tube: new Path2D(PERISCOPE_SHAPES.tube),
            head: new Path2D(PERISCOPE_SHAPES.head),
            lens: new Path2D(PERISCOPE_SHAPES.lens),
        };
    }
    return periscopePaths;
}

/** logo point which is placed on the water surface */
const PERISCOPE_ANCHOR = { x: 59, y: 112 };

/** center of the lens in logo units */
const PERISCOPE_LENS_CENTER = { x: 105, y: 24 };

/** logo units -> px */
const PERISCOPE_SCALE = 0.4;

/** how deep (px) the periscope hides when not raised */
const PERISCOPE_SINK_DEPTH = 60;

function periscopeY(state: GameState): number {
    const p = state.periscope;
    // ease-out: fast at the beginning, slow at the end
    const lift = 1 - Math.pow(1 - p.lift, 3);
    return surfaceY(state, p.x) + (1 - lift) * PERISCOPE_SINK_DEPTH;
}

function drawPeriscope(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    style: GameStyle
): void {
    const p = state.periscope;
    ctx.save();
    ctx.translate(p.x, periscopeY(state));
    // a negative horizontal scale mirrors the shape - when `facing`
    // goes from 1 to -1 the periscope gets narrower, flips and gets
    // wider again, which looks like turning around its axis
    ctx.scale(p.facing * PERISCOPE_SCALE, PERISCOPE_SCALE);
    ctx.translate(-PERISCOPE_ANCHOR.x, -PERISCOPE_ANCHOR.y);
    const paths = getPeriscopePaths();
    ctx.fillStyle = style.periscope;
    ctx.fill(paths.tube);
    ctx.fill(paths.lens);
    ctx.fillStyle = style.periscopeAccent;
    ctx.fill(paths.head);
    ctx.restore();
}

/** a dashed "line of sight" from the lens to the spotted word */
function drawSightLine(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    style: GameStyle
): void {
    const p = state.periscope;
    const word = state.words.find((w) => w.text === p.spotted);
    // only when the periscope is up and looks towards the word
    if (!word || p.lift < 1 || Math.abs(p.facing) < 0.9) {
        return;
    }
    const lensX =
        p.x +
        p.facing *
            (PERISCOPE_LENS_CENTER.x - PERISCOPE_ANCHOR.x) *
            PERISCOPE_SCALE;
    const lensY =
        periscopeY(state) +
        (PERISCOPE_LENS_CENTER.y - PERISCOPE_ANCHOR.y) * PERISCOPE_SCALE;
    const pose = wordPose(state, word);
    const targetY = wordBaselineY(state, word, pose, 0) - WORD_FONT_SIZE / 2;

    ctx.save();
    ctx.strokeStyle = style.periscopeAccent;
    ctx.globalAlpha = 0.5 * wordVisibility(word);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    // moving the dash offset in time makes the line "flow"
    ctx.lineDashOffset = -state.waveTime * 20;
    ctx.beginPath();
    ctx.moveTo(lensX, lensY);
    ctx.lineTo(word.x - Math.sign(word.x - p.x) * (word.width / 2), targetY);
    ctx.stroke();
    ctx.restore();
}

/**
 * Draw the whole scene. Canvas is "immediate mode" - nothing is
 * remembered between frames, so we always repaint everything.
 */
export function draw(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    style: GameStyle
): void {
    ctx.fillStyle = style.sky;
    ctx.fillRect(0, 0, state.width, state.height);
    // words go first, so the sea covers their lower part
    // and they look like floating
    drawWords(ctx, state, style);
    drawPeriscope(ctx, state, style);
    drawSea(ctx, state, style);
    // the sight line goes over everything
    drawSightLine(ctx, state, style);
}
