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

import { IActionQueue, SEDispatcher, StatelessModel } from 'kombo';
import { IAppServices } from '../../../appServices.js';
import { Backlink } from '../../../page/tile.js';
import { QueryMatch, RecognizedQueries } from '../../../query/index.js';
import { Actions as GlobalActions } from '../../../models/actions.js';
import { Actions } from './actions.js';
import { LexItem, Source } from './common.js';

import { HTMLBlock as ASSCData } from './api/asscTypes.js';
import { IJPData as IJPData } from './api/ijpTypes.js';
import { IDataStreaming } from '../../../page/streaming.js';
import { List } from 'cnc-tskit';
import { isAsscData, isIjpData, LexApi, LexArgs } from './api/lex.js';

interface Data {
    assc: ASSCData;
    ijp: IJPData;
}

export interface LexOverviewModelState {
    isBusy: boolean;
    queryMatch: QueryMatch;
    mainSource: Source;
    variants: Array<LexItem>;
    selectedVariantIdx: number;
    requestedIds: LexArgs;
    data: Data;
    error: string;
    backlink: Backlink;
}

export interface LexOverviewModelArgs {
    dispatcher: IActionQueue;
    initState: LexOverviewModelState;
    tileId: number;
    lexApi: LexApi;
    appServices: IAppServices;
    queryMatches: RecognizedQueries;
    dependentTiles: Array<number>;
}

export class LexOverviewModel extends StatelessModel<LexOverviewModelState> {
    private readonly tileId: number;

    private readonly lexApi: LexApi;

    private readonly appServices: IAppServices;

    private readonly queryMatches: RecognizedQueries;

    constructor({
        dispatcher,
        initState,
        lexApi,
        tileId,
        appServices,
        queryMatches,
        dependentTiles,
    }: LexOverviewModelArgs) {
        super(dispatcher, initState);
        this.tileId = tileId;
        this.appServices = appServices;
        this.lexApi = lexApi;
        this.queryMatches = queryMatches;

        this.addActionHandler(
            GlobalActions.RequestQueryResponse,
            (state, action) => {
                state.isBusy = true;
                state.error = undefined;
                state.backlink = undefined;
                if (state.selectedVariantIdx > -1) {
                    state.requestedIds = this.getRequestIds(
                        state.variants[state.selectedVariantIdx],
                        !List.empty(dependentTiles)
                    );
                }
            },
            (state, action, dispatch) => {
                if (state.selectedVariantIdx > -1) {
                    this.loadData(
                        this.appServices.dataStreaming(),
                        dispatch,
                        state.requestedIds
                    );
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.TilePartialDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                // get only first assc data
                if (isAsscData(action.payload) && !state.data.assc) {
                    // get only block containig word with the correct id
                    const block = List.find(
                        (block) =>
                            List.some(
                                (variant) =>
                                    'hid-' + action.payload.id === variant.id,
                                block.variants
                            ),
                        action.payload.data
                    );
                    if (block) {
                        state.data.assc = block;
                    }
                }

                // get only first ijp data
                if (isIjpData(action.payload) && !state.data.ijp) {
                    state.data.ijp = action.payload.data;
                }

                if (
                    (state.data.assc !== null ||
                        List.empty(state.requestedIds.asscIds)) &&
                    (state.data.ijp !== null ||
                        List.empty(state.requestedIds.ijpIds))
                ) {
                    state.isBusy = false;
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.TileDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    state.error = action.error.message;
                }
            }
        );

        this.addActionSubtypeHandler(
            GlobalActions.GetSourceInfo,
            (action) => action.payload.tileId === this.tileId,
            null,
            (state, action, dispatch) => {
                this.lexApi
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
                const backlinkUrl = new URL('https://prirucka.ujc.cas.cz/');
                /* --- TODO ---
                if (state.data.isDirect) {
                    backlinkUrl.searchParams.set('id', state.data.rawQuery);
                } else {
                    backlinkUrl.searchParams.set('slovo', state.data.rawQuery);
                }
                */
                window.open(backlinkUrl.toString(), '_blank');
            }
        );

        this.addActionSubtypeHandler(
            Actions.SelectItemVariant,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.selectedVariantIdx = action.payload.variantIdx;
                state.requestedIds = this.getRequestIds(
                    state.variants[action.payload.variantIdx],
                    !List.empty(dependentTiles)
                );
                state.data.assc = null;
                state.data.ijp = null;
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                const subg = appServices
                    .dataStreaming()
                    .startNewSubgroup(this.tileId, ...dependentTiles);
                dispatch(GlobalActions.TileSubgroupReady, {
                    mainTileId: this.tileId,
                    subgroupId: subg.getId(),
                });
                this.loadData(subg, dispatch, state.requestedIds);
            }
        );
    }

    private getRequestIds(variant: LexItem, requestAll: boolean): LexArgs {
        return {
            asscIds: variant.sources['assc']
                ? requestAll
                    ? List.map((v) => v.id, variant.sources['assc'])
                    : [variant.sources['assc'][0].id]
                : [],
            ijpIds: variant.sources['ijp']
                ? requestAll
                    ? List.map((v) => v.id, variant.sources['ijp'])
                    : [variant.sources['ijp'][0].id]
                : [],
        };
    }

    private loadData(
        streaming: IDataStreaming,
        dispatch: SEDispatcher,
        args: LexArgs
    ) {
        this.lexApi.call(streaming, this.tileId, 0, args).subscribe({
            next: (v) => {
                dispatch<typeof Actions.TilePartialDataLoaded>({
                    name: Actions.TilePartialDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        ...v,
                    },
                });
            },
            complete: () => {
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: false,
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
