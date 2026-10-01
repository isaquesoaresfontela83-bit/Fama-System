import { XMLParser, XMLValidator } from "fast-xml-parser";

type ObjectNode = Record<string, unknown>;
const object = (value: unknown): ObjectNode => value && typeof value === "object" && !Array.isArray(value) ? value as ObjectNode : {};
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
const document = (value: unknown) => text(value).replace(/\D/g, "");

function xmlAmount(value: unknown) {
  const parts = text(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!parts) throw new Error("O XML não contém um valor fiscal válido.");
  const cents = Number(parts[1]) * 100 + Number((parts[2] || "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("O XML não contém um valor fiscal válido.");
  return cents;
}

// Conference of the document's data. Authenticity and current fiscal status are consulted in the official portal.
export function readFiscalXml(source: string, invoice: { type: string; amountCents: number; customerDocument: string }, issuerDocument: string) {
  if (new TextEncoder().encode(source).length > 1024 * 1024) throw new Error("O XML deve ter no máximo 1 MB.");
  if (/<!\s*(?:DOCTYPE|ENTITY)|<\?xml-stylesheet/i.test(source)) throw new Error("O XML contém uma declaração não permitida.");
  if (XMLValidator.validate(source) !== true) throw new Error("O arquivo XML está incompleto ou inválido.");
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, processEntities: false }).parse(source) as ObjectNode;
  let issuer: ObjectNode, customer: ObjectNode, amountCents: number, accessKey: string, officialNumber: string;
  let provider: "portal_nacional" | "portal_estadual";
  if (invoice.type === "nfse" && parsed.NFSe) {
    const info = object(object(parsed.NFSe).infNFSe);
    const dps = object(object(info.DPS).infDPS);
    if (text(dps.tpAmb) !== "1") throw new Error("Importe uma NFS-e do ambiente de produção, com sua DPS.");
    accessKey = text(info["@_Id"]).replace(/^NFS/, "");
    if (!/^\d{50}$/.test(accessKey)) throw new Error("O XML não contém a chave nacional de 50 dígitos.");
    officialNumber = text(info.nNFSe);
    issuer = object(info.emit);
    if (!Object.keys(issuer).length) issuer = object(dps.prest);
    customer = object(dps.toma);
    amountCents = xmlAmount(object(object(dps.valores).vServPrest).vServ);
    provider = "portal_nacional";
  } else if (invoice.type === "nfe" && parsed.nfeProc) {
    const process = object(parsed.nfeProc);
    const info = object(object(process.NFe).infNFe);
    const protocol = object(object(process.protNFe).infProt);
    if (text(protocol.tpAmb) !== "1" || !["100", "150"].includes(text(protocol.cStat))) throw new Error("Importe o XML de produção da NF-e com protocolo de autorização.");
    accessKey = text(info["@_Id"]).replace(/^NFe/, "");
    if (!/^\d{44}$/.test(accessKey) || text(protocol.chNFe) !== accessKey) throw new Error("A chave da NF-e não corresponde ao protocolo do XML.");
    if (text(object(info.ide).mod) !== "55") throw new Error("Este registro corresponde à NF-e de produtos, modelo 55.");
    officialNumber = text(object(info.ide).nNF);
    issuer = object(info.emit); customer = object(info.dest);
    amountCents = xmlAmount(object(object(info.total).ICMSTot).vNF);
    provider = "portal_estadual";
  } else throw new Error("Use o XML da NFS-e nacional ou da NF-e autorizada. Para outros emissores municipais, anexe o PDF.");
  if (!officialNumber) throw new Error("O XML não contém o número da nota.");
  const expectedIssuer = document(issuerDocument);
  if (!expectedIssuer || document(issuer.CNPJ || issuer.CPF) !== expectedIssuer) throw new Error("O emitente do XML difere do CPF/CNPJ da empresa. Confira os dados da empresa e selecione a nota correta.");
  if (amountCents !== invoice.amountCents) throw new Error("O valor do XML difere do rascunho. Selecione a nota correspondente.");
  const expectedCustomer = document(invoice.customerDocument);
  if (expectedCustomer && document(customer.CNPJ || customer.CPF) !== expectedCustomer) throw new Error("O cliente do XML difere do cliente do rascunho.");
  return { provider, officialNumber, accessKey };
}
