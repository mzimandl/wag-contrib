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

import { QueryMatch } from '../../../query/index.js';

export enum Source {
    ASSC = 'assc',
    IJP = 'ijp',
    SSJC = 'ssjc',
    SJC = 'sjc',
}

export enum PoS {
    ADJ = 'A',
    ABB = 'B',
    NUM = 'C',
    ADV = 'D',
    FORE = 'F',
    INTER = 'I',
    CONJ = 'J',
    NOUN = 'N',
    PRON = 'P',
    PREP = 'R',
    SEGM = 'S',
    PART = 'T',
    VERB = 'V',
    UNKN = 'X',
    PUNC = 'Z',
}

export enum Gender {
    MASCULINE_ANIM = 'M',
    MASCULINE_INAN = 'I',
    FEMININE = 'F',
    NEUTER = 'N',
}

export enum Aspect {
    PERF = 'P',
    IMPERF = 'I',
    BOTH = 'B',
}

interface LexID {
    id: string;
    parentId?: string;
}

export interface LexItem {
    lemma: string;
    pos: PoS;
    gender?: Gender;
    aspect?: Aspect;

    sources: { [source: string]: Array<LexID> };
    corpusEntry?: QueryMatch<undefined>;
}

export function isLexQueryMatch(
    qm: QueryMatch<any>
): qm is QueryMatch<Array<LexItem>> {
    return qm.extraData !== undefined && Array.isArray(qm.extraData);
}
