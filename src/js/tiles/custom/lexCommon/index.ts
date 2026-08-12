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
import { IActionDispatcher } from 'kombo';
import { List } from 'cnc-tskit';

import { IAppServices } from '../../../appServices.js';
import {
    findCurrQueryMatch,
    LemmatizationLevel,
    QueryType,
} from '../../../query/index.js';
import {
    TileConf,
    ITileProvider,
    TileComponent,
    TileFactory,
    TileFactoryArgs,
    DEFAULT_ALT_VIEW_ICON,
    ITileReloader,
    AltViewIconProps,
    lemLevelSupport,
} from '../../../page/tile.js';
import { LexCommonModel } from './model.js';
import { LexApi } from './api.js';
import { Source } from './types/enums.js';

export interface LexCommonTileConf extends TileConf {
    apiURL: string;
    backlinkConf: Partial<Record<Source, { url: string }>>;
}

export class LexCommonTile implements ITileProvider {
    private readonly tileId: number;

    private readonly dispatcher: IActionDispatcher;

    private readonly appServices: IAppServices;

    private readonly model: LexCommonModel;

    private readonly widthFract: number;

    private readonly lexApi: LexApi;

    private view: TileComponent;

    private readonly dependentTiles: Array<number>;

    private readonly configuredLemLevels: Array<LemmatizationLevel>;

    constructor({
        tileId,
        dispatcher,
        appServices,
        ut,
        theme,
        widthFract,
        conf,
        isBusy,
        queryMatches,
        dependentTiles,
    }: TileFactoryArgs<LexCommonTileConf>) {
        this.tileId = tileId;
        this.dispatcher = dispatcher;
        this.appServices = appServices;
        this.widthFract = widthFract;
        this.dependentTiles = dependentTiles;
        this.configuredLemLevels = conf.lemmatizationLevels || [];
        this.lexApi = new LexApi(
            conf.apiURL,
            conf.srcInfoURL,
            appServices,
            conf.backlinkConf
        );

        this.model = new LexCommonModel({
            dispatcher,
            appServices,
            tileId,
            dependentTiles,
            lemLevelSupport: this.configuredLemLevels,
            lexApi: this.lexApi,
            initState: {
                currQueryMatch: List.map(findCurrQueryMatch, queryMatches)[0],
            },
        });
        this.view = () => null;
    }

    getIdent(): number {
        return this.tileId;
    }

    getLabel(): string {
        return null;
    }

    getView(): TileComponent {
        return this.view;
    }

    getSourceInfoComponent(): null {
        return null;
    }

    supportsQueryType(
        qt: QueryType,
        domain1: string,
        domain2?: string
    ): boolean {
        return qt === 'single';
    }

    disable(): void {
        this.model.waitForAction({}, (_, syncData) => syncData);
    }

    getWidthFract(): number {
        return this.widthFract;
    }

    supportsTweakMode(): boolean {
        return false;
    }

    supportsAltView(): boolean {
        return false;
    }

    supportsSVGFigureSave(): boolean {
        return false;
    }

    registerReloadModel(model: ITileReloader): boolean {
        model.registerModel(this, this.model);
        return true;
    }

    getBlockingTiles(): Array<number> {
        return [];
    }

    supportsMultiWordQueries(): boolean {
        return false;
    }

    getIssueReportingUrl(): null {
        return null;
    }

    getAltViewIcon(): AltViewIconProps {
        return DEFAULT_ALT_VIEW_ICON;
    }

    getReadDataFrom(): number | null {
        return null;
    }

    hideOnNoData(): boolean {
        return true;
    }

    supportsLemmatizationLevel(ll: LemmatizationLevel): boolean {
        return lemLevelSupport(this.configuredLemLevels, ll);
    }

    isSubtileContainer(): boolean {
        return false;
    }
}

export const init: TileFactory<LexCommonTileConf> = {
    sanityCheck: (args) => [],

    create: (args) => new LexCommonTile(args),
};
