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

export interface NumberData {
    singular: string;
    plural: string;
}

export interface CaseData {
    nominative: NumberData;
    genitive: NumberData;
    dative: NumberData;
    accusative: NumberData;
    vocative: NumberData;
    locative: NumberData;
    instrumental: NumberData;
}

export interface ComparisonData {
    comparative: string;
    superlative: string;
}

export interface PersonData {
    first: NumberData;
    second: NumberData;
    third: NumberData;
}

export interface ParticipleData {
    active: string;
    passive: string;
}

export interface TransgressiveRow {
    m: NumberData;
    zs: NumberData;
}

export interface TransgressiveData {
    past: TransgressiveRow;
    present: TransgressiveRow;
}

export interface ConjugationData {
    person: PersonData;
    imperative: NumberData;
    participle: ParticipleData;
    transgressive: TransgressiveData;
    verbalNoun: string;
}

export interface Alternative {
    id: string;
    info: string;
}

export interface IJPData {
    scripts: Array<string>;
    cssLinks: Array<string>;
    heading: string;
    pronunciation: string;
    meaning: string;
    syllabification: string;
    gender: string;
    grammarCase: CaseData;
    comparison: ComparisonData;
    conjugation: ConjugationData;
    examples: Array<string>;
    notes: string;
    alternatives: Array<Alternative>;
    isDirect: boolean;
}

export function mkEmptyNumber(): NumberData {
    return {
        singular: '',
        plural: '',
    };
}

export function mkEmptyData(): IJPData {
    return {
        scripts: [],
        cssLinks: [],
        heading: '',
        pronunciation: '',
        meaning: '',
        syllabification: '',
        gender: '',
        grammarCase: {
            nominative: mkEmptyNumber(),
            genitive: mkEmptyNumber(),
            dative: mkEmptyNumber(),
            accusative: mkEmptyNumber(),
            vocative: mkEmptyNumber(),
            locative: mkEmptyNumber(),
            instrumental: mkEmptyNumber(),
        },
        comparison: {
            comparative: '',
            superlative: '',
        },
        conjugation: {
            imperative: mkEmptyNumber(),
            participle: {
                active: '',
                passive: '',
            },
            verbalNoun: '',
            person: {
                first: mkEmptyNumber(),
                second: mkEmptyNumber(),
                third: mkEmptyNumber(),
            },
            transgressive: {
                past: {
                    m: mkEmptyNumber(),
                    zs: mkEmptyNumber(),
                },
                present: {
                    m: mkEmptyNumber(),
                    zs: mkEmptyNumber(),
                },
            },
        },
        notes: '',
        examples: [],
        alternatives: [],
        isDirect: false,
    };
}
