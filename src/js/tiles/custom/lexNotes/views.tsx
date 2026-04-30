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

import { List } from 'cnc-tskit';
import { IActionDispatcher, ViewUtils, useModel } from 'kombo';
import * as React from 'react';
import { Theme } from '../../../page/theme.js';
import { CoreTileComponentProps, TileComponent } from '../../../page/tile.js';
import { LexNotesModel } from './model.js';
import * as S from './style.js';
import { GlobalComponents } from '../../../views/common/index.js';

export function init(
    dispatcher: IActionDispatcher,
    ut: ViewUtils<GlobalComponents>,
    theme: Theme,
    model: LexNotesModel
): TileComponent {
    const globalComponents = ut.getComponents();

    // -------------------- <LexNotesTileView /> -----------------------------------------------

    const LexNotesTileView: React.FC<CoreTileComponentProps> = (props) => {
        const state = useModel(model);
        console.log(state.notes);

        return (
            <globalComponents.TileWrapper
                tileId={props.tileId}
                isBusy={state.isBusy}
                error={state.error}
                hasData={
                    !List.empty(state.notes.assc) ||
                    !List.empty(state.notes.ijp)
                }
                supportsTileReload={props.supportsReloadOnError}
                issueReportingUrl={props.issueReportingUrl}
            >
                <S.NotesTileView>
                    {!List.empty(state.notes.ijp) ? (
                        <S.NotesBox className="ijp">
                            {List.map(
                                (note, i) => (
                                    <div>{note}</div>
                                ),
                                state.notes.ijp
                            )}
                        </S.NotesBox>
                    ) : null}

                    {!List.empty(state.notes.assc) ? (
                        <S.NotesBox className="assc">
                            {List.map(
                                (note, i) => (
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: note,
                                        }}
                                    />
                                ),
                                state.notes.assc
                            )}
                        </S.NotesBox>
                    ) : null}
                </S.NotesTileView>
            </globalComponents.TileWrapper>
        );
    };

    return LexNotesTileView;
}
