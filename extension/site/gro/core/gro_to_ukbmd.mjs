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

import { isValidUkbmdDistrictName, getDisambigatedDistrictName } from "./gro_ukbmd_districts.mjs";

// NOTE: Broken UKBMD links on WikiTree can be found with this search:
// https://plus.wikitree.com/default.htm?report=err6&Query=ukbmd+&MaxErrors=1000&ErrorID=965
// Other suggestions related to ukbmd can be found using this search:
// https://plus.wikitree.com/default.htm?report=err6&Query=ukbmd+&MaxErrors=1000&ErrorID=

// UPDATE: In 2.1.3 (Jan 2024) I added a full list of UKBMD district names and no longer
// create a link if it is not in that list. So Sourcer should no longer create broken links.

function getUkbmdDistrictPageUrl(district, volume, year, districtCode) {
  // https://www.ukbmd.org.uk/reg/districts/st%20pancras.html

  const overrides = {
    aberystwith: "aberystwyth",
    aldington: "east ashford", // was never a district, just part of one
    "alston and garregill": "alston", // transcription error?
    "alston and garrigill": "alston",
    "alston with garrigill": "alston",
    "ashby de la zouch": "ashby-de-la-zouch",
    "ashby de la louch": "ashby-de-la-zouch", // transcription error?
    "ashby de la zouche": "ashby-de-la-zouch", // transcription error?
    "ashby dela zouch": "ashby-de-la-zouch",
    ashbydelazouch: "ashby-de-la-zouch",
    ashtonunderlyne: "ashton under lyne",
    "ashton underlyne": "ashton under lyne",
    asminster: "axminster", // transcription error
    bamsley: "barnsley", // transcription error?
    "bangor and beaumaris": "bangor",
    "barrow in furness": "barrow-in-furness",
    "barrowin furness": "barrow-in-furness",
    "barrow on soar": "barrow upon soar",
    "barton regis bristol": "barton regis", // could be date specific?
    bedwellty: "bedwelty", // The name is actually "Bedwellty" but the ukbmd page is bedwelty
    bedwillty: "bedwelty", // The name is actually "Bedwellty" but the ukbmd page is bedwelty
    "bermondsey now st olave southwark": "bermondsey",
    "berwick upon tweed": "berwick",
    "bishop stortford": "bishops stortford",
    bootle: "bootle1",
    "bootle cumberland": "bootle1",
    "bosmere and claydon": "bosmere",
    bourn: "bourne",
    "bournemouth christchurch and poole": "bournemouth",
    "bradford and north bierley yorkshire": "bradford",
    "bradford yorkshire": "bradford",
    "bradford wills": "bradford on avon", // transcription error
    "bradford wilts": "bradford on avon",
    "bradford wilts and somerset": "bradford on avon",
    "bridgend and cowbridge": "bridgend",
    brighthelmston: "brighton",
    "bristol barton regis": "barton regis", // could be date specific?
    "bucklow altrincham": "bucklow",
    bumley: "burnley", // transcription error
    "burton on trent": "burton upon trent",
    "bury bury and lancashire": "bury", // transcription error?
    "bury bury and lancaster": "bury",
    "bury lancaster": "bury",
    castle: "castle ward",
    castor: "peterborough", // castor is part of this district
    "caxton and arrington": "caxton",
    "chapel en le firth": "chapel-en-le-frith", // transcription error
    "chapel en le frith": "chapel-en-le-frith",
    "chapel en lefrith": "chapel-en-le-frith",
    "chapel on le frith": "chapel-en-le-frith",
    chapelenlefrith: "chapel-en-le-frith",
    chepston: "chepstow", // transcription error
    "chester le street": "chester-le-street",
    "chesterle street": "chester-le-street",
    "chester lestreet": "chester-le-street",
    chesterlestreet: "chester-le-street",
    "cholsey in the wallingford": "wallingford",
    "city of london": "london city",
    "county of london": "london city",
    "cricklade and wootton bassett": "cricklade",
    "dorchester and cerne": "dorchester",
    "dorchester and corne": "dorchester", // transcription error?
    "dorset register office dorchester": "dorset",
    drayton: "market drayton",
    duddeston: "aston",
    "durham and lanchester": "durham",
    "east and west flegg": "flegg",
    "east and west flegg norfolk": "flegg",
    eastgrinsted: "east grinstead",
    "east ward westmorland": "east ward",
    "ecclesall burlow": "ecclesall bierlow", // transcription error?
    festiniog: "ffestiniog",
    "foleshill and sowe": "foleshill",
    "foleshill and lowe": "foleshill", // transcription error?
    "foleshill lowe": "foleshill", // transcription error?
    "foleshill sowe": "foleshill",
    gainsbro: "gainsborough",
    gainsburgh: "gainsborough", // transcription error?
    "great boughton and hawarden": "great boughton",
    "gravesend milton": "gravesend",
    "gravesend and milton": "gravesend",
    "gravesend and melton": "gravesend", // transcription error?
    guisbro: "guisborough", // abbreviation
    guisbrough: "guisborough", // abbreviation
    haggerston: "shoreditch",
    hamfordwest: "haverfordwest", // transcription error?
    "hatfield and welwyn": "hatfield",
    "haverford west": "haverfordwest",
    "hayfield and glossop": "hayfield",
    heckington: "sleaford",
    "helmsley and kirkbymoorside": "helmsley",
    "hemel himpsted": "hemel hempstead", // transcription error?
    "hereford and dore": "hereford",
    "houghton le spring": "houghton-le-spring",
    "highworth and swindon": "highworth",
    "isle of thanet": "thanet",
    "isle of w": "isle of wight", // transcription error?
    "islington east": "islington",
    "islington north": "islington",
    "islington south": "islington",
    "islington south east": "islington",
    "islington south west": "islington",
    "islington west": "islington",
    kemington: "kensington", // transcription error?
    "kensington paddington and fulham": "kensington",
    "kingston on thames": "kingston", // note that "kingston upon thames" is a valid later district (we may need a date check)
    "kingston upon hull": "hull", // an early name for district
    knaresbro: "knaresborough",
    knaresbrough: "knaresborough",
    "lady wood birmingham in the county of warwick": "birmingham",
    "leek and longnor": "leek",
    "lexden and winstree": "lexden",
    "lewes chailey and westfirle": "lewes",
    "lewes chailey westfirle and newhaven": "lewes",
    "lewes chailey westfirle and new haven": "lewes", // transcription error?
    "lewes chailey westfirld and newhaven": "lewes", // transcription error?
    "lewes chinley westfirle and newhaven": "lewes", // transcription error?
    llanewst: "llanwrst", // transcription error?
    llanrwst: "llanwrst", // The name is actually Llanrwst but ukbmd page is llanwrst
    llangadock: "llandovery",
    "loddon and clavering": "loddon",
    "manchester and prestwich": "manchester",
    "manchester and prestwick": "manchester", // transcription error?
    "matlock bakewell and tideswell": "matlock",
    "mitford and launditch": "mitford",
    "mortlake in the county of surrey": "richmond1",
    "moulton in the county of northampton": "kettering",
    "mutford and lothingland": "mutford",
    mynyddslwyn: "newport2",
    mynyddyslwyn: "newport2", // typo
    "nantmel and rhayader": "rhayader",
    "rhayader and nantinel": "rhayader", // transcription error?
    "neath port talbot": "neath-port-talbot", // should be "neath" before 1996 (e.g. Walters-9901)
    "newcastle on tyne": "newcastle upon tyne",
    "newcastle on tyne and northumberland": "newcastle upon tyne",
    "newcastle emlyn": "newcastle in emlyn",
    "new castle in emlyn": "newcastle in emlyn",
    newmarkett: "newmarket", // transcription error?
    "newport pagnett": "newport pagnell", // transcription error?
    "newport salop": "newport1",
    "newport salop and stafford": "newport1",
    "newport salop and staffordshire": "newport1",
    "newport shropshire": "newport1",
    "newport in the counties of salop and stafford": "newport1",
    "newport mon": "newport2",
    "newtown and llanidloes": "newtown",
    norhamshire: "northamptonshire",
    pontepact: "pontefract",
    "pont y pridd": "pontypridd",
    "ponty pridd": "pontypridd",
    "presteigne kington": "presteigne",
    "presteigne and kington": "presteigne",
    pwllhell: "pwllheli", // transcription error?
    "rhondda cynon taf": "rhondda-cynon-taf",
    "rhayader and nantmel": "rhayader",
    "rhayader and nantwich": "rhayader", // transcription error?
    "richmond surrey": "richmond1",
    "richmond union surrey": "richmond1",
    "richmond union yorks": "richmond2",
    "richmond union yorkshire": "richmond2",
    "richmond yorkshire": "richmond2",
    rochester: "medway", // depends on date but only example seen was before 1941
    "romsey and mitchelmersh": "romsey",
    rotherfield: "uckfield",
    "royston and buntingford": "royston",
    "royston buntingford": "royston",
    scarboro: "scarborough",
    scarisbrick: "ormskirk", // was never a district, just part of one
    "scilly isles": "scilly",
    "scilly islands": "scilly",
    "st agnes in the county of cornwall": "truro",
    "st aubyn in the county of devon": "stoke damerel", // was never a district, just part of one
    "st augustine in the city and county of bristol": "bristol", // was never a district, just part of one
    "st faith": "st faiths",
    "st columb major": "st columb",
    "st george the martyr southwark": "st george southwark",
    "st george the martyr southwack": "st george southwark", // typo
    "st giles and st george": "st giles",
    "st giles in the fields and st george bloomsbury": "st giles",
    "st giles in the fields of st george bloomsbury": "st giles",
    "st just in penwith": "penzance",
    "st luke chelsea": "chelsea",
    "st mary carlisle": "carlisle",
    "st mary magdalen bermondsey": "bermondsey",
    "st mary magdalen bermondsey surrey": "bermondsey",
    "st mary newington": "newington",
    "st mary newington surrey": "newington",
    "st james clerkenwell": "clerkenwell",
    "st olave": "st olave southwark",
    "st olaves": "st olave southwark",
    "st olaves union southwark": "st olave southwark",
    "st saviour london": "st saviour southwark",
    "st saviours london": "st saviour southwark",
    "st saviour surrey": "st saviour southwark",
    "st saviours surrey": "st saviour southwark",
    "st saviours union surrey": "st saviour southwark",
    "st saviours": "st saviour southwark",
    "st saviour": "st saviour southwark",
    "st thomas union devon": "st thomas",
    stalbridge: "north dorset",
    "stannon county of cumberland": "carlisle", // typo, stanwix?
    "stockton and ledgefield": "stockton", // typo
    "stockton and sedgefield": "stockton",
    stonebridge: "stourbridge", // typo
    "sturminster dorset": "sturminster",
    "sturminster newton": "sturminster",
    "swindon and highworth": "highworth",
    "tiverton and dulverton": "tiverton",
    "town of nottingham": "nottingham",
    tunbridge: "tonbridge",
    "tunsd and happing": "tunstead",
    "tunstd happg": "tunstead",
    "tunstd and happg": "tunstead",
    "tunstead and happing": "tunstead",
    "tynemouth union northumberland": "tynemouth",
    ulverstone: "ulverston", // typo in transcription?
    "upton upon severn": "upton on severn",
    "vale of glamorgan": "vale-of-glamorgan",
    "wandsworth and clapham": "wandsworth",
    "wareham and purbeck": "wareham",
    wanington: "warrington", // typo in transcription?
    "wellington somerset": "wellington1",
    "wellington somerset and devon": "wellington1",
    "wellington salop": "wellington2",
    "wellington union salop": "wellington2",
    "wellington salop": "wellington2",
    "wem and whitchurch": "whitchurch2",
    "west bromwich north east": "west bromwich",
    "west croydon": "croydon",
    "west derby and toxteth park": "west derby",
    "west derby of toxteth park": "west derby",
    "westderby and toxteth park": "west derby", // transcription error?
    "westbury and whorwellsdown": "westbury",
    "westminster st james": "st james westminster",
    "whitchurch and overton": "whitchurch1",
    "whitchurch hants": "whitchurch1",
    "wigan wigan": "wigan", // typo in transcription?
    "wigton cumberland": "wigton",
    wirrall: "wirral",
    "wimborne and cranborne": "wimborne",
    "winchester and hursley": "winchester",
    "wolstanton and barslem": "wolstanton", // typo in transcription?
    "wolstanton and burslem": "wolstanton",
    "wolstanton and burslew": "wolstanton", // typo in transcription?
    "wolverhampton and seisdon": "wolverhampton",
    "wolverhamton and seisdon": "wolverhampton", // typo in transcription?
    woodchurch: "wirral",
    "wortley and penistone": "wortley",
    "yarmouth great yarmouth": "yarmouth",
    "great yarmouth great yarmouth": "yarmouth",

    // these abbreviations are used on FreeBMD (they are on the printed pages that the
    // transcriptions are on). They may not be used on GRO but keeping them here for historical reasons.
    "barrow s": "barrow upon soar",
    "barrow f": "barrow-in-furness",
    "chester-le-s": "chester-le-street",
    "leighton b": "leighton buzzard",
    "gloucester c": "gloucester city",
    "surrey n e": "surrey north eastern",
    "newcastle t": "newcastle upon tyne",
    "nthmbld central": "northumberland central",
  };

  const ambiguousNames = {
    bootle: ["bootle1", "bootle2"], // could be in cumberland or lancs/merseyside
    hadington: ["headington", "paddington"], // ambiguous typo
    newcastle: ["newcastle in emlyn", "newcastle upon tyne"], // could be in staffs or northumberland
    newport: ["newport1", "newport2", "newport pagnell"], // could be in shrops or monmouthshire
    richmond: ["richmond1", "richmond2"], // could be in surrey or yorkshire
    wellington: ["wellington1", "wellington2"], // could be in shrops or somerset
    whitchurch: ["whitchurch1", "whitchurch2"], // could be in hampshire or shropshire
  };

  // don't need to include county names on their own as that is checked for
  const districtNamesWithCounty = [
    "bath and north east somerset",
    "central bedfordshire",
    "chiltern and south bucks",
    "east devon",
    "east dorset",
    "east london",
    "east surrey",
    "east sussex",
    "mid devon",
    "mid glamorgan",
    "mid powys",
    "mid surrey",
    "mid warwicksire",
    "north bucks",
    "north devon",
    "north dorset",
    "north east cheshire",
    "north east hampshire",
    "north east lincolnshire",
    "north lincolnshire",
    "north northamptonshire",
    "north shropshire",
    "north somerset",
    "north surrey",
    "north warwickshire",
    "north yorkshire",
    "south cheshire",
    "south derbyshire",
    "south dorset",
    "south east hampshire",
    "south east surrey",
    "south glamorgan",
    "south gloucestershire",
    "south pembrokeshire",
    "south somerset",
    "south staffordshire",
    "south warwickshire",
    "south and west dorset",
    "south cheshire",
    "west berkshire",
    "west cheshire",
    "west devon",
    "west dorset",
    "west glamorgan",
    "west lancashire",
    "west london",
    "west northamptonshire",
    "west oxfordshire",
    "west somerset",
    "west surrey",
    "west sussex",
  ];

  const endingsToRemove = [
    " bucks",
    " cumberland",
    " devon",
    " dorset",
    " essex",
    " hants",
    " herts",
    " herefordshire",
    " hertfordshire",
    " hertferdshore", // transcription error
    " kent",
    " lancashire",
    " leicestershire",
    " london",
    " middlesex",
    " norfolk",
    " northumberland",
    " notts",
    " salop",
    " shropshire",
    " somerset",
    " surrey",
    " sussex",
    " west riding of yorkshire",
    " west riding yorkshire",
    " westriding of yorkshire", // transcription error?
    " wilts",
    " wiltshire",
    " yorks",
  ];

  function disambiguateName(districtName, volume, year, districtCode) {
    let possibleResolutions = ambiguousNames[districtName];
    if (!possibleResolutions) {
      return districtName;
    }

    // it is ambiguous, try to use valome and year to disambiguate
    let newName = getDisambigatedDistrictName(possibleResolutions, volume, year, districtCode);

    return newName;
  }

  function isDistrictThatEndsWithCountyName(name) {
    return districtNamesWithCounty.includes(name);
  }

  if (!district) {
    return "";
  }

  var districtName = district.toLowerCase().trim();

  districtName = disambiguateName(districtName, volume, year, districtCode);
  if (!districtName) {
    return "";
  }

  // sometimes there is a number on the end like: ABERGAVENNY 578
  // remove this first in case there is another suffix like "union" before it
  // Possibly this could be used to resolve ambiguity in future. E.g. NEWPORT  (8362A)
  // Example here:
  // https://www.gro.gov.uk/gro/content/certificates/indexes_search.asp?index=EW_Death&year=1985&range=0&surname=PUGSLEY&forename1=ADA&forename2=BLANCHE&gender=F&month=14&district=NEWPORT&volume=28&page=770
  districtName = districtName.replace(/\s+\d+$/, "").trim();
  districtName = districtName.replace(/\(\d+\)$/, "").trim(); // district number on end

  districtName = districtName.replace("saint", "st");
  // it is a little odd that we remove "-" below but then add it back for things like chapel-en-le-frith
  districtName = districtName.replace(/\s*[\,\.\(\)\-\_\=]+\s*/g, " ").trim();
  districtName = districtName.replace(/[\'\"]/g, "").trim();
  districtName = districtName.replace(/\s+\&\s+/g, " and ").trim();
  districtName = districtName.replace(/^district of the\s+/, "").trim();
  districtName = districtName.replace(/^district of\s+/, "").trim();
  districtName = districtName.replace(/^of\s+/, "").trim();
  districtName = districtName.replace(/\s+poor\s+law\s+union$/, "").trim();
  districtName = districtName.replace(/union$/, "").trim(); // example BEDFORDUNION
  districtName = districtName.replace(/\s+union$/, "").trim();
  districtName = districtName.replace(/\s+district$/, "").trim();
  districtName = districtName.replace(/\s+hundred$/, "").trim();
  districtName = districtName.replace(/^the\swhole\sof\sthe\s/, "").trim();
  districtName = districtName.replace(/^the\s/, "").trim();

  districtName = disambiguateName(districtName, volume, year, districtCode);
  if (!districtName) {
    return "";
  }

  // sometimes the district name has a slash in it like CARDIFF/CAERDYDD (from 1994 entry)
  // or VALE OF GLAMORGAN/BRO MORGANNWG (from 2004 entry)
  // In this case remove the / and everything after it
  if (districtName.indexOf("/") != -1) {
    districtName = districtName.replace(/([^\/]+)\/.*/, "$1");
  }

  // sometimes the district name starts with "city of", e.g. "city of coventry"
  // This is only wanted in the URL for city of westminster
  const cityOfPrefix = "city of ";
  if (districtName.startsWith(cityOfPrefix)) {
    // some special cases
    if (districtName.startsWith("city of london")) {
      districtName = "london city";
    } else if (!districtName.startsWith("city of westminster")) {
      districtName = districtName.substring(cityOfPrefix.length);
    }
  }

  // check for special cases
  if (overrides.hasOwnProperty(districtName)) {
    districtName = overrides[districtName];
  }

  // before removing county endings check it is not a special case
  if (!isDistrictThatEndsWithCountyName(districtName)) {
    // remove unwanted county names on end (do this after special cases because county name is sometimes needed
    // to spot the special case)
    for (let ending of endingsToRemove) {
      if (districtName.endsWith(ending)) {
        let newDistrictName = districtName.substring(0, districtName.length - ending.length);
        // don't remove if it is the only word
        if (newDistrictName) {
          districtName = newDistrictName;
        }
        break;
      }
    }
  }

  // special case for strings like: "OF DEVIZES IN THE COUNTY OF WILTS"
  // or : OF YORK IN THE CITY AND COUNTY OF YORK
  // or: NORTH AYLESFORD UNION - COUNTY OF KENT
  // Note that previous code may have removed the county name on the end and preceding space
  if (districtName.indexOf("county") != -1) {
    districtName = districtName.replace(/^of /, "");
    districtName = districtName.replace(/ in the city and in the county of.*/, "");
    districtName = districtName.replace(/ in the county of.*/, "");
    districtName = districtName.replace(/ in the city and county.*/, "");
    districtName = districtName.replace(/\s+county of.*/, "");
    districtName = districtName.trim();
  }
  // special case for strings like: DONCASTER IN THE COUNTIES OF YORK AND NOTTINGHAM
  // or: BASFORD UNION COUNTIES OF NOTTINGHAM DERBY
  else if (districtName.indexOf("counties") != -1) {
    districtName = districtName.replace(/^of /, "");
    districtName = districtName.replace(/ in the counties of.*/, "");
    districtName = districtName.replace(/ on the counties of.*/, ""); // maybe a typo
    districtName = districtName.replace(/ of the counties of.*/, ""); // maybe a typo
    districtName = districtName.replace(/ counties of.*/, "");
    districtName = districtName.trim();
  }
  // or a typo like: OF ALCESTER IN THE COUNTRIES OF WARWICK AND WORCHE
  else if (districtName.indexOf("countries") != -1) {
    districtName = districtName.replace(/^of /, "");
    districtName = districtName.replace(/ in the countries of.*/, "");
    districtName = districtName.replace(/ countries of.*/, "");
    districtName = districtName.trim();
  }

  // Remove UNION again for an example like: BASFORD UNION COUNTIES OF NOTTINGHAM DERBY
  // also works for: SAINT ALBANS UNION HERTS
  districtName = districtName.replace(/\s+union$/, "").trim();

  // check for special cases again, for an example like:
  // OF HOUGHTON LE SPRING IN THE COUNTY OF DURHAM
  if (overrides.hasOwnProperty(districtName)) {
    districtName = overrides[districtName];
  }

  // try to disambiguate one more time, needed for example like
  // OF THE NEWPORT UNION IN THE COUNTIES OF SALOP AND
  districtName = disambiguateName(districtName, volume, year, districtCode);
  if (!districtName) {
    return "";
  }

  districtName = encodeURI(districtName);

  if (!isValidUkbmdDistrictName(districtName)) {
    let invalidLink = true;

    // try some rules that might find the correct name

    // sometimes the name includes the old and new district names.
    // e.g.: GREAT BOUGHTON, NOW CHESTER
    if (districtName.includes("%20now%20")) {
      let newDistrictName = districtName.replace(/.*%20now%20(.+)$/, "$1");
      if (newDistrictName && newDistrictName != districtName) {
        if (isValidUkbmdDistrictName(newDistrictName)) {
          districtName = newDistrictName;
          invalidLink = false;
        }
      }
    }

    if (invalidLink) {
      return "";
    }
  }

  const url = "https://www.ukbmd.org.uk/reg/districts/" + districtName + ".html";
  return url;
}

export { getUkbmdDistrictPageUrl };
