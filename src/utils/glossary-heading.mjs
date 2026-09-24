export function glossaryHeading(language, categoryName, letter = "all") {
  if (language === "en") {
    const label = categoryName ? `${categoryName} terms` : "All terms";
    return letter === "all" ? `${label} A–Z` : `${label} starting with ${letter}`;
  }
  const label = categoryName ? `${categoryName}术语` : "全部术语";
  return letter === "all" ? `${label} A–Z` : `以 ${letter} 开头的${categoryName ? label : "术语"}`;
}
