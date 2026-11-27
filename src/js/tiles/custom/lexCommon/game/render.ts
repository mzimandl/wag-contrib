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
    SEA_LEVEL_RATIO,
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
const WORD_SINK_DEPTH = 50;

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

/** opacity of word parts under the water surface */
const UNDERWATER_OPACITY = 0.3;

/**
 * Creates the path of the sea once per frame.
 */
function traceSea(state: GameState): Path2D {
    // the surface is approximated by a polyline sampled every few pixels
    const path = new Path2D();
    path.moveTo(0, state.height);
    for (let x = 0; x <= state.width + SURFACE_STEP; x += SURFACE_STEP) {
        path.lineTo(x, surfaceY(state, x));
    }
    path.lineTo(state.width, state.height);
    path.closePath();
    return path;
}

/**
 * The sea gradient is not painted by the canvas at all - filling a
 * large area with a gradient every frame turned out to be the most
 * expensive part of the whole scene. Instead, the gradient is a static
 * CSS background of the canvas element (painted once by the browser)
 * and we only "cut a hole" into the canvas where the sea is.
 */
export function seaBackgroundCSS(style: GameStyle): string {
    // the top part is the sky color, so the canvas looks fine even
    // before its first frame is painted (canvas covers it later);
    // the sky stops above the highest possible wave crest
    const sky = (SEA_LEVEL_RATIO - 0.1) * 100;
    const sea = SEA_LEVEL_RATIO * 100;
    return (
        `linear-gradient(to bottom, ${style.sky} ${sky}%, ` +
        `${style.seaTop} ${sky}%, ${style.seaTop} ${sea}%, ` +
        `${style.seaBottom} 100%)`
    );
}

/** width (px) of the outline around words, in the background color */
const WORD_OUTLINE_WIDTH = 2;

/**
 * Draws all words. Above water the letters get a thin outline in the
 * sky color, so they stay readable over the periscope of the same color.
 * The underwater pass (semi-transparent) is drawn without it.
 *
 * strokeText() is expensive (it almost doubled the frame time), but an
 * outline in the sky color is invisible over the sky anyway - so only
 * letters near the periscope get it.
 */
function drawWords(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    style: GameStyle,
    opacity: number = 1,
    outline: boolean = true
): void {
    // transformation set by the caller (scaling to device pixels)
    const base = ctx.getTransform();
    ctx.font = style.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // the stroke is centered on the letter edge - half of it is covered
    // by the fill, so it must be twice as wide as the visible outline;
    // round joins avoid sharp spikes at letter corners
    ctx.lineWidth = 2 * WORD_OUTLINE_WIDTH;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style.sky;
    const outlineReach =
        PERISCOPE_REACH * PERISCOPE_SCALE + WORD_OUTLINE_WIDTH;
    for (const w of state.words) {
        const pose = wordPose(state, w);
        const visibility = wordVisibility(w);
        const sink = WORD_DRAFT + (1 - visibility) * WORD_SINK_DEPTH;
        ctx.globalAlpha = opacity * visibility;
        // outlines of all letters first, then their fills - otherwise
        // the outline of a letter would cut into its left neighbor
        const passes: Array<'stroke' | 'fill'> = outline
            ? ['stroke', 'fill']
            : ['fill'];
        for (const pass of passes) {
            if (pass === 'fill') {
                ctx.fillStyle =
                    w.text === state.periscope.spotted
                        ? style.wordSpotted
                        : style.word;
            }
            for (const g of w.glyphs) {
                if (
                    pass === 'stroke' &&
                    Math.abs(w.x + g.dx - state.periscope.x) >
                        outlineReach + g.width / 2
                ) {
                    continue;
                }
                // each letter sits on the bent baseline and is tilted
                // along the chord between baseline points under its edges
                const half = g.width / 2;
                const y = wordBaselineY(state, w, pose, g.dx);
                const yLeft = wordBaselineY(state, w, pose, g.dx - half);
                const yRight = wordBaselineY(state, w, pose, g.dx + half);
                // cos and sin of the tilt straight from the chord vector -
                // no need for atan2() followed by cos() and sin()
                const len = Math.hypot(g.width, yRight - yLeft);
                setRotatedTransform(
                    ctx,
                    base,
                    w.x + g.dx,
                    y,
                    g.width / len,
                    (yRight - yLeft) / len
                );
                if (pass === 'stroke') {
                    ctx.strokeText(g.char, 0, sink);
                } else {
                    ctx.fillText(g.char, 0, sink);
                }
            }
        }
    }
    ctx.setTransform(base);
    ctx.globalAlpha = 1;
}

