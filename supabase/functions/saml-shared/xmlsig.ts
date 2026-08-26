import { NS_DSIG, decodeBase64, getChild, getTextContent, XMLSerializer } from "./xml.ts";
import { canonicalizeSignedInfo } from "./c14n.ts";
import type { SamlIdpConfig } from "./types.ts";

export interface XmlSignatureResult {
  valid: boolean;
  error?: string;
}

export async function verifyAssertionSignature(
  assertion: Element,
  idpConfig: SamlIdpConfig,
): Promise<XmlSignatureResult> {
  const signature = getChild(assertion, "Signature", NS_DSIG);
  if (!signature) {
    return { valid: false, error: "No Signature element found in Assertion" };
  }

  const signedInfo = getChild(signature, "SignedInfo", NS_DSIG);
  if (!signedInfo) {
    return { valid: false, error: "No SignedInfo element found" };
  }

  const signatureValue = getChild(signature, "SignatureValue", NS_DSIG);
  if (!signatureValue) {
    return { valid: false, error: "No SignatureValue element found" };
  }

  const keyInfo = getChild(signature, "KeyInfo", NS_DSIG);
  if (!keyInfo) {
    return { valid: false, error: "No KeyInfo element found" };
  }

  const digestValue = findDigestValue(signedInfo);
  if (!digestValue) {
    return { valid: false, error: "No DigestValue element found" };
  }

  const reference = getChild(signedInfo, "Reference", NS_DSIG);
  const transforms = reference ? getChild(reference, "Transforms", NS_DSIG) : null;
  const transformAlgorithms = transforms
    ? getChildren(transforms, "Transform", NS_DSIG).map((t) => t.getAttribute("Algorithm"))
    : [];

  const isExclusiveC14N = transformAlgorithms.some(
    (a) =>
      a === "http://www.w3.org/2001/10/xml-exc-c14n#" ||
      a === "http://www.w3.org/2001/10/xml-exc-c14n#WithComments",
  );

  const c14nBytes = canonicalizeSignedInfo(signedInfo);

  const sigBytes = decodeBase64(getTextContent(signatureValue).trim());

  const publicKey = await importIdpPublicKey(idpConfig.certificate);
  if (!publicKey) {
    return { valid: false, error: "Failed to parse IdP public key" };
  }

  const sigValid = await verifySignature(c14nBytes, sigBytes, publicKey);
  if (!sigValid) {
    return { valid: false, error: "Signature verification failed" };
  }

  const refDigestValue = getTextContent(digestValue).trim();
  const digestBytes = decodeBase64(refDigestValue);

  const digestMethod =
    getChild(signedInfo, "Reference", NS_DSIG)
      ?.getElementsByTagNameNS(NS_DSIG, "DigestMethod")
      ?.item(0)
      ?.getAttribute("Algorithm") || "http://www.w3.org/2001/04/xmlenc#sha256";

  const digestAlgo = digestMethod.includes("sha512")
    ? "SHA-512"
    : digestMethod.includes("sha384")
      ? "SHA-384"
      : "SHA-256";

  const assertionXml = new XMLSerializer().serializeToString(assertion);
  const assertionBytes = new TextEncoder().encode(assertionXml);
  const computedDigest = await crypto.subtle.digest(digestAlgo, assertionBytes);

  const computedDigestBytes = new Uint8Array(computedDigest);

  if (computedDigestBytes.length !== digestBytes.length) {
    return { valid: false, error: "Digest length mismatch" };
  }

  for (let i = 0; i < computedDigestBytes.length; i++) {
    if (computedDigestBytes[i] !== digestBytes[i]) {
      return { valid: false, error: "Digest value mismatch" };
    }
  }

  return { valid: true };
}

function findDigestValue(signedInfo: Element): Element | null {
  const references = signedInfo.getElementsByTagNameNS(NS_DSIG, "Reference");
  for (let i = 0; i < references.length; i++) {
    const ref = references[i];
    const digestValue = ref.getElementsByTagNameNS(NS_DSIG, "DigestValue").item(0);
    if (digestValue) return digestValue as Element;
  }
  return null;
}

async function importIdpPublicKey(certPem: string): Promise<CryptoKey | null> {
  try {
    const pemHeader = "-----BEGIN CERTIFICATE-----";
    const pemFooter = "-----END CERTIFICATE-----";
    let pemContents = certPem;
    if (pemContents.includes(pemHeader)) {
      pemContents = pemContents.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
    } else {
      pemContents = pemContents.replace(/\s/g, "");
    }

    const derBytes = decodeBase64(pemContents);

    const keyData = await crypto.subtle.importKey(
      "spki",
      derBytes,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["verify"],
    );
    return keyData;
  } catch (err) {
    console.error("[SAML] Failed to import IdP public key:", err);
    return null;
  }
}

async function verifySignature(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: CryptoKey,
): Promise<boolean> {
  try {
    return await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, publicKey, signature, data);
  } catch (err) {
    console.error("[SAML] Signature verification error:", err);
    return false;
  }
}

export function verifyResponseSignature(
  response: Element,
  idpConfig: SamlIdpConfig,
  xmlStr: string,
): Promise<XmlSignatureResult> {
  const assertion = response
    .getElementsByTagNameNS("urn:oasis:names:tc:SAML:2.0:assertion", "Assertion")
    .item(0) as Element | null;

  if (!assertion) {
    return Promise.resolve({ valid: false, error: "No Assertion in Response" });
  }

  const assertionSig = getChild(assertion, "Signature", NS_DSIG);
  const responseSig = getChild(response, "Signature", NS_DSIG);

  if (assertionSig) {
    return verifyAssertionSignature(assertion, idpConfig);
  }

  if (responseSig) {
    const sig = getChild(response, "Signature", NS_DSIG)!;
    const signedInfo = getChild(sig, "SignedInfo", NS_DSIG);
    if (!signedInfo) return Promise.resolve({ valid: false, error: "No SignedInfo" });

    const ref = getChild(signedInfo, "Reference", NS_DSIG);
    const uri = ref?.getAttribute("URI") || "";
    const targetId = uri.startsWith("#") ? uri.slice(1) : "";

    if (!targetId) {
      return Promise.resolve({ valid: false, error: "Reference URI does not point to assertion" });
    }

    return verifyAssertionSignature(assertion, idpConfig);
  }

  return Promise.resolve({ valid: false, error: "No signature found" });
}
