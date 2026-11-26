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

import { ViewUtils, useModel } from 'kombo';
import * as React from 'react';
import {
    CoreTileComponentProps,
    TileComponent,
} from '../../../../page/tile.js';
import { GlobalComponents } from '../../../../views/common/index.js';
import { LexCommonModel } from '../model.js';
import * as S from './styles.js';
import { createState, resize, step, wordAt } from './simulation.js';
import { HTTPAction } from '../../../../page/actions.js';
import { createGameStyle, createMeasure, draw } from './render.js';
import { Theme } from '../../../../page/theme.js';

/** max. simulation step in seconds */
const MAX_DT = 0.1;

const DEFAULT_WORDS = [
    'chobotnice',
    'čmelák',
    'škrkavka',
    'zmrzlina',
    'kokrhat',
    'bublina',
    'skřítek',
    'rozmar',
    'pštros',
    'vrkat',
    'mlsný',
    'šnek',
    'pohádka',
    'štěstí',
    'kormidlo',
    'maják',
];

export function init(
    ut: ViewUtils<GlobalComponents>,
    theme: Theme,
    model: LexCommonModel,
    words: Array<string> = DEFAULT_WORDS
): TileComponent {
    const globalComponents = ut.getComponents();
    const style = createGameStyle(theme);

    const wordUrl = (word: string) =>
        ut.createActionUrl(`${HTTPAction.SEARCH}${encodeURIComponent(word)}`);

    // -------------------- <SlovoskopGame /> -------------------------------------------

    const SlovoskopGame: React.FC = () => {
        const canvasRef = React.useRef<HTMLCanvasElement>(null);

        // canvas is touched only on the client side (useEffect does not run during SSR)
        React.useEffect(() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!ctx) {
                return;
            }
            const rect = canvas.getBoundingClientRect();
            // game state lives outside of React - changing it must not
            // trigger re-render, we repaint the canvas ourselves
            const game = createState(rect.width, rect.height, words);
            const measure = createMeasure(ctx, style);

            // canvas has two sizes: CSS size (how big it looks) and bitmap
            // size (how many pixels it has); on HiDPI screens we need more
            // pixels to keep it sharp, then we scale drawing back to CSS px
            const resizeCanvas = () => {
                const dpr = window.devicePixelRatio || 1;
                const { width, height } = canvas.getBoundingClientRect();
                canvas.width = Math.round(width * dpr);
                canvas.height = Math.round(height * dpr);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                resize(game, width, height);
            };
            resizeCanvas();
            const resizeObserver = new ResizeObserver(resizeCanvas);
            resizeObserver.observe(canvas);

            // pointer events cover mouse, touch and pen at once; we only
            // store the position, the simulation decides what it means
            const toCanvasCoords = (e: PointerEvent | MouseEvent) => {
                const r = canvas.getBoundingClientRect();
                return { x: e.clientX - r.left, y: e.clientY - r.top };
            };
            const onPointerMove = (e: PointerEvent) => {
                game.pointer = toCanvasCoords(e);
            };
            const onPointerLeave = () => {
                game.pointer = null;
            };
            const onClick = (e: MouseEvent) => {
                // hit test right here - on touch devices there is no hover
                // before the tap, so `game.hovered` may not be set yet
                const { x, y } = toCanvasCoords(e);
                const word = wordAt(game, x, y);
                if (word) {
                    window.location.href = wordUrl(word.text);
                }
            };
            canvas.addEventListener('pointermove', onPointerMove);
            canvas.addEventListener('pointerdown', onPointerMove);
            canvas.addEventListener('pointerleave', onPointerLeave);
            canvas.addEventListener('click', onClick);

            // users who set "reduce motion" in their OS get a calm sea;
            // the setting can change while the page is open
            const reducedMotion = window.matchMedia(
                '(prefers-reduced-motion: reduce)'
            );
            const onReducedMotionChange = () => {
                game.calm = reducedMotion.matches;
            };
            onReducedMotionChange();
            reducedMotion.addEventListener('change', onReducedMotionChange);

            // game loop - browser calls `frame` before each repaint
            // (typically 60x per second) with a high resolution timestamp
            let frameId: number | null = null;
            let lastTime: number | null = null;
            const frame = (time: number) => {
                // dt = seconds since last frame; capped, so after switching
                // back to the tab the game does not jump far ahead
                const dt =
                    lastTime === null
                        ? 0
                        : Math.min((time - lastTime) / 1000, MAX_DT);
                lastTime = time;
                step(game, dt, measure);
                draw(ctx, game, style);
                const cursor = game.hovered ? 'pointer' : 'default';
                if (canvas.style.cursor !== cursor) {
                    canvas.style.cursor = cursor;
                }
                frameId = requestAnimationFrame(frame);
            };

            // the loop runs only when the canvas is visible and the font
            // is ready (browsers already pause requestAnimationFrame in
            // background tabs, but not for a canvas scrolled out of view)
            let isVisible = false;
            let fontReady = false;
            let disposed = false;
            const updateLoop = () => {
                const shouldRun = isVisible && fontReady && !disposed;
                if (shouldRun && frameId === null) {
                    lastTime = null; // do not count the paused time
                    frameId = requestAnimationFrame(frame);
                } else if (!shouldRun && frameId !== null) {
                    cancelAnimationFrame(frameId);
                    frameId = null;
                }
            };
            const intersectionObserver = new IntersectionObserver(
                (entries) => {
                    isVisible = entries.some((e) => e.isIntersecting);
                    updateLoop();
                }
            );
            intersectionObserver.observe(canvas);

            // web fonts load lazily - measuring text with a fallback font
            // would place letters of words at wrong positions
            document.fonts
                .load(style.font)
                .catch(() => undefined) // a missing font is not fatal
                .then(() => {
                    fontReady = true;
                    updateLoop();
                });

            // cleanup on unmount - otherwise the loop would run forever
            return () => {
                disposed = true;
                updateLoop();
                resizeObserver.disconnect();
                intersectionObserver.disconnect();
                reducedMotion.removeEventListener(
                    'change',
                    onReducedMotionChange
                );
                canvas.removeEventListener('pointermove', onPointerMove);
                canvas.removeEventListener('pointerdown', onPointerMove);
                canvas.removeEventListener('pointerleave', onPointerLeave);
                canvas.removeEventListener('click', onClick);
            };
        }, []);

        return (
            <S.Game>
                {/* canvas is only a picture for screen readers and keyboard
                    users, so we offer the same words as ordinary links */}
                <S.GameCanvas
                    ref={canvasRef}
                    role="img"
                    aria-label={ut.translate('lex_common__easter_egg_aria')}
                />
                <S.VisuallyHidden>
                    <p>{ut.translate('lex_common__easter_egg_links')}</p>
                    <ul>
                        {words.map((w) => (
                            <li key={w}>
                                <a href={wordUrl(w)}>{w}</a>
                            </li>
                        ))}
                    </ul>
                </S.VisuallyHidden>
            </S.Game>
        );
    };

    // -------------------- <LexCommonTileView /> ---------------------------------------

    const LexCommonTileView: React.FC<CoreTileComponentProps> = (props) => {
        const state = useModel(model);

        if (!state.easterEgg) {
            return null;
        }

        return (
            <globalComponents.TileWrapper
                tileId={props.tileId}
                isBusy={false}
                hasData={true}
                supportsTileReload={props.supportsReloadOnError}
                isSubtileContainer={props.isSubtileContainer}
                issueReportingUrl={props.issueReportingUrl}
            >
                <SlovoskopGame />
            </globalComponents.TileWrapper>
        );
    };

    return LexCommonTileView;
}
