import { DOMParser, XMLSerializer } from "https://esm.sh/@xmldom/xmldom@0.8.10";

export { DOMParser, XMLSerializer };

export function parseXml(xml: string): Document {
  const parser = new DOMParser({
    errorHandler: {
      warning: (msg: string) => console.warn(msg),
      error: (msg: string) => {
        throw new Error(msg);
      },
      fatalError: (msg: string) => {
        throw new Error(msg);
      },
    },
  });
  return parser.parseFromString(xml, "text/xml") as unknown as Document;
}

export function getChild(node: Node, localName: string, namespace?: string): Element | null {
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1) {
      const el = child as Element;
      if (el.localName === localName && (!namespace || el.namespaceURI === namespace)) {
        return el;
      }
    }
  }
  return null;
}

export function getChildren(node: Node, localName: string, namespace?: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1) {
      const el = child as Element;
      if (el.localName === localName && (!namespace || el.namespaceURI === namespace)) {
        result.push(el);
      }
    }
  }
  return result;
}

export function getTextContent(node: Node): string {
  const els = getChildren(node, "#text");
  return els.map((e) => e.textContent || "").join("");
}

export function decodeBase64(str: string): Uint8Array {
  const binary = atob(str.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const NS_SAML = "urn:oasis:names:tc:SAML:2.0:assertion";
export const NS_SAMLP = "urn:oasis:names:tc:SAML:2.0:protocol";
export const NS_DSIG = "http://www.w3.org/2000/09/xmldsig#";
export const NS_XENC = "http://www.w3.org/2001/04/xmlenc#";
