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
import { Backlink, BacklinkWithArgs } from '../../../page/tile.js';
import { RecognizedQueries } from '../../../query.js';
import { createEmptyData, DataStructure } from './common.js';
import { Actions as GlobalActions } from '../../../models/actions.js';
import { Actions } from './actions.js';
import { List, HTTP, pipe, Dict, tuple } from 'cnc-tskit';
import { isWebDelegateApi } from '../../../types.js';
import { findCurrQueryMatch } from '../../../models/query.js';
import { UjcCJAArgs, UjcCJAApi } from './api.js';


export interface UjcCJAModelState {
    isBusy:boolean;
    ident:string;
    data:DataStructure;
    error:string;
    backlinks:Array<BacklinkWithArgs<{}>>;
}

export interface UjcCJAModelArgs {
    dispatcher:IActionQueue;
    initState:UjcCJAModelState;
    tileId:number;
    api:UjcCJAApi,
    appServices:IAppServices;
    queryMatches:RecognizedQueries;
    backlink:Backlink;
}

export class UjcCJAModel extends StatelessModel<UjcCJAModelState> {

    private readonly tileId:number;

    private readonly api:UjcCJAApi;

    private readonly appServices:IAppServices;

    private readonly backlink:Backlink;


    constructor({dispatcher, initState, api, tileId, appServices, queryMatches, backlink}:UjcCJAModelArgs) {
        super(dispatcher, initState);
        this.tileId = tileId;
        this.appServices = appServices;
        this.api = api;
        this.backlink = !backlink?.isAppUrl && isWebDelegateApi(this.api) ? this.api.getBackLink(backlink) : backlink;

        this.addActionHandler(
            GlobalActions.RequestQueryResponse,
            (state, action) => {
                const match = findCurrQueryMatch(List.head(queryMatches));
                state.ident = match.lemma || match.word;
                state.isBusy = true;
                state.error = null;
                state.data = createEmptyData();
                state.backlinks = [];
            },
            (state, action, dispatch) => {
                this.loadData(dispatch, state, state.ident);
            }
        );

        this.addActionHandler(
            Actions.TileDataLoaded,
            (state, action) => {
                if (action.payload.tileId === this.tileId) {
                    state.isBusy = false;
                    if (action.error) {
                        state.error = action.error.message;

                    } else {
                        state.data = action.payload.data;
                        state.backlinks = [this.generateBacklink(state, action.payload.data.backlink)];
                    }
                }
            }
        );

        this.addActionHandler(
            GlobalActions.GetSourceInfo,
            (state, action) => {
            },
            (state, action, dispatch) => {
                this.api.getSourceDescription(
                    this.tileId,
                    this.appServices.getISO639UILang(),
                    ''
                ).subscribe({
                    next: (data) => {
                        dispatch({
                            name: GlobalActions.GetSourceInfoDone.name,
                            payload: {
                                data: data
                            }
                        });
                    },
                    error: (err) => {
                        console.error(err);
                        dispatch({
                            name: GlobalActions.GetSourceInfoDone.name,
                            error: err

                        });
                    }
                });
            }
        );
    }

    private generateBacklink(state:UjcCJAModelState, url:string):BacklinkWithArgs<{}> {
        const urlSplit = url.split("?");
        const args = pipe(
            urlSplit[1].split("&"),
            List.map(v => {
                const keyVal = v.split("=");
                if (keyVal[0] == "hw" || keyVal[0] == "doklad") {
                    return tuple(keyVal[0], state.ident);
                }
                return tuple(keyVal[0], keyVal[1]);
            }),
            Dict.fromEntries(),
        );
        return {
            url: urlSplit[0],
            label: 'heslo v Českém jazykovém atlasu',
            method: HTTP.Method.GET,
            args: args,
        };
    }

    private loadData(dispatch:SEDispatcher, state:UjcCJAModelState, q:string) {
        const args:UjcCJAArgs = {
            q
        };
        this.api.call(args).subscribe({
            next: data => {
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: false,
                        data
                    }
                });
            },
            error: error => {
                console.error(error);
                dispatch<typeof Actions.TileDataLoaded>({
                    name: Actions.TileDataLoaded.name,
                    error,
                    payload: {
                        tileId: this.tileId,
                        isEmpty: true,
                        data: createEmptyData(),
                    }
                });
            }
        });
    }

}