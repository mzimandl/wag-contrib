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
import { LemmatizationLevel, QueryMatch } from '../../../query/index.js';
import { Actions as GlobalActions } from '../../../models/actions.js';
import { Actions } from './actions.js';
import { getCurrentVariant } from './types/dictionary.js';
import { LexApi } from './api.js';
import { List } from 'cnc-tskit';
import { IDataStreaming } from '../../../page/streaming.js';
import { TileStatelessModel } from '../../../models/tiles/base.js';

export interface LexCommonModelState {
    currQueryMatch: QueryMatch;
}

export interface LexCommonModelArgs {
    dispatcher: IActionQueue;
    initState: LexCommonModelState;
    tileId: number;
    appServices: IAppServices;
    lemLevelSupport: Array<LemmatizationLevel>;
    dependentTiles: Array<number>;
    lexApi: LexApi;
}

export class LexCommonModel extends TileStatelessModel<LexCommonModelState> {
    private readonly lexApi: LexApi;

    constructor({
        dispatcher,
        initState,
        tileId,
        appServices,
        lexApi,
        dependentTiles,
        lemLevelSupport,
    }: LexCommonModelArgs) {
        super({
            dispatcher,
            initState,
            tileId,
            appServices,
            dependentTiles,
            lemLevelSupport,
        });
        this.lexApi = lexApi;

        this.addSearchActionHandler(
            (state, action) => {
                if (!!action.payload?.newQueryMatches) {
                    state.currQueryMatch = action.payload.newQueryMatches[0];
                }
            },
            (state, action, dispatch, ds) => {
                // this instantly hides tile from layout
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: true,
                    },
                });
                this.loadData(state, ds, dispatch);
            }
        );

        this.addActionSubtypeHandler(
            Actions.TileDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                if (action.error) {
                    console.log(action.error);
                }
            }
        );

        this.addActionSubtypeHandler(
            GlobalActions.GetSourceInfo,
            (action) =>
                List.some(
                    (tileId) => tileId === action.payload.tileId,
                    this.dependentTiles
                ),
            null,
            (state, action, dispatch) => {
                this.lexApi
                    .getSourceDescription(
                        this.appServices
                            .dataStreaming()
                            .startNewSubgroup(this.tileId),
                        this.tileId,
                        this.appServices.getISO639UILang(),
                        action.payload.corpusId
                    )
                    .subscribe({
                        next: (data) => {
                            dispatch({
                                name: GlobalActions.GetSourceInfoDone.name,
                                payload: {
                                    tileId: this.tileId,
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
    }

    private loadData(
        state: LexCommonModelState,
        streaming: IDataStreaming,
        dispatch: SEDispatcher
    ) {
        const variant = getCurrentVariant(state.currQueryMatch);
        const args = {
            asscIds:
                variant && variant.sources['assc']
                    ? List.map((v) => v.id, variant.sources['assc'])
                    : [],
            ijpIds:
                variant && variant.sources['ijp']
                    ? List.map((v) => v.id, variant.sources['ijp'])
                    : [],
        };
        this.lexApi.call(streaming, this.tileId, 0, args).subscribe({
            complete: () => {
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: true,
                    },
                });
            },
            error: (err) => {
                console.error('lex api error:', err);
            },
        });
    }
}
