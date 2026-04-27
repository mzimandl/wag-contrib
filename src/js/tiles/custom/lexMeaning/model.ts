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
import {
    findCurrQueryMatch,
    QueryMatch,
    RecognizedQueries,
} from '../../../query/index.js';
import { IDataStreaming } from '../../../page/streaming.js';
import { map, merge } from 'rxjs';
import { isLexQueryMatch, LexItem, Source } from '../lexOverview/common.js';
import { ASSCApi } from '../lexOverview/api/assc.js';
import { HTMLBlock } from '../lexOverview/api/asscTypes.js';

export interface LexMeaningModelState {
    isBusy: boolean;
    selectedVariantIdx: number;
    selectedVariant: LexItem;
    data: Array<{
        order: number;
        blocks: HTMLBlock[];
    }>;
    error: string;
    backlink: Backlink;
}

export interface LexMeaningModelArgs {
    dispatcher: IActionQueue;
    initState: LexMeaningModelState;
    tileId: number;
    api: ASSCApi;
    appServices: IAppServices;
    queryMatches: RecognizedQueries;
}

export class LexMeaningModel extends StatelessModel<LexMeaningModelState> {
    private readonly tileId: number;

    private readonly api: ASSCApi;

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
                state.data = [];
                state.selectedVariant = this.getCurrentVariant(
                    state.selectedVariantIdx
                );
            },
            (state, action, dispatch) => {
                const requestIds = this.prepareRequestIds(
                    state.selectedVariant
                );
                this.loadData(
                    this.appServices.dataStreaming(),
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
                    state.data.push({ order: 0, blocks: action.payload.data });
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
                    state.data = [];
                    state.selectedVariantIdx = action.payload.variantIdx;
                    state.selectedVariant = this.getCurrentVariant(
                        state.selectedVariantIdx
                    );
                }
            },
            (state, action, dispatch) => {
                const requestIds = this.prepareRequestIds(
                    state.selectedVariant
                );
                this.loadData(
                    this.appServices
                        .dataStreaming()
                        .startNewSubgroup(this.tileId),
                    requestIds,
                    dispatch
                );
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

    private prepareRequestIds(variant: LexItem): Array<string> {
        return variant
            ? List.map((v) => v.id, variant.sources[Source.ASSC] || [])
            : [];
    }

    private loadData(
        streaming: IDataStreaming,
        requestIds: Array<string>,
        dispatch: SEDispatcher
    ): void {
        merge(
            ...List.map(
                (id, i) =>
                    this.api
                        .call(streaming, this.tileId, i, { id })
                        .pipe(map((data) => ({ data, id }))),
                requestIds
            )
        ).subscribe({
            next: (resp) => {
                let filteredData = this.filterResultsByIDs(resp.id, resp.data);
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
