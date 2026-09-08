import type { Quote } from "@/app/data-model";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(cents / 100);

const date = (value: string) => value
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(`${value}T12:00:00`))
  : "Não informada";

async function brandMarkDataUrl() {
  try {
    const response = await fetch("/fama-piscinas-mark.png");
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export async function generateQuotePdf(quote: Quote, organizationName: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const left = 18;
  const right = pageWidth - 18;
  const mark = await brandMarkDataUrl();

  pdf.setFillColor(11, 31, 75);
  pdf.rect(0, 0, pageWidth, 45, "F");
  if (mark) pdf.addImage(mark, "PNG", 11, 6, 27, 27, undefined, "FAST");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text(organizationName.toLocaleUpperCase("pt-BR").slice(0, 38), 43, 20);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(145, 220, 243);
  pdf.text("ORÇAMENTO COMERCIAL · FAMA PISCINAS", 43, 27);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(255, 255, 255);
  pdf.text(quote.quoteNumber, right, 20, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(169, 216, 226);
  pdf.text(`Emissão: ${date(quote.createdAt.slice(0, 10))}`, right, 27, { align: "right" });

  pdf.setTextColor(19, 59, 72);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("CLIENTE", left, 59);
  pdf.setFontSize(14);
  pdf.text(quote.clientName, left, 67);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 123, 132);
  pdf.text(`Validade da proposta: ${date(quote.validUntil)}`, left, 74);

  pdf.setDrawColor(215, 229, 232);
  pdf.line(left, 82, right, 82);
  pdf.setTextColor(19, 59, 72);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("SERVIÇO / ESCOPO", left, 93);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const serviceLines = pdf.splitTextToSize(quote.service, right - left);
  pdf.text(serviceLines, left, 101);
  let y = 101 + serviceLines.length * 5 + 10;

  pdf.setFillColor(241, 247, 248);
  pdf.roundedRect(left, y, right - left, 49, 3, 3, "F");
  pdf.setTextColor(93, 120, 129);
  pdf.setFontSize(9);
  pdf.text("Materiais", left + 7, y + 11);
  pdf.text("Mão de obra", left + 7, y + 21);
  pdf.text("Desconto", left + 7, y + 31);
  pdf.setTextColor(31, 72, 84);
  pdf.setFont("helvetica", "bold");
  pdf.text(brl(quote.materialsCents), right - 7, y + 11, { align: "right" });
  pdf.text(brl(quote.laborCents), right - 7, y + 21, { align: "right" });
  pdf.text(`- ${brl(quote.discountCents)}`, right - 7, y + 31, { align: "right" });
  pdf.setDrawColor(207, 224, 228);
  pdf.line(left + 7, y + 36, right - 7, y + 36);
  pdf.setFontSize(11);
  pdf.text("TOTAL", left + 7, y + 44);
  pdf.setTextColor(11, 114, 231);
  pdf.setFontSize(14);
  pdf.text(brl(quote.totalCents), right - 7, y + 44, { align: "right" });
  y += 62;

  if (quote.notes) {
    pdf.setTextColor(19, 59, 72);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("OBSERVAÇÕES", left, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(78, 104, 113);
    const noteLines = pdf.splitTextToSize(quote.notes, right - left);
    pdf.text(noteLines, left, y + 8);
  }

  pdf.setDrawColor(215, 229, 232);
  pdf.line(left, 276, right, 276);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(117, 141, 148);
  pdf.text(`Proposta emitida pela ${organizationName}`.slice(0, 70), left, 283);
  pdf.text("Gerado pelo Fama System", right, 283, { align: "right" });
  pdf.save(`${quote.quoteNumber.toLowerCase()}-${quote.clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
}
