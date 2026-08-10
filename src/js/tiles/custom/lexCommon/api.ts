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

import { Dict, HTTP, List, pipe } from 'cnc-tskit';
import { EMPTY, Observable, of as rxOf } from 'rxjs';
import { IApiServices } from '../../../appServices.js';
import { ajax$ } from '../../../page/ajax.js';
import { ResourceApi, SourceDetails, HTTPHeaders } from '../../../types.js';
import { Backlink } from '../../../page/tile.js';
import { IDataStreaming } from '../../../page/streaming.js';
import { HTMLBlock, VariantData } from './types/assc.js';
import { IJPData as IJPData } from './types/ijp.js';
import { Source, Type } from './types/enums.js';
import { CorpusInfoAPI } from '../../../api/vendor/mquery/corpusInfo.js';

export interface LexArgs {
    asscIds: string[];
    ijpIds: string[];
}

export function isEmptyArgs(args: LexArgs): boolean {
    return Dict.every((v) => List.empty(v), args);
}

export interface LexResponse<
    T = IJPData | Array<VariantData> | Array<HTMLBlock> | 'done' | string,
> {
    source: Source;
    type: string;
    id: string;
    data: T;
    statusCode: number;
}

export function isAsscData(
    v: LexResponse
): v is LexResponse<Array<VariantData>> {
    return (
        v &&
        v.source === Source.ASSC &&
        v.type === Type.ASSCRaw &&
        Array.isArray(v.data)
    );
}

export function isAsscHtml(v: LexResponse): v is LexResponse<Array<HTMLBlock>> {
    return (
        v &&
        v.source === Source.ASSC &&
        v.type === Type.ASSCHTML &&
        Array.isArray(v.data)
    );
}

export function isAsscDone(v: LexResponse): v is LexResponse<'done'> {
    return (
        v &&
        v.source === Source.ASSC &&
        v.statusCode === 200 &&
        v.data === 'done'
    );
}

export function isAsscError(v: LexResponse): v is LexResponse<string> {
    return (
        v &&
        v.source === Source.ASSC &&
        v.statusCode >= 400 &&
        typeof v.data === 'string' &&
        v.data !== 'done'
    );
}

export function isIjpData(v: LexResponse): v is LexResponse<IJPData> {
    return (
        v &&
        v.source === Source.IJP &&
        !!v.data &&
        v.data !== 'done' &&
        typeof v.data !== 'string'
    );
}

export function isIjpDone(v: LexResponse): v is LexResponse<'done'> {
    return (
        v &&
        v.source === Source.IJP &&
        v.statusCode === 200 &&
        v.data === 'done'
    );
}

export function isIjpError(v: LexResponse): v is LexResponse<string> {
    return (
        v &&
        v.source === Source.IJP &&
        v.statusCode >= 400 &&
        typeof v.data === 'string' &&
        v.data !== 'done'
    );
}

export function getErrorMessage(lexResponse: LexResponse): Array<string> {
    switch (lexResponse.statusCode) {
        case 503:
            return [`lex_common__${lexResponse.source}_unavailable`];
        case 404:
            return [
                `lex_common__${lexResponse.source}_not_found`,
                `: '${lexResponse.id}'`,
            ];
        default:
            return [`lex_common__${lexResponse.source}_failed`];
    }
}

export class LexApi implements ResourceApi<LexArgs, LexResponse> {
    private readonly apiURL: string;

    private readonly customHeaders: HTTPHeaders;

    private readonly apiServices: IApiServices;

    private readonly corpusInfoApi: CorpusInfoAPI;

    private readonly backlinkConf: Partial<Record<Source, { url: string }>>;

    constructor(
        apiURL: string,
        srcInfoURL: string,
        apiServices: IApiServices,
        backlinkConf: Partial<Record<Source, { url: string }>>
    ) {
        this.apiURL = apiURL;
        this.customHeaders = apiServices.getApiHeaders(apiURL) || {};
        this.apiServices = apiServices;
        this.corpusInfoApi = new CorpusInfoAPI(srcInfoURL, apiServices);
        this.backlinkConf = backlinkConf;
    }

    private prepareArgs(key: string, values: string[]): string[] {
        return pipe(
            values,
            List.filter((v) => !!v),
            List.map((v) => `${key}=${encodeURIComponent(v)}`)
        );
    }

    call(
        streaming: IDataStreaming | null,
        tileId: number,
        queryIdx: number,
        queryArgs: LexArgs
    ): Observable<LexResponse> {
        const params = [
            ...this.prepareArgs('assc_id', queryArgs.asscIds),
            ...this.prepareArgs('ijp_id', queryArgs.ijpIds),
            this.prepareArgs('event', [`DataTile-${tileId}.${queryIdx}`]),
        ];
        const emptyArgs = isEmptyArgs(queryArgs);
        return streaming
            ? streaming.registerTileRequest<LexResponse>({
                  tileId,
                  queryIdx,
                  method: HTTP.Method.GET,
                  url: emptyArgs
                      ? ''
                      : this.apiURL + '/stream?' + params.join('&'),
                  body: {},
                  contentType: 'application/json',
                  isEventSource: !emptyArgs,
              })
            : emptyArgs
              ? EMPTY
              : ajax$<LexResponse>(
                    HTTP.Method.GET,
                    this.apiURL + '/stream?' + params.join('&'),
                    {}
                );
    }

