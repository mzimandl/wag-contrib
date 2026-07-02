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

import { IActionQueue, SEDispatcher } from 'kombo';
import { IAppServices } from '../../../appServices.js';
import { Backlink } from '../../../page/tile.js';
import { Actions as GlobalActions } from '../../../models/actions.js';
import { Actions } from './actions.js';
import { List } from 'cnc-tskit';
import { LemmatizationLevel, QueryMatch } from '../../../query/index.js';
import { TileStatelessModel } from '../../../models/tiles/base.js';
import {
    isSSJCDataStructure,
    isPSJCDataStructure,
    LexDictApi,
} from './api/types.js';
import {
    PSJCDataStructure,
    SSJCDataStructure,
    UjcBasicArgs,
} from './api/basicApi.js';
import { forkJoin, tap } from 'rxjs';
import { getCurrentVariant } from '../lexCommon/types/dictionary.js';
import { IDataStreaming } from '../../../page/streaming.js';
import { Source } from '../lexCommon/types/enums.js';

export interface LexDictionariesModelState {
    isBusy: boolean;
    sources: Array<{
        type: Source;
        loaded: boolean;
        data: SSJCDataStructure | PSJCDataStructure;
        backlink: Backlink;
    }>;
    activeDictTab: number;
    currQueryMatch: QueryMatch;
    error: string;
}

export interface LexDictionariesModelArgs {
    dispatcher: IActionQueue;
    initState: LexDictionariesModelState;
    tileId: number;
    apis: Array<LexDictApi>;
    appServices: IAppServices;
    lemLevelSupport: Array<LemmatizationLevel>;
    dependentTiles: Array<number>;
}

export class LexDictionariesModel extends TileStatelessModel<LexDictionariesModelState> {
    private readonly apis: Array<LexDictApi>;

    constructor({
        dispatcher,
        initState,
        apis,
        tileId,
        appServices,
        dependentTiles,
        lemLevelSupport,
    }: LexDictionariesModelArgs) {
        super({
            dispatcher,
            initState,
            tileId,
            appServices,
            dependentTiles,
            lemLevelSupport,
        });
        this.apis = apis;

        this.addSearchActionHandler(
            (state, action) => {
                if (!!action.payload?.newQueryMatches) {
                    state.currQueryMatch = action.payload.newQueryMatches[0];
                }
                state.isBusy = true;
                state.sources = List.map(
                    (d) => ({
                        type: d.type,
                        data: null,
                        loaded: false,
                        empty: true,
                        backlink: null,
                    }),
                    state.sources
                );
            },
            (state, action, dispatch, ds) => {
                var searchTerm: string;
                const variant = getCurrentVariant(state.currQueryMatch);
                if (variant) {
                    searchTerm = variant.lemma;
                } else {
                    searchTerm =
                        state.currQueryMatch.lemma || state.currQueryMatch.word;
                }
                this.loadData(ds, dispatch, searchTerm);
            }
        );

        this.addActionSubtypeHandler(
            Actions.TileDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.isBusy = false;
                if (state.activeDictTab === -1) {
                    state.activeDictTab = List.findIndex(
                        (source) => source.data !== null,
                        state.sources
                    );
                }
                if (action.error) {
                    state.error = action.error.message;
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.PartialTileDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.sources[action.payload.queryId].loaded = true;
                if (
                    isSSJCDataStructure(
                        state.sources[action.payload.queryId].type,
                        action.payload.data
                    ) &&
                    !List.empty(action.payload.data.entries)
                ) {
                    state.sources[action.payload.queryId].data =
                        action.payload.data;
                    state.sources[action.payload.queryId].backlink = this.apis[
                        action.payload.queryId
                    ].getBacklink(action.payload.queryId);
                } else if (
                    isPSJCDataStructure(
                        state.sources[action.payload.queryId].type,
                        action.payload.data
                    ) &&
                    !List.empty(action.payload.data.entries)
                ) {
                    state.sources[action.payload.queryId].data =
                        action.payload.data;
                    state.sources[action.payload.queryId].backlink = this.apis[
                        action.payload.queryId
                    ].getBacklink(action.payload.queryId);
                }

                if (List.every((d) => d.loaded, state.sources)) {
                    state.isBusy = false;
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.SelectTab,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.activeDictTab = action.payload.dataIdx;
            }
        );

        this.addActionSubtypeHandler(
            GlobalActions.GetSourceInfo,
            (action) => action.payload.tileId === this.tileId,
            null,
            (state, action, dispatch) => {
                this.apis[state.activeDictTab]
                    .getSourceDescription(
                        this.appServices.dataStreaming(),
                        this.tileId,
                        this.appServices.getISO639UILang(),
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
                var searchTerm: string;
                const variant = getCurrentVariant(state.currQueryMatch);
                if (variant) {
                    searchTerm = variant.lemma;
                } else {
                    searchTerm =
                        state.currQueryMatch.lemma || state.currQueryMatch.word;
                }
                const url =
                    this.apis[action.payload.backlink.queryId].getBacklinkURL(
                        searchTerm
                    );
                window.open(url.toString(), '_blank');
            }
        );
    }

    private loadData(
        streaming: IDataStreaming,
        dispatch: SEDispatcher,
        query: string
    ) {
        const args: UjcBasicArgs = {
            q: query,
        };
        forkJoin(
            List.map(
                (api, i) =>
                    api.call(streaming, this.tileId, i, args).pipe(
                        tap((data) => {
                            dispatch<typeof Actions.PartialTileDataLoaded>({
                                name: Actions.PartialTileDataLoaded.name,
                                payload: {
                                    tileId: this.tileId,
                                    queryId: i,
                                    data: data,
                                },
                            });
                        })
                    ),
                this.apis
            )
        ).subscribe({
            next: (resp) => {
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: List.every((d) => List.empty(d), resp),
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
                    },
                });
            },
        });
    }
}
