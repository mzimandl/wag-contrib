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

import { IActionQueue, SEDispatcher } from 'kombo';
import { IAppServices } from '../../../appServices.js';
import { Backlink } from '../../../page/tile.js';
import { Actions as GlobalActions } from '../../../models/actions.js';
import { Actions } from './actions.js';
import { List, pipe } from 'cnc-tskit';
import { IDataStreaming } from '../../../page/streaming.js';
import { HTMLBlock } from '../lexCommon/types/assc.js';
import {
    isAsscData,
    isAsscDone,
    isAsscError,
    isIjpData,
    isIjpDone,
    isIjpError,
    LexResponse,
} from '../lexCommon/api.js';
import { scan } from 'rxjs';
import { IJPData } from '../lexCommon/types/ijp.js';
import { TileStatelessModel } from '../../../models/tiles/base.js';
import { LemmatizationLevel } from '../../../query/index.js';

export interface LexNotesModelState {
    isBusy: boolean;
    data: {
        ijp: Array<LexResponse<IJPData | string>>;
        assc: Array<LexResponse<Array<HTMLBlock> | string>>;
    };
    error: string;
    backlink: Backlink;
}

export interface LexNotesModelArgs {
    dispatcher: IActionQueue;
    initState: LexNotesModelState;
    tileId: number;
    appServices: IAppServices;
    readDataFromTile: number | null;
    lemLevelSupport: Array<LemmatizationLevel>;
    dependentTiles: Array<number>;
}

export class LexNotesModel extends TileStatelessModel<LexNotesModelState> {
    constructor({
        dispatcher,
        initState,
        tileId,
        appServices,
        readDataFromTile,
        dependentTiles,
        lemLevelSupport,
    }: LexNotesModelArgs) {
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
                state.data = {
                    ijp: [],
                    assc: [],
                };
                state.isBusy = true;
            },
            (state, action, dispatch, ds) => {
                this.loadData(ds, dispatch);
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
                if (
                    isAsscData(action.payload.response) ||
                    isAsscError(action.payload.response)
                ) {
                    state.data.assc.push(action.payload.response);
                } else if (
                    isIjpData(action.payload.response) ||
                    isIjpError(action.payload.response)
                ) {
                    state.data.ijp.push(action.payload.response);
                }
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
    }

    private loadData(streaming: IDataStreaming, dispatch: SEDispatcher): void {
        streaming
            .registerTileRequest<LexResponse>({
                tileId: this.tileId,
                queryIdx: 0, // TODO
                otherTileId: this.readDataFromTile,
                otherTileQueryIdx: 0, // TODO
                contentType: 'application/json',
            })
            .pipe(
                scan(
                    (data, resp) => {
                        if (data.done.assc && data.done.ijp) {
                            data.dispatched = true;
                            return data;
                        }

                        if (isAsscData(resp)) {
                            const filteredData = pipe(
                                this.filterASSCResultsByIDs(resp.id, resp.data),
                                List.filter(
                                    (v) => v.notes && v.notes.length > 0
                                )
                            );
                            if (filteredData.length > 0) {
                                resp.data = filteredData;
                                dispatch<typeof Actions.TilePartialDataLoaded>({
                                    name: Actions.TilePartialDataLoaded.name,
                                    payload: {
                                        tileId: this.tileId,
                                        response: resp,
                                    },
                                });
                                data.hasData = true;
                            }
                        } else if (
                            isIjpData(resp) &&
                            List.size(resp.data.notes) > 0
                        ) {
                            dispatch<typeof Actions.TilePartialDataLoaded>({
                                name: Actions.TilePartialDataLoaded.name,
                                payload: {
                                    tileId: this.tileId,
                                    response: resp,
                                },
                            });
                            data.hasData = true;
                        } else if (isAsscError(resp) || isIjpError(resp)) {
                            dispatch<typeof Actions.TilePartialDataLoaded>({
                                name: Actions.TilePartialDataLoaded.name,
                                payload: {
                                    tileId: this.tileId,
                                    response: resp,
                                },
                            });
                            data.hasData = true;
                        } else if (isAsscDone(resp)) {
                            data.done.assc = true;
                        } else if (isIjpDone(resp)) {
                            data.done.ijp = true;
                        } else if (resp === null) {
                            data.done.assc = true;
                            data.done.ijp = true;
                        }
                        return data;
                    },
                    {
                        hasData: false,
                        done: { assc: false, ijp: false },
                        dispatched: false,
                    }
                )
            )
            .subscribe({
                next: (data) => {
                    if (data.done && !data.dispatched) {
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
            (d) => List.some((x) => x.id === 'hid-' + id, d.parsedVariants),
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
