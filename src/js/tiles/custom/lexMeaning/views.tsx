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
import { IActionDispatcher, ViewUtils, useModel } from 'kombo';
import * as React from 'react';
import { Theme } from '../../../page/theme.js';
import { CoreTileComponentProps, TileComponent } from '../../../page/tile.js';
import { LexMeaningModel } from './model.js';
import * as S from './style.js';
import { GlobalComponents } from '../../../views/common/index.js';
import { HTMLBlock } from '../lexCommon/types/assc.js';
import { SubtileRow } from '../lexCommon/style.js';
import { Source } from '../lexCommon/types/enums.js';
import { initLexComponents } from '../lexCommon/views.js';
import { getErrorMessage, LexResponse } from '../lexCommon/api.js';
import { SystemMessageType } from '../../../types.js';

export function init(
    dispatcher: IActionDispatcher,
    ut: ViewUtils<GlobalComponents>,
    theme: Theme,
    model: LexMeaningModel
): TileComponent {
    const globalComponents = ut.getComponents();
    const lexComponents = initLexComponents(dispatcher, ut);

    // -------------------- <ASSCHeader /> -----------------------------------------------

    const ASSCHeader: React.FC<{ i: number; line: string }> = (props) => {
        const [collapsed, setCollapsed] = React.useState(true);

        const onClick = (ev: React.MouseEvent<HTMLDivElement>) => {
            const target = ev.target;
            if (
                target instanceof HTMLElement &&
                (target.closest('.vyslovnost') ||
                    target.closest('.tvCh') ||
                    target.closest('.tvChSl') ||
                    target.closest('.expand'))
            ) {
                setCollapsed((prev) => !prev);
            }
        };

        return (
            <S.ASSCStyle
                key={props.i}
                className={'header-line' + (collapsed ? ' collapsed' : '')}
                onClick={onClick}
                dangerouslySetInnerHTML={{ __html: props.line }}
            />
        );
    };

    // -------------------- <ASSCLexSubtile /> -----------------------------------

    const ASSCLexSubtile: React.FC<{ tileId: number }> = (props) => {
        const state = useModel(model);

        return (
            <lexComponents.Subtile
                tileId={props.tileId}
                source={Source.ASSC}
                className="data-box"
            >
                <SubtileRow className="scroller">
                    {List.flatMap(
                        (blocks, i) =>
                            List.map((block, j) => {
                                const isParent = j > 0;
                                return (
                                    <>
                                        {i > 0 && j === 0 ? (
                                            <hr className="itemDivider" />
                                        ) : null}
                                        {isParent ? (
                                            <span className="ke-slovu">
                                                ke slovu
                                            </span>
                                        ) : null}
                                        {
                                            <S.MeaningItem
                                                key={i}
                                                className={
                                                    isParent ? 'parent' : ''
                                                }
                                            >
                                                <S.MeaningHead>
                                                    {List.map(
                                                        (line, i) => (
                                                            <ASSCHeader
                                                                i={i}
                                                                line={line}
                                                            />
                                                        ),
                                                        block.formattedVariants
                                                    )}
                                                </S.MeaningHead>
                                                <S.MeaningBody>
                                                    {List.map(
                                                        (item, i) => (
                                                            <S.ASSCStyle
                                                                key={`block${i}`}
                                                                className={
                                                                    'meaning-block' +
                                                                    (item.includes(
                                                                        '□'
                                                                    )
                                                                        ? ' style_souslovi'
                                                                        : '')
                                                                }
                                                                dangerouslySetInnerHTML={{
                                                                    __html: item,
                                                                }}
                                                            />
                                                        ),
                                                        block.meanings
                                                    )}
                                                    {List.map(
                                                        (nest, i) => (
                                                            <S.ASSCStyle
                                                                key={`nest${i}`}
                                                                className="nest-line"
                                                                dangerouslySetInnerHTML={{
                                                                    __html: nest,
                                                                }}
                                                            />
                                                        ),
                                                        block.nestedVariants
                                                    )}
                                                    {List.map(
                                                        (links, i) => (
                                                            <S.ASSCStyle
                                                                key={`links${i}`}
                                                                className="links"
                                                                dangerouslySetInnerHTML={{
                                                                    __html: links,
                                                                }}
                                                            />
                                                        ),
                                                        block.links
                                                    )}
                                                </S.MeaningBody>
                                            </S.MeaningItem>
                                        }
                                    </>
                                );
                            }, blocks.data),
                        state.data.assc
                    )}
                </SubtileRow>
            </lexComponents.Subtile>
        );
    };

    // -------------------- <IJPLexSubtile /> -----------------------------------

    const IJPLexSubtile: React.FC<{ tileId: number }> = (props) => {
        const state = useModel(model);

        return (
            <lexComponents.Subtile
                tileId={props.tileId}
                source={Source.IJP}
                className="data-box"
            >
                <SubtileRow className="scroller">
                    {List.map(
                        (item, i) => (
                            <>
                                {i > 0 ? <hr className="itemDivider" /> : null}
                                {
                                    <S.MeaningItem key={i}>
                                        <S.MeaningHead>
                                            <S.ASSCStyle
                                                className={'header-line'}
                                            >
                                                <span className="heslo">
                                                    {item.data.heading}
                                                </span>
                                                <span className="sl_druh">
                                                    {item.data.gender}
                                                </span>
                                            </S.ASSCStyle>
                                        </S.MeaningHead>
                                        <S.MeaningBody>
                                            <S.ASSCStyle className="meaning-block">
                                                {!List.empty(
                                                    item.data.examples
                                                ) ? (
                                                    <>
                                                        <span className="key">
                                                            {ut.translate(
                                                                'lex_meaning__examples'
                                                            )}
                                                            :
                                                        </span>
                                                        <span className="exeplifikace">
                                                            {List.map(
                                                                (example) => (
                                                                    <>
                                                                        <br />
                                                                        <span
                                                                            style={{
                                                                                fontStyle:
                                                                                    'italic',
                                                                            }}
                                                                        >
                                                                            <span className="normalni">
                                                                                {
                                                                                    example
                                                                                }
                                                                            </span>
                                                                        </span>
                                                                    </>
                                                                ),
                                                                item.data
                                                                    .examples
                                                            )}
                                                        </span>
                                                    </>
                                                ) : null}
                                            </S.ASSCStyle>
                                        </S.MeaningBody>
                                    </S.MeaningItem>
                                }
                            </>
                        ),
                        state.data.ijp
                    )}
                </SubtileRow>
            </lexComponents.Subtile>
        );
    };

    // -------------------- <SSCLexSubtile /> -----------------------------------

    const SSCLexSubtile: React.FC<{ tileId: number }> = (props) => {
        const state = useModel(model);

        return (
            <lexComponents.Subtile
                tileId={props.tileId}
                source={Source.SSC}
                className="data-box"
            >
                <SubtileRow className="scroller">
                    {List.map(
                        (item, i) => (
                            <>
                                {i > 0 ? <hr className="itemDivider" /> : null}
                                {
                                    <S.MeaningItem key={i}>
                                        <S.SSCStyle
                                            dangerouslySetInnerHTML={{
                                                __html: item.data.html_content,
                                            }}
                                        />
                                    </S.MeaningItem>
                                }
                            </>
                        ),
                        state.data.ssc
                    )}
                </SubtileRow>
            </lexComponents.Subtile>
        );
    };

    // -------------------- <UsageNotesSubileView /> -----------------------------------

    const UsageNotesSubtileView: React.FC<{ tileId: number }> = (props) => {
        const state = useModel(model);

        const ijpNotes = pipe(
            state.data.ijp,
            List.filter((v) => !List.empty(v.data.notes)),
            List.flatMap((v) => v.data.notes)
        );

        const asscNotes = pipe(
            state.data.assc,
            List.flatMap((v) => v.data),
            List.flatMap((v) => v.notes)
        );

        return !List.empty(asscNotes) || !List.empty(ijpNotes) ? (
            <globalComponents.Subtile
                tileId={props.tileId}
                heading={ut.translate('lex_meaning__usage_notes')}
                isBusy={state.isBusy}
                hasData={true}
            >
                <S.UsageNotesTileView>
                    {!List.empty(ijpNotes) ? (
                        <lexComponents.Subtile
                            tileId={props.tileId}
                            source={
                                List.some(
                                    (data) => data.includes('</a>'),
                                    ijpNotes
                                )
                                    ? [Source.IJP, Source.DJD]
                                    : Source.IJP
                            }
                        >
                            {List.map(
                                (note, i) => (
                                    <SubtileRow
                                        dangerouslySetInnerHTML={{
                                            __html: note,
                                        }}
                                    />
                                ),
                                ijpNotes
                            )}
                        </lexComponents.Subtile>
                    ) : null}

                    {!List.empty(asscNotes) ? (
                        <lexComponents.Subtile
                            tileId={props.tileId}
                            source={Source.ASSC}
                        >
                            {List.map(
                                (note, i) => (
                                    <SubtileRow
                                        dangerouslySetInnerHTML={{
                                            __html: note,
                                        }}
                                    />
                                ),
                                asscNotes
                            )}
                        </lexComponents.Subtile>
                    ) : null}
                </S.UsageNotesTileView>
            </globalComponents.Subtile>
        ) : null;
    };

    // -------------------- <LexMeaningTileView /> -----------------------------------------------

    const LexMeaningTileView: React.FC<CoreTileComponentProps> = (props) => {
        const state = useModel(model);

        const renderErrors = () => {
            return pipe(
                state.sourcePriority,
                List.flatMap(
                    (source) =>
                        (state.sourceErrors[source] || []) as Array<
                            LexResponse<string>
                        >
                ),
                List.map((errResp) => (
                    <lexComponents.MessageSubtile
                        systemMessageType={SystemMessageType.ERROR}
                        className="error-box"
                    >
                        {List.map(
                            (msg) => ut.translate(msg),
                            getErrorMessage(errResp)
                        )}
                    </lexComponents.MessageSubtile>
                ))
            );
        };

        const renderData = (usedSource: string) => {
            switch (usedSource) {
                case Source.ASSC:
                    return <ASSCLexSubtile tileId={props.tileId} />;
                case Source.IJP:
                    return <IJPLexSubtile tileId={props.tileId} />;
                case Source.SSC:
                    return <SSCLexSubtile tileId={props.tileId} />;
                default:
                    return null;
            }
        };

        return (
            <globalComponents.TileWrapper
                tileId={props.tileId}
                isBusy={false}
                error={state.error}
                hasData={true}
                supportsTileReload={props.supportsReloadOnError}
                isSubtileContainer={props.isSubtileContainer}
                issueReportingUrl={props.issueReportingUrl}
            >
                <globalComponents.Subtile
                    tileId={props.tileId}
                    isBusy={state.isBusy}
                    hasData={
                        !List.empty(state.data[state.usedSource]) ||
                        Dict.some((v) => !List.empty(v), state.sourceErrors)
                    }
                    setMaxHeight={true}
                >
                    {props.tileHeader}

                    <S.MeaningTileView>
                        <div className="stretch">
                            {renderErrors()}
                            {renderData(state.usedSource)}
                        </div>
                    </S.MeaningTileView>
                </globalComponents.Subtile>

                <UsageNotesSubtileView tileId={props.tileId} />
            </globalComponents.TileWrapper>
        );
    };

    return LexMeaningTileView;
}
