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

  let article = document.querySelector("article");
  if (!article) {
    return result;
  }

  let breadcrumbs = document.querySelectorAll("div.breadcrumbs li");
  if (breadcrumbs) {
    result.breadcrumbs = [];
    for (let breadcrumb of breadcrumbs) {
      let value = breadcrumb.textContent.trim();
      result.breadcrumbs.push(value);
    }
  }

  let h4Element = article.querySelector("div.data-view > div.info > div > h4");
  if (h4Element) {
    let heading = h4Element.textContent;
    if (heading) {
      heading = heading.replace(/\s+/g, " ");
      result.collectionHeading = heading.trim();
    }
  }

  let headingElement = article.querySelector("div.data-view > div.info > div.heading > h1");
  if (headingElement) {
    let heading = headingElement.textContent;
    if (heading) {
      result.heading = heading.trim();
    }
  }

  function cleanLabel(label) {
    if (label) {
      label = label.trim();
      if (label.endsWith(":")) {
        label = label.substring(0, label.length - 1);
      }
    }
    return label;
  }
  function extractLabelValuePairs(dataObject, rows) {
    for (let dataRow of rows) {
      let rowDivs = dataRow.querySelectorAll("div");
      console.log("rowDivs.length = " + rowDivs.length);
      if (rowDivs.length == 2) {
        let labelDiv = rowDivs[0];
        let valueDiv = rowDivs[1];
        let label = cleanLabel(labelDiv.textContent);
        let value = valueDiv.textContent.trim();
        console.log("label = " + label + ", value = " + value);
        if (label && value) {
          if (value != "-") {
            dataObject[label] = value;
          }
        }
      }
    }
  }

  let leftViewColumn = article.querySelector("div.data-view div.left-view-column");
  let rightViewColumn = article.querySelector("div.data-view div.right-view-column");

  if (leftViewColumn) {
    result.recordData = {};
    result.panelGroups = [];

    // get only the top level lows of the left-view-column
    let columnRows = article.querySelectorAll("div.data-view div.left-view-column > div.row");

    if (columnRows.length) {
      for (let row of columnRows) {
        let permanentIdSpan = row.querySelector("#permanentId");
        if (permanentIdSpan) {
          result.permanentId = permanentIdSpan.textContent.trim();
        } else {
          let panelGroups = row.querySelectorAll("div.panel-group");
          if (panelGroups.length) {
            console.log("row has panel groups: " + panelGroups.length);
            for (let panelGroup of panelGroups) {
              let panelData = {};
              result.panelGroups.push(panelData);
              let panelTitleElement = panelGroup.querySelector("h4.panel-title");
              if (panelTitleElement) {
                let panelTitle = cleanLabel(panelTitleElement.textContent);
                if (panelTitle) {
                  panelData.panelTitle = panelTitle;
                }
              }

              // it could be a row with a single set of data or a list of people
              let dataItems = panelGroup.querySelectorAll("div.panel-body div.data-item");
              if (dataItems.length) {
                // it is a list of people
                panelData.people = [];
                for (let person of dataItems) {
                  let personData = {};
                  panelData.people.push(personData);
                  if (person.classList.contains("current")) {
                    personData.current = true;
                  }

                  let personHeadingElement = person.querySelector("h4");
                  if (personHeadingElement) {
                    let personName = personHeadingElement.textContent.trim();
                    if (personName) {
                      personName = personName.replace(/\s+/g, " ");
                      personData.personName = personName;
                    }
                  }

                  let dataDivs = person.querySelectorAll("div.row > div > div.row > div");
                  let lastLabel = "";
                  for (let dataDiv of dataDivs) {
                    if (dataDiv.classList.contains("ssp-semibold")) {
                      if (lastLabel) {
                        let value = dataDiv.textContent.trim();
                        if (value && value != "-") {
                          personData[lastLabel] = value;
                        }
                      }
                    } else {
                      lastLabel = cleanLabel(dataDiv.textContent);
                    }
                  }
                }
              } else {
                let panelDataRows = panelGroup.querySelectorAll("div.panel-body > div.row > div > div.row");
                extractLabelValuePairs(panelData, panelDataRows);
              }
            }
          } else {
            console.log("row has no panel groups");
            // this is the main row
            let dataRows = row.querySelectorAll("div.row div.row");
            extractLabelValuePairs(result.recordData, dataRows);
          }
        }
      }
    }
  }

  if (rightViewColumn) {
    let title = rightViewColumn.querySelector("h4.title");
    if (title) {
      let sourcePara = title.nextElementSibling;
      if (sourcePara) {
        let sourceInformation = sourcePara.textContent.trim();
        if (sourceInformation) {
          result.sourceInformation = sourceInformation;
        }
      }
    }
    result.sourceData = {};
    let dataRows = rightViewColumn.querySelectorAll("div.row");
    extractLabelValuePairs(result.sourceData, dataRows);
  }

  result.success = true;

  //console.log(result);

  return result;
}

export { extractData };
