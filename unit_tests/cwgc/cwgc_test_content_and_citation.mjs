/*
MIT License

Copyright (c) 2020 Robert M Pavey

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { extractData } from "../../extension/site/cwgc/core/cwgc_extract_data.mjs";
import { generalizeData } from "../../extension/site/cwgc/core/cwgc_generalize_data.mjs";
import { buildCitation } from "../../extension/site/cwgc/core/cwgc_build_citation.mjs";

import { runExtractDataTests } from "../test_utils/test_extract_data_utils.mjs";
import { runGeneralizeDataTests } from "../test_utils/test_generalize_data_utils.mjs";
import { runBuildCitationTests } from "../test_utils/test_build_citation_utils.mjs";

const regressionData = [
  {
    // Only first initial
    caseName: "Private G Peffers _ War Casualty Details 416346 _ CWGC",
    url: "https://www.cwgc.org/find-records/find-war-dead/casualty-details/416346/g-peffers/",
  },
  {
    // Only first initial
    caseName: "Wireman Austin James Palmer _ War Casualty Details 2658315 _ CWGC",
    url: "https://www.cwgc.org/find-records/find-war-dead/casualty-details/2658315/austin-james-palmer/",
  },
];

async function runTests(testManager) {
  await runExtractDataTests("cwgc", extractData, regressionData, testManager);

  await runGeneralizeDataTests("cwgc", generalizeData, regressionData, testManager);

  await runBuildCitationTests("cwgc", buildCitation, undefined, regressionData, testManager);
}

export { runTests };
