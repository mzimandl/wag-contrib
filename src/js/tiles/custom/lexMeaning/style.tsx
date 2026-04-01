/*
 * Copyright 2022 Martin Zimandl <martin.zimandl@gmail.com>
 * Copyright 2022 Institute of the Czech National Corpus,
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
import { Theme } from '../../../page/theme.js';

// ---------------- <MeaningTileView /> --------------------------------------

export const MeaningTileView = styled.div`
    position: relative;
    min-height: 30em;
    height: 100%;
    width: 100%;
`;

export const MeaningBox = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    background-color: #d4e2f4;
    padding: 1em;
    overflow-y: auto;
`;

export const MeaningHeading = styled.div`
    margin-top: 0;

    .key {
        color: ${props => props.theme.colorLightText};
        font-family: ${props => props.theme.condensedFontFamily};
    }

    .word {
        margin-left: 0.5em;
        font-weight: 700;
    }

    .pos {
        margin-left: 0.5em;
        font-size: 0.8em;
    } 
`;

// ---------------- <MeaningBlock /> --------------------------------------

export const MeaningBlock = styled.div`
    margin: 1em 0;

    .attachement {
        margin-left: 0.5em;
        font-size: 0.8em;
    }

    .explanation {
        font-weight: 700;
    }

    .explanation {
        font-weight: 700;
        font-size: 0.9em;
    }

    .examples {
        .example {
            font-style: italic;
        }
    }
`;
