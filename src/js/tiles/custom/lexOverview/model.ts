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
import { ASSCApi } from './api/assc.js';
import { IJPApi } from './api/ijp.js';
import { EMPTY, merge, partition, tap } from 'rxjs';
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
    asscApi: ASSCApi;
    ijpApi: IJPApi;
    lexApi: LexApi;
    appServices: IAppServices;
    queryMatches: RecognizedQueries;
}

export class LexOverviewModel extends StatelessModel<LexOverviewModelState> {
    private readonly tileId: number;

    private readonly asscApi: ASSCApi;

    private readonly ijpApi: IJPApi;

    private readonly lexApi: LexApi;

    private readonly appServices: IAppServices;

    private readonly queryMatches: RecognizedQueries;

    constructor({
        dispatcher,
        initState,
        asscApi,
        ijpApi,
        lexApi,
        tileId,
        appServices,
        queryMatches,
    }: LexOverviewModelArgs) {
        super(dispatcher, initState);
        this.tileId = tileId;
        this.appServices = appServices;
        this.asscApi = asscApi;
        this.ijpApi = ijpApi;
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
                    this.loadData2(
                        this.appServices.dataStreaming(),
                        dispatch,
                        asscId,
                        ijpId
                    );
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.ASSCTileDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
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
        );

        this.addActionSubtypeHandler(
            Actions.IJPTileDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.data.ijp = action.payload.data;
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
                /*
                this.api
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
                */
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
                const variant = state.variants[action.payload.variantIdx];
                const [asscId, ijpId] = this.getRequestIds(variant);
                this.loadData2(
                    this.appServices
                        .dataStreaming()
                        .startNewSubgroup(this.tileId),
                    dispatch,
                    asscId,
                    ijpId
                );
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
        const asscObservable =
            asscId && this.asscApi
                ? this.asscApi
                      .call(streaming, this.tileId, 0, { id: asscId })
                      .pipe(
                          tap((data) => {
                              dispatch<typeof Actions.ASSCTileDataLoaded>({
                                  name: Actions.ASSCTileDataLoaded.name,
                                  payload: {
                                      tileId: this.tileId,
                                      id: asscId,
                                      data,
                                  },
                              });
                          })
                      )
                : EMPTY;

        const ijpObservable =
            ijpId && this.ijpApi
                ? this.ijpApi
                      .call(streaming, this.tileId, 1, { id: ijpId })
                      .pipe(
                          tap((data) => {
                              dispatch<typeof Actions.IJPTileDataLoaded>({
                                  name: Actions.IJPTileDataLoaded.name,
                                  payload: {
                                      tileId: this.tileId,
                                      id: ijpId,
                                      data,
                                  },
                              });
                          })
                      )
                : EMPTY;

        merge(asscObservable, ijpObservable).subscribe({
            complete: () => {
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: false, // TODO
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

    private loadData2(
        streaming: IDataStreaming,
        dispatch: SEDispatcher,
        asscId?: string,
        ijpId?: string
    ) {
        const args: LexArgs = {
            asscIds: [asscId],
            ijpIds: [ijpId],
        };

        this.lexApi
            .call(streaming, this.tileId, 0, args)
            .pipe(
                tap((v) => {
                    if (isAsscData(v)) {
                        dispatch<typeof Actions.ASSCTileDataLoaded>({
                            name: Actions.ASSCTileDataLoaded.name,
                            payload: {
                                tileId: this.tileId,
                                id: asscId,
                                data: v.data,
                            },
                        });
                    } else if (isIjpData(v)) {
                        dispatch<typeof Actions.IJPTileDataLoaded>({
                            name: Actions.IJPTileDataLoaded.name,
                            payload: {
                                tileId: this.tileId,
                                id: ijpId,
                                data: v.data,
                            },
                        });
                    }
                })
            )
            .subscribe({
                complete: () => {
                    dispatch<typeof Actions.TileDataLoaded>({
                        name: Actions.TileDataLoaded.name,
                        payload: {
                            tileId: this.tileId,
                            isEmpty: false, // TODO
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
