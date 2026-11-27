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

import { Action } from 'kombo';
import { Actions as GlobalActions } from '../../../models/actions.js';

export class Actions {
    static TileDataLoaded: Action<typeof GlobalActions.TileDataLoaded.payload> =
        {
            name: GlobalActions.TileDataLoaded.name,
        };

    /**
     * Replaces words of the "slovoskop" easter egg game. Anyone can
     * dispatch it - the model loads words from a URL this way, but
     * also e.g. another tile or a developer from the console could.
     */
    static SetEasterEggWords: Action<{
        tileId: number;
        words: Array<string>;
    }> = {
        name: 'LEX_COMMON_SET_EASTER_EGG_WORDS',
    };
}
