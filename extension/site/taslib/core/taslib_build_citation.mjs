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
import { DataString } from "../../../base/core/data_string.mjs";

const referenceFields = ["File number", "Page", "Voyage number", "Index number"];
const additionalFieldsToIgnoreInDataList = ["Record ID", "Resource"];

function getPartsFromResource(ed) {
  let resourceWrap = ed.recordData["Resource"];
  if (resourceWrap) {
    let result = { text: resourceWrap.text };

    let resourceUrl = resourceWrap.link;
    // we want a permalink.
    // Example URL from href: "https://libraries.tas.gov.au/Digital/RGD37-1-16p186j2"
    // Example permalink: "https://libraries.tas.gov.au/Digital/RGD37-1-16/RGD37-1-16P186"
    const regex = /^https\:\/\/libraries\.tas\.gov\.au\/Digital\/([A-Z0-9\-]+)p(\d+).*$/;
    if (regex.test(resourceUrl)) {
      let id = resourceUrl.replace(regex, "$1");
      let pageNum = resourceUrl.replace(regex, "$2");
      if (id && id != resourceUrl && pageNum && pageNum != resourceUrl) {
        if (id.endsWith("-")) {
          id = id.substring(0, id.length - 1);
        }
        result.id = id;
        result.pageNum = pageNum;
        result.permalink = "https://libraries.tas.gov.au/Digital/" + id + "/" + id + "-P" + pageNum;
        return result;
      }
    }
    // For something like a will the resource href will be something like:
    // "https://libraries.tas.gov.au/Digital/AD960-1-103-47182"
    // and there is a separate permalink for each page, for example:
    // "https://libraries.tas.gov.au/Digital/AD960-1-103/AD960-1-103-47182_1"
    const regex2 = /^https\:\/\/libraries\.tas\.gov\.au\/Digital\/([A-Z0-9\-]+)$/;
    if (regex2.test(resourceUrl)) {
      let id = resourceUrl.replace(regex2, "$1");
      if (id && id != resourceUrl) {
        result.id = id;
        if (result.text) {
          let textId = result.text;
          let spaceIndex = result.text.indexOf(" ");
          if (spaceIndex != -1) {
            textId = result.text.substring(0, spaceIndex);
          }
          // the text ID can have / characters in - they should be - chars in permalink
          textId = textId.replace(/\//g, "-");

          if (id.startsWith(textId) && id.length > textId.length) {
            result.permalink = "https://libraries.tas.gov.au/Digital/" + textId + "/" + id;
          }
        }
        if (!result.permalink) {
          result.permalink = resourceUrl;
        }
        return result;
      }
    }
  }
}

function getPartsFromOtherRecords(ed) {
  let wrap = ed.recordData["Other Records"];
  if (wrap) {
    let result = { text: wrap.text };

    let url = wrap.link;
    // we want a permalink.
    // Example URL from href: "https://libraries.tas.gov.au/Digital/CON13-1-1/CON13-1-1P111"
    const regex = /^https\:\/\/libraries\.tas\.gov\.au\/Digital\/([A-Z0-9\-]+)\/([A-Z0-9\-]+)P(\d+)$/;
    if (regex.test(url)) {
      let id = url.replace(regex, "$1");
      let pageNum = url.replace(regex, "$3");
      if (id && id != url && pageNum && pageNum != url) {
        result.id = id;
        result.pageNum = pageNum;
        result.permalink = url;
        return result;
      }
    }
  }
}

function buildSourceTitle(ed, gd, builder) {
  builder.sourceTitle += "Libraries Tasmania, Names Index";
}

function buildSourceReference(ed, gd, builder) {
  let options = builder.getOptions();
  let dataStyleOption = options.citation_taslib_dataStyle;
  if (dataStyleOption == "listNoRef") {
    return;
  }

  let resourceParts = getPartsFromResource(ed);
  let otherRecordsParts = getPartsFromOtherRecords(ed);

  if (resourceParts && (resourceParts.text || resourceParts.id)) {
    builder.addSourceReferenceText("Tasmanian Archives");
    if (resourceParts.text) {
      builder.addSourceReferenceField("Resource ID", resourceParts.text);
      for (let referenceField of referenceFields) {
        let value = ed.recordData[referenceField];
        if (value && !resourceParts.text.includes(value)) {
          builder.addSourceReferenceField(referenceField, value);
        }
      }
    } else {
      builder.addSourceReferenceField("Resource ID", resourceParts.id);
      builder.addSourceReferenceField("Page", resourceParts.pageNum);
    }
  } else if (otherRecordsParts && (otherRecordsParts.text || otherRecordsParts.id)) {
    builder.addSourceReferenceText("Tasmanian Archives");
    if (otherRecordsParts.text) {
      builder.addSourceReferenceField("Other Records ID", otherRecordsParts.text);
    } else {
      builder.addSourceReferenceField("Other Records ID", otherRecordsParts.id);
      builder.addSourceReferenceField("Page", otherRecordsParts.pageNum);
    }
  } else {
    builder.addSourceReferenceField("Record ID", ed.recordData["Record ID"]);
    for (let referenceField of referenceFields) {
      builder.addSourceReferenceField(referenceField, ed.recordData[referenceField]);
    }
  }
}

function buildRecordLink(ed, gd, builder) {
  let recordId = ed.recordData["Record ID"];
  if (recordId) {
    // A recordId like: "NAME_INDEXES:2055407" should generate a permalink like"
    // https://libraries.tas.gov.au/Record/NamesIndex/2055407
    let nameIndexRegEx = /^NAME_INDEXES\:(\d+)$/;
    if (nameIndexRegEx.test(recordId)) {
      let permaLinkNumber = recordId.replace(nameIndexRegEx, "$1");
      if (permaLinkNumber && permaLinkNumber != recordId) {
        let permalink = "https://libraries.tas.gov.au/Record/NamesIndex/" + permaLinkNumber;
        let recordLink = "[" + permalink + " Record Permalink]";
        builder.recordLinkOrTemplate = recordLink;
      }
    }
  }
}

function buildImageLink(ed, gd, builder) {
  let resourceParts = getPartsFromResource(ed);
  let otherRecordsParts = getPartsFromOtherRecords(ed);

  if (resourceParts && resourceParts.permalink) {
    builder.imageLink = "[" + resourceParts.permalink + " Image Permalink]";
  } else if (otherRecordsParts && otherRecordsParts.permalink) {
    builder.imageLink = "[" + otherRecordsParts.permalink + " Other Record Permalink]";
  }
}

function buildListDataString(ed, gd, builder) {
  const fieldsToExclude = referenceFields.concat(additionalFieldsToIgnoreInDataList);

  let newRecordData = {};
  for (let key in ed.recordData) {
    let value = ed.recordData[key];
    if (value) {
      if (typeof value === "string" || value instanceof String) {
        newRecordData[key] = value;
      } else {
        if (value.text) {
          newRecordData[key] = value.text;
        }
      }
    }
  }

  builder.addListDataStringFromRecordData(newRecordData, fieldsToExclude);
}

function buildListDataStringNoRef(ed, gd, builder) {
  const fieldsToExclude = additionalFieldsToIgnoreInDataList;

  let newRecordData = {};
  for (let key in ed.recordData) {
    let value = ed.recordData[key];
    if (value) {
      if (typeof value === "string" || value instanceof String) {
        newRecordData[key] = value;
      } else {
        if (value.text) {
          newRecordData[key] = value.text;
        }
      }
    }
  }

  builder.addListDataStringFromRecordData(newRecordData, []);
}

function buildSentenceDataString(ed, gd, builder) {
  let input = {
    generalizedData: gd,
    options: builder.options,
  };
  let dataString = DataString.buildDataString(input);

  if (!dataString) {
    buildListDataString(ed, gd, builder);
    return;
  }

  if (dataString) {
    if (!dataString.endsWith(".")) {
      dataString += ".";
    }
    builder.dataString = dataString;
  }
}

function buildDataString(ed, gd, builder) {
  let options = builder.getOptions();
  let dataStyleOption = options.citation_taslib_dataStyle;

  if (dataStyleOption == "list") {
    buildListDataString(ed, gd, builder);
  } else if (dataStyleOption == "sentence") {
    buildSentenceDataString(ed, gd, builder);
  } else if (dataStyleOption == "listNoRef") {
    buildListDataStringNoRef(ed, gd, builder);
  }
}

function buildCoreCitation(ed, gd, builder) {
  buildSourceTitle(ed, gd, builder);
  buildSourceReference(ed, gd, builder);
  buildRecordLink(ed, gd, builder);
  buildImageLink(ed, gd, builder);
  buildDataString(ed, gd, builder);
}

function buildCitation(input) {
  return simpleBuildCitationWrapper(input, buildCoreCitation);
}

export { buildCitation };
