import "server-only";

import PDFDocument from "pdfkit";

export async function buildSummaryPdf(
  title: string,
  rangeLabel: string,
  stats: { label: string; value: string }[],
) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Reliable Realties", { continued: false });
    doc.fontSize(14).fillColor("#5f6670").text(title);
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#8a8f94").text(rangeLabel);
    doc.moveDown(1.5);

    doc.fillColor("#121820");
    for (const stat of stats) {
      doc.fontSize(11).text(`${stat.label}:  `, { continued: true }).font("Helvetica-Bold").text(stat.value);
      doc.font("Helvetica");
      doc.moveDown(0.4);
    }

    doc.end();
  });
}
