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

import { IActionQueue, SEDispatcher } from 'kombo';
import { IAppServices } from '../../../appServices.js';
import { Backlink } from '../../../page/tile.js';
import { DataStructure } from './common.js';
import { Actions as GlobalActions } from '../../../models/actions.js';
import { Actions } from './actions.js';
import { List } from 'cnc-tskit';
import { UjcNeomatArgs, UjcNeomatApi } from './api.js';
import {
    findCurrQueryMatch,
    LemmatizationLevel,
    QueryMatch,
    RecognizedQueries,
} from '../../../query/index.js';
import { IDataStreaming } from '../../../page/streaming.js';
import { getCurrentVariant } from '../lexCommon/types/dictionary.js';
import { TileStatelessModel } from '../../../models/tiles/base.js';

export interface UjcNeomatModelState {
    isBusy: boolean;
    ident: string;
    maxItems: number;
    data: DataStructure;
    error: string;
    backlink: Backlink;
}

export interface UjcNeomatModelArgs {
    dispatcher: IActionQueue;
    initState: UjcNeomatModelState;
    tileId: number;
    api: UjcNeomatApi;
    appServices: IAppServices;
    queryMatches: RecognizedQueries;
    lemLevelSupport: Array<LemmatizationLevel>;
    dependentTiles: Array<number>;
}

export class UjcNeomatModel extends TileStatelessModel<UjcNeomatModelState> {
    private readonly api: UjcNeomatApi;

    constructor({
        dispatcher,
        initState,
        api,
        tileId,
        appServices,
        queryMatches,
        dependentTiles,
        lemLevelSupport,
    }: UjcNeomatModelArgs) {
        super({
            dispatcher,
            initState,
            tileId,
            appServices,
            dependentTiles,
            lemLevelSupport,
        });
        this.api = api;

        this.addSearchActionHandler(
            (state, action) => {
                let queryMatch: QueryMatch;
                if (!!action.payload?.newQueryMatches) {
                    queryMatch = action.payload.newQueryMatches[0];
                } else {
                    queryMatch = findCurrQueryMatch(List.head(queryMatches));
                }
                const variant = getCurrentVariant(queryMatch);
                if (variant) {
                    state.ident = variant.key.lemma;
                } else {
                    state.ident = queryMatch.lemma || queryMatch.word;
                }
                state.isBusy = true;
                state.error = null;
                state.data = {
                    entries: [],
                };
                state.backlink = null;
            },
            (state, action, dispatch, ds) => {
                this.loadData(ds, dispatch, state);
            }
        );

        this.addActionSubtypeHandler(
            Actions.TileDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    state.error = action.error.message;
                } else {
                    state.data = action.payload.data;
                    state.backlink = this.api.getBacklink(0);
                }
            }
        );

        this.addActionSubtypeHandler(
            GlobalActions.GetSourceInfo,
            (action) => action.payload.tileId === this.tileId,
            null,
            (state, action, dispatch) => {
                this.api
                    .getSourceDescription(
                        appServices.dataStreaming(),
                        this.tileId,
                        appServices.getISO639UILang(),
                        ''
                    )
                    .subscribe({
                        next: (data) => {
                            dispatch({
                                name: GlobalActions.GetSourceInfoDone.name,
                                payload: {
                                    data: data,
                                },
                            });
                        },
                        error: (err) => {
                            console.error(err);
                            dispatch({
                                name: GlobalActions.GetSourceInfoDone.name,
                                error: err,
                            });
                        },
                    });
            }
        );

        this.addActionSubtypeHandler(
            GlobalActions.FollowBacklink,
            (action) => action.payload.tileId === this.tileId,
            null,
            (state, action, dispatch) => {
                const backlinkUrl = new URL(
                    'http://www.neologismy.cz/index.php'
                );
                backlinkUrl.searchParams.set('retezec', state.ident);
                backlinkUrl.searchParams.set('nove_hledani', '1');
                backlinkUrl.searchParams.set('button', 'Hledat');
                backlinkUrl.searchParams.set('prijimam', '1');
                window.open(backlinkUrl.toString(), '_blank');
            }
        );
    }

    private loadData(
        streaming: IDataStreaming,
        dispatch: SEDispatcher,
        state: UjcNeomatModelState
    ) {
        const args: UjcNeomatArgs = {
            q: state.ident,
            maxItems: state.maxItems,
        };
        this.api.call(streaming, this.tileId, 0, args).subscribe({
            next: (data) => {
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: false,
                        data,
                    },
                });
            },
            error: (error) => {
                console.error(error);
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    error,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: true,
                        data: {
                            entries: [],
                        },
                    },
                });
            },
        });
    }
}
