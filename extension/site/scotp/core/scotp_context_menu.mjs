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

/* The text selected is going to be in read mode most likely. So something like this:

Birth or Baptism: "Church of Scotland: Old Parish Registers - Births and Baptisms" National Records of Scotland, Parish Number: 382/ ; Ref: 20 9 ScotlandsPeople Search (accessed 23 June 2022) Peter Connan born or baptised on 1 Jun 1823, son of James Connan & Mary McGregor, in Monzie, Perthshire, Scotland.

But it could also be in edit mode, in which case it would be like:

<ref> '''Birth or Baptism''': "Church of Scotland: Old Parish Registers - Births and Baptisms"<br/> National Records of Scotland, Parish Number: 382/ ; Ref: 20 9<br/> [https://www.scotlandspeople.gov.uk/record-results?search_type=people&event=%28B%20OR%20C%20OR%20S%29&record_type%5B0%5D=opr_births&church_type=Old%20Parish%20Registers&dl_cat=church&dl_rec=church-births-baptisms&surname=CONNAN&surname_so=exact&forename=PETER&forename_so=exact&from_year=1823&to_year=1823&sex=M&parent_names=JAMES%20CONNAN&parent_names_so=exact&parent_name_two=MARY%20MCGREGOR&parent_name_two_so=exact&rd_display_name%5B0%5D=MONZIE_MONZIE%20(PERTH)&rd_name%5B0%5D=MONZIE ScotlandsPeople Search] (accessed 23 June 2022)<br/> Peter Connan born or baptised on 1 Jun 1823, son of James Connan & Mary McGregor, in Monzie, Perthshire, Scotland. </ref>

NOTE: The selectionText from the context menu automatically has the \n characters removed already
*/

import { scotpRecordTypes, ScotpRecordType, SpEventClass, SpFeature, SpField } from "./scotp_record_type.mjs";
import { ScotpFormDataBuilder } from "./scotp_form_data_builder.mjs";
import { DateUtils } from "../../../base/core/date_utils.mjs";
import { StringUtils } from "../../../base/core/string_utils.mjs";

var messages = "";

function logMessage(message) {
  if (messages) {
    messages += "\n";
  }
  messages += message;
}

