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

import { styled } from 'styled-components';
import { Theme } from '../../../page/theme.js';
import { LexTileBase } from '../lexCommon/style.js';

// ---------------- <MeaningTileView /> --------------------------------------

export const MeaningTileView = styled(LexTileBase)<{ theme: Theme }>`
    position: relative;
    height: 100%;
    width: 100%;

    .stretch {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;

        display: flex;
        flex-direction: column;

        .error-box {
        }

        .data-box {
            flex-grow: 1;
            overflow-y: hidden;

            .scroller {
                overflow-y: auto;
            }
        }
    }

    .ke-slovu {
        font-weight: 800;
        font-size: 11px;
    }

    min-height: 25em;
`;

export const UsageNotesTileView = styled(LexTileBase)``;

export const MeaningItem = styled.div`
    margin-bottom: 1em;

    // -------- parent meaning indentation --------

    &.parent {
        margin-left: 1em;
        border-left: 2px solid white;
        padding-left: 1em;
    }

    // -------- ASSC adjusted styles -------

    .tooltip-web {
        display: none;
    }
`;

export const MeaningHead = styled.div`
    margin-bottom: 25px;

    .semicolon {
        font-size: 11px;
    }

    // -------- ASSC adjusted styles -------

    .header-line {
        .mainVar {
            font-size: 15px !important;
        }

        .mainVarSign,
        .vyz_count {
            display: none;
        }

        > span {
            display: inline-block !important;
        }

        > span:first-child {
            margin: 0 3px 0 0 !important;
        }

        > span:not(:first-child):not(.semicolon) {
            margin: 0 0 0 3px !important;
        }

        // ---- [+] toggle for vyslovnost and druhyRadek.tvCh ----

        .vyslovnost,
        .druhyRadek .tvCh,
        .druhyRadek .tvChSl,
        .puvod {
            cursor: pointer;
        }

        .expand {
            display: none !important;
            cursor: pointer;
        }
    }

    .collapsed {
        .vyslovnost,
        .druhyRadek .tvCh,
        .druhyRadek .tvChSl,
        .puvod {
            display: none !important;
        }
        .expand {
            display: inline-block !important;
        }
    }
`;

// ---------------- <MeaningBody /> --------------------------------------

export const MeaningBody = styled.div`
    .meaning-block {
        margin-bottom: 16px;
    }

    .nest-line {
        .mainVar {
            font-size: 15px !important;
        }

        > span:not(:first-child),
        .mainVarSign {
            display: none !important;
        }
    }

    .links {
        .heslo {
            font-weight: 800 !important;
        }
    }

    // -------- ASSC adjusted styles -------

    // hide souslovi meanings and examples
    .style_souslovi {
        .varianta_h2_rel {
            font-weight: 400 !important;
        }

        .vyznam_wrapper_link,
        .vyznam_wrapper,
        .exeplifikace,
        .vskipExtraSmall {
            display: none !important;
        }
    }

    .korpus_odkaz, .ext_pozn_pripoj {
        display: none;
    }

    .vskipBig,
    .vskipMedium {
        display: none;
    }
`;

// ---------------- <ASSCStyle /> --------------------------------------