/**
 * Sets transformation "base, then move to (x, y), then rotate" in one
 * call. It does the same as save() + translate() + rotate() + restore(),
 * but these are surprisingly expensive when called for every letter
 * (save/restore copies the whole drawing state, clipping included).
 *
 * Canvas transformation is a matrix [a c e; b d f]: a point (x, y) goes
 * to (a*x + c*y + e, b*x + d*y + f). Multiplying the base matrix by the
 * translation and the rotation [cos -sin; sin cos] gives:
 */
function setRotatedTransform(
    ctx: CanvasRenderingContext2D,
    base: DOMMatrix,
    x: number,
    y: number,
    cos: number,
    sin: number
): void {
    ctx.setTransform(
        base.a * cos + base.c * sin,
        base.b * cos + base.d * sin,
        base.c * cos - base.a * sin,
        base.d * cos - base.b * sin,
        base.a * x + base.c * y + base.e,
        base.b * x + base.d * y + base.f
    );
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

/**
 * The tall blue rectangle. It is longer than in the logo (which ends
 * at y = 141), because the periscope does not copy every ripple and
 * a short tube could show its end in a deep wave trough. The part
 * under water is erased anyway.
 */
const PERISCOPE_TUBE: Prism = {
    profile: [
        [-24, 57],
        [24, 57],
        [24, 200],
        [-24, 200],
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

/** depth (logo units) where the periscope vanishes completely under water */
const UNDERWATER_FADE_DEPTH = 30;

/** logo y placed on the water surface */
const PERISCOPE_ANCHOR_Y = 112;

/** center of the lens in (u, y) */
const PERISCOPE_LENS_CENTER: Vec2 = [46, 24];

/** logo units -> px */
const PERISCOPE_SCALE = 0.5;

/**
 * Max. horizontal distance (logo units) of any periscope point from its
 * axis, in any rotation: the lens corner at u = 59, z = ±24.
 */
const PERISCOPE_REACH = Math.hypot(59, TUBE_HALF_WIDTH);

/** how deep (px) the periscope hides when not raised */
const PERISCOPE_SINK_DEPTH = 75;

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

const rgbCache = new Map<string, [number, number, number]>();

function toRGB(color: string): [number, number, number] {
    let rgb = rgbCache.get(color);
    if (!rgb) {
        const [r, g, b] = Color.importColor(1, color);
        rgb = [r, g, b];
        rgbCache.set(color, rgb);
    }
    return rgb;
}

/**
 * Shading = mixing the base color with white (lit faces) or black
 * (faces in shadow). Each face is filled only once with the final
 * color - this matters for the semi-transparent underwater pass,
 * where a second (shading) layer would not cover the first one.
 */
function shadeColor(color: string, brightness: number): string {
    const delta = brightness - NEUTRAL_BRIGHTNESS;
    const [r, g, b] = toRGB(color);
    const [target, amount] =
        delta > 0
            ? [255, Math.min(0.5, delta * 0.5)]
            : [0, Math.min(0.6, -delta * 0.45)];
    const mix = (c: number) => Math.round(c + (target - c) * amount);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/**
 * Vertical range (in the current drawing units) where faces fade out
 * from fully opaque to fully transparent; null = no fading.
 */
type Fade = { from: number; to: number } | null;

function fillShaded(
    ctx: CanvasRenderingContext2D,
    points: Array<Vec2>,
    color: string,
    brightness: number,
    fade: Fade
): void {
    ctx.beginPath();
    points.forEach(([x, y], i) =>
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    );
    ctx.closePath();
    const shaded = shadeColor(color, brightness);
    if (fade) {
        // the same color, only its alpha goes to zero ("rgb(...)" ->
        // "rgba(..., 0)"); a gradient on such a small area is cheap
        const gradient = ctx.createLinearGradient(0, fade.from, 0, fade.to);
        gradient.addColorStop(0, shaded);
        gradient.addColorStop(
            1,
            shaded.replace('rgb(', 'rgba(').replace(')', ', 0)')
        );
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = shaded;
    }
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
    color: string,
    fade: Fade = null
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
            light.brightness,
            fade
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
            light.brightness,
            fade
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
    const floatY = p.floatY ?? surfaceY(state, p.x);
    return floatY + (1 - lift) * PERISCOPE_SINK_DEPTH;
}

/**
 * Draws the periscope. Normally (painter's algorithm) farther bodies
 * go first and nearer ones cover them; when the periscope looks away
 * from us, the lens is behind the head and the order flips.
 *
 * With `behind = true` everything is drawn in the "destination-over"
 * mode, where each new shape goes *behind* the already painted ones -
 * so the order must be reversed: nearest bodies first. Under water
 * the bodies also fade out with depth.
 */
function drawPeriscope(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    style: GameStyle,
    behind: boolean = false
): void {
    const p = state.periscope;
    const rot: ViewRotation = {
        cos: Math.cos(p.heading),
        sin: Math.sin(p.heading),
    };
    const y = periscopeY(state);
    ctx.save();
    ctx.translate(p.x, y);
    ctx.scale(PERISCOPE_SCALE, PERISCOPE_SCALE);
    ctx.translate(0, -PERISCOPE_ANCHOR_Y);
    // under water the periscope fades with depth - the fading starts at
    // the real water surface at the periscope axis (converted to logo units)
    const waterline =
        PERISCOPE_ANCHOR_Y + (surfaceY(state, p.x) - y) / PERISCOPE_SCALE;
    const fade: Fade = behind
        ? { from: waterline, to: waterline + UNDERWATER_FADE_DEPTH }
        : null;
    const bodies = [
        { prism: PERISCOPE_TUBE, color: style.periscope, glass: false },
        { prism: PERISCOPE_HEAD, color: style.periscopeAccent, glass: false },
        { prism: PERISCOPE_LENS, color: style.periscope, glass: true },
    ];
    const direction = behind ? -1 : 1;
    bodies
        .map((b) => ({ ...b, depth: prismDepth(rot, b.prism) }))
        .sort((a, b) => direction * (a.depth - b.depth))
        .forEach((b) => {
            // (under water the glass is skipped - it would not fade,
            // and it is under water only while the periscope emerges)
            drawPrism(ctx, rot, b.prism, b.color, fade);
            if (b.glass && !behind) {
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
    // back to front: the periscope sails behind the words, the sea
    // covers lower parts of both, so they look like floating
    // horizontal scale of the current transformation = device pixel ratio
    drawPeriscope(ctx, state, style);
    drawWords(ctx, state, style);

    // Compositing operations say how new pixels combine with the ones
    // already on the canvas (normally "source-over" = paint over them).
    //
    // "destination-out" erases where we paint: the sea area becomes
    // transparent, the CSS gradient behind the canvas shows through
    // and lower parts of words and the periscope disappear "under water".
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(traceSea(state));
    // "destination-over" paints *behind* existing pixels: over the opaque
    // sky the words stay hidden, in the transparent sea they appear -
    // semi-transparent, so they look like seen through the water
    ctx.globalCompositeOperation = 'destination-over';
    drawWords(ctx, state, style, UNDERWATER_OPACITY, false);
    // the periscope goes behind the underwater words; faces of one body
    // do not overlap (it is convex), so with opacity nothing shines
    // through except where bodies overlap (only while it emerges)
    ctx.globalAlpha = UNDERWATER_OPACITY;
    drawPeriscope(ctx, state, style, true);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // the sight line goes over everything
    drawSightLine(ctx, state, style);
}