// NOTE: All patterns try to handle the optional accessed date in all three options
// This non-capturing group should match all possibilities
// (?: ?\(accessed [^\)]+\),? ?| ?\: ?accessed [^\)]+\),? ?| |,|, )
const cpParish = {
  regex: /(.*),? ?/,
  paramKeys: ["parish"],
};
const cpTitle = {
  regex: /["'“‘]([^"'”’]+)["'”’],?/,
  paramKeys: ["sourceTitle"],
};
const cpDb = {
  regex: /(?: database with images| database| \[?database online\]?)?,? ?/,
};
const cpOwner = {
  regex: /([^(\[]*),? ?/,
  paramKeys: ["websiteCreatorOwner"],
};
const cpRef = {
  regex: /([^(]*),? ?/,
  paramKeys: ["sourceReference"],
};
const cpLinkA = {
  regex:
    /\(?(?:scotlandspeople,?\.? \(?https?\:\/\/www\.scotlandspeople\.gov\.uk[^\: ]*|https\:\/\/www\.scotlandspeople\.gov\.uk[^\: ]*|scotlandspeople search|scotlandspeople)/,
};
const cpLinkAEdit = {
  regex: /\(?\[https?\:\/\/www\.scotlandspeople\.gov\.uk.* scotlandspeople(?: search)?\]/,
};
const cpLinkB = {
  regex:
    /(?: ?\((?:image )?(?:accessed|viewed) [^\)]+\),? ?| ?\: ?(?:image )?(?:accessed|viewed) [^\)]+\),? ?| |,|, )(?:image,? ?)?/,
};
const cpData = {
  regex: /(.*)/,
  paramKeys: ["dataString"],
};
const cpCitingRef = {
  regex: /;? citing (.*)/,
  paramKeys: ["sourceReference"],
};
const citationPatterns = [
  {
    // "church of scotland: old parish registers - births and baptisms", database, national records of scotland, ([https://www.scotlandspeople.gov.uk/ scotlandspeople] : accessed 23 june 2022), peter connan born or baptised on 1 jun 1823, son of james connan & mary mcgregor, in monzie, perthshire, scotland; citing parish number 382/ , ref 20 9.
    // "Statutory Register of Births", database, National Records of Scotland, [https://www.scotlandspeople.gov.uk/ ScotlandsPeople], Helen McCall A'Hara birth registered 1888 in Anderston, mother's maiden name McCall; citing Ref: 644/10/356.
    // "Church of Scotland: Old Parish Registers - Births and Baptisms", database, National Records of Scotland, ([https://www.scotlandspeople.gov.uk/ ScotlandsPeople] : accessed 23 June 2022), Peter Connan born or baptised on 1 Jun 1823, son of James Connan & Mary McGregor, in Monzie, Perthshire, Scotland; citing Parish Number 382/ , Ref 20 9.
    name: "Edit mode: Sourcer style, source reference at end",
    parts: [cpTitle, cpDb, cpOwner, cpLinkAEdit, cpLinkB, cpData, cpCitingRef],
  },
  {
    // "scotland census, 1851", national records of scotland, ref: 547/ 1/ 35, [https://www.scotlandspeople.gov.uk/ scotlandspeople] (accessed 13 september 2024), surname mckay, forename donald, year 1851, gender m, age at census 11, rd name portnahaven, county / city argyll.
    // "scotland census, 1851", database, national records of scotland, ref: 053/ 1/ 6, [https://www.scotlandspeople.gov.uk/ scotlandspeople], donald mckay (13) in lairg registration district in sutherland, scotland.
    name: "Edit mode: Sourcer style, source reference in default place",
    parts: [cpTitle, cpDb, cpRef, cpLinkAEdit, cpLinkB, cpData],
  },
  {
    // "scotland census, 1851", database, national records of scotland, scotlandspeople, donald mckay (13) in lairg registration district in sutherland, scotland; citing ref: 053/ 1/ 6.
    // Another example from Scotland project:
    // "Statutory Registers - Deaths" database, National Records of Scotland, (ScotlandsPeople : accessed 29 May 2024) John Stewart, age 47, Male, 1908, Paisley; citing Reference Number: 573 / 1 / 160.
    name: "Sourcer style, source reference at end",
    parts: [cpTitle, cpDb, cpOwner, cpLinkA, cpLinkB, cpData, cpCitingRef],
  },
  {
    // "church of scotland: old parish registers - births and baptisms" national records of scotland, parish number: 382/ ; ref: 20 9 scotlandspeople search (accessed 23 june 2022) peter connan born or baptised on 1 jun 1823, son of james connan & mary mcgregor, in monzie, perthshire, scotland.
    // "Statutory Register of Divorces" National Records of Scotland, Court Code: 9772; Serial Number: 1421 ScotlandsPeople Margaret Thomso O'Connor divorce from McClounie in 2010 in Hamilton, Scotland.
    name: "Sourcer style, source reference in default place",
    parts: [cpTitle, cpDb, cpRef, cpLinkA, cpLinkB, cpData],
  },
  {
    // Sometimes they have the parish or country name before the source citation
    // govan parish, church of scotland, "old parish registers births and baptisms" database, national records of scotland, (scotlandspeople : accessed 29 may 2024), william walker birth or baptism 23 jan 1808, son of hugh walker and ann young, citing ref 20 / 211.
    // Scotland, "Statutory Registers - Marriages" database, National Records of Scotland, (ScotlandsPeople :accessed 15 Nov 2023), Euphemia Lamont, and John McBride, 1856, Greenock Old or West; citing Reference Number: 564 / 3 / 44.
    name: "Scotland Project style with parish/place before source title",
    paramKeys: ["parish", "sourceTitle", "websiteCreatorOwner", "dataString", "sourceReference"],
    parts: [cpParish, cpTitle, cpDb, cpOwner, cpLinkA, cpLinkB, cpData, cpCitingRef],
  },
  {
    // St John's, Port Glasgow, "Catholic Registers Births and Baptisms" database, National Records of Scotland, ScotlandsPeople (https://www.scotlandspeople.gov.uk : accessed 21 Feb 2021), William McAtasny, birth 31 Dec 1867 and baptism 1 Apr 1868, son of William McAtasny and Margaret McIlveny.
    name: "Scotland Project style with parish/place before source title, no source reference",
    paramKeys: ["parish", "sourceTitle", "websiteCreatorOwner", "dataString"],
    parts: [cpParish, cpTitle, cpDb, cpOwner, cpLinkA, cpLinkB, cpData],
  },
  {
    // Example: Scotland Project edit mode
    // govan parish, church of scotland, "old parish registers births and baptisms" database, national records of scotland, ([https://www.scotlandspeople.gov.uk scotlandspeople] : accessed 29 may 2024), william walker birth or baptism 23 jan 1808, son of hugh walker and ann young, citing ref 20 / 211.
    name: "Edit mode: Scotland Project style with parish/place before source title",
    parts: [cpParish, cpTitle, cpDb, cpOwner, cpLinkAEdit, cpLinkB, cpData, cpCitingRef],
  },
  {
    // “Statutory Marriages 1855–2013,” database with images, ScotlandsPeople (http://www.scotlandspeople.gov.uk : accessed 1 Feb 2024), image, marriage registration, James Lamont and Jane O'Neill nee Letson, married 1905, Parish of Govan, County of Lanark; citing Statutory Registers no. 646 / 2 / 372.
    name: "Non-standard: Sourcer style (but no website creator/owner), source reference at end",
    parts: [cpTitle, cpDb, cpLinkA, cpLinkB, cpData, cpCitingRef],
  },
];

const partialCitationPatterns = [
  {
    name: "Edit mode: Sourcer style or Scotland Project style with source reference at end",
    parts: [cpDb, cpOwner, cpLinkAEdit, cpLinkB, cpData, cpCitingRef],
  },
  {
    name: "Edit mode: Sourcer style, with source reference in default place",
    parts: [cpDb, cpRef, cpLinkAEdit, cpLinkB, cpData],
  },
  {
    name: "Sourcer style or Scotland Project style with source reference at end",
    parts: [cpDb, cpOwner, cpLinkA, cpLinkB, cpData, cpCitingRef],
  },
  {
    name: "Sourcer style, with source reference in default place",
    parts: [cpDb, cpRef, cpLinkA, cpLinkB, cpData],
  },
  {
    name: "Scotland Project style with no source reference",
    parts: [cpDb, cpOwner, cpLinkA, cpLinkB, cpData],
  },
];

// No need to lower case these - that is done in compare
// These are in same order as scotpRecordTypes
const defaultSourcerTitles = [
  {
    recordType: "stat_births",
    titles: ["Statutory Register of Births"],
  },
  {
    recordType: "stat_marriages",
    titles: ["Statutory Register of Marriages"],
  },
  {
    recordType: "stat_divorces",
    titles: ["Statutory Register of Divorces"],
  },
  {
    recordType: "stat_deaths",
    titles: ["Statutory Register of Deaths"],
  },
  {
    recordType: "stat_civilpartnerships",
    titles: ["Statutory Register of Civil Partnerships"],
  },
  {
    recordType: "stat_dissolutions",
    titles: ["Statutory Register of Dissolutions"],
  },
  {
    recordType: "opr_births",
    titles: ["Church of Scotland: Old Parish Registers - Births and Baptisms"],
  },
  {
    recordType: "opr_marriages",
    titles: ["Church of Scotland: Old Parish Registers - Banns and Marriages"],
  },
  {
    recordType: "opr_deaths",
    titles: ["Church of Scotland: Old Parish Registers - Deaths and Burials"],
  },
  {
    recordType: "cr_baptisms",
    titles: ["Catholic Parish Registers - Births and Baptisms"],
  },
  {
    recordType: "cr_banns",
    titles: ["Catholic Parish Registers - Marriages"],
  },
  {
    recordType: "cr_burials",
    titles: ["Catholic Parish Registers - Deaths, Burials and Funerals"],
  },
  {
    recordType: "cr_other",
    titles: ["Catholic Parish Registers - Other Events"],
  },
  {
    recordType: "ch3_baptisms",
    titles: ["Other Church Registers - Births and Baptisms"],
  },
  {
    recordType: "ch3_banns",
    titles: ["Other Church Registers - Marriages"],
  },
  {
    recordType: "ch3_burials",
    titles: ["Other Church Registers - Deaths and Burials"],
  },
  {
    recordType: "ch3_other",
    titles: ["Other Church Registers - Other Events"],
  },

  {
    // this must come before other census patterns because we use "includes"
    recordType: "census_lds",
    titles: ["Scotland Census, 1881 (LDS)"],
  },

  {
    recordType: "census",
    titles: ["Scotland Census, 1841"],
  },
  {
    recordType: "census",
    titles: ["Scotland Census, 1851"],
  },
  {
    recordType: "census",
    titles: ["Scotland Census, 1861"],
  },
  {
    recordType: "census",
    titles: ["Scotland Census, 1871"],
  },
  {
    recordType: "census",
    titles: ["Scotland Census, 1881"],
  },
  {
    recordType: "census",
    titles: ["Scotland Census, 1891"],
  },
  {
    recordType: "census",
    titles: ["Scotland Census, 1901"],
  },
  {
    recordType: "census",
    titles: ["Scotland Census, 1911"],
  },
  {
    recordType: "census",
    titles: ["Scotland Census, 1921"],
  },
  {
    recordType: "vr",
    titles: ["Valuation Rolls"],
  },
  {
    recordType: "wills",
    titles: ["Wills and Testaments"],
  },
  {
    recordType: "coa",
    titles: ["Public Register of All Arms and Bearings"],
  },
  {
    recordType: "soldiers_wills",
    titles: ["Soldiers' and Airmen's Wills"],
  },
  {
    recordType: "military_tribunals",
    titles: ["Military Service Appeal Tribunals"],
  },
  {
    recordType: "hie",
    titles: ["Highland and Island Emigration Society records"],
  },
  {
    recordType: "prison_records",
    titles: ["Prison Registers"],
  },
];

// No need to lower case these - that is done in compare
// These are in same order as scotpRecordTypes
const scotlandProjectTitles = [
  {
    recordType: "stat_births",
    titles: ["Statutory Registers - Births"],
  },
  {
    recordType: "stat_marriages",
    titles: ["Statutory Registers - Marriages"],
  },
  {
    recordType: "stat_divorces",
    titles: ["Statutory Register - Divorces"],
  },
  {
    recordType: "stat_deaths",
    titles: ["Statutory Registers - Deaths"],
  },
  {
    recordType: "stat_civilpartnerships",
    titles: ["Statutory Registers - Civil Partnerships"],
  },
  {
    recordType: "stat_dissolutions",
    titles: ["Statutory Registers - Dissolutions"],
  },
  {
    recordType: "opr_births",
    titles: ["Old Parish Registers Births and Baptisms"],
  },
  {
    recordType: "opr_marriages",
    titles: ["Old Parish Registers Banns and Marriages"],
  },
  {
    recordType: "opr_deaths",
    titles: ["Old Parish Registers Death and Burials"],
  },
  {
    recordType: "cr_baptisms",
    titles: ["Catholic Registers Births and Baptisms"],
  },
  {
    recordType: "cr_banns",
    titles: ["Catholic Registers Marriages", "Catholic Registers Banns and Marriages"],
  },
  {
    recordType: "cr_burials",
    titles: ["Catholic Registers Deaths, Burials and Funerals"],
  },
  {
    recordType: "cr_other",
    titles: ["Catholic Registers Other Events"],
  },
  {
    recordType: "ch3_baptisms",
    titles: ["Church Registers - Other Church Registers Baptisms"],
  },
  {
    recordType: "ch3_banns",
    titles: ["Church Registers - Other Church Registers Marriages"],
  },
  {
    recordType: "ch3_burials",
    titles: ["Church Registers - Other Church Registers Burials"],
  },
  {
    recordType: "ch3_other",
    titles: ["Church Registers - Other Church Registers Other Events"], // ??
  },

  {
    recordType: "census_lds",
    titles: ["Census 1881 (LDS)"],
  },
  {
    recordType: "census",
    titles: ["Scottish Census Returns - 1841"],
  },
  {
    recordType: "census",
    titles: ["Scottish Census Returns - 1851"],
  },
  {
    recordType: "census",
    titles: ["Scottish Census Returns - 1861"],
  },
  {
    recordType: "census",
    titles: ["Scottish Census Returns - 1871"],
  },
  {
    recordType: "census",
    titles: ["Scottish Census Returns - 1881"],
  },
  {
    recordType: "census",
    titles: ["Scottish Census Returns - 1891"],
  },
  {
    recordType: "census",
    titles: ["Scottish Census Returns - 1901"],
  },
  {
    recordType: "census",
    titles: ["Scottish Census Returns - 1911"],
  },
  {
    recordType: "census",
    titles: ["Scottish Census Returns - 1921"],
  },
  {
    recordType: "vr",
    titles: ["Valuation Rolls"],
  },
  {
    recordType: "wills",
    titles: ["Wills and Testaments"],
  },
  {
    recordType: "coa",
    titles: ["Public Register of All Arms and Bearings"],
  },
  {
    recordType: "soldiers_wills",
    titles: ["Soldiers' and Airmen's Wills"],
  },
  {
    recordType: "military_tribunals",
    titles: ["Military Service Appeal Tribunals"],
  },
  {
    recordType: "hie",
    titles: ["Highland and Island Emigration Society records"],
  },
  {
    recordType: "prison_records",
    titles: ["Prison registers"],
  },
];

// No need to lower case these - that is done in compare
// These are in same order as scotpRecordTypes
const otherFoundTitles = [
  {
    recordType: "stat_births",
    titles: [],
  },
  {
    recordType: "stat_marriages",
    titles: ["Statutory Marriages"],
    reTitles: [/Statutory Marriages \d\d\d\d(?: ?– ?| ?\- ?| to )\d\d\d\d/i],
  },
  {
    recordType: "stat_divorces",
    titles: [],
  },
  {
    recordType: "stat_deaths",
    titles: [],
  },
  {
    recordType: "stat_civilpartnerships",
    titles: [],
  },
  {
    recordType: "stat_dissolutions",
    titles: [],
  },
  {
    recordType: "opr_births",
    titles: [
      "Church of Scotland: Old Parish Registers Births and Baptisms",
      "Church of Scotland: Old Parish Registers Births & Baptisms",
      "Church of Scotland: Old Parish Registers - Births & Baptisms",
    ],
  },
  {
    recordType: "opr_marriages",
    titles: [
      "Church of Scotland: Old Parish Registers Banns and Marriages",
      "Church of Scotland: Old Parish Registers Banns & Marriages",
      "Church of Scotland: Old Parish Registers - Banns & Marriages",
    ],
  },
  {
    recordType: "opr_deaths",
    titles: [
      "Church of Scotland: Old Parish Registers Death and Burials",
      "Church of Scotland: Old Parish Registers Death & Burials",
      "Church of Scotland: Old Parish Registers - Death & Burials",
    ],
  },
  {
    recordType: "cr_baptisms",
    titles: [],
  },
  {
    recordType: "cr_banns",
    titles: [],
  },
  {
    recordType: "cr_burials",
    titles: [],
  },
  {
    recordType: "cr_other",
    titles: [],
  },
  {
    recordType: "ch3_baptisms",
    titles: [],
  },
  {
    recordType: "ch3_banns",
    titles: [],
  },
  {
    recordType: "ch3_burials",
    titles: [],
  },
  {
    recordType: "ch3_other",
    titles: [], // ??
  },

  {
    recordType: "census_lds",
    titles: [],
  },
  {
    recordType: "census",
    titles: [],
  },
  {
    recordType: "vr",
    titles: [],
  },
  {
    recordType: "wills",
    titles: [],
  },
  {
    recordType: "coa",
    titles: [],
  },
  {
    recordType: "soldiers_wills",
    titles: [],
  },
  {
    recordType: "military_tribunals",
    titles: [],
  },
  {
    recordType: "hie",
    titles: [],
  },
  {
    recordType: "prison_records",
    titles: [],
  },
];

const dataStringSentencePatterns = {
  stat_births: [
    {
      // Sourcer generated. Example:
      // Helen McCall A'Hara birth registered 1888 in Anderston, mother's maiden name McCall
      name: "Sourcer format",
      regex: /^(.+) birth registered ([0-9]+) in (.*), mother's maiden name (.*)$/i,
      paramKeys: ["name", "eventDate", "rdName", "mmn"],
    },
    {
      // Scotland Project. Example:
      // James Menzies Wood, mother's MS Wright, M, 1872, Blythswood
      name: "Scotland Project format",
      regex: /^(.+), mother's ms ([^,]+), (m|f), (\d\d\d\d), ([^;]+).*$/i,
      paramKeys: ["name", "mmn", "gender", "eventDate", "rdName"],
    },
  ],
  stat_marriages: [
    {
      // Sourcer generated. Example:
      // Euphemia Lamont marriage to John McBride registered 1856 in Greenock Old or West.
      name: "Sourcer format",
      regex: /^(.+) marriage to (.+) registered (\d\d\d\d) in ([^;]+).*$/i,
      paramKeys: ["name", "spouseName", "eventDate", "rdName"],
    },
    {
      // Scotland Project. Example:
      // Euphemia Lamont, and John McBride, 1856, Greenock Old or West
      name: "Scotland Project format",
      regex: /^(.+),? (?:and|&|\/) (.+), (\d\d\d\d), ([^;]+).*$/i,
      paramKeys: ["name", "spouseName", "eventDate", "rdName"],
    },
    {
      // Found case
      // Duncan Urquhart & Christina Coventry, 1860
      regex: /^(.+),? (?:and|&|\/) (.+), (\d\d\d\d).*$/i,
      paramKeys: ["name", "spouseName", "eventDate"],
    },
    {
      // Found case
      // marriage registration, James Lamont and Jane O'Neill nee Letson, married 1905, Parish of Govan, County of Lanark
      regex: /^marriage registration,? (.+),? (?:and|&|\/) (.+), married (\d\d\d\d),? (.+)$/i,
      paramKeys: ["name", "spouseName", "eventDate", "rdName"],
    },
  ],
  stat_divorces: [
    {
      // Sourcer generated. Example:
      // Margaret Thomso O'Connor divorce from McClounie in 2010 in Hamilton, Scotland.
      name: "Sourcer format",
      regex: /^(.+) divorce from (.+) in (\d\d\d\d) in ([^;]+).*$/i,
      paramKeys: ["name", "spouseLastName", "eventDate", "court"],
    },
  ],
  stat_deaths: [
    {
      // Sourcer generated. Example:
      // Catherine Aagesen death registered 1976 in Glasgow, Martha St (age 85, mother's maiden name McFee).
      name: "Sourcer format",
      regex: /^(.+) death registered (\d\d\d\d) in ([^\(;]+)\(age ([^,]+), mother's maiden name ([^\)]+)\).*$/i,
      paramKeys: ["name", "eventDate", "rdName", "age", "mmn"],
    },
    {
      // Example: Found on Stirling-727
      // Archibald Stirling, male, age 54, date 1869, dwelling in West Kilbride, Ayrshire, Scotland
      name: "Non-standard format",
      regex: /^(.+), (male|female), age ([^,]+), date ([0-9a-z ]+),? dwelling in (.*)$/i,
      paramKeys: ["name", "gender", "age", "eventDate", "eventPlace"],
    },
    {
      // Scotland Project. Example:
      // John Stewart, age 47, Male, 1908, Paisley
      name: "Scotland Project format",
      regex: /^(.+), age ([^,]+), (male|female|m|f), (\d\d\d\d), (.*)$/i,
      paramKeys: ["name", "age", "gender", "eventDate", "rdName"],
    },
    {
      // Scotland Project. Example of a corrected entry where data and source ref are mushed together
      // Joseph Sloy, 12 September 2028, corrected entry, West District, Greenock, Renfrewshire, p. 159, item 475, reference number 564/2 475
      name: "Scotland Project format",
      regex: /^([^,]+), ([0-9a-z ]+), (.*)$/i,
      paramKeys: ["name", "eventDate", "rdName"],
    },
    {
      // Found Example: https://www.wikitree.com/wiki/Rendall-372
      // Joan Rendall OR Cooper death registered 1935 in George Square (age 64)
      name: "Non-standard format",
      regex: /^(.+) death registered (\d\d\d\d) in (.*) \(age ([^\)]+)\).*$/i,
      paramKeys: ["name", "eventDate", "rdName", "age"],
    },
  ],
  stat_civilpartnerships: [
    {
      // Sourcer generated. Example:
      // Abigail Alice Walker marriage to Morera-Pallares registered 2021 in Rosskeen
      name: "Sourcer format",
      regex: /^(.+) marriage to (.+) registered (\d\d\d\d) in ([^;]+).*$/i,
      paramKeys: ["name", "spouseName", "eventDate", "rdName"],
    },
  ],
  stat_dissolutions: [
    {
      // Sourcer generated. Example:
      // Seonaid MacNeil Wilson divorce from MacIntosh in 2013 in Perth, Scotland
      name: "Sourcer format",
      regex: /^(.+) divorce from (.+) in (\d\d\d\d) in ([^;]+).*$/i,
      paramKeys: ["name", "spouseLastName", "eventDate", "court"],
    },
  ],
  opr_births: [
    {
      // Example: Sourcer Default
      // peter connan born or baptised on 1 jun 1823, son of james connan & mary mcgregor, in monzie, perthshire, scotland.
      name: "Sourcer format",
      regex:
        /^([^,;:]+) (?:born or baptised|birth or baptism) (?:on |in )?([0-9a-z ]+), (?:son|daughter|child) of ([0-9a-z ]+)(?: and | ?& ?| ?\/ ?)([0-9a-z ]+),? (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "eventDate", "fatherName", "motherName", "eventPlace"],
    },
    {
      // Example: Scotland Project
      // william walker birth or baptism 23 jan 1808, son of hugh walker and ann young
      name: "Scotland Project format",
      regex:
        /^([^,;:]+) (?:born or baptised|birth or baptism) (?:on |in )?([0-9a-z ]+), (?:son|daughter|child) of ([0-9a-z ]+)(?: and | ?& ?| ?\/ ?)([0-9a-z ]+).*$/i,
      paramKeys: ["name", "eventDate", "fatherName", "motherName"],
    },
    {
      // Example: Scotland Project
      // william walker birth 23 jan 1808, son of hugh walker and ann young
      name: "Scotland Project format",
      regex:
        /^([^,;:]+) (?:birth|baptism) (?:on |in )?([0-9a-z ]+), (?:son|daughter|child) of ([0-9a-z ]+)(?: and | ?& ?| ?\/ ?)([0-9a-z ]+).*$/i,
      paramKeys: ["name", "eventDate", "fatherName", "motherName"],
    },
    {
      // Example: Scotland Project
      // One parent
      // william walker birth or baptism 23 jan 1808, son of hugh walker
      name: "Scotland Project format, one parent",
      regex:
        /^([^,;:]+) (?:born or baptised|birth or baptism) (?:on |in )?([0-9a-z ]+), (?:son|daughter|child) of ([0-9a-z ]+).*$/i,
      paramKeys: ["name", "eventDate", "fatherName"],
    },
    {
      // Example: Scotland Project
      // One parent
      // william walker birth or baptism 23 jan 1808, son of hugh walker
      name: "Scotland Project format, viewed image, one parent",
      regex: /^([^,;:]+) (?:birth|baptism) (?:on |in )?([0-9a-z ]+), (?:son|daughter|child) of ([0-9a-z ]+).*$/i,
      paramKeys: ["name", "eventDate", "fatherName"],
    },
    {
      // Example: Scotland Project
      // No parents
      // william walker birth or baptism 23 jan 1808
      name: "Scotland Project format, no parents",
      regex: /^([^,;:]+) (?:born or baptised|birth or baptism) (?:on |in )?([0-9a-z ]+).*$/i,
      paramKeys: ["name", "eventDate"],
    },
    {
      // Example: Scotland Project
      // No parents
      // william walker birth or baptism 23 jan 1808
      name: "Scotland Project format, viewed image, no parents",
      regex: /^([^,;:]+) (?:birth|baptism) (?:on |in )?([0-9a-z ]+).*$/i,
      paramKeys: ["name", "eventDate"],
    },
    {
      // Example: Found
      // William Cairns, parents: David Cairns and Margaret Wakinshaw, 8 Sep 1822, Tranent
      // willliam wilson, parents: james wilson & agnes christie. 1 april 1711, wemyss, fife
      // Robert Lewis Balfour Stevenson, parents: Thomas Stevenson/Margaret Isabella Balfour, 13 Nov 1850, Edinburgh
      name: "Non-standard format",
      regex: /^(.+),? parents:? ([^,\.]+)(?: and |&|\/)([^,\.]+)(?:,|\.) ([0-9a-z ]+), (.*)$/i,
      paramKeys: ["name", "fatherName", "motherName", "eventDate"],
    },
  ],
  opr_marriages: [
    {
      // Example: Sourcer Default
      // Christane McGregor marriage to Robert Wright on or after 2 Jul 1668 in Buchanan, Stirlingshire, Scotland.
      // Note: in the section (?:on or after |on |in ), "on or after " needs to come before "on "
      name: "Sourcer format",
      regex: /^(.+) marriage to (.+) (?:on or after |on |in )([0-9a-z ]+) (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "spouseName", "eventDate", "eventPlace"],
    },
    {
      // Example: Scotland Project
      // marriage or banns for James Bell and Elizabeth Arrott 30 Apr 1719
      name: "Scotland Project format",
      regex: /^marriage or banns for ([^0-9]+)(?: and | ?& ?| ?\/ ?)([^0-9]+) ([0-9a-z ]+).*$/i,
      paramKeys: ["name", "spouseName", "eventDate"],
    },
    {
      // Example: Scotland Project (after reading image)
      // banns for James Bell and Elizabeth Arrott 30 Apr 1719
      name: "Scotland Project format",
      regex: /^banns for ([^0-9]+)(?: and | ?& ?| ?\/ ?)([^0-9]+) ([0-9a-z ]+).*$/i,
      paramKeys: ["name", "spouseName", "eventDate"],
    },
    {
      // Example: Scotland Project (after reading image)
      // marriage of James Bell and Elizabeth Arrott 30 Apr 1719
      name: "Scotland Project format",
      regex: /^marriage of ([^0-9]+)(?: and | ?& ?| ?\/ ?)([^0-9]+) ([0-9a-z ]+).*$/i,
      paramKeys: ["name", "spouseName", "eventDate"],
    },
    {
      // Example: Found case
      // David Cairns and Mary Chambers, 6 Dec 1820, Tranent
      name: "Non-standard format",
      regex: /^(.+)(?: and | ?& ?| ?\/ ?)(.*), ([0-9a-z ]+), (.*)$/i,
      paramKeys: ["name", "spouseName", "eventDate", "eventPlace"],
    },
  ],
  opr_deaths: [
    {
      // Example: Sourcer Default, age, one parent
      // John Gibson, son of James Galloway Gibson, death or burial (died age 0) on 24 May 1839 in Glasgow, Lanarkshire, Scotland
      name: "Sourcer format",
      regex:
        /^(.+), (?:son|daughter|child) of (.*), death or burial \(died age ([^\)]+)\) (?:on or after |on |in )([0-9a-z ]+) (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "parentName", "age", "eventDate", "eventPlace"],
    },
    {
      // Example: Sourcer Default, one parent
      // Elizabeth Campbell, daughter of Colny Campbell, death or burial on 8 Mar 1647 in Dumbarton, Dunbartonshire, Scotland.
      name: "Sourcer format",
      regex:
        /^(.+), (?:son|daughter|child) of (.*), death or burial (?:on or after |on |in )([0-9a-z ]+) (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "parentName", "eventDate", "eventPlace"],
    },
    {
      // Example: Sourcer Default, age no parent
      // John Burns death or burial (died age 96) on 26 Feb 1839 in Glasgow, Lanarkshire, Scotland
      name: "Sourcer format",
      regex: /^(.+) death or burial \(died age ([^\)]+)\) (?:on or after |on |in )([0-9a-z ]+) (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "age", "eventDate", "eventPlace"],
    },
    {
      // Example: Sourcer Default, no parent
      // James Fraser death or burial on 16 Aug 1685 in Aberdeen, Aberdeenshire, Scotland
      name: "Sourcer format",
      regex: /^(.+) death or burial (?:on or after |on |in )([0-9a-z ]+) (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "eventDate", "eventPlace"],
    },
    {
      // Example: Scotland Project
      // death of John Burns, 3 March 1839
      name: "Scotland Project format",
      regex: /^death of (.+), ([0-9a-z ]+).*$/i,
      paramKeys: ["name", "eventDate"],
    },
  ],
  cr_baptisms: [
    {
      // Example: Sourcer Default
      // Agnes White baptism on 29 Mar 1839 (born 24 Jan 1839), daughter of Alexander White & Saragh McDonnol, in St Mirin's, Paisley, Renfrewshire, Scotland
      name: "Sourcer format",
      regex:
        /^(.+) baptism (?:on |in )?([0-9a-z ]+) \(born (.*)\), (?:son|daughter|child) of ([0-9a-z ]+)(?: and | ?& ?| ?\/ ?)([0-9a-z ]+),? (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "eventDate", "birthDate", "fatherName", "motherName", "eventPlace"],
    },
    {
      // Example: Sourcer Default no dob
      // Agnes White baptism on 29 Mar 1839, daughter of Alexander White & Saragh McDonnol, in St Mirin's, Paisley, Renfrewshire, Scotland
      name: "Sourcer format",
      regex:
        /^(.+) baptism (?:on |in )?([0-9a-z ]+), (?:son|daughter|child) of ([0-9a-z ]+)(?: and | ?& ?| ?\/ ?)([0-9a-z ]+),? (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "eventDate", "fatherName", "motherName", "eventPlace"],
    },
    {
      // Example: Scotland Project
      // William McAtasny, birth 31 Dec 1867 and baptism 1 Apr 1868, son of William McAtasny and Margaret McIlveny.
      name: "Scotland Project format",
      regex:
        /^(.+), birth ([0-9a-z ]+) and baptism ([0-9a-z ]+), (?:son|daughter|child) of ([0-9a-z ]+)(?: and | ?& ?| ?\/ ?)([0-9a-z ]+)$/i,
      paramKeys: ["name", "birthDate", "eventDate", "fatherName", "motherName"],
    },
  ],
  cr_banns: [
    {
      // Example: Sourcer Default
      // James Ronald McGregor marriage to Ruth Margaret Gauld on or after 26 Nov 1941 in St Mary's with St Peter's, Aberdeen, Aberdeenshire, Scotland.
      name: "Sourcer format",
      regex: /^(.+) marriage to (.*) (?:on or after |on |in )([0-9a-z ]+) (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "spouseName", "eventDate", "eventPlace"],
    },
    {
      // Example: Scotland Project
      // marriage or banns for Michael McBride and Mary McSloy, 21 Jul 1862
      name: "Scotland Project format",
      regex: /^marriage or banns for (.+)(?: and | ?& ?| ?\/ ?)(.+), ([0-9a-z ]+).*$/i,
      paramKeys: ["name", "spouseName", "eventDate"],
    },
  ],
  cr_burials: [
    {
      // Example: Sourcer Default, age
      // Ruth Fraser burial (died age 0) on 3 Dec 1860 in Old Dalbeth Cemetery, Glasgow, Lanarkshire, Scotland
      name: "Sourcer format",
      regex: /^(.+) burial \(died age ([^\)]+)\) (?:on or after |on |in )([0-9a-z ]+) (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "age", "eventDate", "eventPlace"],
    },
  ],
  cr_other: [
    // Sourcer uses data list for this
  ],
  ch3_baptisms: [
    {
      // Example: Sourcer Default
      // Peter Connor baptism on 16 Mar 1854 (born 23 Feb 1854), child of Peter Conner & Jean Sneddon, in Wellwynd Associate, Airdrie, Lanarkshire, Scotland
      name: "Sourcer format",
      regex:
        /^(.+) baptism (?:on |in )?([0-9a-z ]+) \(born (.*)\), (?:son|daughter|child) of ([0-9a-z ]+)(?: and | ?& ?| ?\/ ?)([0-9a-z ]+),? (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "eventDate", "birthDate", "fatherName", "motherName", "eventPlace"],
    },
    {
      // Example: Scotland Project
      // John Rutherford, birth 28 August 1848, baptism 20 November 1850, son of George Rutherford and Isabella Waldie, Parish/Congregation Hawick Free
      name: "Scotland Project format",
      regex:
        /^(.+), birth ([0-9a-z ]+)(?: and|,) baptism ([0-9a-z ]+), (?:son|daughter|child) of ([0-9a-z ]+)(?: and | ?& ?| ?\/ ?)([0-9a-z ]+), (.+)$/i,
      paramKeys: ["name", "birthDate", "eventDate", "fatherName", "motherName", "eventPlace"],
    },
  ],
  ch3_banns: [
    {
      // Example: Sourcer Default
      // John Kay marriage to Hannah Butler Dewar on 3 Jul 1849 in Scotland
      name: "Sourcer format",
      regex: /^(.+) marriage to (.*) (?:on or after |on |in )([0-9a-z ]+) (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "spouseName", "eventDate", "eventPlace"],
    },
  ],
  ch3_burials: [
    {
      // Example: Sourcer Default
      // Helen Fraser death or burial on 11 Jul 1842 in St Margaret's United Secession, Dunfermline, Fife, Scotland. Cause of death: Rheumatic Fever
      name: "Sourcer format",
      regex: /^(.+) death or burial (?:on or after |on |in )([0-9a-z ]+) (?:in|at|on) (.*)\. Cause of death: (.+)$/i,
      paramKeys: ["name", "eventDate", "eventPlace", "causeOfDeath"],
    },
    {
      // Example: Sourcer Default, no cause of death
      // Helen Fraser death or burial on 11 Jul 1842 in St Margaret's United Secession, Dunfermline, Fife, Scotland.
      name: "Sourcer format",
      regex: /^(.+) death or burial (?:on or after |on |in )([0-9a-z ]+) (?:in|at|on) (.*)$/i,
      paramKeys: ["name", "eventDate", "eventPlace"],
    },
  ],
  ch3_other: [
    // Sourcer used list form
  ],
  census: [
    {
      // Example: Scotland Project
      // Ella W. McMillan, female, age at census 2, Greenock West, Renfrew;
      name: "Scotland Project format",
      regex: /^(.+), (male|female), age at census ([^,]+), (.*)$/i,
      paramKeys: ["name", "gender", "age", "eventPlace"],
    },
    {
      // Example: Sourcer Default with registration district
      // James Fraser (31) in Milton registration district in Lanarkshire, Scotland.
      name: "Sourcer format",
      regex: /^(.+) \(([^\)]+)\) in (.*) registration district in (.*)$/i,
      paramKeys: ["name", "age", "rdName", "countyCity"],
    },
    {
      // Example: Sourcer Default, no registration (may never generate this)
      // James Fraser (31) in Milton registration district in Lanarkshire, Scotland.
      name: "Sourcer format",
      regex: /^(.+) \(([^\)]+)\) in (.*)$/i,
      paramKeys: ["name", "age", "eventPlace"],
    },
  ],
  census_lds: [
    {
      // Example: Sourcer Default
      // Christina Clark Or Pocock (24) at 27 Marshall St, Edinburgh Buccleuch, Edinburgh, Scotland. Born in Turriff, Banff, Scotland
      name: "Sourcer format",
      regex: /^(.+) \(([^,]+)\) (?:in|on|at) (.*)$/i,
      paramKeys: ["name", "age", "eventPlace"],
    },
    {
      // Example: Sourcer Default
      // John Stewart, male, age at census 20, Dwelling: 2 Blair Street, Galston, birth place: Galston, Ayr
      name: "Sourcer format",
      regex: /^([^,]+), (?:female|male), age at census ([^,]+), (.*)$/i,
      paramKeys: ["name", "age", "eventPlace"],
    },
  ],
  vr: [
    {
      // Example: Sourcer Default
      // W J Fraser in 1855 at House No 83 Union Street in the parish of Aberdeen, Scotland
      name: "Sourcer format",
      regex: /^(.+) (?:in|on) (\d\d\d\d) (?:in|on|at) (.*)$/i,
      paramKeys: ["name", "eventDate", "eventPlace"],
    },
  ],
  wills: [
    {
      // Example: Sourcer Default
      // confirmation of will or testament of robert faireis at dumfries commissary court on 19 oct 1624
      // Confirmation of inventory for Agnes Fraser at Glasgow Sheriff Court on 18 Apr 1910
      name: "Sourcer format",
      regex:
        /^confirmation of (?:will or testament of |will of |inventory for |probate of will of )(.+) (?:in|on|at) (.*) (?:in|on) ([0-9a-z ]+)$/i,
      paramKeys: ["name", "eventPlace", "eventDate"],
    },
    {
      // Example: Sourcer Default
      // Confirmation of will of Adelaide Fraser at Inverness Sheriff Court on 2 Feb 1906. Died 2 Jul 1905.
      name: "Sourcer format",
      regex:
        /^confirmation of (?:will or testament of |will of |inventory for |probate of will of )(.+) (?:in|on|at) (.*) (?:in|on) ([0-9a-z ]+)\. died ([0-9a-z ]+)$/i,
      paramKeys: ["name", "eventPlace", "eventDate", "deathDate"],
    },
    {
      // Example: Sourcer Default
      // Confirmation of inventory for Jane Peffers at Edinburgh Sheriff Court on 25 Jun 1921 (original confirmation on 14 Jun 1921).
      name: "Sourcer format",
      regex:
        /^confirmation of (?:will or testament of |will of |inventory for )(.*) (?:in|on|at) (.+) (?:in|on) ([0-9a-z ]+) \(original confirmation (?:in|on) ([0-9a-z ]+)\).*$/i,
      paramKeys: ["name", "eventPlace", "eventDate", "originalConfDate"],
    },
    {
      // Example: Sourcer Default
      // Confirmation of inventory for Jane Peffers at Edinburgh Sheriff Court on 25 Jun 1921 (original confirmation on 14 Jun 1921). Died 6 Apr 1921.
      name: "Sourcer format",
      regex:
        /^confirmation of (?:will or testament of |will of |inventory for )(.*) (?:in|on|at) (.+) (?:in|on) ([0-9a-z ]+) \(original confirmation (?:in|on) ([0-9a-z ]+)\)\. died ([0-9a-z ]+)$/i,
      paramKeys: ["name", "eventPlace", "eventDate", "originalConfDate", "deathDate"],
    },
  ],
  coa: [
    // Sourcer uses data list
  ],
  soldiers_wills: [
    // Sourcer uses data list
  ],
  military_tribunals: [
    // Sourcer uses data list
  ],
  hie: [
    // Sourcer uses data list
  ],
  prison_records: [
    // Sourcer uses data list
    {
      // Example: Scotland Project
      // Duncan Robertson admitted to prison in 1848, age 16
      name: "Scotland Project format",
      regex: /^(.+) admitted to prison in (\d\d\d\d), age ([^,]+).*$/i,
      paramKeys: ["name", "eventDate", "age"],
    },
  ],
};

