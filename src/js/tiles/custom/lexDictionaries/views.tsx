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
import { LexDictionariesModel } from './model.js';
import * as S from './style.js';
import { GlobalComponents } from '../../../views/common/index.js';
import { PSJCDataStructure, SSJCDataStructure } from './api/basicApi.js';
import { isPSJCDataStructure, isSSJCDataStructure } from './api/types.js';
import { Actions } from './actions.js';

export function init(
    dispatcher: IActionDispatcher,
    ut: ViewUtils<GlobalComponents>,
    theme: Theme,
    model: LexDictionariesModel
): TileComponent {
    const globalComponents = ut.getComponents();

    const TabButton: React.FC<{
        label: string;
        onClick: () => void;
        selected?: boolean;
        disabled?: boolean;
    }> = (props) => {
        const classes = ['item'];
        if (props.disabled) classes.push('disabled');
        if (props.selected) classes.push('current');

        return (
            <S.TabButton>
                <span className={classes.join(' ')}>
                    {<a onClick={(_) => props.onClick()}>{props.label}</a>}
                </span>
            </S.TabButton>
        );
    };

    // -------------------- <PSJCDataView /> -----------------------------------------------

    const PSJCDataView: React.FC<{ data: PSJCDataStructure }> = (props) => {
        return (
            <ul>
                {List.map(
                    (entry, i) => (
                        <S.PSJCEntry
                            key={i}
                            dangerouslySetInnerHTML={{ __html: entry }}
                        />
                    ),
                    props.data.entries
                )}
            </ul>
        );
    };

    // -------------------- <SSJCDataView /> -----------------------------------------------

    const SSJCDataView: React.FC<{ data: SSJCDataStructure }> = (props) => {
        return (
            <ul>
                {List.map(
                    (entry, i) => (
                        <S.SSJCEntry
                            key={i}
                            dangerouslySetInnerHTML={{ __html: entry.payload }}
                        />
                    ),
                    props.data.entries
                )}
            </ul>
        );
    };

    // -------------------- <LexDictionariesTileView /> -----------------------------------------------

    const LexDictionariesTileView: React.FC<CoreTileComponentProps> = (
        props
    ) => {
        const state = useModel(model);

        const tabOnClick = (index: number) => {
            dispatcher.dispatch({
                name: Actions.SelectTab.name,
                payload: {
                    tileId: props.tileId,
                    dataIdx: index,
                },
            });
        };

        const current = state.data[state.selectedDataIndex];
        const source = ut.translate(`lex_dictionaries__label_${current.type}`);
        return (
            <globalComponents.TileWrapper
                tileId={props.tileId}
                isBusy={state.isBusy}
                error={state.error}
                hasData={true}
                backlink={current.backlink}
                supportsTileReload={props.supportsReloadOnError}
                issueReportingUrl={props.issueReportingUrl}
                sourceIdent={{ corp: source }}
            >
                <S.LexDictionariesTileView>
                    <S.Tabs>
                        {List.map(
                            (item, i) => (
                                <>
                                    {i > 0 ? (
                                        <span className="separator">|</span>
                                    ) : null}
                                    <TabButton
                                        label={ut.translate(
                                            `lex_dictionaries__short_label_${item.type}`
                                        )}
                                        onClick={() => tabOnClick(i)}
                                        selected={i === state.selectedDataIndex}
                                        disabled={!item.loaded}
                                    />
                                </>
                            ),
                            state.data
                        )}
                    </S.Tabs>

                    {current.data ? (
                        isPSJCDataStructure(current.type, current.data) ? (
                            <PSJCDataView data={current.data} />
                        ) : isSSJCDataStructure(current.type, current.data) ? (
                            <SSJCDataView data={current.data} />
                        ) : null
                    ) : null}
                </S.LexDictionariesTileView>
            </globalComponents.TileWrapper>
        );
    };

    return LexDictionariesTileView;
}
