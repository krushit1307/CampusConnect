// Windows temporarily needs this file, https://github.com/module-federation/vite/issues/68

import { loadShare } from "@module-federation/runtime";
const importMap = {
  react: async () => {
    let pkg = await import("__mf__virtual/host__prebuild__react__prebuild__.js");
    return pkg;
  },
  "react-dom": async () => {
    let pkg = await import("__mf__virtual/host__prebuild__react_mf_2_dom__prebuild__.js");
    return pkg;
  },
  "react-router-dom": async () => {
    let pkg =
      await import("__mf__virtual/host__prebuild__react_mf_2_router_mf_2_dom__prebuild__.js");
    return pkg;
  },
};
const usedShared = {
  react: {
    name: "react",
    version: "19.2.8",
    scope: ["default"],
    loaded: false,
    from: "host",
    async get() {
      if (false) {
        throw new Error(`Shared module '${"react"}' must be provided by host`);
      }
      usedShared["react"].loaded = true;
      const { react: pkgDynamicImport } = importMap;
      const res = await pkgDynamicImport();
      const exportModule = { ...res };
      // All npm packages pre-built by vite will be converted to esm
      Object.defineProperty(exportModule, "__esModule", {
        value: true,
        enumerable: false,
      });
      return function () {
        return exportModule;
      };
    },
    shareConfig: {
      singleton: true,
      requiredVersion: "^19.2.7",
    },
  },
  "react-dom": {
    name: "react-dom",
    version: "19.2.8",
    scope: ["default"],
    loaded: false,
    from: "host",
    async get() {
      if (false) {
        throw new Error(`Shared module '${"react-dom"}' must be provided by host`);
      }
      usedShared["react-dom"].loaded = true;
      const { "react-dom": pkgDynamicImport } = importMap;
      const res = await pkgDynamicImport();
      const exportModule = { ...res };
      // All npm packages pre-built by vite will be converted to esm
      Object.defineProperty(exportModule, "__esModule", {
        value: true,
        enumerable: false,
      });
      return function () {
        return exportModule;
      };
    },
    shareConfig: {
      singleton: true,
      requiredVersion: "^19.2.0",
    },
  },
  "react-router-dom": {
    name: "react-router-dom",
    version: "7.18.1",
    scope: ["default"],
    loaded: false,
    from: "host",
    async get() {
      if (false) {
        throw new Error(`Shared module '${"react-router-dom"}' must be provided by host`);
      }
      usedShared["react-router-dom"].loaded = true;
      const { "react-router-dom": pkgDynamicImport } = importMap;
      const res = await pkgDynamicImport();
      const exportModule = { ...res };
      // All npm packages pre-built by vite will be converted to esm
      Object.defineProperty(exportModule, "__esModule", {
        value: true,
        enumerable: false,
      });
      return function () {
        return exportModule;
      };
    },
    shareConfig: {
      singleton: true,
      requiredVersion: "^7.18.1",
    },
  },
};
const usedRemotes = [
  {
    entryGlobalName: "http://localhost:4174/remoteEntry.js",
    name: "eventsApp",
    type: "var",
    entry: "http://localhost:4174/remoteEntry.js",
    shareScope: "default",
  },
];
export { usedShared, usedRemotes };
