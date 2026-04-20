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

import { IActionDispatcher, ViewUtils } from 'kombo';
import * as React from 'react';
import { GlobalComponents } from '../../../../../views/common/index.js';
import { init as commonViewInit } from './common.js';
import * as S from '../style.js';
import { calcFreqBand } from '../../../../../query/index.js';

export function init(
    dispatcher: IActionDispatcher,
    ut: ViewUtils<GlobalComponents>
): {
    Subtile: React.FC<{
        source: string;
        data?: {
            abs: number;
            ipm: number;
        };
        color?: string;
    }>;
} {
    const commonViews = commonViewInit(dispatcher, ut);
    const defaultColor = '#fae9da';

    // -------------------- <SrchWordInfo /> ---------------------------------------------------

    const SrchWordInfo: React.FC<{
        source: string;
        data?: {
            abs: number;
            ipm: number;
        };
        color?: string;
    }> = (props) => (
        <S.Subtile color={props.color || defaultColor}>
            {props.data ? (
                props.data.abs > 0 ? (
                    <p className="content">
                        <span className="key">
                            {ut.translate('wordfreq__freq_bands')}:
                        </span>
                        <span
                            className="value"
                            style={{
                                display: 'inline-block',
                                fontSize: '1.2em',
                            }}
                        >
                            <commonViews.Stars
                                freqBand={calcFreqBand(props.data.ipm)}
                            />
                        </span>
                        <br />
                        <span className="key">
                            {ut.translate('wordfreq__ipm')}:
                        </span>
                        <span className="value">
                            {ut.formatNumber(props.data.ipm, 2)}
                        </span>
                    </p>
                ) : (
                    <p className="content">
                        <span className="key">
                            {ut.translate('wordfreq__note')}:
                        </span>
                        <span className="value">
                            {ut.translate(
                                'wordfreq__word_known_but_nothing_more'
                            )}
                        </span>
                    </p>
                )
            ) : (
                <p className="content">
                    <span className="key">
                        {ut.translate('wordfreq__note')}:
                    </span>
                    <span className="value">
                        {ut.translate('wordfreq__not_in_dict')}
                    </span>
                </p>
            )}

            <div className="content footer">
                <span className="key">Zdroj:</span>
                <span className="value">{props.source}</span>
            </div>
        </S.Subtile>
    );

    return {
        Subtile: SrchWordInfo,
    };
}
