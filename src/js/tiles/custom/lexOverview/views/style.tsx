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

export const LexOverviewTileView = styled.div<{ theme: Theme }>`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
`;

export const Header = styled.div<{ theme: Theme }>`
    padding: 0.5em;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;

    h2 {
        width: 100%;
        margin: 0.1em 0;
    }

    .variant {
        margin: 0.1em 1em;

        a {
            text-decoration: none;
            cursor: pointer;
        }
    }

    .small {
        font-size: 0.8em;
        font-style: italic;
    }
`;

export const Subtile = styled.div<{ theme: Theme; color: string }>`
    margin-top: 1em;
    padding: 0.5em;
    background-color: ${(props) => props.color};
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    .content {
        margin: 0;
        padding: 0;
        line-height: 2em;

        .key {
            color: ${(props) => props.theme.colorLightText};
            font-family: ${(props) => props.theme.condensedFontFamily};
        }

        .value {
            margin-left: 0.5em;
        }
    }

    .footer {
        font-size: 0.9em;
        text-align: right;
    }
`;

export const SubtileRow = styled.div<{ theme: Theme }>`
    margin-bottom: 0.5em;

    .key {
        color: ${(props) => props.theme.colorLightText};
        font-family: ${(props) => props.theme.condensedFontFamily};
    }

    .value {
        margin-left: 0.5em;
    }

    &.footer {
        margin-top: 0em;
        font-size: 0.9em;
        text-align: right;
    }
`;
