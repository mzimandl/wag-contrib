/*
 * Copyright 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright 2021 Institute of the Czech National Corpus,
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

import { IActionDispatcher, BoundWithProps, ViewUtils } from 'kombo';
import * as React from 'react';
import { Dict, List, pipe, tuple } from 'cnc-tskit';
import { Theme } from '../../../page/theme';
import { CoreTileComponentProps, TileComponent } from '../../../page/tile';
import { GlobalComponents } from '../../../views/global';
import { HexModel, HexModelState } from './model';
import { ScatterChart, CartesianGrid, XAxis, YAxis, Legend, Scatter, Tooltip } from 'recharts';
import { ChartData, Data, transformDataForCharts } from './common';


export function init(dispatcher:IActionDispatcher, ut:ViewUtils<GlobalComponents>, theme:Theme, model:HexModel):TileComponent {

    const globalComponents = ut.getComponents();

    const Chart:React.FC<{
        data:ChartData;
        isMobile:boolean;
        widthFract:number;
        word:string;

    }> = (props) => {

        const range = pipe(
            props.data,
            List.foldl(
                ([accMin, accMax], curr) => tuple(Math.min(accMin, curr.x), Math.max(accMax, curr.x)),
                tuple(List.head(props.data).x, List.head(props.data).x)
            )
        );

        return (
            <globalComponents.ResponsiveWrapper minWidth={props.isMobile ? undefined : 250}
                                        widthFract={props.widthFract} render={(width:number, height:number) => (
                <ScatterChart width={Math.max(100, width)} height={Math.max(350, height)} margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" name="year" type="number" unit="" domain={range} />
                    <YAxis dataKey="y" name="count" unit="" type="number" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Legend />
                    <Scatter name={props.word} data={props.data} fill={theme.categoryColor(0)} />
                </ScatterChart>)} />
        );
    };


    const Table:React.FC<{
        data:Data;
    }> = (props) => (
        <div style={{maxHeight: '20em', overflowY: 'auto'}}>
            <h2>nalezeno: {props.data.count}</h2>
            <table>
                <tbody>
                {pipe(
                    props.data.table,
                    List.slice(0, 100),
                    List.map((item, i) => (
                        <tr key={`item:${i}:${item.bookId}`}>
                            <td>{item.author}</td>
                            <td>{item.poemName}</td>
                            <td>{item.year}</td>
                            <td>{item.af}</td>
                            <td>{item.rf}</td>
                            <td>{item.phi}</td>
                        </tr>
                    ))
                )}
                </tbody>
            </table>
        </div>
    );

    // -------------------- <HexTileView /> -----------------------------------------------

    const HexTileView:React.FC<HexModelState & CoreTileComponentProps> = (props) => (
        <globalComponents.TileWrapper tileId={props.tileId} isBusy={props.isBusy} error={props.error}
                hasData={props.data.count > 0}
                supportsTileReload={props.supportsReloadOnError}
                issueReportingUrl={props.issueReportingUrl}>
            <div className="GunstickTileView">
                {props.isAltViewMode ?
                    <Table data={props.data} /> :
                    <Chart data={transformDataForCharts(props.data)}
                            isMobile={props.isMobile}
                            widthFract={props.widthFract}
                            word={props.word} />
                }
            </div>
        </globalComponents.TileWrapper>
    );

    return BoundWithProps(HexTileView, model);
}
