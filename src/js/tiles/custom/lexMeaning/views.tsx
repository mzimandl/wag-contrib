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

import { List, pipe } from 'cnc-tskit';
import { IActionDispatcher, ViewUtils, useModel } from 'kombo';
import * as React from 'react';
import { Theme } from '../../../page/theme.js';
import { CoreTileComponentProps, TileComponent } from '../../../page/tile.js';
import { LexMeaningModel } from './model.js';
import * as S from './style.js';
import { GlobalComponents } from '../../../views/common/index.js';
import { HTMLBlock } from '../lexOverview/api/asscTypes.js';

export function init(
    dispatcher: IActionDispatcher,
    ut: ViewUtils<GlobalComponents>,
    theme: Theme,
    model: LexMeaningModel
): TileComponent {
    const globalComponents = ut.getComponents();

    // -------------------- <LexMeaningTileView /> -----------------------------------------------

    const LexMeaningTileView: React.FC<CoreTileComponentProps> = (props) => {
        const state = useModel(model);

        const renderDataItem = (
            key: string,
            data: HTMLBlock,
            isParent: boolean
        ) => {
            return (
                <S.MeaningItem key={key} className={isParent ? 'parent' : ''}>
                    <S.MeaningHeading>
                        <span className="key">pro slovo:</span>
                        {pipe(
                            data.variants,
                            List.map((variant, i) => (
                                <>
                                    {i > 0 ? <span> /</span> : null}
                                    <span className="word">
                                        {variant.key} {variant.homonym}
                                    </span>
                                    <span className="pos">{variant.pos}</span>
                                </>
                            ))
                        )}
                    </S.MeaningHeading>
                    {List.map(
                        (v) => (
                            <S.MeaningBlock
                                dangerouslySetInnerHTML={{ __html: v }}
                            />
                        ),
                        data.meanings
                    )}
                </S.MeaningItem>
            );
        };

        return (
            <globalComponents.TileWrapper
                tileId={props.tileId}
                isBusy={state.isBusy}
                error={state.error}
                hasData={state.data.length > 0}
                supportsTileReload={props.supportsReloadOnError}
                issueReportingUrl={props.issueReportingUrl}
            >
                <S.MeaningTileView>
                    <S.MeaningBox>
                        {List.flatMap(
                            (d, i) =>
                                List.map((block, j) => {
                                    const isParent = j > 0;
                                    return (
                                        <>
                                            {i > 0 && j === 0 ? <hr /> : null}
                                            {renderDataItem(
                                                `item-${i}-${j}`,
                                                block,
                                                isParent
                                            )}
                                        </>
                                    );
                                }, d.blocks),
                            state.data
                        )}
                    </S.MeaningBox>
                </S.MeaningTileView>
            </globalComponents.TileWrapper>
        );
    };

    return LexMeaningTileView;
}
