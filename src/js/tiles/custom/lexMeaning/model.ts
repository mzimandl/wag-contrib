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
import { List } from 'cnc-tskit';
import { findCurrQueryMatch, RecognizedQueries } from '../../../query/index.js';
import { IDataStreaming } from '../../../page/streaming.js';
import { forkJoin } from 'rxjs';
import { isLexQueryMatch, Source } from '../lexOverview/common.js';
import { HTMLBlock, MeaningApi } from './api.js';

export interface LexMeaningModelState {
    isBusy: boolean;
    selectedVariantIdx: number;
    data: Array<HTMLBlock>;
    error: string;
    backlink: Backlink;
}

export interface LexMeaningModelArgs {
    dispatcher: IActionQueue;
    initState: LexMeaningModelState;
    tileId: number;
    api: MeaningApi;
    appServices: IAppServices;
    queryMatches: RecognizedQueries;
}

export class LexMeaningModel extends StatelessModel<LexMeaningModelState> {
    private readonly tileId: number;

    private readonly api: MeaningApi;

    private readonly appServices: IAppServices;

    private readonly queryMatches: RecognizedQueries;

    constructor({
        dispatcher,
        initState,
        api,
        tileId,
        appServices,
        queryMatches,
    }: LexMeaningModelArgs) {
        super(dispatcher, initState);
        this.tileId = tileId;
        this.appServices = appServices;
        this.api = api;
        this.queryMatches = queryMatches;

        this.addActionHandler(
            GlobalActions.RequestQueryResponse,
            (state, action) => {
                state.isBusy = true;
                state.error = null;
                state.backlink = null;
            },
            (state, action, dispatch) => {
                const [lemma, requestIds] = this.prepareRequestIds(
                    state.selectedVariantIdx
                );
                this.loadData(
                    this.appServices.dataStreaming(),
                    lemma,
                    requestIds,
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
                } else {
                    state.data = action.payload.data;
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
                    state.selectedVariantIdx = action.payload.variantIdx;
                }
            },
            (state, action, dispatch) => {
                const [lemma, requestIds] = this.prepareRequestIds(
                    state.selectedVariantIdx
                );
                this.loadData(
                    this.appServices
                        .dataStreaming()
                        .startNewSubgroup(this.tileId),
                    lemma,
                    requestIds,
                    dispatch
                );
            }
        );
    }

    private prepareRequestIds(variantIdx: number): [string, Array<string>] {
        const currentQueryMatch = findCurrQueryMatch(
            List.head(this.queryMatches)
        );
        const variantData = isLexQueryMatch(currentQueryMatch)
            ? currentQueryMatch.extraData[variantIdx]
            : null;
        return variantData
            ? [
                  variantData.lemma,
                  List.map((v) => v.id, variantData.sources[Source.ASSC] || []),
              ]
            : ['', []];
    }

    private loadData(
        streaming: IDataStreaming,
        lemma: string,
        requestIds: Array<string>,
        dispatch: SEDispatcher
    ): void {
        forkJoin(
            List.map(
                (id, i) => this.api.call(streaming, this.tileId, i, { id }),
                requestIds
            )
        ).subscribe({
            next: (data) => {
                let filteredData = this.filterResultsByIDs(requestIds, data);
                filteredData = this.filterVariantsByLemma(lemma, filteredData);

                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: filteredData.length === 0,
                        data: filteredData,
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
                        data: [],
                    },
                });
            },
        });
    }

    private filterResultsByIDs(
        requestIds: string[],
        data: HTMLBlock[][]
    ): HTMLBlock[] {
        return List.flatMap((id, i) => {
            const idx = List.findIndex(
                (d) => List.some((x) => x.id === 'hid-' + id, d.variants),
                data[i]
            );
            if (idx !== -1) {
                const mainItem = data[i][idx];
                if (idx > 0) {
                    const parentItem = data[i][0];
                    parentItem.isParent = true;
                    return [mainItem, parentItem];
                }
                return [mainItem];
            } else {
                return [];
            }
        }, requestIds);
    }

    private filterVariantsByLemma(
        lemma: string,
        data: HTMLBlock[]
    ): HTMLBlock[] {
        return List.map((d) => {
            const variant = List.find((v) => v.key === lemma, d.variants);
            if (variant) {
                d.variants = [variant];
            }
            return d;
        }, data);
    }
}
