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
  registerSubsectionForOptions,
  registerOptionsGroup,
  registerSiteSearchPopupOptionsGroup,
} from "../../../base/core/options/options_registry.mjs";

const citationOptionsGroup = {
  category: "citation",
  subcategory: "opccorn",
  tab: "citation",
  subsection: "opccorn",
  options: [
    {
      optionName: "linkStyle",
      type: "select",
      label: "Link to OPC site by",
      values: [
        { value: "record", text: "Hyperlink to individual record (not recommended by OPC site)" },
        { value: "database", text: "Hyperlink to correct Cornwall OPC database" },
        { value: "content", text: "Hyperlink to Cornwall OPC content site" },
        { value: "url_content", text: "Visible URL to Cornwall OPC content site" },
      ],
      defaultValue: "database",
    },
  ],
};

registerSubsectionForOptions("search", "opccorn", "Cornwall OPC");
registerSiteSearchPopupOptionsGroup("opccorn");

registerSubsectionForOptions("citation", "opccorn", "Cornwall OPC");
registerOptionsGroup(citationOptionsGroup);
