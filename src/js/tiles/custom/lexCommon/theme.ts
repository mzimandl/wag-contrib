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
import { Source } from './types/enums.js';

interface LexTheme {
    subtileBorderRadius: string;
    sourceColors: Partial<Record<Source, string>>;
}

function isLexTheme(theme: Theme): theme is Theme<LexTheme> {
    return (
        !!theme &&
        typeof theme.extraTheme === 'object' &&
        'sourceColors' in theme.extraTheme &&
        typeof theme.extraTheme.sourceColors === 'object'
    );
}

export function getLexTheme(theme: Theme): LexTheme {
    const defaultTheme: LexTheme = {
        subtileBorderRadius: '8px',
        sourceColors: {
            [Source.ASSC]: '#d4e2f4',
            [Source.SSC]: '#dae8f6',
            [Source.IJP]: '#e5eef8',
            [Source.Corpus]: '#fae9da',
        },
    };

    if (isLexTheme(theme)) {
        return {
            ...defaultTheme,
            ...theme.extraTheme,
            sourceColors: {
                ...defaultTheme.sourceColors,
                ...theme.extraTheme.sourceColors,
            },
        };
    }
    return defaultTheme;
}
