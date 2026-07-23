/**
 * @fileoverview Custom ESLint rule to enforce unidirectional dependency graph and prevent cross-page imports.
 */

function normalizePathStack(pathStr) {
  const segments = pathStr.replace(/\\/g, "/").split("/");
  const stack = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (stack.length > 0) stack.pop();
    } else {
      stack.push(seg);
    }
  }
  return stack;
}

function getModuleInfo(stack) {
  const srcIdx = stack.indexOf("src");
  if (srcIdx !== -1 && srcIdx + 2 < stack.length + 1) {
    const dirType = stack[srcIdx + 1];
    if (dirType === "pages" || dirType === "routes") {
      const rawItem = stack[srcIdx + 2];
      if (rawItem) {
        const moduleName = rawItem.replace(/\.[^/.]+$/, "");
        return `${dirType}:${moduleName}`;
      }
    }
  }
  return null;
}

export const noCrossPageImports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent direct cross-page imports between page/route components to enforce architectural boundaries.",
      category: "Architectural Boundaries",
      recommended: true,
    },
    messages: {
      noCrossPageImport:
        "Forbidden cross-page import: '{{importPath}}'. Direct imports between pages/routes are prohibited to enforce unidirectional architecture. Move shared logic to src/components, src/hooks, or src/lib.",
    },
    schema: [],
  },

  create(context) {
    const rawFilename = context.filename || (context.getFilename ? context.getFilename() : "");
    const normalizedFilename = rawFilename.replace(/\\/g, "/");

    // Allow top-level application router/entry points (e.g., App.tsx, main.tsx) to import page/route modules for route registration
    const isAppEntryPoint =
      normalizedFilename.endsWith("/src/App.tsx") ||
      normalizedFilename.endsWith("/src/App.jsx") ||
      normalizedFilename.endsWith("/src/main.tsx") ||
      normalizedFilename.endsWith("/src/main.jsx") ||
      normalizedFilename.endsWith("/src/router.tsx") ||
      normalizedFilename.endsWith("/src/router.ts") ||
      normalizedFilename.includes("/src/micro-frontends/");

    if (isAppEntryPoint) {
      return {};
    }

    const fileStack = normalizePathStack(rawFilename);
    const fileModule = getModuleInfo(fileStack);

    function checkImport(node, importPath) {
      if (!importPath || typeof importPath !== "string") return;

      let targetStack = [];

      if (importPath.startsWith("@/")) {
        targetStack = normalizePathStack("src/" + importPath.slice(2));
      } else if (importPath.startsWith("src/")) {
        targetStack = normalizePathStack(importPath);
      } else if (importPath.startsWith(".")) {
        const fileDirStack = fileStack.slice(0, fileStack.length - 1);
        targetStack = normalizePathStack(fileDirStack.join("/") + "/" + importPath);
      } else {
        return;
      }

      const targetModule = getModuleInfo(targetStack);

      if (targetModule) {
        if (!fileModule || fileModule !== targetModule) {
          context.report({
            node,
            messageId: "noCrossPageImport",
            data: { importPath },
          });
        }
      }
    }

    return {
      ImportDeclaration(node) {
        if (node.source && node.source.value) {
          checkImport(node, node.source.value);
        }
      },
      ImportExpression(node) {
        if (
          node.source &&
          node.source.type === "Literal" &&
          typeof node.source.value === "string"
        ) {
          checkImport(node, node.source.value);
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source && node.source.value) {
          checkImport(node, node.source.value);
        }
      },
      ExportAllDeclaration(node) {
        if (node.source && node.source.value) {
          checkImport(node, node.source.value);
        }
      },
    };
  },
};

export default noCrossPageImports;
