import type { WorkOrder } from "@/app/data-model";

const date = (value: string) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "Não informada";

function completionReport(value: string) {
  try {
    const parsed = JSON.parse(value) as { details?: { completionReport?: string } };
    return parsed.details?.completionReport ? JSON.parse(parsed.details.completionReport) as { summary?: string; customerName?: string; confirmedAt?: string } : null;
  } catch { return null; }
}

export async function generateWorkOrderPdf(order: WorkOrder, organizationName: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const width = pdf.internal.pageSize.getWidth();
  const left = 18;
  const right = width - 18;
  const report = completionReport(order.notes);
  pdf.setFillColor(11, 31, 75);
  pdf.rect(0, 0, width, 42, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text(organizationName.toLocaleUpperCase("pt-BR").slice(0, 42), left, 17);
  pdf.setFontSize(10);
  pdf.text("RELATÓRIO DE SERVIÇO · FAMA PISCINAS", left, 27);
  pdf.setFontSize(12);
  pdf.text(order.osNumber, right, 18, { align: "right" });

  let y = 55;
  const section = (label: string, content: string) => {
    pdf.setTextColor(23, 57, 77);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(label.toLocaleUpperCase("pt-BR"), left, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(58, 80, 93);
    const lines = pdf.splitTextToSize(content || "Não informado", right - left);
    if (y + lines.length * 5 > 275) { pdf.addPage(); y = 22; }
    pdf.text(lines, left, y);
    y += lines.length * 5 + 7;
  };

  section("Cliente", order.clientName);
  section("Serviço", order.service);
  section("Data agendada", date(order.scheduledAt));
  section("Técnico responsável", order.technician || "Não atribuído");
  section("Parâmetros da água", `pH: ${order.ph ?? "não medido"} · Cloro livre: ${order.chlorine ?? "não medido"} ppm · Alcalinidade: ${order.alkalinity ?? "não medida"} ppm`);
  section("Produtos utilizados", order.productsUsed || "Não informado");
  section("Relatório da execução", report?.summary || "Relatório de execução ainda não registrado.");
  section("Confirmação do cliente", report?.customerName ? `${report.customerName} · confirmado em ${date(report.confirmedAt ?? "")}` : "Confirmação ainda não registrada.");
  section("Valor do serviço", new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.amountCents / 100));

  pdf.setDrawColor(210, 224, 232);
  pdf.line(left, 282, right, 282);
  pdf.setTextColor(107, 127, 141);
  pdf.setFontSize(8);
  pdf.text("Relatório gerado pelo Fama System", left, 288);
  pdf.save(`${order.osNumber.toLocaleLowerCase("pt-BR")}-relatorio.pdf`);
}
