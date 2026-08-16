import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { SteganographicEmbedder } from './steganographicEmbedder';
import { PDFSignatureVerifier } from './pdfSignatureVerifier';

export class DocumentWatermarker {
  /**
   * Applies both visible and invisible watermarks to a PDF document,
   * and returns the finalized buffer along with its cryptographic signature.
   */
  static async secureDocument(pdfBuffer: Buffer, user: { name: string, id: string }): Promise<{ securedBuffer: Buffer, signature: string }> {
    // 1. Add Visible Watermark using pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    const watermarkText = `Issued to: ${user.name} (${user.id})\nDate: ${new Date().toISOString()}`;
    
    for (const page of pages) {
      const { width, height } = page.getSize();
      page.drawText(watermarkText, {
        x: 50,
        y: height / 2,
        size: 24,
        color: rgb(0.75, 0.75, 0.75),
        rotate: degrees(-45),
        opacity: 0.3
      });
    }

    const modifiedPdfBytes = await pdfDoc.save();
    let securedBuffer = Buffer.from(modifiedPdfBytes);

    // 2. Embed Steganographic Metadata
    securedBuffer = await SteganographicEmbedder.embedInvisibleMetadata(securedBuffer, user.id);

    // 3. Generate Cryptographic Signature
    const signature = PDFSignatureVerifier.generateSignature(securedBuffer, { userId: user.id });

    return { securedBuffer, signature };
  }
}
