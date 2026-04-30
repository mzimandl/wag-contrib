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

import { Theme } from '../../../page/theme.js';
import { styled } from 'styled-components';

// ---------------- <SSJCEntry /> --------------------------------------

export const SSJCEntry = styled.li`
    /* OdstavcovĂ© elementy */
    div {
        font-family: 'Times New Roman', serif;
        margin-bottom: 0pt;
        text-align: justify;
        margin-top: 0px;
    }
    /* .entry {margin-top: 24px; margin-bottom: 12px; width: 325px;} */
    .entry {
        margin-top: 24px;
        margin-bottom: 12px;
    }

    /* ÄŤĂˇsti heslovĂ© stati */
    /* zĂˇkladnĂ­ formĂˇtovĂˇnĂ­ jednotlivĂ˝ch ÄŤĂˇstĂ­ (tlouĹˇĹĄka, velikost a kurzĂ­va) */
    .bo {
        font-weight: bold;
    }
    .it {
        font-style: italic;
    }
    .np {
        font-size: 80%;
    }

    .hw,
    .phrasem,
    .xref,
    .colloc,
    .hom,
    .construction {
        font-weight: bold;
    }
    .hw,
    .delim,
    .hom {
        font-family: 'Arial', sans-serif;
        font-size: 80%;
    }
    .snserif {
        font-weight: normal !important;
    }
    .source,
    .val,
    .lang,
    .qual {
        font-size: 80%;
    }
    .def {
        font-style: italic;
    }
    .restored {
        color: #c0c0c0;
    }

    /* odliĹˇenĂ­ dĂ­lÄŤĂ­ch ÄŤĂˇstĂ­ heslovĂ© stati */
    .xref {
        color: #333333;
    }
`;

// ---------------- <PSJCEntry /> --------------------------------------

export const PSJCEntry = styled.li`
    .e {
        font-size: 12pt;
        width: 320px;
        text-align: justify;
        font-family: 'Times New Roman', Times, serif;
    }
    .hw {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 90%;
        font-weight: bold;
    }
    .n {
        font-family: 'Times New Roman', Times, serif;
        font-size: 100%;
    }
    .i,
    .see {
        font-style: italic;
    }
    .submitlink {
        font-style: italic;
        text-decoration: underline;
        background-color: transparent;
        border: 0;
        cursor: pointer;
        margin: 0;
        padding: 0;
    }
    .npi {
        font-size: 80%;
        font-style: italic;
    }
    .np {
        font-size: 80%;
    }
    .sep,
    .delim {
        font-size: 90%;
        background-color: #808080;
        color: #ffffff;
        font-weight: bold;
    }
    .b {
        font-weight: bold;
    }
    .pron {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 90%;
    }
    .isup {
        font-style: italic;
        vertical-align: super;
        font-size: 70%;
    }
    .isub {
        font-style: italic;
        vertical-align: sub;
        font-size: 70%;
    }
    .sup {
        vertical-align: super;
        font-size: 70%;
    }
    .sub {
        vertical-align: sub;
        font-size: 70%;
    }
    .none {
        font-style: inherit;
    }
    .autor {
        font-size: 100%;
        font-style: italic;
        font-family: 'Times New Roman', serif;
    }
    .nazev {
        font-size: 150%;
        font-weight: bold;
    }
`;

// ---------------- <Tabs /> --------------------------------------

export const Tabs = styled.div`
    .separator {
        margin: 0 5px;
        font-size: 1.5em;
        color: ${(props) => props.theme.colorLogoBlue};
    }
`;

// ---------------- <TabButton /> --------------------------------------

export const TabButton = styled.span<{ theme: Theme }>`
    color: ${(props) => props.theme.colorDefaultText};

    span.item {
        margin: 0 5px;
        padding: 0 3px;
    }

    span.item.disabled {
        color: ${(props) => props.theme.colorLightText};
        opacity: 0.5;
        cursor: default;
    }

    span.item a {
        text-decoration: none;
        color: ${(props) => props.theme.colorDefaultText};
    }

    span.item a:hover {
        cursor: pointer;
        color: ${(props) => props.theme.colorLogoBlue};
    }

    span.item.current {
        border-bottom: 2px solid ${(props) => props.theme.colorLogoBlue};
    }
`;

// ---------------- <LexDictionariesTileView /> --------------------------------------

export const LexDictionariesTileView = styled.div``;
