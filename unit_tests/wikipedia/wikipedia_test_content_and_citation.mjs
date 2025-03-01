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

import { extractData } from "../../extension/site/wikipedia/core/wikipedia_extract_data.mjs";
import { generalizeData } from "../../extension/site/wikipedia/core/wikipedia_generalize_data.mjs";
import { buildCitation } from "../../extension/site/wikipedia/core/wikipedia_build_citation.mjs";

import { runExtractDataTests } from "../test_utils/test_extract_data_utils.mjs";
import { runGeneralizeDataTests } from "../test_utils/test_generalize_data_utils.mjs";
import { runBuildCitationTests } from "../test_utils/test_build_citation_utils.mjs";

const regressionData = [
  {
    caseName: "hms_warspite_1884",
    url: "https://en.wikipedia.org/wiki/HMS_Warspite_(1884)",
  },
  {
    caseName: "world_war_i",
    url: "https://en.wikipedia.org/wiki/World_War_I",
    optionVariants: [
      {
        variantName: "linkPermalink",
        optionOverrides: {
          citation_wikipedia_citationLinkType: "permalink",
        },
      },
      {
        variantName: "linkExternal",
        optionOverrides: {
          citation_wikipedia_citationLinkType: "external",
        },
      },
      {
        variantName: "linkSpecial",
        optionOverrides: {
          citation_wikipedia_citationLinkType: "special",
        },
      },
      {
        variantName: "linkPlainPermalink",
        optionOverrides: {
          citation_wikipedia_citationLinkType: "plainPermalink",
        },
      },
      {
        variantName: "linkPlainSimple",
        optionOverrides: {
          citation_wikipedia_citationLinkType: "plainSimple",
        },
      },
      {
        variantName: "linkLocationTitle",
        optionOverrides: {
          citation_wikipedia_citationLinkLocation: "title",
        },
      },
      {
        variantName: "linkLocationReference",
        optionOverrides: {
          citation_wikipedia_citationLinkLocation: "reference",
        },
      },
      {
        variantName: "linkLocationAfterW",
        optionOverrides: {
          citation_wikipedia_citationLinkLocation: "afterWikipedia",
        },
      },
      {
        variantName: "linkLocationAfterWE",
        optionOverrides: {
          citation_wikipedia_citationLinkLocation: "afterWikipediaEntry",
        },
      },
    ],
  },
];

async function runTests(testManager) {
  await runExtractDataTests("wikipedia", extractData, regressionData, testManager);

  await runGeneralizeDataTests("wikipedia", generalizeData, regressionData, testManager);

  const functions = { buildCitation: buildCitation };
  await runBuildCitationTests("wikipedia", functions, regressionData, testManager);
}

export { runTests };
