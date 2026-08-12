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
import { Backlink } from '../../../page/tile.js';
import { Actions } from './actions.js';
import { Dict, List } from 'cnc-tskit';
import { LemmatizationLevel, QueryMatch } from '../../../query/index.js';
import { IDataStreaming } from '../../../page/streaming.js';
import { HTMLBlock } from '../lexCommon/types/assc.js';
import {
    isAsscDone,
    isAsscError,
    isAsscHtml,
    isIjpData,
    isIjpDone,
    isIjpError,
    isSscData,
    isSscDone,
    isSscError,
    LexResponse,
} from '../lexCommon/api.js';
import { filter, scan } from 'rxjs';
import { TileStatelessModel } from '../../../models/tiles/base.js';
import { IJPData } from '../lexCommon/types/ijp.js';
import { Source } from '../lexCommon/types/enums.js';
import { SSCData } from '../lexCommon/types/ssc.js';
import { getCurrentVariant } from '../lexCommon/types/dictionary.js';

export interface LexMeaningModelState {
    isBusy: boolean;
    sourcePriority: Array<Source>;
    usedSource: Source;
    data: {
        [Source.IJP]: Array<LexResponse<IJPData>>;
        [Source.ASSC]: Array<LexResponse<HTMLBlock[]>>;
        [Source.SSC]: Array<LexResponse<SSCData>>;
    };
    sourceErrors: {
        [Source.IJP]: Array<LexResponse<string>>;
        [Source.ASSC]: Array<LexResponse<string>>;
        [Source.SSC]: Array<LexResponse<string>>;
    };
    error: string;
    backlink: Backlink;
    currQueryMatch: QueryMatch;
}

export interface LexMeaningModelArgs {
    dispatcher: IActionQueue;
    initState: LexMeaningModelState;
    tileId: number;
    appServices: IAppServices;
    readDataFromTile: number | null;
    lemLevelSupport: Array<LemmatizationLevel>;
    dependentTiles: Array<number>;
}

export class LexMeaningModel extends TileStatelessModel<LexMeaningModelState> {
    constructor({
        dispatcher,
        initState,
        tileId,
        appServices,
        readDataFromTile,
        dependentTiles,
        lemLevelSupport,
    }: LexMeaningModelArgs) {
        super({
            dispatcher,
            initState,
            tileId,
            appServices,
            dependentTiles,
            lemLevelSupport,
            readDataFromTile,
        });

        this.addSearchActionHandler(
            (state, action) => {
                state.error = null;
                state.backlink = null;
                if (!!action.payload?.newQueryMatches) {
                    state.currQueryMatch = action.payload.newQueryMatches[0];
                }
                // set used source to first source with data based on priority
                const currVariant = getCurrentVariant(state.currQueryMatch);
                for (const source of state.sourcePriority) {
                    if (currVariant.sources[source]?.length > 0) {
                        state.usedSource = source;
                        break;
                    }
                }
                state.data = Dict.map(() => [], state.data);
                state.sourceErrors = Dict.map(() => [], state.sourceErrors);
                state.isBusy = true;
            },
            (state, action, dispatch, ds) => {
                this.loadData(state, ds, dispatch);
            }
        );

        this.addActionSubtypeHandler(
            Actions.TileDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.isBusy = false;
                // if empty data for used source, get next not empty source based on priority
                if (List.empty(state.data[state.usedSource])) {
                    for (const source of state.sourcePriority) {
                        if (!List.empty(state.data[source])) {
                            state.usedSource = source;
                            break;
                        }
                    }
                }
                if (action.error) {
                    state.error = action.error.message;
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.TilePartialDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                if (
                    isAsscHtml(action.payload.response) ||
                    isIjpData(action.payload.response) ||
                    isSscData(action.payload.response)
                ) {
                    state.data[action.payload.response.source].push(
                        action.payload.response
                    );
                } else if (
                    isAsscError(action.payload.response) ||
                    isIjpError(action.payload.response) ||
                    isSscError(action.payload.response)
                ) {
                    state.sourceErrors[action.payload.response.source].push(
                        action.payload.response
                    );
                }
                console.log('Partial data loaded', action.payload.response);
            }
        );
    }

