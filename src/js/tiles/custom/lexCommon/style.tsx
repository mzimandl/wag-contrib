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

import { Theme } from '../../../page/theme.js';
import { styled } from 'styled-components';
import { SystemMessageType } from '../../../types.js';
import { getLexTheme } from './theme.js';

export function getMessageColor(systemMessageType: string): string {
    switch (systemMessageType) {
        case SystemMessageType.WARNING:
            return '#009ee0';
        case SystemMessageType.ERROR:
            return '#ea670c';
        default:
            return null;
    }
}

export const LexTileBase = styled.div<{ theme: Theme }>``;

export const SubtileWrapper = styled.div<{
    theme: Theme;
    $source?: string;
    $systemMessageType?: SystemMessageType;
}>`
    margin-top: 0.5em;
    &:first-child {
        margin-top: 0;
    }
    padding: 0.8em 1em;
    background-color: ${(props) =>
        getLexTheme(props.theme).sourceColors[props.$source]};
    border: ${(props) =>
        props.$systemMessageType
            ? `2px solid ${getMessageColor(props.$systemMessageType)}`
            : 'none'};
    border-radius: ${(props) => getLexTheme(props.theme).subtileBorderRadius};
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    a:hover {
        text-decoration: none;
        cursor: pointer;
    }
`;

export const SubtileRow = styled.div<{ theme: Theme }>`
    &:not(:first-child) {
        margin-top: 0.25em;
    }

    .key {
        color: ${(props) => props.theme.colorSecondaryText};
        font-family: ${(props) => props.theme.condensedFontFamily};
        font-weight: 800;
    }

    .value {
        margin-left: 0.5em;
    }

    .MessageStatusIcon {
        margin: 0 0.5em;
    }

    &.footer {
        margin-top: 0.5em;
        font-size: 0.9em;
        text-align: right;

        .key {
            color: ${(props) => props.theme.colorLightText};
            font-weight: 100;
        }
    }
`;
