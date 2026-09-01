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

import { Theme } from '../../../../page/theme.js';
import { styled } from 'styled-components';
import { LexTileBase } from '../../lexCommon/style.js';
import { getLexTheme } from '../../lexCommon/theme.js';

export const LexOverviewTileView = styled(LexTileBase)`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
`;

export const Header = styled.div<{
    theme: Theme;
    source?: string;
    width?: string;
}>`
    h2 {
        width: 100%;
        margin: 0;
    }

    .variant-grid {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        margin-top: 1em;
        gap: 2px;

        .variant {
            flex: 1;
            flex-basis: ${(props) => props.width || 'auto'};
            margin: 0;
            padding: 0.2em 1em;
            white-space: nowrap;
            text-align: center;
            border-radius: ${(props) =>
                getLexTheme(props.theme).subtileBorderRadius};
            border: 1px solid
                ${(props) =>
                    getLexTheme(props.theme).sourceColors[props.source]};
            cursor: pointer;

            .morphology {
                font-size: 0.8em;
                font-style: italic;
            }

            .plurality {
                font-size: 0.6em;
                font-style: bold;
            }

            a {
                width: 100%;
                text-decoration: none;
                cursor: pointer;
            }
        }

        .selected {
            background-color: ${(props) =>
                getLexTheme(props.theme).sourceColors[props.source]};
            cursor: default;
        }

        .variant:not(.selected):hover {
            background-color: ${(props) =>
                getLexTheme(props.theme).sourceColors[props.source]}44;
            // the 44 adds transparency to base color in hex format
        }
    }
`;

export const PlayerIcon = styled.a<{
    theme: Theme;
    $crStaticUrl: (file: string) => string;
}>`
    display: inline-block;
    vertical-align: middle;
    margin-left: 1em;
    margin-bottom: 0.1em;
    cursor: pointer;

    width: 1.5em;
    height: 1.5em;
    background-image: url(${(props) => props.$crStaticUrl('audio-3w.svg')});
    background-repeat: no-repeat;
    background-size: contain;
    background-position: center;

    &.animate {
        animation: playAnimation 1s steps(4) infinite;

        @keyframes playAnimation {
            0% {
                background-image: url(${(props) =>
                    props.$crStaticUrl('audio-0w.svg')});
            }
            25% {
                background-image: url(${(props) =>
                    props.$crStaticUrl('audio-1w.svg')});
            }
            50% {
                background-image: url(${(props) =>
                    props.$crStaticUrl('audio-2w.svg')});
            }
            75% {
                background-image: url(${(props) =>
                    props.$crStaticUrl('audio-3w.svg')});
            }
            100% {
                background-image: url(${(props) =>
                    props.$crStaticUrl('audio-0w.svg')});
            }
        }
    }
`;