    getSourceDescription(
        streaming: IDataStreaming,
        tileId: number,
        lang: string,
        source: string
    ): Observable<SourceDetails> {
        switch (source) {
            case Source.Corpus:
                return this.corpusInfoApi.call(streaming, tileId, 0, {
                    corpname: source,
                    lang,
                });

            case Source.ASSC:
                return rxOf({
                    tileId,
                    title: this.apiServices.importExternalMessage({
                        'cs-CZ': 'Akademický slovník současné češtiny',
                        'en-US':
                            'Akademický slovník současné češtiny UNTRANSLATED',
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

            case Source.IJP:
                return rxOf({
                    tileId,
                    title: this.apiServices.importExternalMessage({
                        'cs-CZ': 'Internetová jazyková příručka',
                        'en-US': 'Internetová jazyková příručka UNTRANSLATED',
                    }),
                    description: this.apiServices.importExternalMessage({
                        'cs-CZ':
                            'Internetová jazyková příručka (IJP) vznikla a byla rozvíjena s podporou projektu Jazyková poradna na internetu, č. 1ET200610406, řešeného v letech 2004–2008, a projektů MŠMT LINDAT/CLARIN (LM2010013, 2013–2015; LM2015071, 2016–2019) a LINDAT/CLARIAH-CZ (LM2018101, 2020–2022; LM2023062, 2023–2026). Jde o první jazykovou pomůcku svého druhu. Výhodou IJP je, že může být neustále rozšiřována, zpřesňována a doplňována o nové výrazy. Od roku 2019 jsou data IJP využívána v rámci projektu TA ČR Webový pravopisný, gramatický a typografický korektor pro český jazyk, č. TL02000146.',
                        'en-US':
                            'Internetová jazyková příručka (IJP) vznikla a byla rozvíjena s podporou projektu Jazyková poradna na internetu, č. 1ET200610406, řešeného v letech 2004–2008, a projektů MŠMT LINDAT/CLARIN (LM2010013, 2013–2015; LM2015071, 2016–2019) a LINDAT/CLARIAH-CZ (LM2018101, 2020–2022; LM2023062, 2023–2026). Jde o první jazykovou pomůcku svého druhu. Výhodou IJP je, že může být neustále rozšiřována, zpřesňována a doplňována o nové výrazy. Od roku 2019 jsou data IJP využívána v rámci projektu TA ČR Webový pravopisný, gramatický a typografický korektor pro český jazyk, č. TL02000146. UNTRANSLATED',
                    }),
                    author: 'Ústav pro jazyk český AV ČR',
                    href: 'https://prirucka.ujc.cas.cz/?id=_about',
                });

            case Source.DJD:
                return rxOf({
                    tileId,
                    title: this.apiServices.importExternalMessage({
                        'cs-CZ': 'Jazyková poradna',
                        'en-US': 'Jazyková poradna UNTRANSLATED',
                    }),
                    description: this.apiServices.importExternalMessage({
                        'cs-CZ':
                            'Jazyková poradna Ústavu pro jazyk český je jediným bohemistickým pracovištěm v České republice poskytujícím soustavné jazykové poradenství a jazykové expertizy nejrůznějším uživatelům češtiny.',
                        'en-US':
                            'Jazyková poradna Ústavu pro jazyk český je jediným bohemistickým pracovištěm v České republice poskytujícím soustavné jazykové poradenství a jazykové expertizy nejrůznějším uživatelům češtiny. UNTRANSLATED',
                    }),
                    author: 'Ústav pro jazyk český AV ČR',
                    href: 'https://ujc.cas.cz/cs/jazykova-poradna/',
                });

            case Source.SSC:
                return rxOf({
                    tileId,
                    title: this.apiServices.importExternalMessage({
                        'cs-CZ':
                            'Slovník spisovné češtiny pro školu a veřejnost',
                        'en-US':
                            'Slovník spisovné češtiny pro školu a veřejnost UNTRANSLATED',
                    }),
                    description: this.apiServices.importExternalMessage({
                        'cs-CZ':
                            'Slovník spisovné češtiny pro školu a veřejnost, zkratka SSČ, je normativní výkladový slovník českého jazyka zpracovaný a průběžně aktualizovaný Ústavem pro jazyk český Akademie věd České republiky a vydávaný nakladatelstvím Academia. Slovník zahrnuje téměř 50 000 hesel současné češtiny.',
                        'en-US':
                            'Slovník spisovné češtiny pro školu a veřejnost, zkratka SSČ, je normativní výkladový slovník českého jazyka zpracovaný a průběžně aktualizovaný Ústavem pro jazyk český Akademie věd České republiky a vydávaný nakladatelstvím Academia. Slovník zahrnuje téměř 50 000 hesel současné češtiny. UNTRANSLATED',
                    }),
                    author: 'Ústav pro jazyk český AV ČR',
                    href: null,
                });

            default:
                return rxOf({
                    tileId,
                    title: this.apiServices.importExternalMessage({
                        'cs-CZ': `Neznámý zdroj "${source}"`,
                        'en-US': `Unknown source "${source}"`,
                    }),
                    description: this.apiServices.importExternalMessage({
                        'cs-CZ': 'Informace o zdroji nejsou dostupné.',
                        'en-US':
                            'Information about the source is not available.',
                    }),
                    author: '',
                    href: null,
                });
        }
    }

    getBacklink(queryId: number, subqueryId?: number): Backlink | null {
        return null;
    }

    isBacklinkSupported(source: Source): boolean {
        return !!this.backlinkConf[source];
    }

    getBacklinkURL(source: Source, id: string): URL {
        const url = new URL(
            this.backlinkConf[source].url.replace(
                '{id}',
                encodeURIComponent(id)
            )
        );
        return url;
    }
}
