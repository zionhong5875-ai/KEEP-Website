export type Localized = string | { zh: string; en: string };
export type Language = "zh" | "en";

export function text(value: Localized, language: Language = "zh"): string {
  return typeof value === "string" ? value : value[language];
}

export function attrs(value: Localized) {
  if (typeof value === "string") {
    return {};
  }

  return {
    "data-zh": value.zh,
    "data-en": value.en
  };
}

export function htmlAttrs(value: Localized) {
  return {
    ...attrs(value),
    "data-i18n-html": typeof value === "string" ? undefined : "true"
  };
}

export function imageAttrs(value: Localized) {
  if (typeof value === "string") {
    return { alt: value };
  }

  return {
    alt: value.zh,
    "data-alt-zh": value.zh,
    "data-alt-en": value.en
  };
}

export function stripLanguagePrefix(pathname: string): string {
  if (pathname === "/en" || pathname === "/en/") {
    return "/";
  }

  return pathname.startsWith("/en/") ? pathname.slice(3) : pathname;
}

export function localizedPath(pathname: string, language: Language): string {
  const basePath = stripLanguagePrefix(pathname);
  return language === "en" ? `/en${basePath}` : basePath;
}