function getScotpRecordTypeFromSourceTitle(sourceTitle) {
  let lcSourceTitle = sourceTitle.toLowerCase();

  function findMatchingTitle(titleObjects) {
    for (let titleObject of titleObjects) {
      if (titleObject.reTitles) {
        for (let reTitle of titleObject.reTitles) {
          if (reTitle.test(sourceTitle)) {
            return titleObject;
          }
        }
      }
      if (titleObject.titles) {
        for (let title of titleObject.titles) {
          const lcTitle = title.toLowerCase();
          if (lcSourceTitle.includes(lcTitle)) {
            return titleObject;
          }
        }
      }
    }
  }

  // first check default Sourcer titles
  let matchingTitleObj = findMatchingTitle(defaultSourcerTitles);
  if (matchingTitleObj) {
    return matchingTitleObj.recordType;
  }

  // next check the NRS titles. Sourcer can optionally use these
  for (let recordTypeKey in scotpRecordTypes) {
    let recordType = scotpRecordTypes[recordTypeKey];
    const nrsTitle = recordType.collectionNrsTitle;
    if (nrsTitle) {
      let lcNrsTitle = nrsTitle.toLowerCase();
      if (lcSourceTitle.includes(lcNrsTitle)) {
        return recordTypeKey;
      }
    }
  }

  // Check Scotland Project titles
  matchingTitleObj = findMatchingTitle(scotlandProjectTitles);
  if (matchingTitleObj) {
    return matchingTitleObj.recordType;
  }

  // Check other found titles
  matchingTitleObj = findMatchingTitle(otherFoundTitles);
  if (matchingTitleObj) {
    return matchingTitleObj.recordType;
  }

  return "";
}

