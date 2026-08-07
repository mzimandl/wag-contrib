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
import { List, pipe } from 'cnc-tskit';
import { IDataStreaming } from '../../../page/streaming.js';
import { TileStatelessModel } from '../../../models/tiles/base.js';
import { Source } from './types/enums.js';

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
                        action.payload.corpusId // todo change to sourceId
                    )
                    .subscribe({
                        next: (data) => {
                            const variant = getCurrentVariant(
                                state.currQueryMatch
                            );
                            if (
                                variant &&
                                this.lexApi.isBacklinkSupported(
                                    action.payload.corpusId as Source
                                )
                            ) {
                                data.backlink = {
                                    key:
                                        List.size(
                                            variant.sources[
                                                action.payload.corpusId
                                            ]
                                        ) > 1
                                            ? this.appServices.translate(
                                                  'lex_common__terms'
                                              )
                                            : this.appServices.translate(
                                                  'lex_common__term'
                                              ),
                                    links: List.map(
                                        (sourceItem) => ({
                                            label: `${variant.lemma} ${this.homonymToGreek(sourceItem.homonym)}`,
                                            url: this.lexApi
                                                .getBacklinkURL(
                                                    action.payload
                                                        .corpusId as Source,
                                                    sourceItem.id
                                                )
                                                .toString(),
                                        }),
                                        variant.sources[
                                            action.payload.corpusId
                                        ] || []
                                    ),
                                };
                            }
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

    private isValidIjpId(id: string): boolean {
        const valid = !id.startsWith('__');
        if (!valid) {
            console.warn('Ignoring IJP item', id);
        }
        return valid;
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
                    ? pipe(
                          variant.sources['assc'],
                          List.map((v) => v.id),
                          List.reduce(
                              (acc, curr, i) => List.addUnique(curr, acc),
                              []
                          )
                      )
                    : [],
            ijpIds:
                variant && variant.sources['ijp']
                    ? pipe(
                          variant.sources['ijp'],
                          List.map((v) => v.id),
                          List.reduce(
                              (acc, curr, i) => List.addUnique(curr, acc),
                              []
                          ),
                          List.filter((id) => this.isValidIjpId(id))
                      )
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

    private homonymToGreek(homonym: number): string {
        switch (homonym) {
            case 1:
                return 'I';
            case 2:
                return 'II';
            case 3:
                return 'III';
            case 4:
                return 'IV';
            case 5:
                return 'V';
            case 6:
                return 'VI';
            case 7:
                return 'VII';
            case 8:
                return 'VIII';
            case 9:
                return 'IX';
            default:
                return '';
        }
    }
}
