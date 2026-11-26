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

import { styled } from 'styled-components';
import { Theme } from '../../../../page/theme.js';

export const Game = styled.div``;

export const GameCanvas = styled.canvas<{ theme: Theme }>`
    display: block;
    width: 100%;
    height: 300px;
    border-radius: 0.5em;
    /* touch-action: none would block page scrolling on mobile,
       pan-y keeps vertical scrolling and gives us horizontal moves */
    touch-action: pan-y;

    ${(props) => props.theme.cssMobileScreen} {
        height: 220px;
    }
`;

/**
 * Hidden visually, but still read by screen readers and reachable
 * by keyboard - when a link gets focus, it becomes visible.
 */
export const VisuallyHidden = styled.div`
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;

    &:focus-within {
        position: static;
        width: auto;
        height: auto;
        clip-path: none;
        white-space: normal;
        margin-top: 0.5em;

        ul {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25em 1em;
            list-style: none;
            padding: 0;
            margin: 0;
        }

        p {
            margin: 0 0 0.25em 0;
        }
    }
`;