import type { Contract } from "@/app/data-model";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(cents / 100);

const date = (value: string) => value
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
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

export async function generateContractPdf(contract: Contract, organizationName: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const width = pdf.internal.pageSize.getWidth();
  const left = 18;
  const right = width - 18;
  const usable = right - left;
  const mark = await brandMarkDataUrl();

  const header = () => {
    pdf.setFillColor(11, 31, 75);
    pdf.rect(0, 0, width, 40, "F");
    if (mark) pdf.addImage(mark, "PNG", 11, 5, 25, 25, undefined, "FAST");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(organizationName.toLocaleUpperCase("pt-BR").slice(0, 38), 41, 18);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(145, 220, 243);
    pdf.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS · FAMA PISCINAS", 41, 25);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(contract.contractNumber, right, 20, { align: "right" });
  };

  const section = (label: string, value: string, y: number) => {
    pdf.setTextColor(18, 58, 70);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(label, left, y);
    pdf.setTextColor(65, 91, 100);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    const lines = pdf.splitTextToSize(value || "Não informado.", usable);
    pdf.text(lines, left, y + 7);
    return y + 7 + lines.length * 5 + 7;
  };

  header();
  let y = 54;
  y = section("CONTRATANTE", `${contract.clientName}${contract.clientDocument ? ` · CPF/CNPJ: ${contract.clientDocument}` : ""}${contract.clientAddress ? `\nEndereço: ${contract.clientAddress}` : ""}`, y);
  y = section("CONTRATADA", organizationName, y);
  y = section("OBJETO DO CONTRATO", contract.service, y);

  pdf.setFillColor(241, 247, 248);
  pdf.roundedRect(left, y, usable, 32, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(91, 116, 124);
  pdf.text("VIGÊNCIA", left + 7, y + 9);
  pdf.text("FREQUÊNCIA", left + 69, y + 9);
  pdf.text("VALOR", right - 7, y + 9, { align: "right" });
  pdf.setFontSize(10);
  pdf.setTextColor(22, 61, 73);
  pdf.text(`${date(contract.startDate)} a ${date(contract.endDate)}`, left + 7, y + 19);
  pdf.text(contract.frequency || "Não informada", left + 69, y + 19);
  pdf.setTextColor(11, 114, 231);
  pdf.text(brl(contract.monthlyCents), right - 7, y + 19, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(99, 123, 131);
  pdf.text(contract.paymentDay ? `Pagamento no dia ${contract.paymentDay}` : "Dia de pagamento não informado", right - 7, y + 26, { align: "right" });
  y += 44;

  const terms = contract.terms || "Sem cláusulas adicionais cadastradas.";
  const termLines = pdf.splitTextToSize(terms, usable);
  if (y + termLines.length * 5 > 235) {
    pdf.addPage();
    header();
    y = 53;
  }
  y = section("CLÁUSULAS E CONDIÇÕES", terms, y);
  if (y > 235) {
    pdf.addPage();
    header();
    y = 58;
  }

  pdf.setDrawColor(151, 174, 180);
  pdf.line(left, y + 28, left + 72, y + 28);
  pdf.line(right - 72, y + 28, right, y + 28);
  pdf.setTextColor(74, 99, 107);
  pdf.setFontSize(8);
  pdf.text(organizationName.slice(0, 40), left + 36, y + 34, { align: "center" });
  pdf.text(contract.clientName, right - 36, y + 34, { align: "center" });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(215, 229, 232);
    pdf.line(left, 278, right, 278);
    pdf.setTextColor(117, 141, 148);
    pdf.setFontSize(8);
    pdf.text("Documento gerado a partir dos dados cadastrados", left, 285);
    pdf.text(`Fama System · ${page}/${pageCount}`, right, 285, { align: "right" });
  }

  const filename = contract.clientName.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  pdf.save(`${contract.contractNumber.toLowerCase()}-${filename || "cliente"}.pdf`);
}
