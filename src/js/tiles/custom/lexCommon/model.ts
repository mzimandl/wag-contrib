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
import { getIdWithParent, isValidIjpId, LexApi, LexArgs } from './api.js';
import { List, pipe } from 'cnc-tskit';
import { IDataStreaming } from '../../../page/streaming.js';
import { TileStatelessModel } from '../../../models/tiles/base.js';
import { isValidSource, Source } from './types/enums.js';
import { map } from 'rxjs';

export interface LexCommonModelState {
    currQueryMatch: QueryMatch;
    /**
     * Easter egg mode - when user searches for "slovoskop",
     * the tile becomes visible and shows a small game.
     */
    easterEgg: boolean;
}

const EASTER_EGG_WORD = 'slovoskop';

export function isEasterEggQuery(qm: QueryMatch | undefined): boolean {
    return (
        !!qm &&
        [qm.word, qm.lemma].some(
            (v) => typeof v === 'string' && v.toLowerCase() === EASTER_EGG_WORD
        )
    );
}

export interface LexCommonModelArgs {
    dispatcher: IActionQueue;
    initState: LexCommonModelState;
    tileId: number;
    appServices: IAppServices;
    lemLevelSupport: Array<LemmatizationLevel>;
    multiWordSupport: boolean;
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
        multiWordSupport,
    }: LexCommonModelArgs) {
        super({
            dispatcher,
            initState,
            tileId,
            appServices,
            dependentTiles,
            lemLevelSupport,
            multiWordSupport,
        });
        this.lexApi = lexApi;

        this.addSearchActionHandler(
            (state, action) => {
                if (!!action.payload?.newQueryMatches) {
                    state.currQueryMatch = action.payload.newQueryMatches[0];
                }
                state.easterEgg = isEasterEggQuery(state.currQueryMatch);
            },
            (state, action, dispatch, ds) => {
                // this instantly hides tile from layout
                // (unless the easter egg is active)
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: !state.easterEgg,
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
                const sourceId = action.payload.corpusId; // todo change to sourceId
                this.lexApi
                    .getSourceDescription(
                        this.appServices
                            .dataStreaming()
                            .startNewSubgroup(this.tileId),
                        this.tileId,
                        this.appServices.getISO639UILang(),
                        sourceId // todo change to sourceId
                    )
                    .pipe(
                        map((data) => {
                            if (isValidSource(sourceId)) {
                                const variant = getCurrentVariant(
                                    state.currQueryMatch
                                );
                                if (
                                    variant &&
                                    this.lexApi.isBacklinkSupported(sourceId)
                                ) {
                                    data.backlink = {
                                        key:
                                            List.size(
                                                variant.sources[sourceId]
                                            ) > 1
                                                ? this.appServices.translate(
                                                      'lex_common__terms'
                                                  )
                                                : this.appServices.translate(
                                                      'lex_common__term'
                                                  ),
                                        links: List.map((sourceItem) => {
                                            const greek = this.homonymToGreek(
                                                sourceItem.homonym
                                            );
                                            return {
                                                label: `${variant.key.lemma}${greek ? ' ' + greek : ''}`,
                                                url: this.lexApi
                                                    .getBacklinkURL(
                                                        sourceId as Source,
                                                        sourceItem.id
                                                    )
                                                    .toString(),
                                            };
                                        }, variant.sources[sourceId] || []),
                                    };
                                }
                            }
                            return data;
                        })
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
        const args: LexArgs = {
            asscIds:
                variant && variant.sources[Source.ASSC]
                    ? pipe(
                          variant.sources[Source.ASSC],
                          List.map((v) => v.id),
                          List.reduce(
                              (acc, curr, i) => List.addUnique(curr, acc),
                              []
                          )
                      )
                    : [],
            ijpIds:
                variant && variant.sources[Source.IJP]
                    ? pipe(
                          variant.sources[Source.IJP],
                          List.map((v) => v.id),
                          List.reduce(
                              (acc, curr, i) => List.addUnique(curr, acc),
                              []
                          ),
                          List.filter((id) => isValidIjpId(id))
                      )
                    : [],
            sscIds:
                variant && variant.sources[Source.SSC]
                    ? pipe(
                          variant.sources[Source.SSC],
                          List.map((v) => getIdWithParent(v)),
                          List.reduce(
                              (acc, curr, i) => List.addUnique(curr, acc),
                              []
                          )
                      )
                    : [],
        };
        this.lexApi.call(streaming, this.tileId, 0, args).subscribe({
            complete: () => {
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: !state.easterEgg,
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
