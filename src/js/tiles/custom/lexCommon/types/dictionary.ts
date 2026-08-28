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

import { QueryMatch } from '../../../../query/index.js';
import { Aspect, Gender, PoS, Plurality, Source } from './enums.js';

export interface LexID {
    id: string;
    parentId?: string;
    groupOrder: number;
    homonym: number;
    pos: string;
}

export interface LexKey {
    lemma: string;
    pos: PoS;
    gender?: Gender;
    aspect?: Aspect;
    uninflected: boolean;
    plurality: Plurality;
}

export interface LexItem {
    key: LexKey;
    posSource: Source;
    sources: { [source: string]: Array<LexID> };
}

export interface LexExtraData {
    corpusId: string;
    variantSource: Source;
    variant: LexItem;
}

export function isLexQueryMatch(
    qm: QueryMatch<any>
): qm is QueryMatch<LexExtraData> {
    return (
        qm.extraData !== undefined &&
        typeof qm.extraData['corpusId'] === 'string' &&
        typeof qm.extraData['variantSource'] === 'string' &&
        typeof qm.extraData['variant'] === 'object'
    );
}

export function getCurrentVariant(currQueryMatch: QueryMatch): LexItem {
    return isLexQueryMatch(currQueryMatch) && currQueryMatch.extraData
        ? currQueryMatch.extraData.variant
        : null;
}
