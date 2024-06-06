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

import {
  setupSearchCollectionsSubMenu,
  addSameRecordMenuItem,
  addBackMenuItem,
  addMenuItemWithSubMenu,
  addMenuItem,
  beginMainMenu,
  endMainMenu,
  doAsyncActionWithCatch,
  closePopup,
} from "/base/browser/popup/popup_menu_building.mjs";
import { setupSearchWithParametersSubMenu } from "/base/browser/popup/popup_search_with_parameters.mjs";

import {
  registerSearchMenuItemFunction,
  shouldShowSiteSearch,
  openUrlInNewTab,
} from "/base/browser/popup/popup_search.mjs";

import { options } from "/base/browser/options/options_loader.mjs";
import { checkPermissionForSite } from "/base/browser/popup/popup_permissions.mjs";

//////////////////////////////////////////////////////////////////////////////////////////
// Menu actions
//////////////////////////////////////////////////////////////////////////////////////////

function freecenDoSearch(input) {
  doAsyncActionWithCatch("FreeCen Search", input, async function () {
    // since many site searchs can be on the popup for a site, it makes sense to dynamically
    // load the build search module
    let loadedModule = await import(`../core/freecen_build_search_data.mjs`);
    let buildResult = loadedModule.buildSearchData(input);

    let fieldData = buildResult.fieldData;

    const searchUrl = "https://www.freecen.org.uk/search_queries/new?locale=en";

    const checkPermissionsOptions = {
      reason: "To perform a search on FreeCen a content script needs to be loaded on the freecen.org.uk search page.",
    };
    let allowed = await checkPermissionForSite("*://www.freecen.org.uk/*", checkPermissionsOptions);
    if (!allowed) {
      closePopup();
      return;
    }

    try {
      const freecenSearchData = {
        timeStamp: Date.now(),
        url: searchUrl,
        fieldData: fieldData,
      };

      // this stores the search data in local storage which is then picked up by the
      // content script in the new tab/window
      chrome.storage.local.set({ freecenSearchData: freecenSearchData }, function () {
        //console.log('saved freecenSearchData, freecenSearchData is:');
        //console.log(freecenSearchData);
      });
    } catch (ex) {
      console.log("storeDataCache failed");
    }

    openUrlInNewTab(searchUrl);
    closePopup();
  });
}

async function freecenSearch(generalizedData) {
  const input = {
    typeOfSearch: "",
    generalizedData: generalizedData,
    options: options,
  };
  freecenDoSearch(input);
}

async function freecenSearchCollection(generalizedData, collectionWtsId) {
  let searchParams = {
    collectionWtsId: collectionWtsId,
  };
  const input = {
    typeOfSearch: "SpecifiedCollection",
    searchParameters: searchParams,
    generalizedData: generalizedData,
    options: options,
  };
  freecenDoSearch(input);
}

async function freecenSearchWithParameters(generalizedData, parameters) {
  const input = {
    typeOfSearch: "SpecifiedParameters",
    searchParameters: parameters,
    generalizedData: generalizedData,
    options: options,
  };
  freecenDoSearch(input);
}

//////////////////////////////////////////////////////////////////////////////////////////
// Menu items
//////////////////////////////////////////////////////////////////////////////////////////

function addFreecenDefaultSearchMenuItem(menu, data, backFunction, filter) {
  const siteConstraints = {
    startYear: 1841,
    endYear: 1911,
    dateTestType: "lived",
    countryList: ["United Kingdom"],
  };

  if (!shouldShowSiteSearch(data.generalizedData, filter, siteConstraints)) {
    return false;
  }

  addMenuItemWithSubMenu(
    menu,
    "Search FreeCen (UK)",
    function (element) {
      freecenSearch(data.generalizedData);
    },
    function () {
      setupFreecenSearchSubMenu(data, backFunction);
    }
  );

  return true;
}

function addFreecenSameRecordMenuItem(menu, data) {
  addSameRecordMenuItem(menu, data, "freecen", function (element) {
    const input = {
      typeOfSearch: "SameCollection",
      generalizedData: data.generalizedData,
      options: options,
    };
    freecenDoSearch(input);
  });
}

function addFreecenSearchCollectionsMenuItem(menu, data, backFunction) {
  addMenuItem(menu, "Search a specific collection...", function (element) {
    setupSearchCollectionsSubMenu(data, "freecen", freecenSearchCollection, backFunction);
  });
}

function addFreecenSearchWithParametersMenuItem(menu, data, backFunction) {
  addMenuItem(menu, "Search with specified parameters...", function (element) {
    setupFreecenSearchWithParametersSubMenu(data, backFunction);
  });
}

//////////////////////////////////////////////////////////////////////////////////////////
// Submenus
//////////////////////////////////////////////////////////////////////////////////////////

async function setupFreecenSearchSubMenu(data, backFunction) {
  let backToHereFunction = function () {
    setupFreecenSearchSubMenu(data, backFunction);
  };

  let menu = beginMainMenu();
  addBackMenuItem(menu, backFunction);

  addFreecenSameRecordMenuItem(menu, data);
  addFreecenSearchCollectionsMenuItem(menu, data, backToHereFunction);
  addFreecenSearchWithParametersMenuItem(menu, data, backToHereFunction);

  endMainMenu(menu);
}

async function setupFreecenSearchWithParametersSubMenu(data, backFunction) {
  let dataModule = await import(`../core/freecen_data.mjs`);
  setupSearchWithParametersSubMenu(data, backFunction, dataModule.FreecenData, freecenSearchWithParameters);
}

//////////////////////////////////////////////////////////////////////////////////////////
// Register the search menu - it can be used on the popup for lots of sites
//////////////////////////////////////////////////////////////////////////////////////////

registerSearchMenuItemFunction("freecen", "FreeCen (UK)", addFreecenDefaultSearchMenuItem);
