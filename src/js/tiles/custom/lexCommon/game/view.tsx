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

import { ViewUtils, useModel } from 'kombo';
import * as React from 'react';
import {
    CoreTileComponentProps,
    TileComponent,
} from '../../../../page/tile.js';
import { GlobalComponents } from '../../../../views/common/index.js';
import { LexCommonModel } from '../model.js';
import * as S from './styles.js';

export function init(
    ut: ViewUtils<GlobalComponents>,
    model: LexCommonModel
): TileComponent {
    const globalComponents = ut.getComponents();

    // -------------------- <SlovoskopGame /> -------------------------------------------

    const SlovoskopGame: React.FC = () => {
        const canvasRef = React.useRef<HTMLCanvasElement>(null);

        // canvas is touched only on the client side (useEffect does not run during SSR)
        React.useEffect(() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!ctx) {
                return;
            }
            const dpr = window.devicePixelRatio || 1;
            const { width, height } = canvas.getBoundingClientRect();
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.scale(dpr, dpr);

            ctx.fillStyle = '#ffffff';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Slovoskop', width / 2, height / 2);
        }, []);

        return <S.GameCanvas ref={canvasRef} />;
    };

    // -------------------- <LexCommonTileView /> ---------------------------------------

    const LexCommonTileView: React.FC<CoreTileComponentProps> = (props) => {
        const state = useModel(model);

        if (!state.easterEgg) {
            return null;
        }

        return (
            <globalComponents.TileWrapper
                tileId={props.tileId}
                isBusy={false}
                hasData={true}
                supportsTileReload={props.supportsReloadOnError}
                isSubtileContainer={props.isSubtileContainer}
                issueReportingUrl={props.issueReportingUrl}
            >
                <SlovoskopGame />
            </globalComponents.TileWrapper>
        );
    };

    return LexCommonTileView;
}
