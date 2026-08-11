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
import {
    getErrorMessage,
    isAsscData,
    isAsscError,
    isAsscHtml,
    isIjpData,
    isIjpError,
    isSscData,
    isSscError,
} from '../lexCommon/api.js';
import { SystemMessageType } from '../../../types.js';
import { IJPData } from '../lexCommon/types/ijp.js';
import { SSCData } from '../lexCommon/types/ssc.js';

export function init(
    dispatcher: IActionDispatcher,
    ut: ViewUtils<GlobalComponents>,
    theme: Theme,
    model: LexMeaningModel
): TileComponent {
    const globalComponents = ut.getComponents();
    const lexComponents = initLexComponents(dispatcher, ut);

    // -------------------- <Header /> -----------------------------------------------

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

    const IJPHeader: React.FC<{
        i: number;
        term: string;
        partOfSpeech: string;
    }> = (props) => {
        return (
            <S.ASSCStyle key={props.i} className={'header-line'}>
                <span className="heslo">{props.term}</span>
                <span className="sl_druh">{props.partOfSpeech}</span>
            </S.ASSCStyle>
        );
    };

    // -------------------- <LexMeaningTileView /> -----------------------------------------------

    const LexMeaningTileView: React.FC<CoreTileComponentProps> = (props) => {
        const state = useModel(model);

        const renderASSCDataItem = (
            key: string,
            data: HTMLBlock,
            isParent: boolean
        ) => {
            return (
                <S.MeaningItem key={key} className={isParent ? 'parent' : ''}>
                    <S.MeaningHead>
                        {List.map(
                            (line, i) => (
                                <ASSCHeader i={i} line={line} />
                            ),
                            data.formattedVariants
                        )}
                    </S.MeaningHead>
                    <S.MeaningBody>
                        {List.map(
                            (block, i) => (
                                <S.ASSCStyle
                                    key={`block${i}`}
                                    className={
                                        'meaning-block' +
                                        (block.includes('□')
                                            ? ' style_souslovi'
                                            : '')
                                    }
                                    dangerouslySetInnerHTML={{ __html: block }}
                                />
                            ),
                            data.meanings
                        )}
                        {List.map(
                            (nest, i) => (
                                <S.ASSCStyle
                                    key={`nest${i}`}
                                    className="nest-line"
                                    dangerouslySetInnerHTML={{ __html: nest }}
                                />
                            ),
                            data.nestedVariants
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
                            data.links
                        )}
                    </S.MeaningBody>
                </S.MeaningItem>
            );
        };

        const renderIJPDataItem = (key: string, data: IJPData) => {
            return (
                <S.MeaningItem key={key}>
                    <S.MeaningHead>
                        <IJPHeader
                            i={0}
                            term={data.heading}
                            partOfSpeech={data.gender}
                        />
                    </S.MeaningHead>
                    <S.MeaningBody>
                        <S.ASSCStyle className="meaning-block">
                            <span className="exeplifikace">
                                {List.map(
                                    (example, i) => (
                                        <>
                                            {i > 0 ? <br /> : null}
                                            <span
                                                style={{ fontStyle: 'italic' }}
                                            >
                                                <span className="normalni">
                                                    {example}
                                                </span>
                                            </span>
                                        </>
                                    ),
                                    data.examples
                                )}
                            </span>
                        </S.ASSCStyle>
                    </S.MeaningBody>
                </S.MeaningItem>
            );
        };

        const renderSSCDataItem = (key: string, data: SSCData) => {
            return (
                <S.MeaningItem key={key}>
                    <S.SSCStyle
                        dangerouslySetInnerHTML={{
                            __html: data.html_content,
                        }}
                    />
                </S.MeaningItem>
            );
        };

        const ijpNotes = pipe(
            state.data.ijp,
            List.filter((v) => isIjpData(v)),
            List.filter((v) => !List.empty(v.data.notes)),
            List.flatMap((v) => v.data.notes)
        );

        const asscNotes = pipe(
            state.data.assc,
            List.flatMap((v) => v.data),
            List.flatMap((v) => v.notes)
        );

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
                            {pipe(
                                [
                                    ...state.sourceErrors.ijp,
                                    ...state.sourceErrors.assc,
                                    ...state.sourceErrors.ssc,
                                ],
                                List.map((v) => (
                                    <lexComponents.MessageSubtile
                                        systemMessageType={
                                            SystemMessageType.ERROR
                                        }
                                        className="error-box"
                                    >
                                        {List.map(
                                            (msg) => ut.translate(msg),
                                            getErrorMessage(v)
                                        )}
                                    </lexComponents.MessageSubtile>
                                ))
                            )}

                            {!List.empty(state.data.assc) ? (
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
                                                            {i > 0 &&
                                                            j === 0 ? (
                                                                <hr />
                                                            ) : null}
                                                            {isParent ? (
                                                                <span className="ke-slovu">
                                                                    ke slovu
                                                                </span>
                                                            ) : null}
                                                            {renderASSCDataItem(
                                                                `item-${i}-${j}`,
                                                                block,
                                                                isParent
                                                            )}
                                                        </>
                                                    );
                                                }, blocks.data),
                                            state.data.assc
                                        )}
                                    </SubtileRow>
                                </lexComponents.Subtile>
                            ) : null}

                            {List.empty(state.data.assc) &&
                            !List.empty(state.data.ssc) &&
                            !state.isBusy ? (
                                <lexComponents.Subtile
                                    tileId={props.tileId}
                                    source={Source.SSC}
                                    className="data-box"
                                >
                                    <SubtileRow className="scroller">
                                        {List.map(
                                            (item, i) => (
                                                <>
                                                    {i > 0 ? <hr /> : null}
                                                    {renderSSCDataItem(
                                                        `item-${i}`,
                                                        item.data
                                                    )}
                                                </>
                                            ),
                                            state.data.ssc
                                        )}
                                    </SubtileRow>
                                </lexComponents.Subtile>
                            ) : null}

                            {List.empty(state.data.assc) &&
                            List.empty(state.data.ssc) &&
                            !List.empty(state.data.ijp) &&
                            !state.isBusy ? (
                                <lexComponents.Subtile
                                    tileId={props.tileId}
                                    source={Source.IJP}
                                    className="data-box"
                                >
                                    <SubtileRow className="scroller">
                                        {List.map(
                                            (item, i) => (
                                                <>
                                                    {i > 0 ? <hr /> : null}
                                                    {renderIJPDataItem(
                                                        `item-${i}`,
                                                        item.data
                                                    )}
                                                </>
                                            ),
                                            state.data.ijp
                                        )}
                                    </SubtileRow>
                                </lexComponents.Subtile>
                            ) : null}
                        </div>
                    </S.MeaningTileView>
                </globalComponents.Subtile>

                {!List.empty(asscNotes) || !List.empty(ijpNotes) ? (
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
                ) : null}
            </globalComponents.TileWrapper>
        );
    };

    return LexMeaningTileView;
}
