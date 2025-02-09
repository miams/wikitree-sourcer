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

function extractData(document, url) {
  var result = {};

  if (url) {
    result.url = url;
  }
  result.success = false;

  const itemTitleSpan = document.querySelector("h1.item-title > span");
  if (itemTitleSpan) {
    result.title = itemTitleSpan.textContent;
  }

  result.metadata = {};
  const metaDataElements = document.querySelectorAll("dl.metadata-definition");
  for (let metaDataElement of metaDataElements) {
    let dtElement = metaDataElement.querySelector("dt");
    let ddElement = metaDataElement.querySelector("dd");
    if (dtElement && ddElement) {
      let label = dtElement.textContent;
      let value = ddElement.textContent;
      if (label && value) {
        label = label.trim();
        value = value.trim();
        result.metadata[label] = value;
      }
    }
  }

  const pageFooterSpan = document.querySelector("span.BRcurrentpage");
  if (pageFooterSpan) {
    let pageXOfY = pageFooterSpan.textContent;
    if (pageXOfY) {
      pageXOfY = pageXOfY.trim();
      result.pageXOfY = pageXOfY;
    }
  }

  result.success = true;

  //console.log(result);

  return result;
}

export { extractData };
