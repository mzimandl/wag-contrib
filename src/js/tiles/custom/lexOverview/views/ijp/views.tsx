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

import { Dict, List, pipe } from 'cnc-tskit';
import { IActionDispatcher, ViewUtils } from 'kombo';
import * as React from 'react';
import { GlobalComponents } from '../../../../../views/common/index.js';
import {
    CaseData,
    ComparisonData,
    ConjugationData,
} from '../../api/ijpTypes.js';
import * as S from '../style.js';
import * as LS from './style.js';
import { IJPData } from '../../api/ijpTypes.js';

export function init(
    dispatcher: IActionDispatcher,
    ut: ViewUtils<GlobalComponents>
): {
    Subtile: React.FC<{
        data: IJPData;
        color?: string;
    }>;
} {
    const defaultColor = '#e5eef8';

    // -------------------- <ComparisonTable /> -----------------------------------------------

    const ComparisonTable: React.FC<{
        positive: string;
        comparisonData: ComparisonData;
    }> = (props) => {
        return (
            <LS.DataTable>
                <thead>
                    <tr>
                        <th>
                            {ut.translate('lex_overview__comparison_positive')}
                        </th>
                        <th>
                            {ut.translate(
                                'lex_overview__comparison_comparative'
                            )}
                        </th>
                        <th>
                            {ut.translate(
                                'lex_overview__comparison_superlative'
                            )}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{props.positive}</td>
                        <td>{props.comparisonData.comparative}</td>
                        <td>{props.comparisonData.superlative}</td>
                    </tr>
                </tbody>
            </LS.DataTable>
        );
    };

    // -------------------- <CaseTable /> -----------------------------------------------

    const CaseTable: React.FC<{
        caseData: CaseData;
    }> = (props) => {
        return (
            <LS.DataTable>
                <thead>
                    <tr>
                        <th>{ut.translate('lex_overview__table_case')}</th>
                        <th>{ut.translate('lex_overview__number_singular')}</th>
                        <th>{ut.translate('lex_overview__number_plural')}</th>
                    </tr>
                </thead>
                <tbody>
                    {pipe(
                        props.caseData,
                        Dict.toEntries(),
                        List.map((data, i) => (
                            <tr key={`${i}:${data[0]}`}>
                                <td>{i + 1}.</td>
                                <td>{data[1].singular}</td>
                                <td>{data[1].plural}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </LS.DataTable>
        );
    };

    // -------------------- <ConjugationTable /> -----------------------------------------------

    const ConjugationTable: React.FC<{
        conjugationData: ConjugationData;
    }> = (props) => {
        return (
            <LS.DataTable>
                <thead>
                    <tr>
                        <th></th>
                        <th>{ut.translate('lex_overview__number_singular')}</th>
                        <th>{ut.translate('lex_overview__number_plural')}</th>
                    </tr>
                </thead>
                <tbody>
                    {pipe(
                        props.conjugationData.person,
                        Dict.toEntries(),
                        List.map((data) => (
                            <tr>
                                <td>
                                    {ut.translate(
                                        `lex_overview__conjugation_person_${data[0]}`
                                    )}
                                </td>
                                <td>{data[1].singular}</td>
                                <td>{data[1].plural}</td>
                            </tr>
                        ))
                    )}
                    {!!props.conjugationData.imperative.singular ||
                    !!props.conjugationData.imperative.singular ? (
                        <tr>
                            <td>
                                {ut.translate(
                                    'lex_overview__conjugation_imperative'
                                )}
                            </td>
                            <td>{props.conjugationData.imperative.singular}</td>
                            <td>{props.conjugationData.imperative.plural}</td>
                        </tr>
                    ) : null}
                    {!!props.conjugationData.participle.active ? (
                        <tr>
                            <td>
                                {ut.translate(
                                    'lex_overview__conjugation_participle_active'
                                )}
                            </td>
                            <td colSpan={2}>
                                {props.conjugationData.participle.active}
                            </td>
                        </tr>
                    ) : null}
                    {!!props.conjugationData.participle.passive ? (
                        <tr>
                            <td>
                                {ut.translate(
                                    'lex_overview__conjugation_participle_passive'
                                )}
                            </td>
                            <td colSpan={2}>
                                {props.conjugationData.participle.passive}
                            </td>
                        </tr>
                    ) : null}
                    {!!props.conjugationData.transgressive.past.m.singular ||
                    !!props.conjugationData.transgressive.past.m.plural ? (
                        <tr>
                            <td>
                                {ut.translate(
                                    'lex_overview__conjugation_transgressive_past_m'
                                )}
                            </td>
                            <td>
                                {
                                    props.conjugationData.transgressive.past.m
                                        .singular
                                }
                            </td>
                            <td>
                                {
                                    props.conjugationData.transgressive.past.m
                                        .plural
                                }
                            </td>
                        </tr>
                    ) : null}
                    {!!props.conjugationData.transgressive.past.zs.singular ||
                    !!props.conjugationData.transgressive.past.zs.plural ? (
                        <tr>
                            <td>
                                {ut.translate(
                                    'lex_overview__conjugation_transgressive_past_zs'
                                )}
                            </td>
                            <td>
                                {
                                    props.conjugationData.transgressive.past.zs
                                        .singular
                                }
                            </td>
                            <td>
                                {
                                    props.conjugationData.transgressive.past.zs
                                        .plural
                                }
                            </td>
                        </tr>
                    ) : null}
                    {!!props.conjugationData.transgressive.present.m.singular ||
                    !!props.conjugationData.transgressive.present.m.plural ? (
                        <tr>
                            <td>
                                {ut.translate(
                                    'lex_overview__conjugation_transgressive_present_m'
                                )}
                            </td>
                            <td>
                                {
                                    props.conjugationData.transgressive.present
                                        .m.singular
                                }
                            </td>
                            <td>
                                {
                                    props.conjugationData.transgressive.present
                                        .m.plural
                                }
                            </td>
                        </tr>
                    ) : null}
                    {!!props.conjugationData.transgressive.present.zs
                        .singular ||
                    !!props.conjugationData.transgressive.present.zs.plural ? (
                        <tr>
                            <td>
                                {ut.translate(
                                    'lex_overview__conjugation_transgressive_present_zs'
                                )}
                            </td>
                            <td>
                                {
                                    props.conjugationData.transgressive.present
                                        .zs.singular
                                }
                            </td>
                            <td>
                                {
                                    props.conjugationData.transgressive.present
                                        .zs.plural
                                }
                            </td>
                        </tr>
                    ) : null}
                    {!!props.conjugationData.verbalNoun ? (
                        <tr>
                            <td>
                                {ut.translate(
                                    'lex_overview__conjugation_verbal_noun'
                                )}
                            </td>
                            <td colSpan={2}>
                                {props.conjugationData.verbalNoun}
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </LS.DataTable>
        );
    };

    // -------------------- <IjpSubtileView /> -----------------------------------------------

    const IjpSubtileView: React.FC<{
        data: IJPData;
        color?: string;
    }> = (props) => {
        return (
            <S.Subtile color={props.color || defaultColor}>
                <S.SubtileRow>
                    <span className="key">
                        {ut.translate('lex_overview__overview_syllabification')}
                        :
                    </span>
                    <span className="value">{props.data.syllabification}</span>
                </S.SubtileRow>
                {props.data.gender ? (
                    <S.SubtileRow>
                        <span className="key">
                            {ut.translate('lex_overview__overview_gender')}:
                        </span>
                        <span className="value">{props.data.gender}</span>
                    </S.SubtileRow>
                ) : null}

                {!!props.data.comparison.comparative ||
                !!props.data.comparison.superlative ? (
                    <S.SubtileRow>
                        <span className="key">
                            {ut.translate('lex_overview__comparison')}
                        </span>
                        <ComparisonTable
                            positive={props.data.heading}
                            comparisonData={props.data.comparison}
                        />
                    </S.SubtileRow>
                ) : null}

                {Dict.some(
                    (item) => !!item.singular || !!item.plural,
                    props.data.grammarCase
                ) ? (
                    <S.SubtileRow>
                        <span className="key">
                            {ut.translate('lex_overview__case')}:
                        </span>
                        <CaseTable caseData={props.data.grammarCase} />
                    </S.SubtileRow>
                ) : null}

                {Dict.some(
                    (item) => !!item.singular || !!item.plural,
                    props.data.conjugation.person
                ) ? (
                    <S.SubtileRow>
                        <span className="key">
                            {ut.translate('lex_overview__conjugation')}
                        </span>
                        <ConjugationTable
                            conjugationData={props.data.conjugation}
                        />
                    </S.SubtileRow>
                ) : null}

                <S.SubtileRow className="footer">
                    <span className="key">
                        {ut.translate('lex_overview__source')}:
                    </span>
                    <span className="value">Internetová jazyková příručka</span>
                </S.SubtileRow>
            </S.Subtile>
        );
    };

    return {
        Subtile: IjpSubtileView,
    };
}
