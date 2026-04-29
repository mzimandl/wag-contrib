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

export interface VariantData {
    id: string;
    key: string;
    homonym: string;
    pronunciation: string;
    audioFile: string;
    quality: string;
    forms: { [key: string]: string };
    pos: string;
}

export interface MeaningData {
    explanation: string;
    metaExplanation: string;
    attachement: string;
    synonyms: Array<string>;
    examples: Array<{
        usage: string;
        data: Array<string>;
    }>;
    collocations: Array<{
        collocation: string;
        explanation: string;
        examples: Array<string>;
    }>;
}

export interface PhrasemeData {
    phraseme: string;
    explanation: string;
    examples: Array<string>;
}

export interface DataItem {
    variants: Array<VariantData>;
    meanings: Array<MeaningData>;
    phrasemes: Array<PhrasemeData>;
}

export interface HTMLBlock {
    variants: Array<VariantData>;
    meanings: Array<string>;
    notes: Array<string>;
}