export const ASSCStyle = styled.div`
    .normal {
        font-weight: 400 !important;
    }
    .heslo .nepodtrzeny_odkaz .cerna {
        color: black;
    }
    .heslo {
        color: rgb(108, 116, 240);
        padding: 0;
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        font-family: Verdana;
    }
    .sousloviProp {
        color: rgb(108, 116, 240);
    }
    .vyznam_wrapper_link .souslovi {
        color: rgb(108, 116, 240);
        padding: 0;
        margin: 0;
        font-size: 15px;
        font-weight: 600;
    }
    .mainVar {
        color: rgb(108, 116, 240);
        font-size: 24px;
        font-weight: 700;
    }
    .mainVarSign {
        font-size: 24px;
        font-weight: normal;
    }
    h2,
    #uvod_page h2 {
        padding-top: 15px;
    }
    .vyslovnost {
        font-weight: 400;
        font-family: Charis-sil;
        font-size: 15px;
        display: block;
    }
    .vazebnost {
        font-weight: 400;
        font-size: 11px;
    }
    .vyznam_wrapper {
        font-size: 15px;
        font-weight: 800;
    }
    .vyznam_wrapper .heslo {
        color: rgb(108, 116, 240);
        font-weight: 800;
    }
    .vyznam_wrapper .souslovi {
        color: rgb(108, 116, 240);
        font-weight: 800;
    }
    .vyznam_wrapper_link {
        font-size: 15px;
        padding: 0 0 0 0;
        font-weight: 800;
    }
    .vyznam {
    }
    .vyznam a {
        color: #333333;
    }
    .podvyznam a {
        color: #333333;
    }
    .carka {
        font-family: Verdana;
    }

    .predvyklad_vyraz {
        font-style: italic;
    }
    .line {
        display: block;
        padding: 0 0 8px 0;
    }
    .lineNoSpace {
        display: block;
        padding: 0 0 0 0;
    }
    .smallLine {
        display: block;
        padding: 0 0 4px 0;
    }
    .small {
        font-size: 11px;
    }
    .podhesliOddeleni {
        font-size: 15px;
        font-weight: 400;
    }
    .vyznam .small {
        font-size: 11px;
        font-weight: 800;
    }
    .normalni {
        font-size: 15px;
    }
    .vskipCara {
        border-top-width: 4px; /*display: none; */
        background-color: rgba(0, 0, 0, 0);
        border-color: rgb(244, 244, 254);
        padding: 0 0 4px 0;
        margin: 0;
    }
    .vskipExtraSmall {
        border-top-width: 0px; /*display: none; */
        background-color: rgba(0, 0, 0, 0);
        border-color: rgba(0, 0, 0, 0);
        padding: 0 0 4px 0;
        margin: 0;
    }
    .vskipSmall {
        border-top-width: 0px; /*display: none; */
        background-color: rgba(0, 0, 0, 0);
        border-color: rgba(0, 0, 0, 0);
        padding: 0 0 8px 0;
        margin: 0;
    }
    .vskipSmallS {
        border-top-width: 0px; /*display: none; */
        background-color: rgba(0, 0, 0, 0);
        border-color: rgba(0, 0, 0, 0);
        padding: 0 0 8px 0;
        margin: 0;
    }
    .vskipMedium {
        border-top-width: 0px; /*display: none; */
        background-color: rgba(0, 0, 0, 0);
        border-color: rgba(0, 0, 0, 0);
        padding: 0 0 16px 0;
        margin: 0;
    }
    .vskipBig {
        border-top-width: 0px; /*display: none; */
        background-color: rgba(0, 0, 0, 0);
        border-color: rgba(0, 0, 0, 0);
        padding: 0 0 24px 0;
        margin: 0;
    }
    .nepodtrzeny_odkaz {
        color: black;
        font-weight: normal;
    }
    .nepodtrzeny_odkaz .heslo {
        color: black;
        font-weight: normal;
    }
    .varianta-tvarCharSl,
    .varianta-tvarChar {
        font-size: 11px;
    }
    .tvCh {
        font-size: 15px;
        font-weight: 400;
    }
    .vyznam_wrapper .tvChBlock {
        font-size: 15px;
        font-weight: 400;
    }
    .tvChSl {
        font-size: 15px;
        font-weight: 400;
    }
    .tvCh-typ {
        font-size: 11px;
    }
    .gramInfo {
        font-size: 11px;
        font-weight: 400;
    }
    .podhesli_komentar {
        font-size: 11px;
        font-weight: 400;
    }
    .oborUziti {
        font-size: 11px;
        font-weight: 400;
    }
    .varianta_h1_rel {
        color: rgb(108, 116, 240);
        font-size: 24px;
        font-weight: 900;
        font-family: Verdana;
    }
    .varianta_h2_rel {
        color: rgb(108, 116, 240);
        font-size: 15px;
        font-weight: 800;
        font-family: Verdana;
    }
    .synonymum-wrapper {
        font-size: 15px;
        font-weight: 400;
    }
    .antonymum-wrapper {
        font-size: 15px;
        font-weight: 400;
    }
    .ext_pozn_label {
        font-weight: 800;
    }
    .ext_pozn_pripoj {
        font-size: 11px;
    }
    .ext_pozn_wrapper {
        background-color: rgb(244, 244, 254);
    }
    .puvod {
        display: block;
        font-size: 11px;
        padding: 0 0 0 0;
    }
    .sl_druh {
        font-size: 11px;
        font-weight: 400;
    }
    .exeplifikace {
        font-size: 15px;
        padding: 0px 0 0 0;
    }
    .stylKval {
        font-size: 11px;
        font-weight: 400;
    }
    .synonymum-label {
        font-size: 11px;
    }
    .antonymum-label {
        font-size: 11px;
    }
    .predvyklad_wrap {
        font-size: 11px;
    }
    .varianta-label {
        font-size: 11px;
    }
    .komentar {
        font-size: 11px;
        font-family: Verdana;
    }
    .stylKvalPred {
        font-size: 11px;
        font-weight: 400;
        color: black;
    }
    .komentar_tvarchar {
        font-size: 11px;
        font-weight: 400;
    }
    .gramInfoUpres {
        font-size: 11px;
    }
    .varianta-tvarChar-koncovka-komentar {
        font-size: 11px;
    }
    .cislaOdkazu {
        font-size: 15px;
    }
    .druhyRadek {
        margin: 0 0 0 0;
        display: block;
    }
    .konec_zahlavi {
        font-size: 11px;
    }
    .metavyklad {
        font-size: 11px;
    }
    .metavyklad2 {
        font-size: 11px;
    }
`;
