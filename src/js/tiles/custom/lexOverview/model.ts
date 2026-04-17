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
import { LexApi, LexArgs } from './api.js';
import { LexItem } from './lexQueryMatch.js';

import { DataItem as ASSCData } from './commonAssc.js';
import { DataStructure as LGuideData } from './commonLguide.js';
import { IDataStreaming } from 'src/js/page/streaming.js';

interface Data {
    assc: ASSCData;
    ijp: LGuideData;
}

export interface LexOverviewModelState {
    isBusy: boolean;
    queryMatch: QueryMatch;
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
    api: LexApi;
    appServices: IAppServices;
    queryMatches: RecognizedQueries;
}

export class LexOverviewModel extends StatelessModel<LexOverviewModelState> {
    private readonly tileId: number;

    private readonly api: LexApi;

    private readonly appServices: IAppServices;

    constructor({
        dispatcher,
        initState,
        api,
        tileId,
        appServices,
        queryMatches,
    }: LexOverviewModelArgs) {
        super(dispatcher, initState);
        this.tileId = tileId;
        this.appServices = appServices;
        this.api = api;

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
                    this.loadData(
                        this.appServices.dataStreaming(),
                        dispatch,
                        variant.lemma,
                        variant.sources['assc'][0].id,
                        variant.sources['ijp'][0].id
                    );
                }
                //const match = findCurrQueryMatch(List.head(queryMatches));
                //this.loadData(dispatch, match.lemma || match.word);
            }
        );

        this.addActionSubtypeHandler(
            Actions.TileDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.isBusy = false;
                state.data = action.payload.data;
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
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                const variant = state.variants[action.payload.variantIdx];
                this.loadData(
                    this.appServices
                        .dataStreaming()
                        .startNewSubgroup(this.tileId),
                    dispatch,
                    variant.lemma,
                    variant.sources['assc'][0].id,
                    variant.sources['ijp'][0].id
                );
            }
        );
    }

    private loadData(
        streaming: IDataStreaming,
        dispatch: SEDispatcher,
        value: string,
        asscId: string,
        ijpId: string
    ) {
        const args: LexArgs = {
            asscId,
            ijpId,
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
                            assc: null,
                            ijp: null,
                        },
                    },
                });
            },
        });
    }
}
