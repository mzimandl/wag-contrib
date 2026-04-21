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
import { Actions, DataItem } from './actions.js';
import { Actions as LexActions } from '../lexOverview/actions.js';
import { List } from 'cnc-tskit';
import { LexApi } from '../lexOverview/api/api.js';
import {
    findCurrQueryMatch,
    QueryMatch,
    RecognizedQueries,
} from '../../../query/index.js';
import { IDataStreaming } from '../../../page/streaming.js';
import { forkJoin, map } from 'rxjs';
import { isLexQueryMatch, Source } from '../lexOverview/common.js';

export interface LexMeaningModelState {
    isBusy: boolean;
    slectedVariantIdx: number;
    data: Array<DataItem>;
    error: string;
    backlink: Backlink;
}

export interface LexMeaningModelArgs {
    dispatcher: IActionQueue;
    initState: LexMeaningModelState;
    tileId: number;
    api: LexApi;
    appServices: IAppServices;
    queryMatches: RecognizedQueries;
}

export class LexMeaningModel extends StatelessModel<LexMeaningModelState> {
    private readonly tileId: number;

    private readonly api: LexApi;

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
                state.data = this.prepareRequestData(state.slectedVariantIdx);
            },
            (state, action, dispatch) => {
                this.loadData(
                    this.appServices.dataStreaming(),
                    List.map((v) => v.id, state.data),
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
                if (state.slectedVariantIdx !== action.payload.variantIdx) {
                    state.isBusy = true;
                    state.slectedVariantIdx = action.payload.variantIdx;
                    state.data = this.prepareRequestData(
                        state.slectedVariantIdx
                    );
                }
            },
            (state, action, dispatch) => {
                this.loadData(
                    this.appServices
                        .dataStreaming()
                        .startNewSubgroup(this.tileId),
                    List.map((v) => v.id, state.data),
                    dispatch
                );
            }
        );
    }

    private prepareRequestData(
        variantIdx: number
    ): Array<{ id: string; variants: null; meanings: null }> {
        const currentQueryMatch = findCurrQueryMatch(
            List.head(this.queryMatches)
        );
        return isLexQueryMatch(currentQueryMatch)
            ? List.flatMap(
                  (v) =>
                      v.parentId
                          ? [
                                {
                                    id: v.id,
                                    variants: null,
                                    meanings: null,
                                },
                                {
                                    id: v.parentId,
                                    variants: null,
                                    meanings: null,
                                },
                            ]
                          : [
                                {
                                    id: v.id,
                                    variants: null,
                                    meanings: null,
                                },
                            ],
                  currentQueryMatch.extraData[variantIdx].sources[
                      Source.ASSC
                  ] || []
              )
            : [];
    }

    private loadData(
        streaming: IDataStreaming,
        requestIds: Array<string>,
        dispatch: SEDispatcher
    ): void {
        forkJoin(
            List.map(
                (id, i) =>
                    this.api.loadASSC(streaming, this.tileId, i, id).pipe(
                        map((resp) => ({
                            id: id,
                            variants: resp.variants,
                            meanings: resp.meanings,
                        }))
                    ),
                requestIds
            )
        ).subscribe({
            next: (data) => {
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: data.length === 0,
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
                        data: [],
                    },
                });
            },
        });
    }
}
