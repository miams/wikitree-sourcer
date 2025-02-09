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

import { setupSimplePopupMenu } from "/base/browser/popup/popup_simple_base.mjs";
import { initPopup } from "/base/browser/popup/popup_init.mjs";
import { generalizeData, regeneralizeData, getRequestedUserInput } from "../core/psuk_generalize_data.mjs";
import { buildCitation } from "../core/psuk_build_citation.mjs";

async function setupPsukPopupMenu(extractedData) {
  let input = {
    extractedData: extractedData,
    extractFailedMessage:
      "It looks like a Probate Search page but there are no digital search results and no document selected.",
    generalizeFailedMessage:
      "It looks like a Probate Search/Find A Will (UK) page but does not contain the required data.",
    generalizeDataFunction: generalizeData,
    regeneralizeFunction: regeneralizeData,
    buildCitationFunction: buildCitation,
    siteNameToExcludeFromSearch: "psuk",
  };

  if (extractedData.isImage) {
    input.userInputFunction = getRequestedUserInput;
  }

  setupSimplePopupMenu(input);
}

initPopup("psuk", setupPsukPopupMenu);
