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
import { getPlaceSearchTerms } from "./scotp_place_search_terms.mjs";

var messages = "";

function logMessage(message) {
  if (messages) {
    messages += "\n";
  }
  messages += message;
}

// To debug regex matches use: https://regex101.com/r/vY0iK9/1

// NOTE: All patterns try to handle the optional accessed date in all three options
// This non-capturing group should match all possibilities
// (?: ?\(accessed [^\)]+\),? ?| ?\: ?accessed [^\)]+\),? ?| |,|, )
const cpParish = {
  regex: /(.*),? ?/,
  paramKeys: ["parish"],
};
const cpTitle = {
  regex: /["']([^"']+)["'],?/,
  paramKeys: ["sourceTitle"],
};
const cpDb = {
  regex: /(?: database with images| database| \[?database online\]?)?,? ?/,
};
const cpOwner = {
  // If this is followed by sourceRef they could be all put in this group
  // so we have to exclude some characters
  regex: /([^;:(\[]*),? ?/,
  paramKeys: ["websiteCreatorOwner"],
};
const cpRef = {
  regex: /([^(]*),? ?/,
  paramKeys: ["sourceReference"],
};
const cpLinkA = {
  regex:
    /\(?(?:scotlandspeople,?\.? \(?(?:https?\:\/\/)?www\.scotlandspeople\.gov\.uk[^\: ]*|(?:https?\:\/\/)?www\.scotlandspeople\.gov\.uk[^\: ]*|scotlandspeople search|scotlandspeople \(?(?:digital database|database online|database)\)?|scotlandspeople)/,
};
const cpLinkAEdit = {
  regex: /\(?\[https?\:\/\/www\.scotlandspeople\.gov\.uk.* scotlandspeople(?: search)?\]/,
};
const cpLinkB = {
  regex:
    /(?: ?\((?:image )?(?:last )?(?:accessed|viewed) [^\)]+\),? ?| ?\: ?(?:image )?(?:last )?(?:accessed|viewed) [^\)]+\),? ?| |,|, )(?:image,? ?)?/,
};
const cpLinkANoParens = {
  regex:
    /(?:scotlandspeople,?\.? (?:https?\:\/\/)?www\.scotlandspeople\.gov\.uk[^\: ]*|(?:https?\:\/\/)?www\.scotlandspeople\.gov\.uk[^\: ]*|scotlandspeople search|scotlandspeople \(digital database\)|scotlandspeople)/,
};
const cpLinkAEditNoParens = {
  regex: /\[https?\:\/\/www\.scotlandspeople\.gov\.uk.* scotlandspeople(?: search)?\]/,
};
const cpLinkBNoParens = {
  regex:
    /(?: ?(?:\: ?)?(?:image )?(?:last )?(?:accessed|viewed) [^\.,]+.?,? ?| ?\: ?(?:image )?(?:last )?(?:accessed|viewed) [^\.,]+\)\.?,? ?| |,|, )(?:image,? ?)?/,
};
const cpLinkBare = {
  regex: / ?(?:https?\:\/\/)?www\.scotlandspeople\.gov\.uk[^\: ]*/,
};
const cpData = {
  regex: /(.*)/,
  paramKeys: ["dataString"],
};
const cpCitingRef = {
  regex: /[;,]? ?citing(?: |: | - )(.*)/,
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
    parts: [cpParish, cpTitle, cpDb, cpOwner, cpLinkA, cpLinkB, cpData, cpCitingRef],
  },
  {
    // St John's, Port Glasgow, "Catholic Registers Births and Baptisms" database, National Records of Scotland, ScotlandsPeople (https://www.scotlandspeople.gov.uk : accessed 21 Feb 2021), William McAtasny, birth 31 Dec 1867 and baptism 1 Apr 1868, son of William McAtasny and Margaret McIlveny.
    name: "Scotland Project style with parish/place before source title, no source reference",
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
  {
    // ↑ "Statutory Register of Marriages", National Records of Scotland, Ref: 335/7. ScotlandsPeople (digital database) Accessed 25 Apr 2023 John Alexander Algie marriage to Penelope Anders[on] Monro registered 1924 in Blairgowrie.
    name: "Non-standard: Source Title not in quotes and non-standard. No colon before accessed",
    parts: [cpTitle, cpDb, cpOwner, cpRef, cpLinkANoParens, cpLinkBNoParens, cpData],
  },
];

const partialCitationPatterns = [
  {
    // Canongate, Edinburgh. 29 August 1795. CRAW Arthur and HASTIE, Jean. 685/ 3 160/ 127. http://www.scotlandspeople.gov.uk : last accessed 9 June 2024.
    name: "Non-standard: Source Title not in quotes and non-standard. Colon in weird place",
    parts: [cpData, cpLinkANoParens, cpLinkBNoParens],
  },
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
  {
    name: "Non-standard form with bare link at end",
    parts: [cpData, /(?: from)?/, cpLinkBare],
  },
  {
    name: "Non-standard form with no link",
    parts: [cpData],
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
    titles: ["Statutory Births"],
    reTitles: [
      /(?:Scotland )?Statutory Births?(?: Records?| Index(?:es))/i,
      /Statutory(?: Registers? ?(?:of|:|-)?)? ?Births(?: \d\d\d\d(?: ?- ?| ?: ?| to )present)?/i,
    ],
    reTitlesPlusKeyword: [
      {
        titleRegex: /Statutory Registers/i,
        keywordRegex: /Birth of /i,
      },
    ],
  },
  {
    recordType: "stat_marriages",
    titles: ["Statutory Marriages"],
    reTitles: [
      /(?:Scotland )?Statutory Marriages?(?: Records?| Index(?:es))/i,
      /Statutory(?: Registers? ?(?:of|:|-)?)? ?Marriages(?: \d\d\d\d(?: ?- ?| ?: ?| to )present)?/i,
    ],
    reTitlesPlusKeyword: [
      {
        titleRegex: /Statutory Registers/i,
        keywordRegex: /Marriage of /i,
      },
    ],
  },
  {
    recordType: "stat_divorces",
    titles: ["Statutory Divorces", "Statutory Registers: Divorces"],
    reTitles: [
      /(?:Scotland )?Statutory Divorces?(?: Records?| Index(?:es))/i,
      /Statutory(?: Registers? ?(?:of|:|-)?)? ?Divorces(?: \d\d\d\d(?: ?- ?| ?: ?| to )present)?/i,
    ],
  },
  {
    recordType: "stat_deaths",
    titles: ["Statutory Deaths", "Statutory Registers: Deaths"],
    reTitles: [
      /(?:Scotland )?Statutory Deaths?(?: Records?| Index(?:es))/i,
      /Statutory(?: Registers? ?(?:of|:|-)?)? ?Deaths(?: \d\d\d\d(?: ?- ?| ?: ?| to )present)?/i,
    ],
    reTitlesPlusKeyword: [
      {
        titleRegex: /Statutory Registers/i,
        keywordRegex: /Death of /i,
      },
    ],
  },
  {
    recordType: "stat_civilpartnerships",
    titles: ["Statutory Civil Partnerships"],
    reTitles: [
      /(?:Scotland )?Statutory Civil Partnerships?(?: Records?| Index(?:es))/i,
      /Statutory(?: Registers? ?(?:of|:|-)?)? ?(?:Civil )?Partnerships(?: \d\d\d\d(?: ?- ?| ?: ?| to )present)?/i,
    ],
  },
  {
    recordType: "stat_dissolutions",
    titles: ["Statutory Civil Dissolutions", "Statutory Dissolutions"],
    reTitles: [
      /(?:Scotland )?Statutory Civil Dissolutions?(?: Records?| Index(?:es))/i,
      /Statutory(?: Registers? ?(?:of|:|-)?)? ?(?:Civil )?Dissolutions(?: \d\d\d\d(?: ?- ?| ?: ?| to )present)?/i,
    ],
  },
  {
    recordType: "opr_births",
    reTitles: [
      /Church of Scotland ?[:-]? Old Parish Registers ?[:-] Births (?:and|&) Baptisms/i,
      /Old Parish Registers ?[:-] ?Births(?: ?(?:and|&) ?Baptisms)?/i,
      /OPR Baptisms? index(?:es)?/i,
      /OPR Births? index(?:es)?/i,
    ],
    titles: ["Births (OPR) Scotland"],
  },
  {
    recordType: "opr_marriages",
    reTitles: [
      /Church of Scotland ?[:-]? Old Parish Registers ?[:-] Banns (?:and|&) Marriages/i,
      /Old Parish Registers ?[:-] Banns (?:and|&) Marriages/i,
      /OPR Marriages? index(?:es)?/i,
    ],
    titles: ["Marriages (OPR) Scotland"],
  },
  {
    recordType: "opr_deaths",
    titles: ["Deaths (OPR) Scotland"],
    reTitles: [
      /(?:Church of Scotland:? )?Old Parish Registers(?: - | )(?:Deaths? (?:and|&) Burials?|Deaths?|Burials?)/i,
      /OPR Deaths? index(?:es)?/i,
      /OPR Burials? index(?:es)?/i,
    ],
  },
  {
    recordType: "cr_baptisms",
    titles: [],
    reTitles: [
      /Church of Scotland ?[:-]? Catholic Registers ?[:-] Births (?:and|&) Baptisms/i,
      /Catholic Registers ?[:-] ?Births(?: ?(?:and|&) ?Baptisms)?/i,
      /Church of Scotland ?[:-]? Catholic Registers ?[:-] ?Baptisms/i,
      /Catholic Registers ?[:-] ?Baptisms?/i,
    ],
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
    reTitles: [
      /1881 LDS Census of Scotland/i,
      /1881 Scotland LDS Census/i,
      /Census 1881 LDS Scotland/i,
      /Census LSD 1881 Scotland/i,
    ],
    titles: [],
  },
  {
    recordType: "census",
    titles: [],
    reTitles: [/\d\d\d\d Census of Scotland/i, /\d\d\d\d Scotland Census/i],
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

// sp means "sentence part"
const spName = {
  regex: /([^,:0-9]+)/,
  paramKeys: ["name"],
};
const spSpouse = {
  regex: /([^,:0-9]+)/,
  paramKeys: ["spouseName"],
};
const spSpouseLastName = {
  regex: /([^,:0-9]+)/,
  paramKeys: ["spouseLastName"],
};
const spNameAndSpouse = {
  regex: /([^,0-9]+),? (?:and|&|\/) ([^,0-9]+)/,
  paramKeys: ["name", "spouseName"],
};
const spEventYear = {
  regex: /(?:, in | in |, |,| )(\d\d\d\d)/,
  paramKeys: ["eventDate"],
};
const spEventDate = {
  // allows for double dating being added by user i.e. \d\d\d\d(?:\/\d\d?)
  regex:
    /(?:, on or after| on or after|, in |, on | in | on |, |\. |,|\.| )(\d?\d [a-z]+ \d\d\d\d(?:\/\d\d?)?|[a-z]+ \d\d\d\d(?:\/\d\d?)?|\d\d\d\d(?:\/\d\d?)?|\d\d?\/\d\d?\/\d\d\d\d)/,
  paramKeys: ["eventDate"],
};
const spEventDateNoWs = {
  regex: /(\d?\d [a-z]+ \d\d\d\d|\d\d\d\d)/,
  paramKeys: ["eventDate"],
};
const spEventPlace = {
  regex: /(?:, in |, at |, on | in | at | on |, |,| )(.+)/,
  paramKeys: ["eventPlace"],
};
const spEventPlaceNoWs = {
  regex: /(.+)/,
  paramKeys: ["eventPlace"],
};
const spNameOrPlaceNoWs = {
  regex: /([^;:]+)/,
  paramKeys: ["nameOrPlace"],
};
const spRdName = {
  // has an optional "in" on start but often it has to be called as a separate part
  // to avoid ambiguity
  regex: /(?:, in | in |, |,| )([^;0-9]+)/,
  paramKeys: ["rdName"],
};
const spRdNameNoWs = {
  regex: /([^;0-9]+)/,
  paramKeys: ["rdName"],
};
const spParishName = {
  regex: /(?:, in | in |, |,| )([^;0-9]+)/,
  paramKeys: ["parish"],
};
const spCourt = {
  regex: /(?:, in | in |, |,| )([a-z&\(\) ,]+)/,
  paramKeys: ["court"],
};
const spCountyCity = {
  regex: /(?:, in | in |, |,| )(.+)/,
  paramKeys: ["countyCity"],
};
const spMmn = {
  regex: /(?:, |,| )(?:mother's maiden name|mother's ms) ([^,0-9]+)/,
  paramKeys: ["mmn"],
};
const spGender = {
  regex: /(?:, |,| )(male|female|m|f)/,
  paramKeys: ["gender"],
};
const spAge = {
  regex: /(?:, |,| )\(?aged? ([^;,\)]+)\)?/,
  paramKeys: ["age"],
};
const spAgeNoWs = {
  regex: /age ([^;,]+)/,
  paramKeys: ["age"],
};
const spAgeNoLabel = {
  regex: /(?:, |,| )([^;,]+)/,
  paramKeys: ["age"],
};
const spAgeNoLabelOrWs = {
  regex: /([^;,]+)/,
  paramKeys: ["age"],
};
const spChildOfTwoParents = {
  regex: /(?:, |,| )(?:lawful )?(?:son|daughter|child) of (?:parents )?([^,&0-9]+)(?: and | ?& ?| ?\/ ?)([^,&0-9]+)/,
  paramKeys: ["fatherName", "motherName"],
};
const spChildOfOneParent = {
  regex: /(?:, |,| )(?:son|daughter|child) of ([^,&0-9]+)/,
  paramKeys: ["fatherName"],
};
const spTwoParents = {
  regex: /(?:, |,| )([^,&0-9]+)(?: and | ?& ?| ?\/ ?)([^,&0-9]+)/,
  paramKeys: ["fatherName", "motherName"],
};
const spOneParent = {
  regex: /(?:, |,| )([^,&0-9]+)/,
  paramKeys: ["fatherName"],
};
const spBirthDate = {
  regex: /,? \(?(?:birth date|born|birth):? (\d?\d [a-z]+ \d\d\d\d|\d\d\d\d)\)?/,
  paramKeys: ["birthDate"],
};
const spBirthPlace = {
  regex: /,? (?:born in|birth place:?) (.+)/,
  paramKeys: ["birthPlace"],
};
const spWill = {
  regex: /(?:will or testament of |will of |inventory for |probate of will of )/,
};
const spOrigConfDate = {
  regex: /,? \(original confirmation (?:in|on) (\d?\d [a-z]+ \d\d\d\d|\d\d\d\d)\)/,
  paramKeys: ["originalConfDate"],
};
const spCauseOfDeath = {
  regex: /,? cause of death:? .*/,
  paramKeys: ["causeOfDeath"],
};
const spNameSurnameFirst = {
  // "CRAW Arthur" or "HASTIE, Jean"
  // have to allow for commas
  regex: /([^0-9]+)/,
  paramKeys: ["nameSurnameFirst"],
};
const spNameAndSpouseSurnameFirst = {
  // CRAW Arthur and HASTIE, Jean
  // have to allow for commas
  regex: /([^0-9]+),? (?:and|&|\/) ([^0-9]+)/,
  paramKeys: ["nameSurnameFirst", "spouseNameSurnameFirst"],
};
const spRefNum = {
  regex: /(?:, |,| )([0-9 \/]+)/,
  paramKeys: ["ref"],
};
const spRefCode = {
  regex: /(?:, |,| )([0-9a-z \/]+)/,
  paramKeys: ["ref"],
};
const spParishNum = {
  regex: /(?:, |,| )([0-9 \/]+)/,
  paramKeys: ["parishNum"],
};

// the "parts" member is an array, each member can be either a part object, a string or a RegExp
const dataStringSentencePatterns = {
  stat_births: [
    {
      // Sourcer generated. Example:
      // Helen McCall A'Hara birth registered 1888 in Anderston, mother's maiden name McCall
      name: "Sourcer format",
      parts: [spName, " birth registered", spEventYear, " in", spRdName, spMmn],
    },
    {
      // Scotland Project. Example:
      // James Menzies Wood, mother's MS Wright, M, 1872, Blythswood
      name: "Scotland Project format",
      parts: [spName, spMmn, spGender, spEventYear, spRdName],
    },
    {
      // William Begg birth registered 1904 in Milton
      name: "Non-standard format: name, date, RD name",
      parts: [spName, / birth registered/, spEventDate, spRdName],
    },
    {
      // Name: Jessie Grosart McLean; Dugald McLean and Jessie Young Lamb; 24 Sep 1891; Lochgoilhead; Parish Number: 527; Reference Number: 1/4
      name: "Non-standard format: date, RD name, ref",
      parts: [
        /(?:Name: )?/,
        spName,
        /;/,
        spTwoParents,
        /;/,
        spEventDate,
        /;/,
        spRdName,
        /; Parish Number: \d+; Reference Number:/,
        spRefNum,
      ],
    },
    {
      // John Turner, parent: Barr, 12 January 1863, Bridgeton; Reference Number: 644/3 92
      name: "Non-standard format: name, 1 parent, date, RD name, ref",
      parts: [spName, /, parent:/, spOneParent, spEventDate, spRdName, /; Reference Number:/, spRefNum],
    },
    {
      name: "Non-standard format: name, 2 parenta, date, RD name, ref",
      parts: [spName, /, parents:/, spTwoParents, spEventDate, spRdName, /; Reference Number:/, spRefNum],
    },
    {
      // Annie Dunlop Climie, 1906, Riccarton; Reference Number: 611 / 1 / 87
      name: "Non-standard format: name, date, RD name, ref",
      parts: [spName, spEventDate, spRdName, /; Reference Number:/, spRefNum],
    },
    {
      // Robert Hamilton, Mother's maiden name Jeffrey, 17 June 1862, Carluke, Lanarkshire, Scotland, United Kingdom: Parish: 629/142
      name: "Non-standard format: name, mmn, date, RD name, parish",
      parts: [spName, spMmn, spEventDate, spRdName, /[,:]? parish:/, spParishNum],
    },
    {
      // Robert Hamilton, Mother's maiden name Jeffrey, 17 June 1862, Carluke, Lanarkshire, Scotland, United Kingdom: Ref: 629/142
      name: "Non-standard format: name, mmn, date, RD name, ref",
      parts: [spName, spMmn, spEventDate, spRdName, /[,:]? ref:/, spRefNum],
    },
    {
      // 1892; Dunnet 036/ 8
      name: "Non-standard format: date, RD name, ref",
      parts: [spEventDateNoWs, /;/, spRdName, spRefNum],
    },
    {
      // "1901 CATHIE, CHARLES SKEOCH (Statutory registers Births 597 / 893)"
      name: "Non-standard format: date, name with surname first, source title",
      parts: [spEventDateNoWs, spNameSurnameFirst, / \(.*/],
    },
    {
      // Made up example: e.g.
      // 10 July 1867
      name: "Non-standard format: date only",
      parts: [spEventDateNoWs],
    },
    {
      // Cramond
      // In this example the name of the person is in the label at start
      name: "Non-standard format: Name or RD name only",
      parts: [spNameOrPlaceNoWs],
    },
  ],
  stat_marriages: [
    {
      // Sourcer generated. Example:
      // Euphemia Lamont marriage to John McBride registered 1856 in Greenock Old or West.
      name: "Sourcer format",
      parts: [spName, " marriage to ", spSpouse, " registered", spEventYear, spRdName],
    },
    {
      // Found case
      // marriage registration, James Lamont and Jane O'Neill nee Letson, married 1905, Parish of Govan, County of Lanark
      name: "non-standard format",
      parts: [/marriage registration,? /, spNameAndSpouse, /,? married/, spEventYear, spRdName],
    },
    {
      // Found case
      // Marriage of Legh R.H. Peter Marshall and Frances Marian Ainslie, in Peebles in 1912 (ref. 768/27). Index online at ScotlandsPeople, hosted by National Records of Scotland, www.scotlandspeople.gov.uk (register entry purchased by Alison Kilpatrick, 2018-07-11).
      name: "non-standard format, 'Marriage of', names, RD, year",
      parts: [/marriage of /, spNameAndSpouse, spRdName, / in/, spEventYear, /.*/],
    },
    {
      // Scotland Project. Example:
      // Euphemia Lamont, and John McBride, 1856, Greenock Old or West
      name: "Scotland Project format",
      parts: [spNameAndSpouse, spEventYear, spRdName],
    },
    {
      // Found case
      // Duncan Urquhart & Christina Coventry, 1860
      name: "Non-standard format, names and date only",
      parts: [spNameAndSpouse, spEventYear],
    },
    {
      // Found case
      // WATT, ALEXANDER & NICOLL, ISABELLA, year: 1863, 322/ 2 Tealing
      name: "Non-standard format, name have surname first",
      parts: [spNameAndSpouseSurnameFirst, / year:/, spEventYear, spRefNum, spEventPlace],
    },
    {
      name: "Non-standard format: names, date, RD name",
      parts: [spNameAndSpouse, / marriage registered/, spEventDate, spRdName],
    },
    {
      name: "Non-standard format: names, date, RD name, ref",
      parts: [spNameAndSpouse, spEventDate, spRdName, /; Reference Number:/, spRefNum],
    },
    {
      // William MacAlpine Hyslop and Jennie Johnstone; 9 Jun 1936; Barrhill; Parish Number: 582/2, Reference Number: 4
      name: "Non-standard format: names ; date ; RD ; PN ; RN",
      parts: [
        spNameAndSpouse,
        /;/,
        spEventDate,
        /;/,
        spRdName,
        /; Parish Number:/,
        spParishNum,
        /, Reference Number:/,
        spRefNum,
      ],
    },
    {
      // 1920; Dunnet 036/ 1
      name: "Non-standard format: date, RD name, ref",
      parts: [spEventDateNoWs, /;/, spRdName, spRefNum],
    },
  ],
  stat_divorces: [
    {
      // Sourcer generated. Example:
      // Margaret Thomso O'Connor divorce from McClounie in 2010 in Hamilton, Scotland.
      name: "Sourcer format",
      parts: [spName, " divorce from", spSpouseLastName, " in", spEventYear, spCourt],
    },
    {
      // Scotland Project. Assumed:
      // Margaret Thomso O'Connor and McClounie, 2010, Hamilton, Scotland.
      name: "Scotland Project format?",
      parts: [spNameAndSpouse, spEventYear, spCourt],
    },
  ],
  stat_deaths: [
    {
      // Sourcer generated. Example:
      // Catherine Aagesen death registered 1976 in Glasgow, Martha St (age 85, mother's maiden name McFee).
      name: "Sourcer format",
      parts: [spName, " death registered", spEventYear, spRdName, / \(/, spAgeNoWs, spMmn, /\)/],
    },
    {
      // Example: Found on Stirling-727
      // Archibald Stirling, male, age 54, date 1869, dwelling in West Kilbride, Ayrshire, Scotland
      name: "Non-standard format",
      parts: [spName, spGender, spAge, /,? date/, spEventYear, /,? dwelling in/, spEventPlace],
    },
    {
      // Scotland Project. Example:
      // John Stewart, age 47, Male, 1908, Paisley
      name: "Scotland Project format",
      parts: [spName, spAge, spGender, spEventYear, spRdName],
    },
    {
      // Found Example: https://www.wikitree.com/wiki/Rendall-372
      // Joan Rendall OR Cooper death registered 1935 in George Square (age 64)
      name: "Non-standard format",
      parts: [spName, " death registered", spEventYear, spRdName, spAge],
    },
    {
      // Scotland Project. Example of a corrected entry where data and source ref are mushed together
      // Joseph Sloy, 12 September 2028, corrected entry, West District, Greenock, Renfrewshire, p. 159, item 475, reference number 564/2 475
      name: "Scotland Project format",
      parts: [spName, /,/, spEventDate, /,/, spRdName, /, p\. \d+, item \d+, reference number/, spRefNum, /.*/],
    },
    {
      // Found case
      // Death of Legh Richmond H. Marshall, aged 74 years, in 1948, Walkerburn registration district, ref. 762/2 6. Index online at ScotlandsPeople, hosted by National Records of Scotland, www.scotlandspeople.gov.uk (register entry purchased by Alison Kilpatrick, 2018-07-20).
      name: "non-standard format, 'Death of', name, age, year, RD",
      parts: [/death of /, spName, spAge, /,? in/, spEventYear, spRdName, /(?:registration district)?,.*/],
    },
    {
      // death registration, Jane Lamont, 1924, 44, District of Paisley, County of Renfrew
      name: "Non-standard format",
      parts: [/death registration,? /, spName, /,/, spEventDate, /,/, spAgeNoLabelOrWs, /,/, spEventPlace],
    },
    {
      name: "Non-standard format: names, date, RD name",
      parts: [spName, / death registered/, spEventDate, spRdName],
    },
    {
      // Jean Turner; spouse: John Turner; parents: Robert Barr and Agnes Reid; 8 March 1863; Reference Number: 644/3 243
      name: "Non-standard format: name, spouse, parents, date, ref",
      parts: [
        spName,
        /[;,]? spouse:/,
        spSpouse,
        /[;,]? parents:/,
        spTwoParents,
        spEventDate,
        /; Reference Number:/,
        spRefNum,
      ],
    },
    {
      // Mary Alexander parent: Gray, 18 October 1862, Old Monkland; Reference Number: 652/2 293
      name: "Non-standard format: name, parent, date, RD, ref",
      parts: [spName, /[;,]? parent:/, spOneParent, spEventDate, spRdName, /; Reference Number:/, spRefNum],
    },
    {
      // Ann White Alexander parent: Gray, Bridgeton; Reference Number: 644/3 1308
      name: "Non-standard format: name, parent, date, RD, ref",
      parts: [spName, /[;,]? parent:/, spOneParent, spRdName, /; Reference Number:/, spRefNum],
    },
    {
      // Jenny Grosart Hyslop, 22 Sep 1970; Barrhill; Parish Number: 594, Reference Number: 93
      name: "Non-standard format: date, RD name, ref",
      parts: [
        /(?:Name: )?/,
        spName,
        /[,;]/,
        spEventDate,
        /[,;]/,
        spRdName,
        /; Parish Number:/,
        spParishNum,
        /, Reference Number:/,
        spRefNum,
      ],
    },
    {
      name: "Non-standard format: name, date, RD name, ref",
      parts: [spName, spEventDate, spRdName, /; Reference Number:/, spRefNum],
    },
    {
      // Robert Hamilton, Mother's maiden name Jeffrey, 5 September 1889, Penicuik, Midlothian, Parish: 629/142
      name: "Non-standard format: name, mmn, date, RD name, parish",
      parts: [spName, spMmn, spEventDate, spRdName, /[,:]? parish:/, spParishNum],
    },
    {
      // Robert Hamilton, Mother's maiden name Jeffrey, 5 September 1889, Penicuik, Midlothian, Ref: 629/142
      name: "Non-standard format: name, mmn, date, RD name, ref",
      parts: [spName, spMmn, spEventDate, spRdName, /[,:]? ref:/, spRefNum],
    },
    {
      // 1960; Dunnet 036/ 5
      name: "Non-standard format: date, RD name, ref",
      parts: [spEventDateNoWs, /;/, spRdName, spRefNum],
    },
  ],
  stat_civilpartnerships: [
    {
      // Sourcer generated. Example:
      // Abigail Alice Walker marriage to Morera-Pallares registered 2021 in Rosskeen
      name: "Sourcer format",
      parts: [spName, " marriage to", spSpouse, / registered/, spEventYear, spRdName],
    },
    {
      // Assumed: Abigail Alice Walker marriage to Morera-Pallares, 2021, Rosskeen
      name: "Scotland Project format?",
      parts: [spNameAndSpouse, spEventYear, spRdName],
    },
  ],
  stat_dissolutions: [
    {
      // Sourcer generated. Example:
      // Seonaid MacNeil Wilson divorce from MacIntosh in 2013 in Perth, Scotland
      name: "Sourcer format",
      parts: [spName, " divorce from", spSpouseLastName, / in/, spEventYear, / in/, spCourt],
    },
    {
      // Scotland Project. Assumed:
      // Seonaid MacNeil Wilson and MacIntosh, 2013, Perth, Scotland
      // Margaret Thomso O'Connor and McClounie, 2010, Hamilton, Scotland.
      name: "Scotland Project format?",
      parts: [spNameAndSpouse, spEventYear, spCourt],
    },
  ],
  opr_births: [
    {
      // Example: Sourcer Default
      // peter connan born or baptised on 1 jun 1823, son of james connan & mary mcgregor, in monzie, perthshire, scotland.
      name: "Sourcer format",
      parts: [
        spName,
        /(?:born or baptised|birth or baptism)/,
        spEventDate,
        spChildOfTwoParents,
        /(?:,? in|,? at|,? on)/,
        spEventPlace,
      ],
    },
    {
      // Example: Scotland Project
      // william walker birth or baptism 23 jan 1808, son of hugh walker and ann young
      name: "Scotland Project format",
      parts: [spName, /(?:born or baptised|birth or baptism)/, spEventDate, spChildOfTwoParents],
    },
    {
      // Example: Scotland Project
      // william walker birth 23 jan 1808, son of hugh walker and ann young
      name: "Scotland Project format",
      parts: [spName, /(?:birth|baptism)/, spEventDate, spChildOfTwoParents],
    },
    {
      // Example: Scotland Project
      // One parent
      // william walker birth or baptism 23 jan 1808, son of hugh walker
      name: "Scotland Project format, one parent, with place",
      parts: [
        spName,
        /(?:born or baptised|birth or baptism)/,
        spEventDate,
        spChildOfOneParent,
        /(?:,? in|,? at|,? on)/,
        spEventPlace,
      ],
    },
    {
      // Example: Scotland Project
      // One parent
      // william walker birth or baptism 23 jan 1808, son of hugh walker
      name: "Scotland Project format, one parent",
      parts: [spName, /(?:born or baptised|birth or baptism)/, spEventDate, spChildOfOneParent],
    },
    {
      // Example: Scotland Project
      // One parent
      // william walker birth or baptism 23 jan 1808, son of hugh walker
      name: "Scotland Project format, viewed image, one parent",
      parts: [spName, /(?:birth|baptism)/, spEventDate, spChildOfOneParent],
    },
    {
      // Example: Scotland Project
      // No parents
      // william walker birth or baptism 23 jan 1808
      name: "Scotland Project format, no parents",
      parts: [spName, /(?:born or baptised|birth or baptism)/, spEventDate],
    },
    {
      // william walker birth or baptism 23 jan 1808
      name: "Scotland Project format, viewed image, no parents",
      parts: [spName, /(?:birth|baptism)/, spEventDate],
    },
    {
      // Example: Found
      // William Cairns, parents: David Cairns and Margaret Wakinshaw, 8 Sep 1822, Tranent
      // willliam wilson, parents: james wilson & agnes christie. 1 april 1711, wemyss, fife
      // Robert Lewis Balfour Stevenson, parents: Thomas Stevenson/Margaret Isabella Balfour, 13 Nov 1850, Edinburgh
      name: "Non-standard format, 'parents' in string, with place",
      parts: [spName, /,? parents:?/, spTwoParents, /(?:,|\.)/, spEventDate, spEventPlace],
    },
    {
      // Example: Found
      // William Cairns, parents: David Cairns and Margaret Wakinshaw, 8 Sep 1822, Tranent
      // willliam wilson, parents: james wilson & agnes christie. 1 april 1711, wemyss, fife
      // Robert Lewis Balfour Stevenson, parents: Thomas Stevenson/Margaret Isabella Balfour, 13 Nov 1850, Edinburgh
      name: "Non-standard format, 'parents' in string, no place",
      parts: [spName, /,? parents:?/, spTwoParents, /(?:,|\.)/, spEventDate],
    },
    {
      // Example: Found
      // William, lawful son of parents William Stewart / Isobel Dow. Parish: Clunie, 1817
      name: "Non-standard format, name, parents, parish, date",
      parts: [spName, spChildOfTwoParents, /.? parish:?/, spParishName, spEventDate],
    },
    {
      // Example: Found
      // WATT, ALEXANDER DUFF, parents: THOS. WATT/JEAN DUFF, sex: M, date: 11/10/1837, 289/ 30 50 Glamis
      name: "Non-standard format, 'parents' in string, with sex and place",
      parts: [
        spNameSurnameFirst,
        /,? parents:?/,
        spTwoParents,
        /,? ?sex:/,
        spGender,
        /(?:,|\.|, date:)/,
        spEventDate,
        spRefNum,
        spEventPlace,
      ],
    },
  ],
  opr_marriages: [
    {
      // Example: Sourcer Default
      // Christane McGregor marriage to Robert Wright on or after 2 Jul 1668 in Buchanan, Stirlingshire, Scotland.
      // Note: in the section (?:on or after |on |in ), "on or after " needs to come before "on "
      name: "Sourcer format",
      parts: [spName, / marriage to/, spSpouse, / (?:on or after|on|in)/, spEventDate, spEventPlace],
    },
    {
      // Example: Scotland Project
      // marriage or banns for James Bell and Elizabeth Arrott 30 Apr 1719
      name: "Scotland Project format, 'marriage or banns'",
      parts: [/marriage or banns for /, spNameAndSpouse, spEventDate, spEventPlace],
    },
    {
      name: "Scotland Project format, (after reading image), 'banns', with place",
      parts: [/banns for /, spNameAndSpouse, spEventDate, spEventPlace],
    },
    {
      // Example: Scotland Project (after reading image)
      // banns for James Bell and Elizabeth Arrott 30 Apr 1719
      name: "Scotland Project format, (after reading image), 'banns', no place",
      parts: [/banns for /, spNameAndSpouse, spEventDate],
    },
    {
      // Example: Scotland Project (after reading image)
      // marriage of James Bell and Elizabeth Arrott 30 Apr 1719, Glasgow
      name: "Scotland Project format, (after reading image), 'marriage', with place",
      parts: [/marriage of /, spNameAndSpouse, spEventDate, spEventPlace],
    },
    {
      // Example: Scotland Project (after reading image)
      // marriage of James Bell and Elizabeth Arrott 30 Apr 1719
      name: "Scotland Project format, (after reading image), 'marriage', no place",
      parts: [/marriage of /, spNameAndSpouse, spEventDate],
    },
    {
      // Example: Found case
      // David Cairns and Mary Chambers, 6 Dec 1820, Tranent
      name: "Non-standard format, name and spouse, date, place",
      parts: [spNameAndSpouse, spEventDate, spEventPlace],
    },
    {
      // Example: Invented case
      // David Cairns and Mary Chambers, 6 Dec 1820
      name: "Non-standard format, name and spouse, date, no place",
      parts: [spNameAndSpouse, spEventDate],
    },
    {
      // Canongate, Edinburgh. 29 August 1795. CRAW Arthur and HASTIE, Jean. 685/ 3 160/ 127
      name: "Extremely non-standard format, name and spouse, date, no place",
      parts: [spEventPlaceNoWs, /\./, spEventDate, /\./, spNameAndSpouseSurnameFirst, /\./, spRefNum],
    },
  ],
  opr_deaths: [
    {
      // Example: Sourcer Default, age, one parent
      // John Gibson, son of James Galloway Gibson, death or burial (died age 0) on 24 May 1839 in Glasgow, Lanarkshire, Scotland
      name: "Sourcer format, one parent and age at death",
      parts: [spName, spChildOfOneParent, /,? death or burial \(died/, spAge, /\)/, spEventDate, spEventPlace],
    },
    {
      // Example: Sourcer Default, one parent
      // Elizabeth Campbell, daughter of Colny Campbell, death or burial on 8 Mar 1647 in Dumbarton, Dunbartonshire, Scotland.
      name: "Sourcer format, one parent, no age",
      parts: [spName, spChildOfOneParent, /,? death or burial/, spEventDate, spEventPlace],
    },
    {
      // Example: Sourcer Default, age no parent
      // John Burns death or burial (died age 96) on 26 Feb 1839 in Glasgow, Lanarkshire, Scotland
      name: "Sourcer format, age, no parent",
      parts: [spName, /,? death or burial \(died/, spAge, /\)/, spEventDate, spEventPlace],
    },
    {
      // Example: Sourcer Default, no parent
      // James Fraser death or burial on 16 Aug 1685 in Aberdeen, Aberdeenshire, Scotland
      name: "Sourcer format, no parent or age",
      parts: [spName, /,? death or burial/, spEventDate, spEventPlace],
    },
    {
      // death of John Burns, 3 March 1839
      name: "Scotland Project format, just name and date",
      parts: ["death of ", spName, spEventDate],
    },
    {
      // Jonet Scott, December 1568/69, Perth
      name: "Non-standard format, just name and date and death with no labels",
      parts: [spName, /,/, spEventDate, /,/, spEventPlace],
    },
  ],
  cr_baptisms: [
    {
      // Example: Sourcer Default
      // Agnes White baptism on 29 Mar 1839 (born 24 Jan 1839), daughter of Alexander White & Saragh McDonnol, in St Mirin's, Paisley, Renfrewshire, Scotland
      name: "Sourcer format, with parents and DOB",
      parts: [spName, / baptism/, spEventDate, spBirthDate, spChildOfTwoParents, spEventPlace],
    },
    {
      // Example: Sourcer Default no dob
      // Agnes White baptism on 29 Mar 1839, daughter of Alexander White & Saragh McDonnol, in St Mirin's, Paisley, Renfrewshire, Scotland
      name: "Sourcer format, with parents, no DOB",
      parts: [spName, / baptism/, spEventDate, spChildOfTwoParents, spEventPlace],
    },
    {
      // Example: Scotland Project
      // William McAtasny, birth 31 Dec 1867 and baptism 1 Apr 1868, son of William McAtasny and Margaret McIlveny.
      name: "Scotland Project format, birth and baptism dates, parents, place",
      parts: [spName, spBirthDate, / and baptism/, spEventDate, spChildOfTwoParents, /,/, spEventPlace],
    },
    {
      // Example: Scotland Project
      // William McAtasny, birth 31 Dec 1867 and baptism 1 Apr 1868, son of William McAtasny and Margaret McIlveny.
      name: "Scotland Project format, birth and baptism dates, parents, no place",
      parts: [spName, spBirthDate, / and baptism/, spEventDate, spChildOfTwoParents],
    },
    {
      // Example: Found
      // John McKinley, parents: James McKinley/Bridget Wallace, Birth Date: 4 Nov 1841, Airdrie
      name: "Non-standard format, name, parents, birth date, parish",
      parts: [spName, /[,;]? ?parents:/, spTwoParents, spBirthDate, spEventPlace],
    },
  ],
  cr_banns: [
    {
      // Example: Sourcer Default
      // James Ronald McGregor marriage to Ruth Margaret Gauld on or after 26 Nov 1941 in St Mary's with St Peter's, Aberdeen, Aberdeenshire, Scotland.
      name: "Sourcer format",
      parts: [spName, / marriage to/, spSpouse, /(?: on or after| on| in)/, spEventDate, spEventPlace],
    },
    {
      // marriage or banns for Michael McBride and Mary McSloy, 21 Jul 1862
      name: "Scotland Project format, with date and place",
      parts: [/marriage or banns for /, spNameAndSpouse, spEventDate, spEventPlace],
    },
    {
      // marriage or banns for Michael McBride and Mary McSloy, 21 Jul 1862
      name: "Scotland Project format, no place",
      parts: [/marriage or banns for /, spNameAndSpouse, spEventDate],
    },
  ],
  cr_burials: [
    {
      // Example: Sourcer Default, age
      // Ruth Fraser burial (died age 0) on 3 Dec 1860 in Old Dalbeth Cemetery, Glasgow, Lanarkshire, Scotland
      name: "Sourcer format",
      parts: [spName, /,? burial \(died/, spAge, /\)/, spEventDate, spEventPlace],
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
      parts: [spName, /,? baptism/, spEventDate, spBirthDate, spChildOfTwoParents, spEventPlace],
    },
    {
      // Example: Scotland Project
      // John Rutherford, birth 28 August 1848, baptism 20 November 1850, son of George Rutherford and Isabella Waldie, Parish/Congregation Hawick Free
      name: "Scotland Project format",
      parts: [spName, spBirthDate, /(?: and|,) baptism/, spEventDate, spChildOfTwoParents, /,/, spEventPlace],
    },
  ],
  ch3_banns: [
    {
      // Example: Sourcer Default
      // John Kay marriage to Hannah Butler Dewar on 3 Jul 1849 in Scotland
      name: "Sourcer format, with place",
      parts: [spName, / marriage to/, spSpouse, /(?: on or after| on| in)/, spEventDate, spEventPlace],
    },
  ],
  ch3_burials: [
    {
      // Example: Sourcer Default
      // Helen Fraser death or burial on 11 Jul 1842 in St Margaret's United Secession, Dunfermline, Fife, Scotland. Cause of death: Rheumatic Fever
      name: "Sourcer format",
      parts: [spName, / death or burial/, spEventDate, spEventPlace, /\./, spCauseOfDeath],
    },
    {
      // Example: Sourcer Default, no cause of death
      // Helen Fraser death or burial on 11 Jul 1842 in St Margaret's United Secession, Dunfermline, Fife, Scotland.
      name: "Sourcer format",
      parts: [spName, / death or burial/, spEventDate, spEventPlace],
    },
  ],
  ch3_other: [
    // Sourcer used list form
  ],
  census: [
    {
      // Jane Lamont (Census 573/1 90/ 6), Copyright National Records of Scotland. Image generated on 4 Feb 2024 20:09
      name: "Non-standard format, just name and refNum",
      parts: [spName, / \(?Census/, spRefNum, /\).*/],
    },
    {
      // Example: Scotland Project
      // Ella W. McMillan, female, age at census 2, Greenock West, Renfrew;
      name: "Scotland Project format",
      parts: [spName, spGender, /,? age at census/, spAgeNoLabel, ",", spRdName],
    },
    {
      // Example: Sourcer Default with registration district
      // James Fraser (31) in Milton registration district in Lanarkshire, Scotland.
      name: "Sourcer format",
      parts: [spName, /,? \(/, spAgeNoLabelOrWs, /\)/, spRdName, " registration district", spCountyCity],
    },
    {
      // Example: Sourcer Default, no registration (may never generate this)
      // James Fraser (31) in Milton registration district in Lanarkshire, Scotland.
      name: "Sourcer format, no RD",
      parts: [spName, /,? \(/, spAgeNoLabelOrWs, /\)/, spEventPlace],
    },
    {
      // 1901 Lydia O'Hara (Census 647/1112)
      name: "Non-standard format, census year in dataString",
      parts: [spEventDateNoWs, spName, / \(?Census/, spRefNum, /\)/],
    },
    {
      // Agnes Miller in Greenock, Renfrewshire
      name: "Non-standard format, name in place",
      parts: [spName, / in/, spRdName],
    },
  ],
  census_lds: [
    {
      // Example: Sourcer Default
      // Christina Clark Or Pocock (24) at 27 Marshall St, Edinburgh Buccleuch, Edinburgh, Scotland. Born in Turriff, Banff, Scotland
      name: "Sourcer format",
      parts: [spName, /,? \(/, spAgeNoLabelOrWs, /\)/, spEventPlace, spBirthPlace],
    },
    {
      // Example: Sourcer Default
      // John Stewart, male, age at census 20, Dwelling: 2 Blair Street, Galston, birth place: Galston, Ayr
      name: "Scotland Project format",
      parts: [spName, spGender, /,? age at census/, spAgeNoLabel, ",", spEventPlace, spBirthPlace],
    },
  ],
  vr: [
    {
      // Example: Sourcer Default
      // W J Fraser in 1855 at House No 83 Union Street in the parish of Aberdeen, Scotland
      name: "Sourcer format",
      parts: [spName, / (?:in|on)/, spEventYear, spEventPlace],
    },
  ],
  wills: [
    {
      // Example: Sourcer Default
      // confirmation of will or testament of robert faireis at dumfries commissary court on 19 oct 1624
      // Confirmation of inventory for Agnes Fraser at Glasgow Sheriff Court on 18 Apr 1910
      name: "Sourcer format",
      parts: [/confirmation of /, spWill, spName, / (?:in|on|at)/, spEventPlace, / (?:in|on)/, spEventDate],
    },
    {
      // Example: Sourcer Default
      // Confirmation of will of Adelaide Fraser at Inverness Sheriff Court on 2 Feb 1906. Died 2 Jul 1905.
      name: "Sourcer format",
      parts: [
        /confirmation of /,
        spWill,
        spName,
        / (?:in|on|at)/,
        spEventPlace,
        / (?:in|on)/,
        spEventDate,
        /\. died/,
        spAgeNoLabel,
      ],
    },
    {
      // Example: Sourcer Default
      // Confirmation of inventory for Jane Peffers at Edinburgh Sheriff Court on 25 Jun 1921 (original confirmation on 14 Jun 1921).
      name: "Sourcer format",
      parts: [
        /confirmation of /,
        spWill,
        spName,
        / (?:in|on|at)/,
        spEventPlace,
        / (?:in|on)/,
        spEventDate,
        spOrigConfDate,
      ],
    },
    {
      // Example: Sourcer Default
      // Confirmation of inventory for Jane Peffers at Edinburgh Sheriff Court on 25 Jun 1921 (original confirmation on 14 Jun 1921). Died 6 Apr 1921.
      name: "Sourcer format",
      parts: [
        /confirmation of /,
        spWill,
        spName,
        / (?:in|on|at)/,
        spEventPlace,
        / (?:in|on)/,
        spEventDate,
        spOrigConfDate,
        /\. died/,
        spAgeNoLabel,
      ],
    },
    {
      // Hamilton, James; 16/6/1576; Duke of Chastelherault, Earl of Arran; Testament Testamentar and Inventory; Edinburgh Commissary Court; CC8/8/4; from
      name: "No-standard Testament Testamentar format",
      parts: [
        spNameSurnameFirst,
        /;/,
        spEventDate,
        /; (?:[^;]+)?; Testament Testamentar(?: and Inventory)?;/,
        spCourt,
        /;/,
        spRefCode,
        /;(?: from)?/,
      ],
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
      parts: [spName, /,? admitted to prison/, spEventYear, spAge],
    },
  ],
};

function getScotpRecordTypeFromSourceTitle(parsedCitation) {
  let sourceTitle = parsedCitation.sourceTitle;
  let lcSourceTitle = sourceTitle.toLowerCase();

  function findMatchingTitle(titleObjects) {
    for (let titleObject of titleObjects) {
      if (titleObject.reTitles) {
        for (let reTitle of titleObject.reTitles) {
          if (reTitle.test(sourceTitle)) {
            let startIndex = lcSourceTitle.search(reTitle);
            if (startIndex > 0) {
              let beforeTitle = sourceTitle.substring(0, startIndex).trim();
              if (beforeTitle) {
                parsedCitation.textBeforeMatchedTitleInSourceTitle = beforeTitle;
              }
            }

            return titleObject;
          }
        }
      }
      if (titleObject.titles) {
        for (let title of titleObject.titles) {
          const lcTitle = title.toLowerCase();
          if (lcSourceTitle.includes(lcTitle)) {
            let startIndex = lcSourceTitle.indexOf(lcTitle);
            if (startIndex > 0) {
              let beforeTitle = sourceTitle.substring(0, startIndex).trim();
              if (beforeTitle) {
                parsedCitation.textBeforeMatchedTitleInSourceTitle = beforeTitle;
              }
            }

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

function isOdd(num) {
  return num % 2;
}

function isLabelTextPlausible(text, beMoreStrict) {
  // not yet implemented
  // Could have a black list and white list
  // Black list could include all source title formats
  // White list could include all refTitles from generalize_data_utils
  //  Have to allow for dates on start/end, relationships
  //  There can also be override refTitles

  // check if in quotes
  const inQuotesTest = /^"(.*)"$/;
  let wasInQuotes = false;
  if (inQuotesTest.test(text)) {
    text = text.replace(inQuotesTest, "$1");
    wasInQuotes = true;
  }

  if (beMoreStrict) {
    return false;
  }
  return true;
}

function cleanCitation(parsedCitation) {
  let text = parsedCitation.text;

  text = text.trim();

  // if they select a bit too much the string can have the up arrow symbol which
  // take the user back to the inline citation
  if (text.startsWith("↑")) {
    text = text.substring(1);
    text = text.trim();
  }

  // there can also be numbers on the start if they selext too much that are the links back
  // to the inline citation point. E.g. "↑ 35.0 35.1 35.2 "
  const testForInlineNumOnStart = /^\d\d?\d?\.\d\d?\s(.*)$/;
  while (testForInlineNumOnStart.test(text)) {
    text = text.replace(testForInlineNumOnStart, "$1");
  }

  // replace breaks and newlines with ", "
  text = text.replace(/<\s*br\s*\/ *> *\n\ *>/g, ", ");
  text = text.replace(/<\s*br\s*\/ *> */g, ", ");
  text = text.replace(/ *\n\ */g, ", ");

  // replace curly (a.k.a. smart) quotes with regular ones
  text = text.replace(/[“”]/g, '"');
  text = text.replace(/[‘’]/g, "'");

  // replace variations of dash/hyphen with standardm en dash, em dash, figure dash, hyphen-minus
  text = text.replace(/[–—‒-]/g, "-");

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
  // This is fraught with difficulties due to typos and varying usage.
  // It can go wring either way:
  // -  I have seen a label, in quotes, with a semi-colon instead of a colon at end
  //    This got treated as the Sourcer Title
  // - I have seen a source title with a colon in it when the first part was treated as a label
  const labelRegex = /^(?:\'\')?(?:\'\'\')?([A-Za-z0-9\s']+)(?:\'\')?(?:\'\'\')?\s?\:(.*)$/;
  if (labelRegex.test(text)) {
    let labelText = text.replace(labelRegex, "$1");
    let remainderText = text.replace(labelRegex, "$2");
    if (labelText && labelText != text && remainderText && remainderText != text) {
      if (isLabelTextPlausible(labelText, false)) {
        parsedCitation.labelText = labelText;
        text = remainderText.trim();
        logMessage("Found label: '" + labelText + "'. This is removed during cleanCitation.");
      }
    }
  } else {
    // look for labels done in a non standard form
    const nsLabelRegex = /^(?:\'\')?(?:\'\'\')?([A-Za-z0-9\s']+)(?:\'\')?(?:\'\'\')?\s?[\:;](.*)$/;
    if (nsLabelRegex.test(text)) {
      let labelText = text.replace(nsLabelRegex, "$1");
      let remainderText = text.replace(nsLabelRegex, "$2");
      if (labelText && labelText != text && remainderText && remainderText != text) {
        if (isLabelTextPlausible(labelText, true)) {
          parsedCitation.labelText = labelText;
          text = remainderText.trim();
          logMessage("Found label: '" + labelText + "'. This is removed during cleanCitation.");
        }
      }
    }
  }

  // check for mismatched quotes
  let doubleQuoteMatches = text.match(/"/g);
  if (doubleQuoteMatches) {
    if (isOdd(doubleQuoteMatches.length)) {
      logMessage("Found odd number of double quotes (" + doubleQuoteMatches.length + "). Adding a quote at the start.");
      text = '"' + text;
    }
  }

  parsedCitation.cleanText = text;
  return true;
}

function getRegexForPattern(pattern, allowAnythingOnEnd) {
  if (pattern.parts) {
    let regexSource = /^/.source;
    for (let i = 0; i < pattern.parts.length; i++) {
      let part = pattern.parts[i];
      // the parts can be either a simple string, a regex, or an object containing a regex
      if (typeof part === "string" || part instanceof String) {
        regexSource += part;
      } else if (part instanceof RegExp) {
        regexSource += part.source;
      } else if (part.regex) {
        regexSource += pattern.parts[i].regex.source;
      }
    }
    if (allowAnythingOnEnd) {
      regexSource += /.*/.source;
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

function getScotpRecordTypeAndSourceTitleFromFullText(parsedCitation, combineLabel = false) {
  let text = parsedCitation.cleanText;

  // in some cases where there is a colon in the title part of the title can be put in the label
  if (combineLabel && parsedCitation.labelText) {
    text = parsedCitation.labelText + ": " + text.trim();
  }
  let lcText = text.toLowerCase();

  function foundMatch(recordType, title, matchIndex) {
    parsedCitation.sourceTitle = title;
    let remainder = text.substring(matchIndex + title.length);
    let beforeTitle = text.substring(0, matchIndex);
    let quotesBeforeTitle = beforeTitle.match(/["']/);
    if (quotesBeforeTitle && isOdd(quotesBeforeTitle.length)) {
      // if there is a matching quote in remainder then remove up to (and including) it
      const startQuoteToEndQuote = {
        '"': `"`,
        "'": `'`,
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
    // remove punctuation from start
    remainder = remainder.replace(/^\s*[\.\,\:\;\-]+\s*/, "");
    // partial patterns expect a space at start
    parsedCitation.partialText = " " + remainder;
    parsedCitation.textBeforeTitleInPartialMatch = beforeTitle;
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

  function checkRePlusKeywordMatch(recordType, reTitlePlusKeyword) {
    let titleRegex = reTitlePlusKeyword.titleRegex;
    let keywordRegex = reTitlePlusKeyword.keywordRegex;
    let sourceTitleIndex = lcText.search(titleRegex);
    if (sourceTitleIndex != -1) {
      let keywordIndex = lcText.search(keywordRegex);
      if (keywordIndex != -1) {
        let matches = lcText.match(titleRegex);
        if (matches && matches.length > 0) {
          let title = matches[0];
          foundMatch(recordType, title, sourceTitleIndex);
          return true;
        }
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
      if (titleObject.reTitlesPlusKeyword) {
        for (let reTitlePlusKeyword of titleObject.reTitlesPlusKeyword) {
          if (checkRePlusKeywordMatch(titleObject.recordType, reTitlePlusKeyword)) {
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

function parseTextUsingPatternParts(pattern, objectToFill, textToParse, cleanValueFunc, allowAnythingOnEnd) {
  let regex = getRegexForPattern(pattern, allowAnythingOnEnd);
  let paramIndex = 0;
  for (let part of pattern.parts) {
    if (part.paramKeys) {
      for (let key of part.paramKeys) {
        let resultIndex = paramIndex + 1;
        paramIndex++;
        let resultString = "$" + resultIndex;
        let value = textToParse.replace(regex, resultString);
        if (key && value) {
          objectToFill[key] = cleanValueFunc(value);
        }
      }
    }
  }
}

function parseUsingPattern(parsedCitation) {
  let pattern = parsedCitation.matchingPattern;
  let text = parsedCitation.cleanText;
  parseTextUsingPatternParts(pattern, parsedCitation, text, cleanCitationValue);
}

function parseUsingPartialPattern(parsedCitation) {
  let pattern = parsedCitation.matchingPartialPattern;
  let text = parsedCitation.partialText;
  parseTextUsingPatternParts(pattern, parsedCitation, text, cleanCitationValue);
}

function removeBracketedSectionFromEnd(text) {
  // e.g. Penelope Anders[on]
  const regex = /^(.*)\[[^\]]+\]$/;
  if (regex.test(text)) {
    text = text.replace(regex, "$1");
  }
  return text;
}

function cleanForename(text) {
  if (!text) {
    return text;
  }

  // Penelope Anders[on]
  text = removeBracketedSectionFromEnd(text);

  if (text.endsWith(".")) {
    text = text.substring(0, text.length - 1);
  }

  return text;
}

function cleanSurname(text) {
  if (!text) {
    return text;
  }
  text = removeBracketedSectionFromEnd(text);

  return text;
}

function cleanFullName(text) {
  return text;
}

function setNameFromNameWithSurnameFirst(data, parsedCitation, builder, isSpouse) {
  let scotpRecordType = parsedCitation.scotpRecordType;

  let name = data.nameSurnameFirst;
  let forenameParam = ScotpRecordType.getSearchField(scotpRecordType, SpField.forename);
  if (isSpouse) {
    name = data.spouseNameSurnameFirst;
    forenameParam = ScotpRecordType.getSearchField(scotpRecordType, SpField.spouseForename);
  }
  // this is a really wierd format like "CRAW Arthur" or "HASTIE, Jean"
  // if there is a comma the use that to separate surname from first name
  // else use case
  let commaIndex = name.indexOf(",");
  let surname = "";
  let forename = "";
  if (commaIndex != -1) {
    surname = name.substring(0, commaIndex).trim();
    forename = name.substring(commaIndex + 1).trim();
  } else {
    // we will consider the surname all the parts up to the last all upper case word
    // and the rest the forename
    let parts = name.split(" ");
    let forenamePartIndex = 0;
    for (let part of parts) {
      if (StringUtils.isAllUppercase(part)) {
        forenamePartIndex++;
      }
    }

    if (forenamePartIndex > 0) {
      surname = parts[0];
      for (let partIndex = 1; partIndex < forenamePartIndex; partIndex++) {
        surname += " " + parts[partIndex];
      }
    }
    if (forenamePartIndex < parts.length) {
      forename = parts[forenamePartIndex];
      for (let partIndex = forenamePartIndex + 1; partIndex < parts.length; partIndex++) {
        forename += " " + parts[partIndex];
      }
    }
  }

  if (forenameParam) {
    if (forename) {
      forename = cleanForename(forename);
      if (isSpouse) {
        builder.addSpouseForename(forename, "exact");
      } else {
        builder.addForename(forename, "exact");
      }
    }
    if (surname) {
      surname = cleanSurname(surname);
      if (isSpouse) {
        builder.addSpouseSurname(surname, "exact");
      } else {
        builder.addSurname(surname, "exact");
      }
    }
  } else {
    // use full name
    let fullNameParam = ScotpRecordType.getSearchField(scotpRecordType, SpField.fullName);
    if (isSpouse) {
      fullNameParam = ScotpRecordType.getSearchField(scotpRecordType, SpField.spouseFullName);
    }
    if (fullNameParam) {
      let fullName = forename;
      if (surname) {
        if (fullName) {
          fullName += " ";
        }
        fullName += surname;
      }
      fullName = cleanFullName(fullName);
      if (isSpouse) {
        builder.addSpouseFullName(fullName, "exact");
      } else {
        builder.addSFullName(fullName, "exact");
      }
    }
  }
}

function setNameFromSeparateForenameAndSurname(data, parsedCitation, builder, isSpouse) {
  let scotpRecordType = parsedCitation.scotpRecordType;

  let surname = data.surname;
  let forename = data.forename;

  if (isSpouse) {
    surname = data.spouseSurname;
    forename = data.spouseForename;
  }

  if (surname || forename) {
    if (forename) {
      forename = cleanForename(forename);
      if (isSpouse) {
        builder.addSpouseForename(forename, "exact");
      } else {
        builder.addForename(forename, "exact");
      }
    }
    if (surname) {
      // check for nee or née in name
      let neeIndex = surname.search(/(nee|née)/);
      if (neeIndex != -1) {
        surname = surname.substring(0, neeIndex).trim();
      }
      surname = cleanSurname(surname);

      if (isSpouse) {
        builder.addSpouseSurname(surname, "exact");
      } else {
        builder.addSurname(surname, "exact");
      }
    }
    return true;
  }

  return false;
}

function setName(data, parsedCitation, builder) {
  let scotpRecordType = parsedCitation.scotpRecordType;
  let name = data.name;
  if (setNameFromSeparateForenameAndSurname(data, parsedCitation, builder, false)) {
    return;
  }

  if (!name) {
    if (!data.nameSurnameFirst) {
      return;
    }

    setNameFromNameWithSurnameFirst(data, parsedCitation, builder, false);
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

  // change initials with periods to have no periods or they will not match
  const removePeriodsAfterInitialsRegEx = /[ \.]([a-z])\./gi;
  while (removePeriodsAfterInitialsRegEx.test(name)) {
    name = name.replace(removePeriodsAfterInitialsRegEx, " $1 ");
  }
  name = name.replace(/\s+/g, " ");
  name = name.trim();

  let numWordsInName = StringUtils.countWords(name);
  if (numWordsInName > 1) {
    if (numWordsInName > 2 && name.toLowerCase().includes(" or ")) {
      // this handles the cases like "Christina Clark Or Pocock"
      let nameParts = name.split(" ");
      let newNameParts = [];
      let newIndexOfOrPart = -1;
      for (let i = 0; i < nameParts.length; i++) {
        let namePart = nameParts[i];
        if (i < nameParts.length - 2 && nameParts[i + 1].toLowerCase() == "or") {
          let newNamePart = nameParts[i] + " or " + nameParts[i + 2];
          newNameParts.push(newNamePart);
          newIndexOfOrPart = newNameParts.length - 1;
          i += 2;
        } else {
          newNameParts.push(namePart);
        }
      }

      if (newNameParts.length > 1) {
        let forenames = newNameParts[0];
        let lastName = newNameParts[newNameParts.length - 1];

        if (newIndexOfOrPart == newNameParts.length - 1) {
          // the OR is in the last part, so the OR indicates two surnames
          if (newNameParts.length > 2) {
            for (let i = 1; i < newNameParts.length - 1; i++) {
              forenames += " " + newNameParts[i];
            }
          }
        } else {
          // the or is not in the last part, it could be something like
          // "Jeanie Campbell OR Jeanie Stevenson"
          // so ignore the part with the OR
        }

        forenames = cleanForename(forenames);
        lastName = cleanSurname(lastName);

        builder.addForename(forenames, "exact");
        builder.addSurname(lastName, "exact");
        return;
      } else {
        builder.addSurname(cleanSurname(newNameParts[0]), "exact");
        return;
      }
    }

    if (numWordsInName > 2 && name.includes("/")) {
      // this handles the cases like "Helen ADAM / CHALMERS"
      // In this case the user has added both the maiden name and married name
      // usually on a death registration
      // We try just throwing away the part after the slash
      let slashIndex = name.indexOf("/");
      if (slashIndex != -1) {
        name = name.substring(0, slashIndex).trim();
      }
    }

    if (numWordsInName > 2 && name.includes("(") && name.includes(")")) {
      // this handles the cases like "Helen (ADAM) CHALMERS"
      // In this case the user has added both the maiden name and married name
      // usually on a death registration
      // We try just throwing away the part in the parens
      name = name.replace(/^(.*)\(.*\)(.*)$/, "$1 $2");
      name = name.replace(/\s+/g, " ");
    }

    let forenames = StringUtils.getWordsBeforeLastWord(name);
    let lastName = StringUtils.getLastWord(name);

    forenames = cleanForename(forenames);
    lastName = cleanSurname(lastName);

    builder.addForename(forenames, "exact");
    builder.addSurname(lastName, "exact");
  } else {
    // there is only one name, use may depend on record type
    // for now assume it is surname
    let eventClass = ScotpRecordType.getEventClass(scotpRecordType);
    if (eventClass == "birth") {
      name = cleanForename(name);
      builder.addForename(name, "exact");
    } else {
      name = cleanSurname(name);
      builder.addSurname(name, "exact");
    }
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
    if (setNameFromSeparateForenameAndSurname(data, parsedCitation, builder, true)) {
      return;
    }

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

        if (forenames) {
          forenames = cleanForename(forenames);
          builder.addSpouseForename(forenames, searchOption);
        }

        if (lastName) {
          lastName = cleanSurname(lastName);
          builder.addSpouseSurname(lastName, searchOption);
        }
      } else {
        // there is only one name, use may depend on record type
        spouseName = cleanSurname(spouseName);
        builder.addSurname(spouseName, "exact");
      }

      // some record types use full name instead of separate names
      let fullName = spouseName;

      if (fullName) {
        fullName = cleanFullName(fullName);
        builder.addSpouseFullName(fullName, searchOption);
      }
    } else if (data.spouseLastName) {
      let lastName = cleanSurname(data.spouseLastName);
      builder.addSpouseSurname(lastName, searchOption);
    } else if (data.spouseNameSurnameFirst) {
      setNameFromNameWithSurnameFirst(data, parsedCitation, builder, true);
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
  const ddmmyyyRegex = /\d\d?\/\d\d?\/(\d\d\d\d)/;
  if (ddmmyyyRegex.test(eventDate)) {
    let year = eventDate.replace(ddmmyyyRegex, "$1");
    if (year && year != eventDate) {
      eventDate = year;
    }
  }

  let isDoubleDated = false;

  // The user could have inserted double dating in the date. E.g. 1568/69 or 1568/9
  const doubleDataRegEx = /(\d\d\d\d)\/(\d\d?)$/;
  if (doubleDataRegEx.test(eventDate)) {
    // could do some extra tests but for now just set flag and remove last part
    isDoubleDated = true;
    eventDate = eventDate.replace(doubleDataRegEx, "$1");
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
  if (isDoubleDated) {
    let endYearNum = parsedDate.yearNum + 1;
    builder.addEndYear(endYearNum.toString());
  } else {
    builder.addEndYear(yearString);
  }

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

  // check for extra text like " years" on the end
  age = age.replace(/ years?$/i, "");

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
      // check if rdName has extra stuff on end
      let rdName = data.rdName;
      rdName = rdName.replace(/ registration district$/i, "");
      rdName = rdName.replace(/ district$/i, "");
      rdName = rdName.replace(/ rd$/i, "");

      if (builder.addRdName(rdName, false)) {
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

function checkForMissingDataNotInDataString(parsedCitation, data) {
  let beforeText = parsedCitation.textBeforeTitleInPartialMatch;
  if (!beforeText) {
    beforeText = parsedCitation.textBeforeMatchedTitleInSourceTitle;
  }

  if (!data.name) {
    if (beforeText) {
      let text = beforeText;
      const testForOf = /^(.*) of ([^,:;\(\)]+).*$/;
      if (testForOf.test(text)) {
        let possName = text.replace(testForOf, "$2");
        // maybe need to do some tests
        data.name = possName;
      }
    }
  }

  if (!data.eventDate && !data.year) {
    if (parsedCitation.sourceReference) {
      let text = parsedCitation.sourceReference;
      const testForYear = /^.*year(?: |: |:)(\d\d\d\d).*$/;
      if (testForYear.test(text)) {
        data.year = test.replace(testForYear, "$1");
      }
    }
  }

  if (!data.eventDate && !data.year) {
    if (beforeText) {
      let text = beforeText;
      const testForYear = /^.*(\d\d\d\d).*$/;
      if (testForYear.test(text)) {
        data.year = text.replace(testForYear, "$1");
      }
    }
  }

  if (!data.name || (!data.eventDate && !data.year)) {
    // could try to get data from the WikiTree profile that they clicked from
    // either using extract or the WikiTree API.
  }
}

function disambiguateDataFields(parsedCitation, data) {
  let scotpRecordType = parsedCitation.scotpRecordType;

  let classOfRecord = "";
  if (scotpRecordType.startsWith("stat_")) {
    classOfRecord = "statutory";
  } else if (scotpRecordType.startsWith("opr_")) {
    classOfRecord = "opr";
  } else if (scotpRecordType.startsWith("cr_")) {
    classOfRecord = "rc";
  } else if (scotpRecordType.startsWith("ch3_")) {
    classOfRecord = "other";
  }

  let hasName = data.name || data.surname || data.forename;
  let hasPlace = data.eventPlace || data.rdName || data.countyCity;

  let doneNameOrPlace = false;
  if (data.nameOrPlace) {
    if (hasName && !hasPlace) {
      if (classOfRecord == "statutory") {
        data.rdName = data.nameOrPlace;
      } else {
        data.eventPlace = data.nameOrPlace;
      }
      doneNameOrPlace = true;
    } else if (!hasName && hasPlace) {
      data.name = data.nameOrPlace;
      doneNameOrPlace = true;
    }

    // could try to determine whether the string is a valid rdName or eventPlace or name
    if (!doneNameOrPlace) {
      if (classOfRecord) {
        const searchTerms = getPlaceSearchTerms(data.nameOrPlace, classOfRecord, false);
        if (searchTerms && Array.isArray(searchTerms) && searchTerms.length > 0) {
          if (classOfRecord == "statutory") {
            data.rdName = data.nameOrPlace;
          } else {
            data.eventPlace = data.nameOrPlace;
          }
        }
      }
    }
  }
}

function addDataToBuilder(parsedCitation, data, builder) {
  checkForMissingDataNotInDataString(parsedCitation, data);

  // sometimes we have fields like "nameOrPlace"
  disambiguateDataFields(parsedCitation, data);

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
  } else if (lcLabel == "spouse forename" || lcLabel == "spouse forenames") {
    data.spouseForename = value;
  } else if (lcLabel == "spouse surname") {
    data.spouseSurname = value;
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

function parseDataSentence(dataString, parsedCitation, builder, allowAnythingOnEnd) {
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
      if (pattern.parts) {
        let regex = getRegexForPattern(pattern, allowAnythingOnEnd);
        if (regex.test(dataString)) {
          parseTextUsingPatternParts(pattern, data, dataString, cleanDataValue, allowAnythingOnEnd);
          matchedPattern = true;
          matchingPattern = pattern;
          break;
        }
      }
    }
  }

  if (matchedPattern) {
    logMessage("Parsed data string as a sentence. Pattern name is: '" + matchingPattern.name + "'");
    if (matchingPattern.parts) {
      logMessage("Pattern regular expression used was:");
      let regex = getRegexForPattern(matchingPattern);
      logMessage(regex.source);
    } else if (matchingPattern.regex) {
      logMessage("Pattern regular expression used was:");
      logMessage(matchingPattern.regex.source);
    }
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

function cleanSourceReference(parsedCitation) {
  let sourceReference = parsedCitation.sourceReference;

  if (!sourceReference) {
    return sourceReference;
  }

  sourceReference = sourceReference.trim();

  if (sourceReference.endsWith(";")) {
    sourceReference = sourceReference.substring(0, sourceReference.length - 1);
  }

  sourceReference = sourceReference.trim();

  const testForHttpOnEnd = /(.*)https?\:\/\/$/;
  if (testForHttpOnEnd.test(sourceReference)) {
    // this can happen if there is bare link after source reference befause the
    // https:// is options as we allow bare links like www.scotlandspeople.gov.uk
    sourceReference = sourceReference.replace(testForHttpOnEnd, "$1");
  }

  sourceReference = sourceReference.trim();

  const testForPunctuationOnEnd = /(.*)[\s\.,;\[\(]+$/;
  if (testForPunctuationOnEnd.test(sourceReference)) {
    sourceReference = sourceReference.replace(testForPunctuationOnEnd, "$1");
  }

  const testForPunctuationOnStart = /^[\s\.,;:\]\)]+(.*)/;
  if (testForPunctuationOnStart.test(sourceReference)) {
    sourceReference = sourceReference.replace(testForPunctuationOnStart, "$1");
  }
  const possibleStartJunkRegexes = [
    /^(?:image )?(?:last )?(?:accessed|viewed)(?: : |:| )\d\d? [a-z]+ \d\d\d\d ?(.*)/i,
    /^National Records of Scotland ?(.*)/i,
    /^database ?(.*)/i,
    /^Scotlands People ?(.*)/i,
    /^ScotlandsPeople ?(.*)/i,
  ];

  let foundMatch = true;
  while (foundMatch) {
    foundMatch = false;
    for (let regex of possibleStartJunkRegexes) {
      if (regex.test(sourceReference)) {
        foundMatch = true;

        sourceReference = sourceReference.replace(regex, "$1");

        // recheck for punctuation on start
        if (testForPunctuationOnStart.test(sourceReference)) {
          sourceReference = sourceReference.replace(testForPunctuationOnStart, "$1");
        }
        break;
      }
    }
  }

  return sourceReference;
}

function cleanDataString(parsedCitation) {
  let dataString = parsedCitation.dataString;

  if (!dataString) {
    return dataString;
  }

  dataString = dataString.trim();

  if (dataString.endsWith(";")) {
    // this can happen if there is a "; citing " after data string
    dataString = dataString.substring(0, dataString.length - 1);
  }

  dataString = dataString.trim();

  const testForHttpOnEnd = /(.*)https?\:\/\/$/;
  if (testForHttpOnEnd.test(dataString)) {
    // this can happen if there is bare link after data string befacse the
    // https:// is options as we alow bare links like www.scotlandspeople.gov.uk
    dataString = dataString.replace(testForHttpOnEnd, "$1");
  }

  dataString = dataString.trim();

  const testForPunctuationOnEnd = /(.*)[\s\.,;\[\(]+$/;
  if (testForPunctuationOnEnd.test(dataString)) {
    dataString = dataString.replace(testForPunctuationOnEnd, "$1");
  }

  const testForPunctuationOnStart = /^[\s\.,;:\]\)]+(.*)/;
  if (testForPunctuationOnStart.test(dataString)) {
    dataString = dataString.replace(testForPunctuationOnStart, "$1");
  }
  const possibleStartJunkRegexes = [
    /^(?:image )?(?:last )?(?:accessed|viewed)(?: : |: ?| )\d\d? [a-z]+ \d\d\d\d\)? ?(.*)/i,
    /^National Records of Scotland ?(.*)/i,
    /^database ?(.*)/i,
    /^Scotlands People ?(.*)/i,
    /^ScotlandsPeople ?(.*)/i,
  ];

  let foundMatch = true;
  while (foundMatch) {
    foundMatch = false;
    for (let regex of possibleStartJunkRegexes) {
      if (regex.test(dataString)) {
        foundMatch = true;

        dataString = dataString.replace(regex, "$1");

        // recheck for punctuation on start
        if (testForPunctuationOnStart.test(dataString)) {
          dataString = dataString.replace(testForPunctuationOnStart, "$1");
        }
        break;
      }
    }
  }

  // check for "citing" in the data string
  const testForCiting = /^(.*)[;,] ?citing (.*)$/i;
  if (testForCiting.test(dataString)) {
    let possibleSourceRef = dataString.replace(testForCiting, "$2");
    if (!parsedCitation.sourceReference) {
      parsedCitation.sourceReference = possibleSourceRef;
    } else {
      parsedCitation.sourceReference += ", " + possibleSourceRef;
    }
    dataString = dataString.replace(testForCiting, "$1");
    logMessage("Found 'citing' in data string, moved text after that to source reference");
  }

  return dataString;
}

function parseDataString(parsedCitation, builder) {
  // first need to determine if it is a sentence or a list

  let dataString = cleanDataString(parsedCitation);

  if (dataString) {
    logMessage("Clean data string is :\n----------------\n" + dataString + "\n----------------");

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

    // try again with any extra stuff allowed on end of sentence
    if (parseDataSentence(dataString, parsedCitation, builder, true)) {
      return;
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

  // sometimes the data got put in the SourceTitle e.g. found_stat_births_11
  dataString = parsedCitation.sourceTitle;
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

  // not parsed as a sentence or a list - could still be some missing data in
  // other strings.
  let data = {};
  addDataToBuilder(parsedCitation, data, builder);
  parsedCitation.data = data;
}

function extractReferenceNumber(parsedCitation) {
  let refNum = "";

  const standardRefNumRegexes = [
    /^.*reference number[\.,:]? ([a-z0-9 \/]+).*$/i,
    /^.*reference no\.?[,:]? ([a-z0-9 \/]+).*$/i,
    /^.*reference[\.,:]? ([a-z0-9 \/]+).*$/i,
    /^.*ref number[\.,:]? ([a-z0-9 \/]+).*$/i,
    /^.*ref num[\.,:]? ([a-z0-9 \/]+).*$/i,
    /^.*ref no[\.,:]? ([a-z0-9 \/]+).*$/i,
    /^.*ref[\.,:]? ([a-z0-9 \/]+).*$/i,
  ];

  const nonStandardRefNumRegexes = [/^.*Statutory Registers no[\.,:]? ([a-z0-9 \/]+).*$/i];

  const bareRefNumRegexes = [
    /^.*[^\d\/](\d+ ?\/ ?\d+ \d+ ?\/ ?\d+)[^\d\/].*$/, // 123 / 12 123 / 12
    /^.*[^\d\/](\d+ ?\/ ?\d+ ?\/ ?\d+)[^\d\/].*$/, // 123 / 12 / 123
    /^.*[^\d\/](\d+ ?\/ ?\d+)[^\d\/].*$/, // 123 / 12
  ];

  function extractFromTextString(text, regexes, rtKey) {
    if (!text) {
      return "";
    }

    if (regexes) {
      for (let regex of regexes) {
        if (regex.test(text)) {
          let num = text.replace(regex, "$1");
          if (num && num != text) {
            return num;
          }
        }
      }
    }

    // another way is to look for what this record type would use.
    if (rtKey) {
      let refName = ScotpRecordType.getRecordKey(parsedCitation.scotpRecordType, rtKey);
      if (refName) {
        let lcRefName = refName.toLowerCase();
        let lcSourceReference = text.toLowerCase();
        let index = lcSourceReference.indexOf(lcRefName);
        if (index != -1) {
          let remainder = lcSourceReference.substring(index + lcRefName.length);
          let num = remainder.replace(/^:? ([a-z0-9 \/]+).*$/, "$1");
          if (num && num != remainder) {
            return num;
          }
        }
      }
    }

    return "";
  }

  function extractFromSourceRefDataStringOrData(standardRegexes, nonStandardRegexes, dataKey, rtKey) {
    // See if we can extract a reference number from sourceReference
    if (parsedCitation.sourceReference && standardRegexes) {
      let sourceReference = parsedCitation.sourceReference;
      let result = extractFromTextString(sourceReference, standardRegexes, rtKey);

      if (result) {
        logMessage("  found in source reference");
        return result;
      }
    }

    // either there is no source reference or it doesn't contain a ref num
    // It is possible that it is in the data if the data string was a list
    if (parsedCitation.data && dataKey) {
      let dataRef = parsedCitation.data[dataKey];
      if (dataRef) {
        logMessage("  found in data extracted from dataString via pattern");
        return dataRef;
      }
    }

    // check the data string for a refNum, it could have been parsed as a sentence but have
    // been put in the place name
    if (parsedCitation.dataString && standardRegexes) {
      let result = extractFromTextString(parsedCitation.dataString, standardRegexes, rtKey);
      if (result) {
        logMessage("  found in data string");
        return result;
      }
    }

    // if still nothing try non-standard labels
    if (parsedCitation.sourceReference && nonStandardRegexes) {
      let result = extractFromTextString(parsedCitation.sourceReference, nonStandardRegexes, rtKey);
      if (result) {
        logMessage("  found using non-standard label");
        return result;
      }
    }

    if (parsedCitation.dataString && nonStandardRegexes) {
      let result = extractFromTextString(parsedCitation.dataString, nonStandardRegexes, rtKey);
      if (result) {
        logMessage("  found in data string using non-standard label");
        return result;
      }
    }

    return "";
  }

  function extractFromSourceTitle(standardRegexes, nonStandardRegexes, rtKey) {
    // See if we can extract a reference number from sourceTItle
    if (parsedCitation.sourceTitle) {
      let sourceTitle = parsedCitation.sourceTitle;
      let result = extractFromTextString(sourceTitle, standardRegexes, rtKey);

      if (result) {
        logMessage("  found in source reference");
        return result;
      }
    }

    // if still nothing try non-standard labels
    if (parsedCitation.sourceTitle) {
      let result = extractFromTextString(parsedCitation.sourceTitle, nonStandardRegexes, rtKey);
      if (result) {
        logMessage("  found using non-standard label");
        return result;
      }
    }
    return "";
  }

  logMessage("Search for ref num...");
  refNum = extractFromSourceRefDataStringOrData(standardRefNumRegexes, nonStandardRefNumRegexes, "ref", "ref");

  if (!refNum && parsedCitation.sourceReference) {
    // occasionally the entire source ref is just the reference number
    const testForOnlyRefNum = /^\s*([0-9 \/]+)\s*$/i;
    if (testForOnlyRefNum.test(parsedCitation.sourceReference)) {
      refNum = parsedCitation.sourceReference.replace(testForOnlyRefNum, "$1");
    }
  }

  if (!refNum && parsedCitation.sourceTitle) {
    // occasionally the source ref is in the source title
    refNum = extractFromSourceTitle(standardRefNumRegexes, nonStandardRefNumRegexes, "ref");
  }

  // try looking for a bare ref num
  if (!refNum) {
    refNum = extractFromSourceRefDataStringOrData(undefined, bareRefNumRegexes);

    if (!refNum && parsedCitation.sourceTitle) {
      // occasionally the source ref is in the source title
      refNum = extractFromSourceTitle(undefined, bareRefNumRegexes);
    }

    // exclude if it looks like a date
    if (refNum && /\d\d?\/\d\d?\/\d\d\d\d/.test(refNum)) {
      refNum = "";
    }
  }

  if (refNum) {
    refNum = refNum.trim();

    // we have a ref num but sometimes there is also a parish number and that has been left
    // out of the ref num.
    // e.g.: Parish Number: 582/2, Reference Number: 4.
    // This should set refNum to 582/2/4
    // This is only the case for a few record types. For OPR types
    // The psrish num is a separate column in the search results

    const spRt = parsedCitation.scotpRecordType;
    if (spRt == "stat_births" || spRt == "stat_marriages" || spRt == "stat_deaths") {
      const standardParishRegexes = [/^.*parish number[\.,:]? ([0-9 \/]+).*$/i, /^.*parish[\.,:]? ([0-9 \/]+).*$/i];

      const nonStandardParishRegexes = [];

      let parishNum = extractFromSourceRefDataStringOrData(
        standardParishRegexes,
        nonStandardParishRegexes,
        "parishNum",
        ""
      );

      parishNum = parishNum.trim();

      if (parishNum) {
        let compactRefNum = refNum.replace(/ ?\/ ?/g, "/");
        let compactParishNum = parishNum.replace(/ ?\/ ?/g, "/");

        if (!compactRefNum.includes(compactParishNum)) {
          refNum = parishNum + " " + refNum;
        }
      }
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
      logMessage("After parsing using pattern the source title is empty.");
      return { messages: messages };
    }
    logMessage("   Label is : " + parsedCitation.labelText);
    if (parsedCitation.textBeforeMatchedTitleInSourceTitle) {
      logMessage("   Text before title is : " + parsedCitation.textBeforeMatchedTitleInSourceTitle);
    }
    logMessage("   Source Reference is : " + parsedCitation.sourceReference);
    logMessage("   Source Title is : " + parsedCitation.sourceTitle);
    logMessage("   Website Creator/Owner is : " + parsedCitation.websiteCreatorOwner);
    logMessage("   Parish is : " + parsedCitation.parish);
    logMessage("   Data string is : " + parsedCitation.dataString);

    let scotpRecordType = getScotpRecordTypeFromSourceTitle(parsedCitation);
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
    logMessage("Trying for a partial citation pattern match by searching for known source titles in text.");

    if (!getScotpRecordTypeAndSourceTitleFromFullText(parsedCitation)) {
      if (parsedCitation.labelText) {
        logMessage("Trying again including label text.");
        if (!getScotpRecordTypeAndSourceTitleFromFullText(parsedCitation, true)) {
          logMessage("Could not find any known source title text.");
          return { messages: messages };
        }
      } else {
        logMessage("Could not find any known source title text.");
        return { messages: messages };
      }
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
      logMessage("   Label is : " + parsedCitation.labelText);
      logMessage("   Text before title is : " + parsedCitation.textBeforeTitleInPartialMatch);
      logMessage("   Source Reference is : " + parsedCitation.sourceReference);
      logMessage("   Source Title is : " + parsedCitation.sourceTitle);
      logMessage("   Website Creator/Owner is : " + parsedCitation.websiteCreatorOwner);
      logMessage("   Parish is : " + parsedCitation.parish);
      logMessage("   Data string is : " + parsedCitation.dataString);
    } else {
      logMessage("Could not find a matching partial citation pattern.");
      return { messages: messages };
    }
  }

  // do some checks on how the citation got parsed into parts
  if (!parsedCitation.sourceReference && parsedCitation.websiteCreatorOwner) {
    // it is possible that the sourceReference data got put in the owner string
    // since we don't use the owner for anything, put it in the source Reference
    parsedCitation.sourceReference = parsedCitation.websiteCreatorOwner;
    logMessage("Moved Website Creator/Owner string into Source Reference");
  }

  parsedCitation.sourceReference = cleanSourceReference(parsedCitation);

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
