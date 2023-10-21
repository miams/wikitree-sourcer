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

import { simpleBuildCitationWrapper } from "../../../base/core/citation_builder.mjs";

function buildGbooksUrl(ed, builder) {
  // could provide option to use a search style URL but don't see any reason to so far
  return ed.url;
}

function buildSourceTitle(ed, gd, builder) {
  if (ed.title) {
    builder.sourceTitle += ed.title;
  } else if (ed.headTitle) {
    builder.sourceTitle += ed.headTitle;
  }
}

function buildSourceReference(ed, gd, builder) {
  let string = "";
  function addPart(part) {
    if (part) {
      if (string) {
        string += ", ";
      }
      string += part;
    }
  }
  addPart(ed.author);
  addPart(ed.date);
  addPart(ed.publisher);
  builder.sourceReference = string;
}

function buildRecordLink(ed, gd, builder) {
  var gbooksUrl = buildGbooksUrl(ed, builder);

  let recordLink = "[" + gbooksUrl + " Google Books]";
  builder.recordLinkOrTemplate = recordLink;
}

function buildCoreCitation(ed, gd, builder) {
  buildSourceTitle(ed, gd, builder);
  buildSourceReference(ed, gd, builder);
  buildRecordLink(ed, gd, builder);
  builder.addStandardDataString(gd);
}

function buildCitation(input) {
  return simpleBuildCitationWrapper(input, buildCoreCitation);
}

export { buildCitation };
