import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import QRCode from "qrcode";
import { format } from "date-fns";

(pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;

export const generateItineraryPDF = async (
  itinerary: any[],
  userName: string,
  eventTitle: string,
) => {
  if (!itinerary || itinerary.length === 0) return;

  // 1. Generate QR Code (holds DB IDs for fast scanning)
  const qrData = JSON.stringify(itinerary.map((i) => i.sub_session_id));
  const qrCodeDataUri = await QRCode.toDataURL(qrData, { width: 150 });

  // 2. Sort the schedule chronologically
  const sortedItinerary = [...itinerary].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );

  // 3. Format rows for the PDF table
  const tableBody = sortedItinerary.map((session) => [
    format(new Date(session.start_time), "MMM d, h:mm a"),
    format(new Date(session.end_time), "h:mm a"),
    session.title || "Untitled Session",
    session.room || "TBD",
  ]);

  // 4. Define the PDF Document structure
  const docDefinition: any = {
    content: [
      { text: `${eventTitle}`, style: "header" },
      { text: `Personal Itinerary for: ${userName}`, margin: [0, 0, 0, 20] },
      {
        columns: [
          {
            width: "*",
            table: {
              headerRows: 1,
              widths: ["auto", "auto", "*", "auto"],
              body: [
                [
                  { text: "Start", bold: true },
                  { text: "End", bold: true },
                  { text: "Session", bold: true },
                  { text: "Room", bold: true },
                ],
                ...tableBody,
              ],
            },
          },
          {
            width: 150,
            stack: [
              {
                text: "Scan to Verify Schedule",
                alignment: "center",
                fontSize: 10,
                margin: [0, 0, 0, 5],
              },
              { image: qrCodeDataUri, width: 100, alignment: "center" },
            ],
          },
        ],
      },
    ],
    styles: {
      header: { fontSize: 22, bold: true, margin: [0, 0, 0, 5] },
    },
  };

  // 5. Generate and trigger download
  const fileName = `${eventTitle.replace(/\s+/g, "_")}_Itinerary.pdf`;
  pdfMake.createPdf(docDefinition).download(fileName);
};
