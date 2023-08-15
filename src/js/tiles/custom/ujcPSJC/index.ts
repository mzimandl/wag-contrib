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
import { IActionDispatcher } from 'kombo';

import { IAppServices } from '../../../appServices';
import { QueryType } from '../../../query/index';
import { init as viewInit } from './views';
import { TileConf, ITileProvider, TileComponent, TileFactory, TileFactoryArgs, DEFAULT_ALT_VIEW_ICON, ITileReloader } from '../../../page/tile';
import { UjcPSJCModel } from './model';
import { UjcPSJCApi } from './api';
import { createEmptyData } from './common';


export interface UjcPSJCConf extends TileConf {
    apiURL:string;
}

export class UjcPSJCTile implements ITileProvider {

    private readonly tileId:number;

    private readonly dispatcher:IActionDispatcher;

    private readonly appServices:IAppServices;

    private readonly model:UjcPSJCModel;

    private readonly widthFract:number;

    private readonly label:string;

    private readonly api:UjcPSJCApi;

    private view:TileComponent;

    constructor({
        tileId, dispatcher, appServices, ut, theme, widthFract, conf, isBusy, cache,
        queryMatches}:TileFactoryArgs<UjcPSJCConf>
    ) {
        this.tileId = tileId;
        this.dispatcher = dispatcher;
        this.appServices = appServices;
        this.widthFract = widthFract;
        this.api = new UjcPSJCApi(cache, conf.apiURL, appServices);
        this.model = new UjcPSJCModel({
            dispatcher,
            appServices,
            api: this.api,
            queryMatches,
            tileId,
            backlink: null,
            initState: {
                isBusy: isBusy,
                queries: [],
                data: createEmptyData(),
                error: null,
                backlinks: []
            }
        });
        this.label = appServices.importExternalMessage(conf.label || 'ujc_psjc__main_label');
        this.view = viewInit(
            this.dispatcher,
            ut,
            theme,
            this.model
        );
    }

    getIdent():number {
        return this.tileId;
    }

    getLabel():string {
        return this.label;
    }

    getView():TileComponent {
        return this.view;
    }

    getSourceInfoComponent():null {
        return null;
    }

    supportsQueryType(qt:QueryType, domain1:string, domain2?:string):boolean {
        return qt === QueryType.SINGLE_QUERY;
    }

    disable():void {
        this.model.waitForAction({}, (_, syncData)=>syncData);
    }

    getWidthFract():number {
        return this.widthFract;
    }

    supportsTweakMode():boolean {
        return false;
    }

    supportsAltView():boolean {
        return false;
    }

    getAltViewIcon():[string, string] {
        return DEFAULT_ALT_VIEW_ICON;
    }

    registerReloadModel(model:ITileReloader):boolean {
        model.registerModel(this, this.model);
        return true;
    }

    getBlockingTiles():Array<number> {
        return [];
    }

    supportsMultiWordQueries():boolean {
        return false;
    }

    getIssueReportingUrl():null {
        return null;
    }
}

export const init:TileFactory<UjcPSJCConf> = {

    sanityCheck: (args) => [],

    create: (args) => new UjcPSJCTile(args)
};