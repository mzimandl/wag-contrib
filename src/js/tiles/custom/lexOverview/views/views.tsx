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
import { List, pipe } from 'cnc-tskit';
import { initLexComponents } from '../../lexCommon/views.js';
import { LexItem, LexKey } from '../../lexCommon/types/dictionary.js';
import { SubtileRow } from '../../lexCommon/style.js';
import { Plurality, Source } from '../../lexCommon/types/enums.js';
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
        lexKey: LexKey,
        withPosInfo: boolean,
        short: boolean
    ) => {
        const parts = [];
        if (withPosInfo) {
            parts.push(
                short
                    ? ut.translate(`lex_common__pos_short_${lexKey.pos}`)
                    : ut.translate(`lex_common__pos_${lexKey.pos}`)
            );
        }
        if (lexKey.gender) {
            parts.push(
                short
                    ? ut.translate(`lex_common__gender_short_${lexKey.gender}`)
                    : ut.translate(`lex_common__gender_${lexKey.gender}`)
            );
        } else if (lexKey.aspect) {
            parts.push(
                short
                    ? ut.translate(`lex_common__aspect_short_${lexKey.aspect}`)
                    : ut.translate(`lex_common__aspect_${lexKey.aspect}`)
            );
        }
        return parts.join(' ');
    };

    const translatePlurality = (lexKey: LexKey, short: boolean) => {
        switch (lexKey.plurality) {
            case Plurality.PLURAL:
                return ut.translate(
                    `lex_common__plurality${short ? '_short' : ''}_plural`
                );
            case Plurality.ALWAYS:
                return ut.translate(
                    `lex_common__plurality${short ? '_short' : ''}_always`
                );
            case Plurality.USUALLY:
                return ut.translate(
                    `lex_common__plurality${short ? '_short' : ''}_usually`
                );
            case Plurality.ONLY:
                return ut.translate(
                    `lex_common__plurality${short ? '_short' : ''}_only`
                );
            default:
                return '';
        }
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
            key: number,
            lexKey: LexKey,
            withInfo: boolean,
            withPosInfo: boolean,
            clickHandler?: () => void
        ) => {
            const info = [];
            if (withInfo) {
                info.push(translateMorfology(lexKey, withPosInfo, true));
            }
            if (lexKey.uninflected) {
                info.push(ut.translate('lex_common__uninflected_short'));
            }
            return (
                <h4
                    key={key}
                    className={'variant' + (clickHandler ? '' : ' selected')}
                    onClick={clickHandler ? clickHandler : null}
                >
                    {lexKey.plurality !== Plurality.NONE ? (
                        <span className="plurality">
                            {translatePlurality(lexKey, true)}{' '}
                        </span>
                    ) : null}
                    {clickHandler ? (
                        <a>
                            {lexKey.lemma}
                            {!List.empty(info) ? (
                                <span className="morphology">
                                    {' '}
                                    ({info.join(' ')})
                                </span>
                            ) : null}
                        </a>
                    ) : (
                        <span>
                            {lexKey.lemma}
                            {!List.empty(info) ? (
                                <span className="morphology">
                                    {' '}
                                    ({info.join(' ')})
                                </span>
                            ) : null}
                        </span>
                    )}
                </h4>
            );
        };

        const hasSameLemmaVariant = (key: LexKey) => {
            return (
                List.findIndex(
                    (v, i) =>
                        v.key.lemma === key.lemma &&
                        (v.key.pos !== key.pos ||
                            v.key.gender !== key.gender ||
                            v.key.aspect !== key.aspect),
                    props.variants
                ) !== -1
            );
        };

        const hasSamePosVariant = (key: LexKey) => {
            return (
                List.findIndex(
                    (v, i) =>
                        v.key.lemma === key.lemma &&
                        v.key.pos === key.pos &&
                        (v.key.gender !== key.gender ||
                            v.key.aspect !== key.aspect),
                    props.variants
                ) !== -1
            );
        };

        const itemWidth = List.size(props.variants) === 4 ? '35%' : undefined;
        return (
            <S.Header source={props.source} width={itemWidth}>
                <h2>{props.selectedVariant.key.lemma}</h2>
                {List.size(props.variants) > 1 ||
                props.variants[0].key.plurality > 0 ? (
                    <div className="variant-grid">
                        {pipe(
                            props.variants,
                            List.map((variant, i) =>
                                renderVariant(
                                    i,
                                    variant.key,
                                    hasSameLemmaVariant(variant.key),
                                    !hasSamePosVariant(variant.key),
                                    i !== props.selectedVariantIdx
                                        ? () => handleVariantClick(i)
                                        : undefined
                                )
                            )
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
                        {translateMorfology(
                            props.selectedVariant.key,
                            true,
                            false
                        )}
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
                  key: {
                      lemma: selectedQueryMatch.lemma,
                      pos: selectedQueryMatch.pos[0].value,
                  },
              } as LexItem);
        let asscVariantData: VariantData;

        switch (state.mainSource) {
            case Source.ASSC:
                if (
                    isAsscData(state.sourceData.assc) &&
                    !List.empty(state.sourceData.assc.data)
                ) {
                    asscVariantData =
                        state.sourceData.assc.data[
                            selectedVariant.sources['assc'][0].groupOrder
                        ];
                    // selected variant may not be in detailed data, for example "hranolky" is only mentioned in hranolka/hranolek
                    if (asscVariantData !== undefined) {
                        basicOverview.pronunciation =
                            asscVariantData.pronunciation;
                        basicOverview.audioLink = asscVariantData.audioFile;
                    } else {
                        console.warn(
                            `Selected variant ${selectedVariant.key.lemma} ${selectedVariant.key.pos} not found in ASSC data`
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
                                {List.map(
                                    (msg) => ut.translate(msg),
                                    getErrorMessage(v)
                                )}
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
                    {asscVariantData &&
                    !List.empty(asscVariantData.forms) &&
                    !ijpHasForms() ? (
                        <asscViews.Subtile
                            tileId={props.tileId}
                            variant={asscVariantData}
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
                    {asscVariantData && asscVariantData.origin ? (
                        <LexOverviewOrigin
                            tileId={props.tileId}
                            source={Source.ASSC}
                            origin={asscVariantData.origin}
                        />
                    ) : null}
                </S.LexOverviewTileView>
            </globalComponents.TileWrapper>
        );
    };

    return LexOverviewTileView;
}
