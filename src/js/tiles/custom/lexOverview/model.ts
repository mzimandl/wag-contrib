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
import { QueryMatch, LemmatizationLevel } from '../../../query/index.js';
import { Actions as GlobalActions } from '../../../models/actions.js';
import { Actions } from './actions.js';
import { TileStatelessModel } from '../../../models/tiles/base.js';

import { IDataStreaming } from '../../../page/streaming.js';
import { List } from 'cnc-tskit';
import { HTMLBlock } from '../lexCommon/types/assc.js';
import { Source } from '../lexCommon/types/enums.js';
import { LexItem } from '../lexCommon/types/dictionary.js';
import {
    LexResponse,
    isAsscData,
    isAsscError,
    isAsscDone,
    isIjpData,
    isIjpError,
    isIjpDone,
} from '../lexCommon/api.js';
import { IJPData } from '../lexCommon/types/ijp.js';
import { scan } from 'rxjs';

interface SourceData {
    assc: LexResponse<HTMLBlock[] | string> | null;
    ijp: LexResponse<IJPData | string> | null;
}

export interface LexOverviewModelState {
    isBusy: boolean;
    availQueryMatches: Array<QueryMatch>;
    referenceCorpus: string;
    mainSource: Source;
    variants: Array<LexItem>;
    selectedVariantIdx: number;
    sourceData: SourceData;
    error: string;
    backlink: Backlink;
    playingAudio: boolean;
}

export interface LexOverviewModelArgs {
    dispatcher: IActionQueue;
    initState: LexOverviewModelState;
    tileId: number;
    appServices: IAppServices;
    readDataFromTile: number | null;
    lemLevelSupport: Array<LemmatizationLevel>;
    dependentTiles: Array<number>;
}

export class LexOverviewModel extends TileStatelessModel<LexOverviewModelState> {
    constructor({
        dispatcher,
        initState,
        tileId,
        appServices,
        readDataFromTile,
        dependentTiles,
        lemLevelSupport,
    }: LexOverviewModelArgs) {
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
                if (!!action.payload?.newQueryMatches) {
                    state.availQueryMatches = List.map(
                        (match) => ({
                            ...match,
                            isCurrent:
                                match.localId ===
                                action.payload.newQueryMatches[0].localId,
                        }),
                        state.availQueryMatches
                    );
                }
                state.selectedVariantIdx = List.findIndex(
                    (match) => match.isCurrent,
                    state.availQueryMatches
                );
                state.error = undefined;
                state.backlink = undefined;
                state.isBusy = true;
            },
            (state, action, dispatch, ds) => {
                this.loadData(ds, dispatch, state);
            }
        );

        this.addActionSubtypeHandler(
            Actions.TilePartialDataLoaded,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                if (
                    isAsscData(action.payload.resp) ||
                    isAsscError(action.payload.resp)
                ) {
                    state.sourceData.assc = action.payload.resp;
                } else if (
                    isIjpData(action.payload.resp) ||
                    isIjpError(action.payload.resp)
                ) {
                    state.sourceData.ijp = action.payload.resp;
                }
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
            Actions.PlayAudio,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.playingAudio = true;
            },
            (state, action, dispatch) => {
                const player = this.appServices.getAudioPlayer();
                player
                    .play(
                        [
                            {
                                url: action.payload.link,
                                format: action.payload.link.split('.').pop(),
                            },
                        ],
                        true
                    )
                    .subscribe({
                        complete: () => {
                            dispatch(Actions.AudioStopped, {
                                tileId: this.tileId,
                            });
                        },
                        error: (err) => {
                            console.error(err);
                            dispatch(Actions.AudioStopped, {
                                tileId: this.tileId,
                            });
                        },
                    });
            }
        );

        this.addActionSubtypeHandler(
            Actions.AudioStopped,
            (action) => action.payload.tileId === this.tileId,
            (state, action) => {
                state.playingAudio = false;
            }
        );
    }

    private loadData(
        streaming: IDataStreaming,
        dispatch: SEDispatcher,
        state: LexOverviewModelState
    ) {
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

                        if (
                            (isAsscData(resp) || isAsscError(resp)) &&
                            !data.done.assc
                        ) {
                            if (isAsscData(resp)) {
                                const asscBlock = this.filterASSCResultsByID(
                                    resp.id,
                                    state.variants[state.selectedVariantIdx]
                                        .lemma,
                                    resp.data
                                );
                                if (asscBlock) {
                                    dispatch<
                                        typeof Actions.TilePartialDataLoaded
                                    >({
                                        name: Actions.TilePartialDataLoaded
                                            .name,
                                        payload: {
                                            tileId: this.tileId,
                                            resp: {
                                                ...resp,
                                                data: [asscBlock],
                                            },
                                        },
                                    });
                                    data.hasData = true;
                                    data.done.assc = true;
                                }
                                return data;
                            }
                            dispatch<typeof Actions.TilePartialDataLoaded>({
                                name: Actions.TilePartialDataLoaded.name,
                                payload: {
                                    tileId: this.tileId,
                                    resp,
                                },
                            });
                            data.hasData = true;
                            data.done.assc = true;
                        } else if (
                            (isIjpData(resp) || isIjpError(resp)) &&
                            !data.done.ijp
                        ) {
                            // dispatch only first ijp data
                            dispatch<typeof Actions.TilePartialDataLoaded>({
                                name: Actions.TilePartialDataLoaded.name,
                                payload: {
                                    tileId: this.tileId,
                                    resp,
                                },
                            });
                            data.hasData = true;
                            data.done.ijp = true;
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
                    if (data.done.assc && data.done.ijp && !data.dispatched) {
                        dispatch<typeof Actions.TileDataLoaded>({
                            name: Actions.TileDataLoaded.name,
                            payload: {
                                tileId: this.tileId,
                                isEmpty: false, // this tile is never empty
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
                            isEmpty: false,
                        },
                    });
                },
            });
    }

    private filterASSCResultsByID(
        id: string,
        value: string,
        data: HTMLBlock[]
    ): HTMLBlock {
        const asscData = List.find(
            (d) => List.some((x) => x.id === 'hid-' + id, d.parsedVariants),
            data
        );
        if (!asscData) {
            return asscData;
        }

        // need to create new object here, changing old object can affect other tiles
        const newData = { ...asscData };
        const variantIndex = List.findIndex(
            (v) => v.key === value,
            newData.parsedVariants
        );
        if (variantIndex !== -1) {
            newData.parsedVariants = [newData.parsedVariants[variantIndex]];
            newData.formattedVariants = [
                newData.formattedVariants[variantIndex],
            ];
        }
        return newData;
    }
}
