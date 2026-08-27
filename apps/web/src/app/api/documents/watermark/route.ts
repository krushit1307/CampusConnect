import { NextResponse } from 'next/server';
import { DocumentWatermarker } from '../../../../../../../../services/security/documentWatermarker';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    const userId = formData.get('userId') as string;
    const userName = formData.get('userName') as string;

    if (!file || !userId || !userName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Apply security measures
    const { securedBuffer, signature } = await DocumentWatermarker.secureDocument(pdfBuffer, { id: userId, name: userName });
    
    // Hash for tracking
    const documentHash = require('crypto').createHash('sha256').update(securedBuffer).digest('hex');

    // In a real app, save to DB
    // await db.documentAuditEntry.create({
    //   data: { documentHash, signature, userId, documentType: 'TICKET' }
    // });

    return new NextResponse(securedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="secured_ticket.pdf"',
        'X-Document-Signature': signature,
        'X-Document-Hash': documentHash
      }
    });
  } catch (error) {
    console.error('Watermarking Error:', error);
    return NextResponse.json(
      { error: 'Document watermarking failed' },
      { status: 500 }
    );
  }
}
