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
import { Actions as GlobalActions } from '../../../../models/actions.js';
import { LexOverviewModel } from '../model.js';
import { init as initAsscViews } from './assc/views.js';
import { init as initIjpViews } from './ijp/views.js';
import { init as initCorpusViews } from './corpus/views.js';
import * as S from './style.js';
import { Dict, List, pipe } from 'cnc-tskit';
import { initLexComponents } from '../../lexCommon/views.js';
import { LexItem } from '../../lexCommon/types/dictionary.js';
import { SubtileRow } from '../../lexCommon/style.js';
import { Source } from '../../lexCommon/types/enums.js';
import { VariantData } from '../../lexCommon/types/assc.js';
import { Actions } from '../actions.js';
import { SystemMessageType } from '../../../../types.js';
import {
    getErrorMessage,
    isAsscData,
    isAsscError,
    isIjpData,
    isIjpError,
} from '../../lexCommon/api.js';
import { QueryMatch } from '../../../../query/index.js';

interface BasicOverviewData {
    pronunciation?: string;
    audioLink?: string;
}

export function init(
    dispatcher: IActionDispatcher,
    ut: ViewUtils<GlobalComponents>,
    theme: Theme,
    model: LexOverviewModel
): TileComponent {
    const globalComponents = ut.getComponents();
    const lexComponents = initLexComponents(dispatcher, ut);
    const asscViews = initAsscViews(dispatcher, ut);
    const ijpViews = initIjpViews(dispatcher, ut);
    const corpusViews = initCorpusViews(dispatcher, ut);

    const translateMorfology = (
        variant: LexItem,
        withPosInfo: boolean,
        short: boolean
    ) => {
        const parts = [];
        if (withPosInfo) {
            parts.push(
                short
                    ? ut.translate(`lex_common__pos_short_${variant.pos}`)
                    : ut.translate(`lex_common__pos_${variant.pos}`)
            );
        }
        if (variant.gender) {
            parts.push(
                short
                    ? ut.translate(`lex_common__gender_short_${variant.gender}`)
                    : ut.translate(`lex_common__gender_${variant.gender}`)
            );
        } else if (variant.aspect) {
            parts.push(
                short
                    ? ut.translate(`lex_common__aspect_short_${variant.aspect}`)
                    : ut.translate(`lex_common__aspect_${variant.aspect}`)
            );
        }
        return parts.join(' ');
    };

    // -------------------- <LexOverviewHeader /> -----------------------------------------------

    const LexOverviewHeader: React.FC<{
        tileId: number;
        source: string;
        selectedVariantIdx: number;
        selectedVariant: LexItem;
        variants: Array<LexItem>;
        queryMatches: Array<QueryMatch>;
    }> = (props) => {
        const handleVariantClick = (variantIdx: number) => {
            dispatcher.dispatch<typeof GlobalActions.UpdateQueryMatches>({
                name: GlobalActions.UpdateQueryMatches.name,
                payload: {
                    newQueryMatches: [
                        {
                            ...props.queryMatches[variantIdx],
                            isCurrent: true,
                        },
                    ],
                },
            });
        };

        const renderVariant = (
            i: number,
            variant: LexItem,
            withInfo: boolean,
            withPosInfo: boolean,
            clickHandler?: () => void
        ) => {
            return (
                <h4
                    key={i}
                    className={'variant' + (clickHandler ? '' : ' selected')}
                    onClick={clickHandler ? clickHandler : null}
                >
                    {clickHandler ? (
                        <a>
                            {variant.lemma}{' '}
                            {withInfo && variant.pos ? (
                                <span className="morphology">
                                    (
                                    {translateMorfology(
                                        variant,
                                        withPosInfo,
                                        true
                                    )}
                                    )
                                </span>
                            ) : null}
                        </a>
                    ) : (
                        <span>
                            {variant.lemma}{' '}
                            {withInfo && variant.pos ? (
                                <span className="morphology">
                                    (
                                    {translateMorfology(
                                        variant,
                                        withPosInfo,
                                        true
                                    )}
                                    )
                                </span>
                            ) : null}
                        </span>
                    )}
                </h4>
            );
        };

        const hasSameLemmaVariant = (variant: LexItem) => {
            return (
                List.findIndex(
                    (v, i) =>
                        v.lemma === variant.lemma &&
                        (v.pos !== variant.pos ||
                            v.gender !== variant.gender ||
                            v.aspect !== variant.aspect),
                    props.variants
                ) !== -1
            );
        };

        const hasSamePosVariant = (variant: LexItem) => {
            return (
                List.findIndex(
                    (v, i) =>
                        v.lemma === variant.lemma &&
                        v.pos === variant.pos &&
                        (v.gender !== variant.gender ||
                            v.aspect !== variant.aspect),
                    props.variants
                ) !== -1
            );
        };

        const itemWidth = List.size(props.variants) === 4 ? '35%' : undefined;
        return (
            <S.Header source={props.source} width={itemWidth}>
                <h2>{props.selectedVariant.lemma}</h2>
                {List.size(props.variants) > 1 ? (
                    <div className="variant-grid">
                        {List.map(
                            (variant, i) =>
                                renderVariant(
                                    i,
                                    variant,
                                    hasSameLemmaVariant(variant),
                                    !hasSamePosVariant(variant),
                                    i !== props.selectedVariantIdx
                                        ? () => handleVariantClick(i)
                                        : undefined
                                ),
                            props.variants
                        )}
                    </div>
                ) : null}
            </S.Header>
        );
    };

    // ------------------------- <PlayerIcon /> -------------------------------

    const PlayerIcon: React.FC<{
        tileId: number;
        audioLink: string;
        isPlaying: boolean;
    }> = (props) => {
        const handleClick = () => {
            dispatcher.dispatch(Actions.PlayAudio, {
                tileId: props.tileId,
                link: props.audioLink,
            });
        };

        return (
            <S.PlayerIcon
                $crStaticUrl={ut.createStaticUrl}
                onClick={handleClick}
                className={props.isPlaying ? 'animate' : ''}
            />
        );
    };

    // -------------------- <LexOverviewBasics /> -----------------------------------------------

    const LexOverviewBasics: React.FC<{
        tileId: number;
        source: Source;
        selectedVariant: LexItem;
        basicOverview: BasicOverviewData;
        playingAudio: boolean;
    }> = (props) => {
        return (
            <lexComponents.Subtile tileId={props.tileId} source={props.source}>
                {props.basicOverview.pronunciation ? (
                    <SubtileRow>
                        <span className="key">
                            {ut.translate(
                                'lex_overview__overview_pronunciation'
                            )}
                            :
                        </span>
                        <span className="value">
                            {props.basicOverview.pronunciation}
                            {props.basicOverview.audioLink ? (
                                <PlayerIcon
                                    tileId={props.tileId}
                                    audioLink={props.basicOverview.audioLink}
                                    isPlaying={props.playingAudio}
                                />
                            ) : null}
                        </span>
                    </SubtileRow>
                ) : null}
                <SubtileRow>
                    <span className="key">
                        {ut.translate('lex_overview__overview_part_of_speech')}:
                    </span>
                    <span className="value">
                        {translateMorfology(props.selectedVariant, true, false)}
                    </span>
                </SubtileRow>
            </lexComponents.Subtile>
        );
    };

    // -------------------- <LexOverviewOrigin /> -----------------------------------------------

    const LexOverviewOrigin: React.FC<{
        tileId: number;
        source: Source;
        origin: string;
    }> = (props) => {
        return (
            <lexComponents.Subtile tileId={props.tileId} source={props.source}>
                <SubtileRow>
                    <span className="key">
                        {ut.translate('lex_overview__origin')}:
                    </span>
                    <span className="value">{props.origin}</span>
                </SubtileRow>
            </lexComponents.Subtile>
        );
    };

    // -------------------- <LexOverviewTileView /> -----------------------------------------------

    const LexOverviewTileView: React.FC<CoreTileComponentProps> = (props) => {
        const state = useModel(model);

        const ijpHasForms = () => {
            if (isIjpData(state.sourceData.ijp)) {
                return (
                    !!state.sourceData.ijp.data.grammarCase ||
                    !!state.sourceData.ijp.data.conjugation ||
                    !!state.sourceData.ijp.data.comparison
                );
            }
            return false;
        };

        const basicOverview = {} as BasicOverviewData;
        const selectedQueryMatch =
            state.availQueryMatches[state.selectedVariantIdx];
        const selectedVariant = state.variants[state.selectedVariantIdx]
            ? state.variants[state.selectedVariantIdx]
            : ({
                  lemma: selectedQueryMatch.lemma,
                  pos: selectedQueryMatch.pos[0].value,
              } as LexItem);
        let asscVariant: VariantData;

        switch (state.mainSource) {
            case Source.ASSC:
                if (
                    isAsscData(state.sourceData.assc) &&
                    !List.empty(state.sourceData.assc.data)
                ) {
                    asscVariant = List.find(
                        (v) => v.key.startsWith(selectedVariant.lemma),
                        state.sourceData.assc.data[0].parsedVariants
                    );
                    // selected variant may not be in detailed data, for example "hranolky" is only mentioned in hranolka/hranolek
                    if (asscVariant !== undefined) {
                        basicOverview.pronunciation = asscVariant.pronunciation;
                        basicOverview.audioLink = asscVariant.audioFile;
                    } else {
                        console.warn(
                            `Selected variant ${selectedVariant.lemma} ${selectedVariant.pos} not found in ASSC data`
                        );
                    }
                }
                break;

            case Source.IJP:
                if (
                    isIjpData(state.sourceData.ijp) &&
                    state.sourceData.ijp.data
                ) {
                    basicOverview.pronunciation =
                        state.sourceData.ijp.data.pronunciation;
                }
                break;
        }

        return (
            <globalComponents.TileWrapper
                tileId={props.tileId}
                isBusy={state.isBusy}
                error={state.error}
                hasData={true} // this tile will always have some data
                supportsTileReload={props.supportsReloadOnError}
                isSubtileContainer={props.isSubtileContainer}
                issueReportingUrl={props.issueReportingUrl}
            >
                <S.LexOverviewTileView>
                    <LexOverviewHeader
                        tileId={props.tileId}
                        selectedVariantIdx={state.selectedVariantIdx}
                        selectedVariant={selectedVariant}
                        source={state.mainSource}
                        variants={state.variants}
                        queryMatches={state.availQueryMatches}
                    />
                    {pipe(
                        [state.sourceData.assc, state.sourceData.ijp],
                        List.filter((v) => isAsscError(v) || isIjpError(v)),
                        List.map((v, i) => (
                            <lexComponents.MessageSubtile
                                key={i}
                                systemMessageType={SystemMessageType.ERROR}
                            >
                                {ut.translate(getErrorMessage(v))}
                            </lexComponents.MessageSubtile>
                        ))
                    )}
                    {state.mainSource !== undefined ? (
                        <LexOverviewBasics
                            tileId={props.tileId}
                            source={state.mainSource}
                            selectedVariant={selectedVariant}
                            basicOverview={basicOverview}
                            playingAudio={state.playingAudio}
                        />
                    ) : null}
                    {isIjpData(state.sourceData.ijp) ? (
                        <ijpViews.Subtile
                            tileId={props.tileId}
                            data={state.sourceData.ijp.data}
                        />
                    ) : null}
                    {isAsscData(state.sourceData.assc) &&
                    !Dict.empty(
                        state.sourceData.assc.data[0].parsedVariants[0].forms
                    ) &&
                    !ijpHasForms() ? (
                        <asscViews.Subtile
                            tileId={props.tileId}
                            block={state.sourceData.assc.data[0]}
                        />
                    ) : null}
                    {selectedQueryMatch ? (
                        <corpusViews.Subtile
                            tileId={props.tileId}
                            corpname={state.referenceCorpus}
                            data={{
                                abs: selectedQueryMatch.abs,
                                ipm: selectedQueryMatch.ipm,
                            }}
                        />
                    ) : (
                        <corpusViews.Subtile
                            tileId={props.tileId}
                            corpname={state.referenceCorpus}
                        />
                    )}
                    {asscVariant && asscVariant.origin ? (
                        <LexOverviewOrigin
                            tileId={props.tileId}
                            source={Source.ASSC}
                            origin={asscVariant.origin}
                        />
                    ) : null}
                </S.LexOverviewTileView>
            </globalComponents.TileWrapper>
        );
    };

    return LexOverviewTileView;
}
