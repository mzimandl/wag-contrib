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
import { List, HTTP } from 'cnc-tskit';
import { isWebDelegateApi } from '../../../types.js';
import { findCurrQueryMatch } from '../../../models/query.js';
import { UjcPSJCArgs, UjcPSJCApi } from './api.js';


export interface UjcPSJCModelState {
    isBusy:boolean;
    queries:Array<string>;
    data:DataStructure;
    error:string;
    backlinks:Array<BacklinkWithArgs<{}>>;
}

export interface UjcPSJCModelArgs {
    dispatcher:IActionQueue;
    initState:UjcPSJCModelState;
    tileId:number;
    api:UjcPSJCApi,
    appServices:IAppServices;
    queryMatches:RecognizedQueries;
    backlink:Backlink;
}

export class UjcPSJCModel extends StatelessModel<UjcPSJCModelState> {

    private readonly tileId:number;

    private readonly api:UjcPSJCApi;

    private readonly appServices:IAppServices;

    private readonly backlink:Backlink;


    constructor({dispatcher, initState, api, tileId, appServices, queryMatches, backlink}:UjcPSJCModelArgs) {
        super(dispatcher, initState);
        this.tileId = tileId;
        this.appServices = appServices;
        this.api = api;
        this.backlink = !backlink?.isAppUrl && isWebDelegateApi(this.api) ? this.api.getBackLink(backlink) : backlink;

        this.addActionHandler(
            GlobalActions.RequestQueryResponse,
            (state, action) => {
                const match = findCurrQueryMatch(List.head(queryMatches));
                state.queries = [match.word];
                if (!match.isNonDict) {
                    state.queries.push(match.lemma)
                };
                state.isBusy = true;
                state.error = null;
                state.data = createEmptyData(),
                state.backlinks = [];
            },
            (state, action, dispatch) => {
                this.loadData(dispatch, state);
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
                        state.backlinks = [this.generateBacklink(state.data.query)];
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

    private generateBacklink(ident:string):BacklinkWithArgs<{}> {
        return {
            url: `https://psjc.ujc.cas.cz/search.php`,
            label: 'heslo v Příručním slovníku jazyka českého',
            method: HTTP.Method.GET,
            args: {
                hledej: "Hledej",
                heslo: ident,
                where: "hesla",
                zobraz_ps: "ps",
                not_initial: 1
            }
        };
    }

    private loadData(dispatch:SEDispatcher, state:UjcPSJCModelState) {
        const args:UjcPSJCArgs = {
            q: state.queries
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