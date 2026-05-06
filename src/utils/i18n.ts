export type Localized = string | { zh: string; en: string };

export function text(value: Localized): string {
  return typeof value === "string" ? value : value.zh;
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
