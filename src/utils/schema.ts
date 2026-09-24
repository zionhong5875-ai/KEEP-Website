import settings from "../data/site/siteSettings.json";
import authors from "../data/site/authors.json";
import qualification from "../data/site/factoryQualification.json" with { type: "json" };
import { localizedPath } from "./i18n";
import type { Language, Localized } from "./i18n";

export type SchemaNode = Record<string, unknown>;

export type SchemaBreadcrumb = {
  name: Localized;
  path: string;
};

export const ORGANIZATION_NAME = "Vinner";
export const ORGANIZATION_LEGAL_NAME = "Vinner (Shenzhen) Health Products Limited";

export const languageCode = (language: Language) => language === "en" ? "en" : "zh-CN";

export const normalizeSiteUrl = (siteUrl: string) => new URL("/", siteUrl).toString();

export const absoluteUrl = (value: string, siteUrl: string) =>
  new URL(value, normalizeSiteUrl(siteUrl)).toString();

export const schemaIds = (siteUrl: string) => {
  const root = normalizeSiteUrl(siteUrl);

  return {
    root,
    organization: `${root}#organization`,
    website: `${root}#website`,
    logo: `${root}#logo`,
    headquarters: `${root}#headquarters`,
    factory: `${root}#huanggang-factory`
  };
};

export const buildAuthorNode = (authorId: string, siteUrl: string, language: Language): SchemaNode => {
  const author = authors[authorId as keyof typeof authors];
  if (!author) throw new Error(`Unknown blog author: ${authorId}`);
  return {
    "@type": "Person",
    "@id": `${schemaIds(siteUrl).root}#person-${authorId}`,
    name: author.name[language],
    alternateName: author.name[language === "en" ? "zh" : "en"],
    jobTitle: author.role[language],
    url: absoluteUrl(`${localizedPath("/contact/", language)}#${authorId}`, siteUrl),
    worksFor: { "@id": schemaIds(siteUrl).organization }
  };
};

const organizationDescription = (language: Language) => language === "en"
  ? "Wet wipes manufacturer founded in 2004, providing product development, manufacturing, supply, and OEM/ODM services for infection control, personal care, environmental cleaning, and industrial wiping."
  : "成立于2004年的湿巾专业制造商，为感染控制、个人护理、环境清洁和工业擦拭领域提供产品研发、生产、供应及 OEM/ODM 服务。";

export const credentialAnchor = (item: { href: string }) =>
  `credential-${item.href.split("/").pop()!.replace(/\.pdf$/i, "")}`;

export const credentialId = (item: { href: string }, siteUrl: string) =>
  absoluteUrl(`/about/factory-qualification/#${credentialAnchor(item)}`, siteUrl);

export const buildOrganizationNodes = (siteUrl: string, language: Language): SchemaNode[] => {
  const ids = schemaIds(siteUrl);
  const isEnglish = language === "en";
  const certifications = qualification.certificatesSection.items
    .filter(item => !["License", "Audit"].includes(item.type))
    .map(item => ({ "@id": credentialId(item, siteUrl) }));

  return [
    {
      "@type": "Organization",
      "@id": ids.organization,
      name: ORGANIZATION_NAME,
      legalName: ORGANIZATION_LEGAL_NAME,
      alternateName: ["VINNER", "维尼", "维尼健康", "维尼健康（深圳）股份有限公司"],
      url: ids.root,
      logo: { "@id": ids.logo },
      image: { "@id": ids.logo },
      description: organizationDescription(language),
      foundingDate: "2004",
      email: "hongzihao@vinnercare.cn",
      telephone: "+86-755-61695825",
      address: {
        "@type": "PostalAddress",
        streetAddress: isEnglish
          ? "Room 608, Baoshan Times Building, Minzhi Subdistrict, Longhua District"
          : "龙华区民治街道民强社区宝山时代大厦608",
        addressLocality: isEnglish ? "Shenzhen" : "深圳市",
        addressRegion: isEnglish ? "Guangdong" : "广东省",
        postalCode: "518129",
        addressCountry: "CN"
      },
      contactPoint: [{
        "@type": "ContactPoint",
        contactType: "sales",
        email: "hongzihao@vinnercare.cn",
        telephone: "+86-150-1399-5875",
        areaServed: "Worldwide",
        availableLanguage: ["zh-CN", "en"]
      }],
      sameAs: settings.footer.socials.map((item) => item.href).filter(Boolean),
      knowsAbout: [
        "Wet wipes manufacturing",
        "Infection control wipes",
        "Personal cleansing wipes",
        "Industrial wiping",
        "Wet wipes OEM/ODM"
      ],
      location: [{ "@id": ids.headquarters }, { "@id": ids.factory }],
      subOrganization: { "@id": ids.factory },
      hasCertification: certifications
    },
    {
      "@type": "ImageObject",
      "@id": ids.logo,
      url: absoluteUrl(settings.brand.logo, siteUrl),
      contentUrl: absoluteUrl(settings.brand.logo, siteUrl),
      caption: "Vinner logo"
    },
    {
      "@type": "Place",
      "@id": ids.headquarters,
      name: isEnglish ? "Vinner Shenzhen Headquarters" : "维尼深圳总部",
      address: {
        "@type": "PostalAddress",
        streetAddress: isEnglish
          ? "Room 608, Baoshan Times Building, Minzhi Subdistrict, Longhua District"
          : "龙华区民治街道民强社区宝山时代大厦608",
        addressLocality: isEnglish ? "Shenzhen" : "深圳市",
        addressRegion: isEnglish ? "Guangdong" : "广东省",
        postalCode: "518129",
        addressCountry: "CN"
      }
    },
    {
      "@type": ["Organization", "Place"],
      "@id": ids.factory,
      name: isEnglish
        ? `${ORGANIZATION_LEGAL_NAME} Huanggang Branch`
        : "维尼健康（深圳）股份有限公司黄冈分公司",
      alternateName: isEnglish ? "Vinner Huanggang Manufacturing Facility" : "维尼黄冈制造基地",
      parentOrganization: { "@id": ids.organization },
      foundingDate: "2017",
      image: absoluteUrl("/assets/factory/production-workshop.jpg", siteUrl),
      address: {
        "@type": "PostalAddress",
        streetAddress: isEnglish
          ? "Building 3, No. 76 Xinqiao Street, Huangzhou District"
          : "黄州区新桥街76号3号楼",
        addressLocality: isEnglish ? "Huanggang" : "黄冈市",
        addressRegion: isEnglish ? "Hubei" : "湖北省",
        postalCode: "438000",
        addressCountry: "CN"
      }
    }
  ];
};

export const buildBreadcrumbNode = (
  breadcrumbs: SchemaBreadcrumb[],
  siteUrl: string,
  language: Language,
  pageUrl: string
): SchemaNode | null => {
  if (breadcrumbs.length < 2) return null;

  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: typeof item.name === "string" ? item.name : item.name[language],
      item: absoluteUrl(localizedPath(item.path, language), siteUrl)
    }))
  };
};

export const productBrandName = (code = "", title = "") => {
  const value = `${code} ${title}`.toUpperCase();
  if (value.includes("VINNERLOVE")) return "VINNERLOVE";
  if (value.includes("HOMEKEEP")) return "HOMEKEEP";
  if (value.includes("VINNER")) return "Vinner";
  return "Vinner";
};

export const resourceDate = (date = "") => {
  const match = date.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
};

export const stripSchemaContext = (node: SchemaNode): SchemaNode => {
  const { "@context": _context, ...rest } = node;
  return rest;
};
