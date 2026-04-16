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

import { Action } from 'kombo';
import { Actions as GlobalActions } from '../../../models/actions.js';
import { AggregateData, SearchVariant } from './common.js';
import { DataItem, MeaningData, VariantData } from './commonAssc.js';
import { DataStructure as LGuideDataStructure } from './commonLguide.js';

export interface DataLoadedPayload {
    aggregate: AggregateData;
}

export class Actions {
    static TileDataLoaded: Action<
        typeof GlobalActions.TileDataLoaded.payload & DataLoadedPayload
    > = {
        name: GlobalActions.TileDataLoaded.name,
    };

    static ASSCDataLoaded: Action<{
        tileId: number;
        selectedItemIdx: number;
        selectedVariantIdx: number;
        items: Array<DataItem>;
        variants: Array<Array<SearchVariant>>;
    }> = {
        name: 'LEX_OVERVIEW_ASSC_DATA_LOADED',
    };

    static LGuideDataLoaded: Action<{
        tileId: number;
        selectedItemIdx: number;
        selectedVariantIdx: number;
        data: LGuideDataStructure;
    }> = {
        name: 'LEX_OVERVIEW_LGUIDE_DATA_LOADED',
    };

    static SelectItemVariant: Action<{
        tileId: number;
        variantIdx: number;
    }> = {
        name: 'LEX_OVERVIEW_SELECT_ITEM_VARIANT',
    };

    static SendActiveMeaningData: Action<{
        tileId: number;
        variants: Array<VariantData>;
        meanings: Array<MeaningData>;
    }> = {
        name: 'LEX_OVERVIEW_SEND_ACTIVE_MEANING_DATA',
    };
}
