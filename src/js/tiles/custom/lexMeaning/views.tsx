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

import { List } from 'cnc-tskit';
import { IActionDispatcher, ViewUtils, useModel } from 'kombo';
import * as React from 'react';
import { Theme } from '../../../page/theme.js';
import { CoreTileComponentProps, TileComponent } from '../../../page/tile.js';
import { LexMeaningModel } from './model.js';
import * as S from './style.js';
import { GlobalComponents } from '../../../views/common/index.js';
import { VariantData, MeaningData } from '../lexOverview/api/assc.js';

export function init(
    dispatcher: IActionDispatcher,
    ut: ViewUtils<GlobalComponents>,
    theme: Theme,
    model: LexMeaningModel
): TileComponent {
    const globalComponents = ut.getComponents();

    // -------------------- <UjcDictionaryTileView /> -----------------------------------------------

    const LexMeaningTileView: React.FC<CoreTileComponentProps> = (props) => {
        const state = useModel(model);

        const renderDataItem = (
            variants: Array<VariantData>,
            meanings: Array<MeaningData>,
            i: number
        ) => {
            return (
                <div>
                    {i > 0 ? <hr /> : null}
                    <S.MeaningHeading>
                        <span className="key">pro slovo:</span>
                        {List.map(
                            (variant, i) => (
                                <>
                                    {i > 0 ? <span> /</span> : null}
                                    <span className="word">{variant.key}</span>
                                    <span className="pos">{variant.pos}</span>
                                </>
                            ),
                            variants
                        )}
                    </S.MeaningHeading>
                    {List.map(
                        (v, i) => (
                            <S.MeaningBlock>
                                <div>
                                    {i + 1}.{' '}
                                    <span className="attachement">
                                        {v.attachement}
                                    </span>
                                </div>
                                <div className="explanation">
                                    {v.explanation}
                                </div>
                                <div className="examples">
                                    {List.flatMap(
                                        (e) =>
                                            List.map(
                                                (x) => (
                                                    <div className="example">
                                                        {x}
                                                    </div>
                                                ),
                                                e.data
                                            ),
                                        v.examples
                                    )}
                                </div>
                            </S.MeaningBlock>
                        ),
                        meanings
                    )}
                </div>
            );
        };

        return (
            <globalComponents.TileWrapper
                tileId={props.tileId}
                isBusy={state.isBusy}
                error={state.error}
                hasData={!!state.variants && state.meanings.length > 0}
                supportsTileReload={props.supportsReloadOnError}
                issueReportingUrl={props.issueReportingUrl}
            >
                <S.MeaningTileView>
                    <S.MeaningBox>
                        {state.variants
                            ? renderDataItem(state.variants, state.meanings, 0)
                            : null}
                    </S.MeaningBox>
                </S.MeaningTileView>
            </globalComponents.TileWrapper>
        );
    };

    return LexMeaningTileView;
}