function cleanCitation(parsedCitation) {
  let text = parsedCitation.text;

  text = text.trim();

  // if there select a bit too much the string can have the up arrow symbol which
  // take the user back to the inline citation
  if (text.startsWith("↑")) {
    text = text.substring(1);
  }

  // replace breaks and newlines with ", "
  text = text.replace(/<\s*br\s*\/ *> *\n\ *>/g, ", ");
  text = text.replace(/<\s*br\s*\/ *> */g, ", ");
  text = text.replace(/ *\n\ */g, ", ");

  // replace any multiple white space chars with one space
  text = text.replace(/\s+/g, " ");

  // if there is a <ref> in the text then change text to be just the part inside the ref
  let startRefIndex = text.search(/\<\s*ref(?: name ?= ?"[^"]+" ?)? ?\>/i);
  if (startRefIndex != -1) {
    let startRefs = text.match(/\<\s*ref(?: name ?= ?"[^"]+" ?)? ?\>/i);
    if (!startRefs || startRefs.length != 1) {
      logMessage("Found <ref> but there is more than one.");
      return false;
    }
    let endRefs = text.match(/\<\s*\/\s*ref\s*\>/i);
    if (!endRefs || endRefs.length != 1) {
      logMessage("Found </ref> but there is more than one.");
      return false;
    }
    let endRefIndex = text.search(/\<\s*\/\s*ref\s*\>/i);
    if (endRefIndex == -1) {
      logMessage("Found <ref> but no matching </ref>. (search failed).");
      return false;
    }
    text = text.substring(startRefIndex, endRefIndex);
    // this still has the <ref> on the start
    text = text.replace(/\<\s*ref(?: name ?= ?"[^"]+" ?)?\s*\>/i, "");
    text = text.trim();
    parsedCitation.isEditMode = true;
  }

  if (text.startsWith("*")) {
    text = text.substring(1).trim();
    parsedCitation.isEditMode = true;
  }

  // check for label on start
  const labelRegex = /^(?:\'\')?(?:\'\'\')?([A-Za-z0-9\s]+)(?:\'\')?(?:\'\'\')?\s?\:(.*)$/;
  if (labelRegex.test(text)) {
    let labelText = text.replace(labelRegex, "$1");
    let remainderText = text.replace(labelRegex, "$2");
    if (labelText && labelText != text && remainderText && remainderText != text) {
      parsedCitation.labelText = labelText;
      text = remainderText.trim();
      logMessage("Found label: '" + labelText + "'. This is removed during cleanCitation.");
    }
  }

  parsedCitation.cleanText = text;
  return true;
}

function getRegexForPattern(pattern) {
  if (pattern.parts) {
    let regexSource = /^/.source;
    for (let i = 0; i < pattern.parts.length; i++) {
      regexSource += pattern.parts[i].regex.source;
    }
    regexSource += /$/.source;
    let regex = new RegExp(regexSource, "i");
    return regex;
  } else {
    return pattern.regex;
  }
}

function findMatchingCitationPattern(parsedCitation) {
  let text = parsedCitation.cleanText;

  for (let index = 0; index < citationPatterns.length; index++) {
    let pattern = citationPatterns[index];
    let regex = getRegexForPattern(pattern);

    if (regex.test(text)) {
      parsedCitation.matchingPattern = pattern;
      return true;
    }
  }

  return false;
}

function getScotpRecordTypeAndSourceTitleFromFullText(parsedCitation) {
  let text = parsedCitation.cleanText;
  let lcText = text.toLowerCase();

  function foundMatch(recordType, title, matchIndex) {
    parsedCitation.sourceTitle = title;
    let remainder = text.substring(matchIndex + title.length);
    let beforeTitle = text.substring(0, matchIndex);
    let quotesBeforeTitle = beforeTitle.match(/["'“‘]/);
    function isOdd(num) {
      return num % 2;
    }
    if (quotesBeforeTitle && isOdd(quotesBeforeTitle.length)) {
      // if there is a matching quote in remainder then remove up to (and including) it
      const startQuoteToEndQuote = {
        '"': `"`,
        "'": `'`,
        "“": `”`,
        "‘": `’`,
      };
      let lastQuoteBeforeTitle = quotesBeforeTitle[quotesBeforeTitle.length - 1];
      let matchingEndQuote = startQuoteToEndQuote[lastQuoteBeforeTitle];
      if (matchingEndQuote) {
        let quoteIndex = remainder.indexOf(matchingEndQuote);
        if (quoteIndex != -1) {
          remainder = remainder.substring(quoteIndex + 1);
        }
      }
    }
    while (remainder.startsWith('"') || remainder.startsWith(",") || remainder.startsWith(" ")) {
      remainder = remainder.substring(1);
    }
    // partial patterns expect a space at start
    parsedCitation.partialText = " " + remainder;
    parsedCitation.scotpRecordType = recordType;
  }

  function checkMatch(recordType, title) {
    let lcTitle = title.toLowerCase();
    let sourceTitleIndex = lcText.indexOf(lcTitle);
    if (sourceTitleIndex != -1) {
      foundMatch(recordType, title, sourceTitleIndex);
      return true;
    }
    return false;
  }

  function checkReMatch(recordType, reTitle) {
    let sourceTitleIndex = lcText.search(reTitle);
    if (sourceTitleIndex != -1) {
      let matches = lcText.match(reTitle);
      if (matches && matches.length > 0) {
        let title = matches[0];
        foundMatch(recordType, title, sourceTitleIndex);
        return true;
      }
    }
    return false;
  }

  function checkTitleObjects(titleObjects) {
    for (let titleObject of titleObjects) {
      if (titleObject.reTitles) {
        for (let reTitle of titleObject.reTitles) {
          if (checkReMatch(titleObject.recordType, reTitle)) {
            return true;
          }
        }
      }
      if (titleObject.titles) {
        for (let title of titleObject.titles) {
          if (checkMatch(titleObject.recordType, title)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // first check default Sourcer titles
  if (checkTitleObjects(defaultSourcerTitles)) {
    return true;
  }

  for (let recordTypeKey in scotpRecordTypes) {
    let recordType = scotpRecordTypes[recordTypeKey];
    const nrsTitle = recordType.collectionNrsTitle;
    if (nrsTitle) {
      if (checkMatch(recordTypeKey, nrsTitle)) {
        return true;
      }
    }
  }

  if (checkTitleObjects(scotlandProjectTitles)) {
    return true;
  }

  if (checkTitleObjects(otherFoundTitles)) {
    return true;
  }

  return false;
}

function findMatchingPartialCitationPattern(parsedCitation) {
  let text = parsedCitation.partialText;

  for (let index = 0; index < partialCitationPatterns.length; index++) {
    let pattern = partialCitationPatterns[index];
    let regex = getRegexForPattern(pattern);

    if (regex.test(text)) {
      parsedCitation.matchingPartialPattern = pattern;
      return true;
    }
  }

  return false;
}

function cleanCitationValue(value) {
  value = value.trim();
  while (value.endsWith(".") || value.endsWith(",")) {
    value = value.substring(0, value.length - 1).trim();
  }
  while (value.startsWith(".") || value.startsWith(",")) {
    value = value.substring(1).trim();
  }
  return value;
}

function parseTextUsingPatternParts(pattern, objectToFill, textToParse) {
  let paramIndex = 0;
  for (let part of pattern.parts) {
    if (part.paramKeys) {
      for (let key of part.paramKeys) {
        let resultIndex = paramIndex + 1;
        paramIndex++;
        let resultString = "$" + resultIndex;
        let regex = getRegexForPattern(pattern);
        let value = textToParse.replace(regex, resultString);
        if (key && value && value != textToParse) {
          objectToFill[key] = cleanCitationValue(value);
        }
      }
    }
  }
}

function parseUsingPattern(parsedCitation) {
  let pattern = parsedCitation.matchingPattern;
  let text = parsedCitation.cleanText;
  parseTextUsingPatternParts(pattern, parsedCitation, text);
}

function parseUsingPartialPattern(parsedCitation) {
  let pattern = parsedCitation.matchingPartialPattern;
  let text = parsedCitation.partialText;
  parseTextUsingPatternParts(pattern, parsedCitation, text);
}

function setName(data, parsedCitation, builder) {
  let scotpRecordType = parsedCitation.scotpRecordType;
  let name = data.name;
  let surname = data.surname;
  let forename = data.forename;
  if (surname || forename) {
    if (forename) {
      if (forename.endsWith(".")) {
        forename = forename.substring(0, forename.length - 1);
      }
      builder.addForename(forename, "exact");
    }
    if (surname) {
      // check for nee or née in name
      let neeIndex = surname.search(/(nee|née)/);
      if (neeIndex != -1) {
        surname = surname.substring(0, neeIndex).trim();
      }
      builder.addSurname(surname, "exact");
    }
    return;
  }

  if (!name) {
    return;
  }

  // check for nee or née in name
  let neeIndex = name.search(/(nee|née)/);
  if (neeIndex != -1) {
    name = name.substring(0, neeIndex).trim();
  }

  if (scotpRecordType == "coa") {
    builder.addFullName(name, "fuzzy");
    return;
  }

  let numWordsInName = StringUtils.countWords(name);
  if (numWordsInName > 1) {
    if (numWordsInName > 2 && name.toLowerCase().includes(" or ")) {
      // this handles the cases like "Christina Clark Or Pocock"
      let nameParts = name.split(" ");
      let newNameParts = [];
      for (let i = 0; i < nameParts.length; i++) {
        let namePart = nameParts[i];
        if (i < nameParts.length - 2 && nameParts[i + 1].toLowerCase() == "or") {
          let newNamePart = nameParts[i] + " or " + nameParts[i + 2];
          newNameParts.push(newNamePart);
          i += 2;
        } else {
          newNameParts.push(namePart);
        }
      }

      if (newNameParts.length > 1) {
        let forenames = newNameParts[0];
        let lastName = newNameParts[newNameParts.length - 1];

        if (newNameParts.length > 2) {
          for (let i = 1; i < newNameParts.length - 1; i++) {
            forenames += " " + newNameParts[i];
          }
        }

        if (forenames && forenames.endsWith(".")) {
          forenames = forenames.substring(0, forenames.length - 1);
        }

        builder.addForename(forenames, "exact");
        builder.addSurname(lastName, "exact");
        return;
      } else {
        builder.addSurname(newNameParts[0], "exact");
        return;
      }
    }
    let forenames = StringUtils.getWordsBeforeLastWord(name);
    let lastName = StringUtils.getLastWord(name);

    if (forenames && forenames.endsWith(".")) {
      forenames = forenames.substring(0, forenames.length - 1);
    }

    builder.addForename(forenames, "exact");
    builder.addSurname(lastName, "exact");
  } else {
    // there is only one name, use may depend on record type
    // for now assume it is surname
    builder.addSurname(name, "exact");
  }
}

function setParents(data, parsedCitation, builder) {
  let scotpRecordType = parsedCitation.scotpRecordType;
  let searchOption = "exact";
  if (ScotpRecordType.hasSearchFeature(scotpRecordType, SpFeature.parents)) {
    if (data.fatherName) {
      builder.addParentName(data.fatherName, searchOption);
    }
    if (data.motherName) {
      builder.addParentName(data.motherName, searchOption);
    }
  }

  if (ScotpRecordType.hasSearchFeature(scotpRecordType, SpFeature.mmn)) {
    let mmn = data.mmn;
    if (mmn) {
      builder.addMothersMaidenName(mmn, searchOption);
    }
  }
}

function setSpouse(data, parsedCitation, builder) {
  let scotpRecordType = parsedCitation.scotpRecordType;

  if (ScotpRecordType.hasSearchFeature(scotpRecordType, SpFeature.spouse)) {
    let spouseName = data.spouseName;
    const searchOption = "exact";

    if (spouseName) {
      let neeIndex = spouseName.search(/(nee|née)/);
      if (neeIndex != -1) {
        spouseName = spouseName.substring(0, neeIndex).trim();
      }

      let numWordsInName = StringUtils.countWords(spouseName);
      if (numWordsInName > 1) {
        let forenames = StringUtils.getWordsBeforeLastWord(spouseName);
        let lastName = StringUtils.getLastWord(spouseName);

        if (forenames && forenames.endsWith(".")) {
          forenames = forenames.substring(0, forenames.length - 1);
        }

        if (forenames) {
          builder.addSpouseForename(forenames, searchOption);
        }

        if (lastName) {
          builder.addSpouseSurname(lastName, searchOption);
        }
      } else {
        // there is only one name, use may depend on record type
      }

      // some record types use full name instead of separate names
      let fullName = spouseName;

      if (fullName) {
        builder.addSpouseFullName(fullName, searchOption);
      }
    } else if (data.spouseLastName) {
      builder.addSpouseSurname(data.spouseLastName, searchOption);
    }
  }
}

function setDates(data, parsedCitation, builder) {
  let scotpRecordType = parsedCitation.scotpRecordType;

  let eventDate = data.eventDate;
  let birthDate = data.birthDate;

  // check for values from data list
  if (!eventDate) {
    eventDate = data.year;
  }

  // census has the year in the source title and not in data sentence
  if (!eventDate) {
    if (scotpRecordType == "census_lds") {
      eventDate = "1881";
    } else if (scotpRecordType == "census") {
      let sourceTitle = parsedCitation.sourceTitle;
      let year = sourceTitle.replace(/^.*(\d\d\d\d).*$/, "$1");
      if (year && year != sourceTitle) {
        eventDate = year;
      }
    }
  }

  if (scotpRecordType == "cr_baptisms" || scotpRecordType == "ch3_baptisms") {
    // search actually works off birthDate rather than baptism date
    if (birthDate) {
      eventDate = birthDate;
      birthDate = "";
    }
  }

  // For coa it could be of the form 27/11/1899
  const ddmmyyyRegex = /\d\d\/\d\d\/(\d\d\d\d)/;
  if (ddmmyyyRegex.test(eventDate)) {
    let year = eventDate.replace(ddmmyyyRegex, "$1");
    if (year && year != eventDate) {
      eventDate = year;
    }
  }

  let parsedDate = DateUtils.parseDateString(eventDate);

  if (!parsedDate.isValid || !parsedDate.yearNum) {
    return;
  }

  let yearString = parsedDate.yearNum.toString();

  let eventClass = ScotpRecordType.getEventClass(scotpRecordType);

  // census is special in that there is no date range
  if (eventClass == SpEventClass.census) {
    builder.addYear(yearString);
    return; // return as census is special case
  }

  if (scotpRecordType == "vr") {
    // another special case. In this case only one year can be specified
    builder.addYear(yearString);
    return; // return as vr is special case
  }

  if (scotpRecordType == "military_tribunals" || scotpRecordType == "hie") {
    // another special case. In this case we just don't specify a year
    return;
  }

  builder.addStartYear(yearString);
  builder.addEndYear(yearString);

  // in some cases the search allows the birth date - e.g. searching stat deaths
  if (birthDate && ScotpRecordType.hasSearchFeature(scotpRecordType, SpFeature.birthYear)) {
    let parsedDate = DateUtils.parseDateString(birthDate);

    if (parsedDate.isValid && parsedDate.yearNum) {
      let yearString = parsedDate.yearNum.toString();
      builder.addBirthYear(yearString, 0);
    }
  }
}

function setAge(data, parsedCitation, builder) {
  let scotpRecordType = parsedCitation.scotpRecordType;

  let targetHasAgeRange = ScotpRecordType.hasSearchFeature(scotpRecordType, SpFeature.ageRange);
  let targetHasAge = ScotpRecordType.hasSearchFeature(scotpRecordType, SpFeature.age);

  if (!targetHasAgeRange && !targetHasAge) {
    return;
  }

  let age = data.age;

  if (!age) {
    return;
  }

  builder.addAgeRange(age, age);
}

function setPlace(data, parsedCitation, builder) {
  let scotpRecordType = parsedCitation.scotpRecordType;

  // we need to find a place name that could be used as a place to search
  // which one to use depends on the type of record being searched and on the
  // source data.

  // eventClass is : birth, death, marriage, divorce, census or other
  let searchEventClass = ScotpRecordType.getEventClass(scotpRecordType);

  let countySearchParam = ScotpRecordType.getSearchField(scotpRecordType, SpField.county);
  if (countySearchParam && ScotpRecordType.hasSearchFeature(SpFeature.county)) {
    if (data.cityCounty) {
      builder.addSelectField(countySearchParam, data.cityCounty);
    }
  }

  let addedPlace = false;
  // Registration district
  if (ScotpRecordType.hasSearchFeature(scotpRecordType, SpFeature.rd)) {
    if (data.rdName) {
      if (builder.addRdName(data.rdName, false)) {
        addedPlace = true;
      }
    }
  }

  // OPR parish
  if (!addedPlace && ScotpRecordType.hasSearchFeature(scotpRecordType, SpFeature.oprParish)) {
    if (data.parish) {
      if (builder.addOprParishName(data.parish, false)) {
        addedPlace = true;
      }
    }
  }

  // Catholic parish
  if (!addedPlace && ScotpRecordType.hasSearchFeature(scotpRecordType, SpFeature.rcParish)) {
    if (data.parish) {
      if (builder.addCatholicParishName(data.parish, false)) {
        addedPlace = true;
      }
    }
  }
}

function setGender(data, parsedCitation, builder) {
  let scotpRecordType = parsedCitation.scotpRecordType;

  if (!data.gender) {
    return;
  }

  if (ScotpRecordType.hasSearchFeature(scotpRecordType, SpFeature.gender)) {
    let gender = data.gender.toLowerCase();
    if (gender == "m") {
      gender = "male";
    } else if (gender == "f") {
      gender = "female";
    }

    builder.addGender(gender);
  }
}

function addDataToBuilder(parsedCitation, data, builder) {
  setName(data, parsedCitation, builder);
  setGender(data, parsedCitation, builder);
  setAge(data, parsedCitation, builder);
  setDates(data, parsedCitation, builder);
  setParents(data, parsedCitation, builder);
  setSpouse(data, parsedCitation, builder);
  setPlace(data, parsedCitation, builder);
}

function addListValueToData(label, value, parsedCitation, data) {
  function getYearFromDate(dateString) {
    const ddmmyyyyRegex = /(\d\d)?\/(\d\d)?\/(\d\d\d\d)/;

    if (ddmmyyyyRegex.test(dateString)) {
      let year = dateString.replace(ddmmyyyyRegex, "$3");
      if (year) {
        return year;
      }
    }

    const yyyyRegex = /(\d\d\d\d)/;
    if (yyyyRegex.test(dateString)) {
      let year = dateString.replace(ddmmyyyyRegex, "$1");
      if (year) {
        return year;
      }
    }

    return "";
  }

  let lcLabel = label.toLowerCase();

  if (lcLabel == "surname") {
    data.surname = value;
  } else if (lcLabel == "forename" || lcLabel == "forenames") {
    data.forename = value;
  } else if (lcLabel == "full name") {
    data.name = value;
  } else if (lcLabel == "gender") {
    data.gender = value;
  } else if (lcLabel == "parents/other details") {
    let parents = value.split("/");
    if (parents.length == 2) {
      data.fatherName = parents[0].trim();
      data.motherName = parents[1].trim();
    }
  } else if (lcLabel == "birth date") {
    let eventClass = ScotpRecordType.getEventClass(parsedCitation.scotpRecordType);
    if (eventClass == SpEventClass.birth) {
      let year = getYearFromDate(value);
      if (year) {
        data.eventDate = year;
      }
    }
  } else if (lcLabel == "event date" || lcLabel == "date of appeal" || lcLabel == "departure date") {
    let year = getYearFromDate(value);
    if (year) {
      data.eventDate = year;
    }
  } else if (lcLabel == "parish") {
    data.parish = value;
  } else if (lcLabel == "court") {
    data.court = value;
  } else if (lcLabel == "year" || lcLabel == "year admitted") {
    data.year = value;
  } else if (lcLabel == "grant year") {
    data.year = value;
  } else if (lcLabel == "age at census") {
    data.age = value;
  } else if (lcLabel == "rd name") {
    data.rdName = value;
  } else if (lcLabel == "county / city" || lcLabel == "county/city" || "county") {
    data.countyCity = value;
  } else if (lcLabel == "ref") {
    data.ref = value;
  }
}

function parseSemiColonColonDataList(dataString, parsedCitation, data) {
  let items = dataString.split(";");
  for (let item of items) {
    let parts = item.split(":");
    if (parts.length == 2) {
      let label = parts[0].trim();
      let value = parts[1].trim();
      addListValueToData(label, value, parsedCitation, data);
    }
  }
}

function parseCommaColonDataList(dataString, parsedCitation, data) {
  let items = dataString.split(",");
  for (let item of items) {
    let parts = item.split(":");
    if (parts.length == 2) {
      let label = parts[0].trim();
      let value = parts[1].trim();
      addListValueToData(label, value, parsedCitation, data);
    }
  }
}

function parseCommaOnlyDataList(dataString, parsedCitation, data) {
  const possibleLabels = [
    "surname",
    "forename",
    "parents/other details",
    "gender",
    "birth date",
    "parish",
    "year",
    "age at census",
    "rd name",
    "county / city",
  ];

  let items = dataString.split(",");
  for (let item of items) {
    let field = item.trim();
    let lcField = field.toLowerCase();
    for (let possibleLabel of possibleLabels) {
      if (lcField.startsWith(possibleLabel)) {
        let label = possibleLabel;
        let value = field.substring(possibleLabel.length + 1).trim();
        addListValueToData(label, value, parsedCitation, data);
        break;
      }
    }
  }
}

function parseDataList(dataString, parsedCitation, builder) {
  let data = {};

  // Semi-colon and colon example:
  // surname: connan; forename: peter; parents/other details: james connan/mary mcgregor; gender: m; birth date: 01/06/1823; parish: monzie.
  // Comma and colon example:
  // surname: connan, forename: peter, parents/other details: james connan/mary mcgregor, gender: m, birth date: 01/06/1823, parish: monzie.
  // Comma only example:
  // surname connan, forename peter, parents/other details james connan/mary mcgregor, gender m, birth date 01/06/1823, parish monzie.
  let semicolons = dataString.match(/;/g);
  let colons = dataString.match(/:/g);

  if (semicolons && semicolons.length && colons && colons.length && semicolons.length == colons.length - 1) {
    parseSemiColonColonDataList(dataString, parsedCitation, data);
  } else if (colons && colons.length) {
    parseCommaColonDataList(dataString, parsedCitation, data);
  } else {
    parseCommaOnlyDataList(dataString, parsedCitation, data);
  }

  logMessage("Parsed data string as a list. Data is:");
  for (let key in data) {
    logMessage("  " + key + ": " + data[key]);
  }

  addDataToBuilder(parsedCitation, data, builder);

  parsedCitation.data = data;

  return true;
}

function parseDataSentence(dataString, parsedCitation, builder) {
  let data = {};

  function cleanDataValue(value) {
    value = value.trim();
    if (value.endsWith(".")) {
      value = value.substring(0, value.length - 1);
    }
    value = value.trim();
    if (value.endsWith(",")) {
      value = value.substring(0, value.length - 1);
    }
    value = value.trim();
    if (value.endsWith(";")) {
      value = value.substring(0, value.length - 1);
    }
    value = value.trim();
    return value;
  }

  let matchedPattern = false;
  let matchingPattern = "";
  let patterns = dataStringSentencePatterns[parsedCitation.scotpRecordType];
  if (patterns) {
    for (let pattern of patterns) {
      if (pattern.regex.test(dataString)) {
        for (let i = 0; i < pattern.paramKeys.length; i++) {
          let key = pattern.paramKeys[i];
          let resultIndex = i + 1;
          let resultString = "$" + resultIndex;
          let value = dataString.replace(pattern.regex, resultString);
          if (key && value && value != dataString) {
            data[key] = cleanDataValue(value);
          }
        }
        matchedPattern = true;
        matchingPattern = pattern;
        break;
      }
    }
  }

  if (matchedPattern) {
    logMessage("Parsed data string as a sentence. Pattern name is: '" + matchingPattern.name + "'");
    logMessage("Pattern regular expression used was:");
    logMessage(matchingPattern.regex.source);
    logMessage("Data is:");
    for (let key in data) {
      logMessage("  " + key + ": " + data[key]);
    }

    addDataToBuilder(parsedCitation, data, builder);
    parsedCitation.data = data;

    return true;
  }

  return false;
}

function parseDataString(parsedCitation, builder) {
  // first need to determine if it is a sentence or a list

  let dataString = parsedCitation.dataString;

  if (dataString) {
    dataString = dataString.trim();
    if (dataString.endsWith(";")) {
      // this can happen if there is a "; citing " after data string
      dataString = dataString.substring(0, dataString.length - 1);
    }

    logMessage("Data string is :\n----------------\n" + dataString + "\n----------------");

    if (parseDataSentence(dataString, parsedCitation, builder)) {
      return;
    }

    // no matched sentence pattern, try a list
    let lcDataString = dataString.toLowerCase();
    if (lcDataString.includes("surname") || lcDataString.includes("full name")) {
      if (parseDataList(dataString, parsedCitation, builder)) {
        return;
      }
    }

    logMessage("Data string does not look like a valid sentence or list.");
  }

  // sometimes the data got put in the SourceReference e.g. scotproj_stat_deaths_corrected
  // in that case though it still doesn't find any results as it seems a made up case with a date
  // of 2028
  dataString = parsedCitation.sourceReference;
  if (dataString) {
    dataString = dataString.trim();
    if (dataString.endsWith(";")) {
      // this can happen if there is a "; citing " after data string
      dataString = dataString.substring(0, dataString.length - 1);
    }

    if (parseDataSentence(dataString, parsedCitation, builder)) {
      return;
    }

    // no matched sentence pattern, try a list
    if (dataString.includes("surname") || dataString.includes("full name")) {
      if (parseDataList(dataString, parsedCitation, builder)) {
        return;
      }
    }
  }
}

function extractReferenceNumber(parsedCitation) {
  let refNum = "";

  const standardRegexes = [
    /^.*reference number[\.,:]? ([a-z0-9 \/]+).*$/i,
    /^.*reference[\.,:]? ([a-z0-9 \/]+).*$/i,
    /^.*ref number[\.,:]? ([a-z0-9 \/]+).*$/i,
    /^.*ref num[\.,:]? ([a-z0-9 \/]+).*$/i,
    /^.*ref no[\.,:]? ([a-z0-9 \/]+).*$/i,
    /^.*ref[\.,:]? ([a-z0-9 \/]+).*$/i,
  ];

  const nonStandardRegexes = [/^.*Statutory Registers no[\.,:]? ([a-z0-9 \/]+).*$/i];

  function extractFromTextString(text, regexes) {
    for (let regex of regexes) {
      if (regex.test(text)) {
        let num = text.replace(regex, "$1");
        if (num && num != text) {
          refNum = num;
          break;
        }
      }
    }

    // another way is to look for what this record type would use.
    if (!refNum) {
      let refName = ScotpRecordType.getRecordKey(parsedCitation.scotpRecordType, "ref");
      if (refName) {
        let lcRefName = refName.toLowerCase();
        let lcSourceReference = text.toLowerCase();
        let index = lcSourceReference.indexOf(lcRefName);
        if (index != -1) {
          let remainder = lcSourceReference.substring(index + lcRefName.length);
          let num = remainder.replace(/^:? ([a-z0-9 \/]+).*$/, "$1");
          if (num && num != remainder) {
            refNum = num;
          }
        }
      }
    }
  }

  // See if we can extract a reference number from sourceReference
  if (parsedCitation.sourceReference) {
    let sourceReference = parsedCitation.sourceReference;
    logMessage("Source reference is : " + sourceReference);

    extractFromTextString(sourceReference, standardRegexes);

    if (!refNum) {
      logMessage("No ref number found in source reference");
    }
  }

  if (!refNum) {
    // either there is no source reference or it doesn't contain a ref num
    // It is possible that it is in the data if the data string was a list
    if (parsedCitation.data) {
      let dataRef = parsedCitation.data.ref;
      if (dataRef) {
        refNum = dataRef;
      }
    }
  }

  if (!refNum) {
    // check the data string for a refNum, it could have been parsed as a sentence but have
    // been put in the place name
    if (parsedCitation.dataString) {
      extractFromTextString(parsedCitation.dataString, standardRegexes);
    }
  }

  // if still nothing try non-standard labels
  if (!refNum) {
    if (parsedCitation.dataString) {
      extractFromTextString(parsedCitation.sourceReference, nonStandardRegexes);
      if (refNum) {
        logMessage("Found ref num using non-standard label");
      }
    }
  }
  if (!refNum) {
    if (parsedCitation.dataString) {
      extractFromTextString(parsedCitation.dataString, nonStandardRegexes);
      logMessage("Found ref num in data string using non-standard label");
    }
  }

  return refNum;
}

function buildScotlandsPeopleContextSearchData(text) {
  messages = ""; // reset messages

  let lcText = text.toLowerCase();

  //console.log("buildScotlandsPeopleContextSearchData, lcText is:");
  //console.log(lcText);

  // To be Scotlands People we need some identifiers
  if (!(lcText.includes("scotlandspeople") || lcText.includes("scotlands people"))) {
    //console.log("buildScotlandsPeopleContextSearchData, no scotlandspeople found");
    return { messages: messages };
  }

  let parsedCitation = {
    text: text,
    lcText: lcText,
  };

  if (!cleanCitation(parsedCitation)) {
    logMessage("Could not clean citation.");
    return { messages: messages };
  }
  logMessage("Clean citation is :\n----------------\n" + parsedCitation.cleanText + "\n----------------");

  //console.log("buildScotlandsPeopleContextSearchData, after cleanCitation, parsedCitation is:");
  //console.log(parsedCitation);

  let foundPattern = findMatchingCitationPattern(parsedCitation);

  //console.log("buildScotlandsPeopleContextSearchData, after findMatchingCitationPattern, parsedCitation is:");
  //console.log(parsedCitation);

  if (foundPattern) {
    logMessage("Found matching citation pattern. Pattern name is: '" + parsedCitation.matchingPattern.name + "'");

    parseUsingPattern(parsedCitation);
    if (!parsedCitation.sourceTitle) {
      logMessage("After parsing using pattern the soutrce title is empty.");
      return { messages: messages };
    }

    logMessage("Source Title is : " + parsedCitation.sourceTitle);

    let scotpRecordType = getScotpRecordTypeFromSourceTitle(parsedCitation.sourceTitle);
    if (!scotpRecordType) {
      logMessage("Source title not recognized. Will try a partial match.");
    } else {
      parsedCitation.scotpRecordType = scotpRecordType;
    }
    logMessage("Identified ScotP record type as : " + parsedCitation.scotpRecordType);
  } else {
    logMessage("Could not find a matching citation pattern.");
  }

  if (!parsedCitation.scotpRecordType) {
    logMessage("Trying for a partial citation pattern match.");

    if (!getScotpRecordTypeAndSourceTitleFromFullText(parsedCitation)) {
      logMessage("Could not find any known source title text.");
      return { messages: messages };
    }

    logMessage("Source Title is : " + parsedCitation.sourceTitle);
    logMessage(
      "Partial citation remaining is :\n----------------\n" + parsedCitation.partialText + "\n----------------"
    );

    let foundPartialPattern = findMatchingPartialCitationPattern(parsedCitation);
    if (foundPartialPattern) {
      logMessage(
        "Found matching partial citation pattern. Pattern name is: '" + parsedCitation.matchingPartialPattern.name + "'"
      );
      logMessage("Identified ScotP record type as : " + parsedCitation.scotpRecordType);
      parseUsingPartialPattern(parsedCitation);
    } else {
      logMessage("Could not find a matching partial citation pattern.");
      return { messages: messages };
    }
  }

  var builder = new ScotpFormDataBuilder(parsedCitation.scotpRecordType);

  parseDataString(parsedCitation, builder);

  let searchData = builder.getFormData();

  let refNum = extractReferenceNumber(parsedCitation);
  if (refNum) {
    logMessage("Ref number is : " + refNum);

    searchData.refNum = refNum;
    searchData.recordType = parsedCitation.scotpRecordType;
  } else {
    logMessage("No ref number found");
  }

  //console.log("buildScotlandsPeopleContextSearchData, returning, searchData is:");
  //console.log(searchData);

  return { messages: messages, searchData, searchData };
}

export { buildScotlandsPeopleContextSearchData };
