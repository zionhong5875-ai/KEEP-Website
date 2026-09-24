export const MAX_FILES = 3;
export const MAX_ATTACHMENT_BYTES = 4_000_000;
export const MAX_REQUEST_BYTES = 4_200_000;

const option = (value, zh, en) => ({ value, zh, en });
export const contactFields = [
  { name: "name", zh: "姓名", en: "Name", autocomplete: "name", limit: 120 },
  { name: "country", zh: "所属国家", en: "Your country", autocomplete: "country-name", limit: 120 },
  { name: "marketCountry", zh: "市场国家", en: "Target market country", limit: 200 },
  { name: "company", zh: "公司名称", en: "Company name", autocomplete: "organization", limit: 200 },
  { name: "email", zh: "公司邮箱", en: "Company email", type: "email", autocomplete: "email", limit: 320 },
  { name: "companyWebsite", zh: "公司官网（非必填，若有）", en: "Company website (optional)", type: "url", autocomplete: "url", optional: true, limit: 500 },
  { name: "cooperation", zh: "合作模式", en: "Cooperation model", options: [
    option("distribution", "代理销售维尼产品", "Distribute Vinner products"),
    option("oem", "OEM代工生产", "OEM manufacturing")
  ] },
  { name: "regulation", zh: "适用法规", en: "Applicable regulation", options: [
    option("cosmetics", "由化妆品法规监管", "Cosmetics regulations"),
    option("bpr", "由BPR法规监管", "BPR regulations"),
    option("medical", "由医疗器械法规监管", "Medical device regulations")
  ] },
  { name: "need", zh: "产品类型", en: "Product type", options: [
    option("medikeep", "感染控制", "Infection control"),
    option("carekeep", "清洁护理", "Cleansing & care"),
    option("indukeep", "工业擦拭", "Industrial wiping")
  ] },
  { name: "formula", zh: "您是否已有成熟配方", en: "Existing formula", options: [
    option("yes", "是，我已有成熟配方，仅需维尼进行代工", "Yes, I have a ready formula and only need Vinner to manufacture"),
    option("no", "否，我需要维尼的产品和配方", "No, I need Vinner's products and formulations")
  ] },
  { name: "quantity", zh: "预计首批数量（包）", en: "Initial order (packs)", options: [
    option("up-to-30000", "≦30,000", "≤30,000"),
    option("30000-100000", "30,000-100,000", "30,000-100,000"),
    option("from-100000", "≧100,000", "≥100,000")
  ] },
  { name: "message", zh: "产品描述", en: "Product description", type: "textarea", limit: 5000 }
];

export function attachmentError(files) {
  if (files.length > MAX_FILES) return "file_count";
  if (files.some(file => !/\.pdf$/i.test(file.name) || !["", "application/pdf"].includes(file.type) || file.size === 0)) return "file_type";
  if (files.reduce((size, file) => size + file.size, 0) > MAX_ATTACHMENT_BYTES) return "file_size";
  return null;
}

export function contactRows(payload) {
  return contactFields.map(field => {
    const value = payload[field.name] || "-";
    const choice = field.options?.find(item => item.value === value);
    return [`${field.en} / ${field.zh}`, choice ? `${choice.en} / ${choice.zh}` : value];
  });
}
