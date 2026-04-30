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

import { IActionDispatcher, ViewUtils, useModel } from 'kombo';
import * as React from 'react';
import { Theme } from '../../../../page/theme.js';
import {
    CoreTileComponentProps,
    TileComponent,
} from '../../../../page/tile.js';
import { GlobalComponents } from '../../../../views/common/index.js';
import { Actions } from '../actions.js';
import { LexOverviewModel } from '../model.js';
import { init as initIjpViews } from './ijp/views.js';
import { init as initCorpusViews } from './corpus/views.js';
import * as S from './style.js';
import { List } from 'cnc-tskit';
import { LexItem, Source } from '../common.js';

interface BasicOverviewStruct {
    pronunciation?: string;
    partOfSpeach?: string;
    source: string;
}

export function init(
    dispatcher: IActionDispatcher,
    ut: ViewUtils<GlobalComponents>,
    theme: Theme,
    model: LexOverviewModel
): TileComponent {
    const globalComponents = ut.getComponents();
    const ijpViews = initIjpViews(dispatcher, ut);
    const corpusViews = initCorpusViews(dispatcher, ut);

    // -------------------- <LexOverviewHeader /> -----------------------------------------------

    const LexOverviewHeader: React.FC<{
        tileId: number;
        selectedVariantIdx: number;
        items: Array<LexItem>;
        backupTitle: string;
    }> = (props) => {
        const handleVariantClick = (variantIdx: number) => {
            dispatcher.dispatch(Actions.SelectItemVariant, {
                tileId: props.tileId,
                variantIdx,
            });
        };

        const renderVariants = (
            variantIdx: number,
            withInfo: boolean,
            clickable: boolean
        ) => {
            const variant = props.items[variantIdx];
            return (
                <>
                    {clickable ? (
                        <a onClick={() => handleVariantClick(variantIdx)}>
                            {variant.lemma}{' '}
                            {withInfo && variant.pos ? (
                                <span className="small">
                                    ({variant.pos}
                                    {variant.gender}
                                    {variant.aspect})
                                </span>
                            ) : null}
                        </a>
                    ) : (
                        <span>
                            {variant.lemma}{' '}
                            {withInfo && variant.pos ? (
                                <span className="small">
                                    ({variant.pos}
                                    {variant.gender}
                                    {variant.aspect})
                                </span>
                            ) : null}
                        </span>
                    )}
                </>
            );
        };

        return (
            <S.Header>
                {props.selectedVariantIdx > -1 ? (
                    <h2>
                        {renderVariants(props.selectedVariantIdx, true, false)}
                    </h2>
                ) : (
                    <h2>{props.backupTitle}</h2>
                )}

                {List.map(
                    (variants, i) => (
                        <h4 key={i} className="variant">
                            {renderVariants(
                                i,
                                true,
                                i !== props.selectedVariantIdx
                            )}
                        </h4>
                    ),
                    props.items
                )}
            </S.Header>
        );
    };

    // -------------------- <LexOverviewBasics /> -----------------------------------------------

    const LexOverviewBasics: React.FC<{
        basicOverview: BasicOverviewStruct;
    }> = (props) => {
        return (
            <S.Subtile color="#d4e2f4">
                {props.basicOverview.pronunciation ? (
                    <S.SubtileRow>
                        <span className="key">
                            {ut.translate(
                                'lex_overview__overview_pronunciation'
                            )}
                            :
                        </span>
                        <span className="value">
                            {props.basicOverview.pronunciation}
                        </span>
                    </S.SubtileRow>
                ) : null}
                <S.SubtileRow>
                    <span className="key">
                        {ut.translate('lex_overview__overview_part_of_speech')}:
                    </span>
                    <span className="value">
                        {props.basicOverview.partOfSpeach}
                    </span>
                </S.SubtileRow>
                <S.SubtileRow className="footer">
                    <span className="key">
                        {ut.translate('lex_overview__source')}:
                    </span>
                    <span className="value">{props.basicOverview.source}</span>
                </S.SubtileRow>
            </S.Subtile>
        );
    };

    // -------------------- <LexOverviewTileView /> -----------------------------------------------

    const LexOverviewTileView: React.FC<CoreTileComponentProps> = (props) => {
        const state = useModel(model);
        const basicOverview = {} as BasicOverviewStruct;

        const currentVariant =
            state.variants && state.selectedVariantIdx > -1
                ? state.variants[state.selectedVariantIdx]
                : null;
        if (currentVariant !== null) {
            const variant = state.variants[state.selectedVariantIdx];
            basicOverview.partOfSpeach = variant.pos;
            switch (state.mainSource) {
                case Source.ASSC:
                    basicOverview.source =
                        'Akademický slovník současné češtiny';
                    if (state.data.assc) {
                        const asscVariant = List.find(
                            (v) => v.key.startsWith(variant.lemma),
                            state.data.assc.variants
                        );
                        basicOverview.pronunciation = asscVariant.pronunciation;
                    }
                    break;
                case Source.IJP:
                    basicOverview.source = 'Internetová jazyková příručka';
                    if (state.data.ijp) {
                        basicOverview.pronunciation =
                            state.data.ijp.pronunciation;
                    }
                    break;
            }
        } else if (state.queryMatch.pos[0]) {
            basicOverview.partOfSpeach = state.queryMatch.pos[0].value;
            basicOverview.source = 'Korpus';
        }

        return (
            <globalComponents.TileWrapper
                tileId={props.tileId}
                isBusy={state.isBusy}
                error={state.error}
                hasData={true}
                supportsTileReload={props.supportsReloadOnError}
                issueReportingUrl={props.issueReportingUrl}
            >
                <S.LexOverviewTileView>
                    <LexOverviewHeader
                        tileId={props.tileId}
                        selectedVariantIdx={state.selectedVariantIdx}
                        items={state.variants}
                        backupTitle={state.queryMatch.lemma}
                    />
                    <LexOverviewBasics basicOverview={basicOverview} />

                    {state.data.ijp ? (
                        <ijpViews.Subtile data={state.data.ijp} />
                    ) : null}

                    {!currentVariant ? (
                        <corpusViews.Subtile
                            source={'syn2020'}
                            data={{
                                abs: state.queryMatch.abs,
                                ipm: state.queryMatch.ipm,
                            }}
                        />
                    ) : currentVariant.corpusEntry ? (
                        <corpusViews.Subtile
                            source={'syn2020'}
                            data={{
                                abs: currentVariant.corpusEntry.count,
                                ipm: currentVariant.corpusEntry.ipm,
                            }}
                        />
                    ) : (
                        <corpusViews.Subtile source={'syn2020'} />
                    )}
                </S.LexOverviewTileView>
            </globalComponents.TileWrapper>
        );
    };

    return LexOverviewTileView;
}
