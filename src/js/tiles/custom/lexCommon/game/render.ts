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
import { periscopeFacing } from './periscope.js';

export interface GameStyle {
    sky: string;
    seaTop: string;
    seaBottom: string;
    word: string;
    wordSpotted: string;
    periscope: string;
    periscopeAccent: string;
    periscopeGlass: string;
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
            periscopeGlass: '#8fc4f0',
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
        periscopeGlass: '#7fb8ec',
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
 * The periscope is the mark from the Slovoskop logo, turned into
 * simple 3D bodies. Coordinates are in logo SVG units, relative to
 * the tube axis:
 *
 *   u - distance along the viewing direction (logo x - 59)
 *   y - vertical position (logo y)
 *   z - depth across the viewing direction
 *
 * All parts (tube, red head, lens) are prisms - their logo
 * outlines (profiles) extruded to the tube thickness.
 * Seen exactly from the side (heading 0) the result is the logo.
 */

type Vec2 = [number, number];

interface Prism {
    /** convex outline in (u, y) */
    profile: Array<Vec2>;
    halfDepth: number;
}

/** half of the tube thickness - the tube has a square cross-section */
const TUBE_HALF_WIDTH = 24;

/** the tall blue rectangle, its bottom part is under water */
const PERISCOPE_TUBE: Prism = {
    profile: [
        [-24, 57],
        [24, 57],
        [24, 141.188],
        [-24, 141.188],
    ],
    halfDepth: TUBE_HALF_WIDTH,
};

/** the red triangle (angled mirror housing) */
const PERISCOPE_HEAD: Prism = {
    profile: [
        [24, 48],
        [24, 0],
        [-24, 48],
    ],
    halfDepth: TUBE_HALF_WIDTH,
};

/** the blue rectangle at the top - an eyepiece looking forward */
const PERISCOPE_LENS: Prism = {
    profile: [
        [33, 0],
        [59, 0],
        [59, 48],
        [33, 48],
    ],
    halfDepth: TUBE_HALF_WIDTH,
};

/** glass on the front face of the lens (u = 59) */
const LENS_GLASS = { y0: 9, y1: 39, halfDepth: 15 };

/** logo y placed on the water surface */
const PERISCOPE_ANCHOR_Y = 112;

/** center of the lens in (u, y) */
const PERISCOPE_LENS_CENTER: Vec2 = [46, 24];

/** logo units -> px */
const PERISCOPE_SCALE = 0.4;

/** how deep (px) the periscope hides when not raised */
const PERISCOPE_SINK_DEPTH = 60;

/**
 * Direction towards the light in (screen x, screen y, depth) -
 * from the upper left and in front of the scene (y grows down,
 * depth grows towards the viewer).
 */
const LIGHT = (() => {
    const v = [-0.45, -0.55, 0.7];
    const len = Math.hypot(...v);
    return v.map((c) => c / len);
})();

/**
 * Faces turned towards the light get lighter, the others darker.
 * The side face seen at heading 0 keeps exactly the logo color.
 */
const NEUTRAL_BRIGHTNESS = LIGHT[2];

/** rotation of the periscope around its vertical axis */
interface ViewRotation {
    cos: number;
    sin: number;
}

/**
 * Orthographic projection of a model point to the screen: rotate
 * (u, z) around the vertical axis and forget the depth. Vertical
 * coordinate does not change at all.
 */
function projectX(rot: ViewRotation, u: number, z: number): number {
    return u * rot.cos - z * rot.sin;
}

/**
 * Brightness of a face with model normal (nu, ny, nz) - the dot
 * product of the rotated normal and the light direction.
 * Also returns the depth component, which tells whether the face
 * looks towards the viewer (> 0) or away from them.
 */
function lightFace(
    rot: ViewRotation,
    nu: number,
    ny: number,
    nz: number
): { brightness: number; towardsViewer: number } {
    const x = nu * rot.cos - nz * rot.sin;
    const depth = nu * rot.sin + nz * rot.cos;
    return {
        brightness: x * LIGHT[0] + ny * LIGHT[1] + depth * LIGHT[2],
        towardsViewer: depth,
    };
}

function fillShaded(
    ctx: CanvasRenderingContext2D,
    points: Array<Vec2>,
    color: string,
    brightness: number
): void {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    // shading = a translucent white or black layer over the base color
    const delta = brightness - NEUTRAL_BRIGHTNESS;
    ctx.fillStyle =
        delta > 0
            ? `rgba(255, 255, 255, ${Math.min(0.5, delta * 0.5)})`
            : `rgba(0, 0, 0, ${Math.min(0.6, -delta * 0.45)})`;
    ctx.fill();
}

/** depth of the prism center (bigger = closer to the viewer) */
function prismDepth(rot: ViewRotation, prism: Prism): number {
    const cu =
        prism.profile.reduce((acc, p) => acc + p[0], 0) / prism.profile.length;
    // the center lies at z = 0
    return cu * rot.sin;
}

/** faces almost perpendicular to the screen are skipped */
const MIN_VISIBLE = 1e-3;

/**
 * Draws a convex prism. Thanks to convexity we do not have to sort
 * faces: a face is either turned towards the viewer and fully
 * visible, or turned away and hidden ("back-face culling").
 */
function drawPrism(
    ctx: CanvasRenderingContext2D,
    rot: ViewRotation,
    prism: Prism,
    color: string
): void {
    const pts = prism.profile;
    const d = prism.halfDepth;
    const cu = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
    const cy = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;

    // side faces - one per profile edge, extruded along z
    for (let i = 0; i < pts.length; i++) {
        const [au, ay] = pts[i];
        const [bu, by] = pts[(i + 1) % pts.length];
        // a perpendicular to the edge, flipped to point outwards
        let nu = by - ay;
        let ny = -(bu - au);
        if (nu * ((au + bu) / 2 - cu) + ny * ((ay + by) / 2 - cy) < 0) {
            nu = -nu;
            ny = -ny;
        }
        const len = Math.hypot(nu, ny);
        const light = lightFace(rot, nu / len, ny / len, 0);
        if (light.towardsViewer < MIN_VISIBLE) {
            continue;
        }
        fillShaded(
            ctx,
            [
                [projectX(rot, au, -d), ay],
                [projectX(rot, bu, -d), by],
                [projectX(rot, bu, d), by],
                [projectX(rot, au, d), ay],
            ],
            color,
            light.brightness
        );
    }

    // caps - the logo outline itself, on both sides of the prism
    for (const z of [d, -d]) {
        const light = lightFace(rot, 0, 0, Math.sign(z));
        if (light.towardsViewer < MIN_VISIBLE) {
            continue;
        }
        fillShaded(
            ctx,
            pts.map(([u, y]) => [projectX(rot, u, z), y]),
            color,
            light.brightness
        );
    }
}

/** glass is visible only when the lens front face is turned to us */
function drawLensGlass(
    ctx: CanvasRenderingContext2D,
    rot: ViewRotation,
    style: GameStyle
): void {
    const front = PERISCOPE_LENS.profile[1][0];
    const light = lightFace(rot, 1, 0, 0);
    if (light.towardsViewer < MIN_VISIBLE) {
        return;
    }
    const { y0, y1, halfDepth } = LENS_GLASS;
    const left = projectX(rot, front, halfDepth);
    const right = projectX(rot, front, -halfDepth);
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, style.periscopeGlass);
    g.addColorStop(1, style.periscope);
    ctx.fillStyle = g;
    ctx.fillRect(left, y0, right - left, y1 - y0);
    // a small reflection makes the glass look glossy
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(left + (right - left) * 0.2, y0 + 4, (right - left) * 0.2, 6);
}

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
    const rot: ViewRotation = {
        cos: Math.cos(p.heading),
        sin: Math.sin(p.heading),
    };
    ctx.save();
    ctx.translate(p.x, periscopeY(state));
    ctx.scale(PERISCOPE_SCALE, PERISCOPE_SCALE);
    ctx.translate(0, -PERISCOPE_ANCHOR_Y);
    // painter's algorithm - farther bodies are drawn first, so the
    // nearer ones cover them; when the periscope looks away from us,
    // the lens is behind the head and the order flips
    const bodies = [
        { prism: PERISCOPE_TUBE, color: style.periscope, glass: false },
        { prism: PERISCOPE_HEAD, color: style.periscopeAccent, glass: false },
        { prism: PERISCOPE_LENS, color: style.periscope, glass: true },
    ];
    bodies
        .map((b) => ({ ...b, depth: prismDepth(rot, b.prism) }))
        .sort((a, b) => a.depth - b.depth)
        .forEach((b) => {
            drawPrism(ctx, rot, b.prism, b.color);
            if (b.glass) {
                drawLensGlass(ctx, rot, style);
            }
        });
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
    const facing = periscopeFacing(p);
    if (!word || p.lift < 1 || Math.abs(facing) < 0.9) {
        return;
    }
    const [lensU, lensV] = PERISCOPE_LENS_CENTER;
    const lensX = p.x + facing * lensU * PERISCOPE_SCALE;
    const lensY =
        periscopeY(state) + (lensV - PERISCOPE_ANCHOR_Y) * PERISCOPE_SCALE;
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
