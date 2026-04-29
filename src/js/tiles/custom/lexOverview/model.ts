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
            },
            (state, action, dispatch) => {
                if (state.selectedVariantIdx > -1) {
                    const variant = state.variants[state.selectedVariantIdx];
                    const [asscId, ijpId] = this.getRequestIds(variant);
                    this.loadData(
                        this.appServices.dataStreaming(),
                        dispatch,
                        asscId,
                        ijpId
                    );
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.TilePartialDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                if (isAsscData(action.payload)) {
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
                } else if (isIjpData(action.payload)) {
                    state.data.ijp = action.payload.data;
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
                const variant = state.variants[action.payload.variantIdx];
                const [asscId, ijpId] = this.getRequestIds(variant);
                this.loadData(subg, dispatch, asscId, ijpId);
            }
        );
    }

    private getRequestIds(variant: LexItem): [string?, string?] {
        const asscId = variant.sources['assc']
            ? variant.sources['assc'][0].id
            : null;
        const ijpId = variant.sources['ijp']
            ? variant.sources['ijp'][0].id
            : null;
        return [asscId, ijpId];
    }

    private loadData(
        streaming: IDataStreaming,
        dispatch: SEDispatcher,
        asscId?: string,
        ijpId?: string
    ) {
        const args: LexArgs = {
            asscIds: [asscId],
            ijpIds: [ijpId],
        };

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
