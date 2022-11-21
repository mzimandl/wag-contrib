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
import { IActionDispatcher, StatelessModel } from 'kombo';

import { IAppServices } from '../../../appServices';
import { QueryType } from '../../../query/index';
import { init as viewInit } from './views';
import { TileConf, ITileProvider, TileComponent, TileFactory, TileFactoryArgs } from '../../../page/tile';
import { UjcDictionaryModel } from './model';
import { UjcDictionaryApi } from './api';
import { createEmptyData } from './common';


export interface UjcDictionaryConf extends TileConf {
    apiURL:string;
    maxItems:number;
}

export class UjcDictionaryTile implements ITileProvider {

    private readonly tileId:number;

    private readonly dispatcher:IActionDispatcher;

    private readonly appServices:IAppServices;

    private readonly model:UjcDictionaryModel;

    private readonly widthFract:number;

    private readonly label:string;

    private readonly api:UjcDictionaryApi;

    private view:TileComponent;

    constructor({
        tileId, dispatcher, appServices, ut, theme, widthFract, conf, isBusy, cache,
        queryMatches}:TileFactoryArgs<UjcDictionaryConf>
    ) {
        this.tileId = tileId;
        this.dispatcher = dispatcher;
        this.appServices = appServices;
        this.widthFract = widthFract;
        this.api = new UjcDictionaryApi(cache, conf.apiURL, appServices);
        this.model = new UjcDictionaryModel({
            dispatcher,
            appServices,
            api: this.api,
            queryMatches,
            tileId,
            backlink: null,
            initState: {
                isBusy: isBusy,
                ident: '',
                data: createEmptyData(),
                maxItems: conf.maxItems,
                error: null,
                backlinks: []
            }
        });
        this.label = appServices.importExternalMessage(conf.label || 'ujc_dict__main_label');
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

    exposeModel():StatelessModel<{}>|null {
        return this.model;
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

export const init:TileFactory<UjcDictionaryConf> = {

    sanityCheck: (args) => [],

    create: (args) => new UjcDictionaryTile(args)
};