    private loadData(
        state: LexMeaningModelState,
        streaming: IDataStreaming,
        dispatch: SEDispatcher
    ): void {
        streaming
            .registerTileRequest<LexResponse>({
                tileId: this.tileId,
                queryIdx: 0, // TODO
                otherTileId: this.readDataFromTile,
                otherTileQueryIdx: 0, // TODO
                contentType: 'application/json',
            })
            .pipe(
                filter(
                    (resp) =>
                        resp === null ||
                        List.some(
                            (v) => resp.source === v,
                            state.sourcePriority
                        )
                ),
                scan(
                    (data, resp) => {
                        if (Dict.every((done) => done, data.done)) {
                            data.dispatched = true;
                            return data;
                        }

                        if (isAsscHtml(resp)) {
                            // response contains whole ASSČ page, we need to filter only
                            // requested id, and its parent if it has one
                            const filteredData = this.filterASSCResultsByIDs(
                                resp.id,
                                resp.data
                            );

                            if (List.size(resp.data) > 0) {
                                dispatch<typeof Actions.TilePartialDataLoaded>({
                                    name: Actions.TilePartialDataLoaded.name,
                                    payload: {
                                        tileId: this.tileId,
                                        response: {
                                            ...resp,
                                            data: filteredData,
                                        },
                                    },
                                });
                                data.hasData = true;
                            }
                        } else if (isIjpData(resp)) {
                            dispatch<typeof Actions.TilePartialDataLoaded>({
                                name: Actions.TilePartialDataLoaded.name,
                                payload: {
                                    tileId: this.tileId,
                                    response: resp,
                                },
                            });
                            if (
                                (!!resp.data.examples &&
                                    !List.empty(resp.data.examples)) ||
                                (!!resp.data.notes &&
                                    !List.empty(resp.data.notes))
                            ) {
                                data.hasData = true;
                            }
                        } else if (isSscData(resp)) {
                            dispatch<typeof Actions.TilePartialDataLoaded>({
                                name: Actions.TilePartialDataLoaded.name,
                                payload: {
                                    tileId: this.tileId,
                                    response: resp,
                                },
                            });
                            if (!!resp.data.html_content) {
                                data.hasData = true;
                            }
                        } else if (
                            isAsscError(resp) ||
                            isIjpError(resp) ||
                            isSscError(resp)
                        ) {
                            dispatch<typeof Actions.TilePartialDataLoaded>({
                                name: Actions.TilePartialDataLoaded.name,
                                payload: {
                                    tileId: this.tileId,
                                    response: resp,
                                },
                            });
                            data.hasData = true;
                        } else if (
                            isAsscDone(resp) ||
                            isIjpDone(resp) ||
                            isSscDone(resp)
                        ) {
                            data.done[resp.source] = true;
                        } else if (resp === null) {
                            data.done = Dict.map((_) => true, data.done);
                        }
                        return data;
                    },
                    {
                        hasData: false,
                        done: { assc: false, ijp: false, ssc: false },
                        dispatched: false,
                    }
                )
            )
            .subscribe({
                next: (data) => {
                    if (data.done.assc && data.done.ijp && !data.dispatched) {
                        dispatch<typeof Actions.TileDataLoaded>({
                            name: Actions.TileDataLoaded.name,
                            payload: {
                                tileId: this.tileId,
                                isEmpty: !data.hasData,
                            },
                        });
                    }
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

    private filterASSCResultsByIDs(id: string, data: HTMLBlock[]): HTMLBlock[] {
        const blockIdx = List.findIndex(
            (d) =>
                List.some((x) => x.includes('hid-' + id), d.formattedVariants),
            data
        );

        if (blockIdx !== -1) {
            const mainItem = data[blockIdx];
            if (blockIdx > 0) {
                const parentItem = data[0];
                parentItem.nestedVariants = List.filter(
                    (v) =>
                        List.findIndex(
                            (x) => x === v,
                            mainItem.formattedVariants
                        ) === -1,
                    parentItem.nestedVariants
                );
                return [mainItem, parentItem];
            }
            return [mainItem];
        } else {
            return [];
        }
    }
}
