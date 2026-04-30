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
import { Actions as GlobalActions } from '../../../models/actions.js';
import { Actions } from './actions.js';
import { Actions as LexActions } from '../lexOverview/actions.js';
import { List, pipe } from 'cnc-tskit';
import { findCurrQueryMatch, RecognizedQueries } from '../../../query/index.js';
import { IDataStreaming } from '../../../page/streaming.js';
import { isLexQueryMatch, LexItem, Source } from '../lexOverview/common.js';
import { HTMLBlock } from '../lexOverview/api/asscTypes.js';
import {
    isAsscData,
    isIjpData,
    LexApi,
    LexArgs,
    LexResponse,
} from '../lexOverview/api/lex.js';
import { filter } from 'rxjs';

export interface LexNotesModelState {
    isBusy: boolean;
    selectedVariantIdx: number;
    requestedIds: LexArgs;
    notes: {
        ijp: Array<string>;
        assc: Array<string>;
    };
    error: string;
    backlink: Backlink;
}

export interface LexNotesModelArgs {
    dispatcher: IActionQueue;
    initState: LexNotesModelState;
    tileId: number;
    lexApi: LexApi;
    appServices: IAppServices;
    queryMatches: RecognizedQueries;
    readDataFromTile: number | null;
}

export class LexNotesModel extends StatelessModel<LexNotesModelState> {
    private readonly tileId: number;

    private readonly lexApi: LexApi;

    private readonly appServices: IAppServices;

    private readonly queryMatches: RecognizedQueries;

    private readonly readDataFromTile: number | null;

    constructor({
        dispatcher,
        initState,
        lexApi,
        tileId,
        appServices,
        queryMatches,
        readDataFromTile,
    }: LexNotesModelArgs) {
        super(dispatcher, initState);
        this.tileId = tileId;
        this.appServices = appServices;
        this.lexApi = lexApi;
        this.queryMatches = queryMatches;
        this.readDataFromTile = readDataFromTile;

        this.addActionHandler(
            GlobalActions.RequestQueryResponse,
            (state, action) => {
                state.isBusy = true;
                state.error = null;
                state.backlink = null;
                state.notes = {
                    ijp: [],
                    assc: [],
                };
                state.requestedIds = this.getRequestIds(
                    this.getCurrentVariant(state.selectedVariantIdx)
                );
            },
            (state, action, dispatch) => {
                this.loadData(
                    this.appServices.dataStreaming(),
                    state.requestedIds,
                    dispatch
                );
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
            Actions.TilePartialDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                switch (action.payload.source) {
                    case Source.IJP:
                        state.notes.ijp.push(...action.payload.notes);
                        break;
                    case Source.ASSC:
                        state.notes.assc.push(...action.payload.notes);
                        break;
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
                window.open(
                    `https://slovnikcestiny.cz/heslo/state.data.query/`,
                    '_blank'
                );
            }
        );

        this.addActionHandler(
            LexActions.SelectItemVariant,
            (state, action) => {
                if (state.selectedVariantIdx !== action.payload.variantIdx) {
                    state.isBusy = true;
                    state.notes = {
                        ijp: [],
                        assc: [],
                    };
                    state.selectedVariantIdx = action.payload.variantIdx;
                    state.requestedIds = this.getRequestIds(
                        this.getCurrentVariant(state.selectedVariantIdx)
                    );
                }
            },
            (state, action, dispatch) => {
                if (this.readDataFromTile !== null) {
                    this.waitForAction({}, (action, data) => {
                        if (
                            GlobalActions.isTileSubgroupReady(action) &&
                            action.payload.mainTileId === this.readDataFromTile
                        ) {
                            return null;
                        }
                        return data;
                    }).subscribe({
                        next: (action) => {
                            if (GlobalActions.isTileSubgroupReady(action)) {
                                this.loadData(
                                    this.appServices
                                        .dataStreaming()
                                        .getSubgroup(action.payload.subgroupId),
                                    state.requestedIds,
                                    dispatch
                                );
                            }
                        },
                    });
                } else {
                    this.loadData(
                        this.appServices
                            .dataStreaming()
                            .startNewSubgroup(this.tileId),
                        state.requestedIds,
                        dispatch
                    );
                }
            }
        );
    }

    private getCurrentVariant(variantIdx: number): LexItem {
        const currentQueryMatch = findCurrQueryMatch(
            List.head(this.queryMatches)
        );
        return isLexQueryMatch(currentQueryMatch)
            ? currentQueryMatch.extraData[variantIdx]
            : null;
    }

    private loadData(
        streaming: IDataStreaming,
        requestIds: LexArgs,
        dispatch: SEDispatcher
    ): void {
        (streaming && typeof this.readDataFromTile === 'number'
            ? streaming.registerTileRequest<LexResponse>({
                  tileId: this.tileId,
                  queryIdx: 0, // TODO
                  otherTileId: this.readDataFromTile,
                  otherTileQueryIdx: 0, // TODO
                  contentType: 'application/json',
              })
            : this.lexApi.call(streaming, this.tileId, 0, requestIds)
        )
            .pipe(filter((resp) => isAsscData(resp) || isIjpData(resp)))
            .subscribe({
                next: (resp) => {
                    if (isAsscData(resp)) {
                        let filteredData = this.filterResultsByIDs(
                            resp.id,
                            resp.data
                        );
                        dispatch<typeof Actions.TilePartialDataLoaded>({
                            name: Actions.TilePartialDataLoaded.name,
                            payload: {
                                tileId: this.tileId,
                                source: Source.ASSC,
                                notes: pipe(
                                    filteredData,
                                    List.flatMap((v) => v.notes),
                                    List.filter((v) => !!v)
                                ),
                            },
                        });
                    } else if (isIjpData(resp) && resp.data.notes) {
                        dispatch<typeof Actions.TilePartialDataLoaded>({
                            name: Actions.TilePartialDataLoaded.name,
                            payload: {
                                tileId: this.tileId,
                                source: Source.IJP,
                                notes: [resp.data.notes],
                            },
                        });
                    }
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

    private getRequestIds(variant: LexItem): LexArgs {
        return {
            asscIds: variant.sources['assc']
                ? List.map((v) => v.id, variant.sources['assc'])
                : [],
            ijpIds: variant.sources['ijp']
                ? List.map((v) => v.id, variant.sources['ijp'])
                : [],
        };
    }

    private filterResultsByIDs(id: string, data: HTMLBlock[]): HTMLBlock[] {
        const blockIdx = List.findIndex(
            (d) => List.some((x) => x.id === 'hid-' + id, d.variants),
            data
        );
        if (blockIdx > -1) {
            const mainItem = data[blockIdx];
            if (blockIdx > 0) {
                const parentItem = data[0];
                return [mainItem, parentItem];
            }
            return [mainItem];
        } else {
            return [];
        }
    }
}
