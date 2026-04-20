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

import { Dict, HTTP, List, pipe } from 'cnc-tskit';
import { Observable, of as rxOf } from 'rxjs';
import { IApiServices } from '../../../appServices.js';
import { ajax$ } from '../../../page/ajax.js';
import { ResourceApi, SourceDetails, HTTPHeaders } from '../../../types.js';
import { DataStructure } from '../lexOverview/api/assc.js';
import { Backlink } from '../../../page/tile.js';
import { IDataStreaming } from '../../../page/streaming.js';

export interface UjcDictionaryArgs {
    q: string | Array<string>;
}

export class UjcDictionaryApi
    implements ResourceApi<UjcDictionaryArgs, DataStructure>
{
    private readonly apiURL: string;

    private readonly customHeaders: HTTPHeaders;

    private readonly apiServices: IApiServices;

    constructor(apiURL: string, apiServices: IApiServices) {
        this.apiURL = apiURL;
        this.customHeaders = apiServices.getApiHeaders(apiURL) || {};
        this.apiServices = apiServices;
    }

    private prepareArgs(queryArgs: { [k: string]: any }): string {
        return pipe(
            {
                ...queryArgs,
            },
            Dict.toEntries(),
            List.filter(([k, v]) => v !== undefined),
            List.map(([k, v]) => `${k}=${encodeURIComponent(v)}`),
            (x) => x.join('&')
        );
    }

    call(
        streaming: IDataStreaming | null,
        tileId: number,
        queryIdx: number,
        queryArgs: UjcDictionaryArgs
    ): Observable<DataStructure> {
        const url = this.apiURL.replace(/\/$/, '');
        return streaming
            ? streaming.registerTileRequest<DataStructure>({
                  tileId,
                  queryIdx,
                  method: HTTP.Method.GET,
                  url: url + '?' + this.prepareArgs(queryArgs),
                  body: {},
                  contentType: 'application/json',
              })
            : ajax$<DataStructure>(HTTP.Method.GET, url, queryArgs);
    }

    getSourceDescription(
        streaming: IDataStreaming,
        tileId: number,
        lang: string,
        corpname: string
    ): Observable<SourceDetails> {
        return rxOf({
            tileId,
            title: this.apiServices.importExternalMessage({
                'cs-CZ': 'Akademický slovník současné češtiny',
                'en-US': 'Academic Dictionary of Contemporary Czech',
            }),
            description: this.apiServices.importExternalMessage({
                'cs-CZ':
                    'Původní webová aplikace vznikla v rámci grantového projektu Programu aplikovaného výzkumu a vývoje národní a kulturní identity (NAKI) Ministerstva kultury ČR – Nová cesta k modernímu jednojazyčnému výkladovému slovníku současné češtiny (DF13P01OVV011). Její nová verze je rozvíjena a financována z institucionálních prostředků Ústavu pro jazyk český AV ČR, v. v. i.',
                'en-US':
                    'Původní webová aplikace vznikla v rámci grantového projektu Programu aplikovaného výzkumu a vývoje národní a kulturní identity (NAKI) Ministerstva kultury ČR – Nová cesta k modernímu jednojazyčnému výkladovému slovníku současné češtiny (DF13P01OVV011). Její nová verze je rozvíjena a financována z institucionálních prostředků Ústavu pro jazyk český AV ČR, v. v. i. UNTRANSLATED',
            }),
            author: 'Ústav pro jazyk český AV ČR',
            href: 'https://slovnikcestiny.cz/o_slovniku.php',
        });
    }

    getBacklink(queryId: number, subqueryId?: number): Backlink | null {
        return {
            queryId,
            label: 'heslo v Akademickém slovníku současné češtiny',
        };
    }
}
