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

export interface FormStruct {
    key: string;
    values: Array<FormStructValue>;
}

export interface FormStructValue {
    comment: string;
    value: string;
}

export interface VariantData {
    id: string;
    key: string;
    homonym: string;
    pronunciation: string;
    audioFile: string;
    quality: string;
    forms: Array<FormStruct>;
    pos: string;
    origin: string;
}

export interface HTMLBlock {
    formattedVariants: Array<string>;
    nestedVariants: Array<string>;
    meanings: Array<string>;
    links: Array<string>;
    notes: Array<string>;
}
