const parseResourceDate = (value) => {
  if (typeof value !== "string") return null;

  const match = value.match(/(\d{4})\.(\d{2})(?:\.(\d{2}))?/);
  if (!match) return null;

  const [, year, month, day = "01"] = match;
  return new Date(`${year}-${month}-${day}T00:00:00`).getTime();
};

export const sortResourcesByDate = (items) => items
  .map((item, index) => ({ item, index, timestamp: parseResourceDate(item.date) }))
  .sort((a, b) => {
    if (a.timestamp !== null && b.timestamp !== null) return b.timestamp - a.timestamp;
    if (a.timestamp !== null) return -1;
    if (b.timestamp !== null) return 1;
    return a.index - b.index;
  })
  .map(({ item }) => item);

export const isDirectDownloadResource = (item) =>
  Boolean(
    (item?.label === "Product Brochure" || item?.label === "Product Manual" || item?.type === "Brochure") &&
      typeof item?.href === "string" &&
      item.href.trim()
  );

const getResourceName = (item) => {
  if (typeof item?.title === "string") return item.title;
  return item?.title?.en || item?.title?.zh || item?.label || "";
};

export const sortResourcesByAccessAndName = (items) => [...items].sort((a, b) => {
  const accessOrder = Number(isDirectDownloadResource(b)) - Number(isDirectDownloadResource(a));
  if (accessOrder !== 0) return accessOrder;

  return getResourceName(a).localeCompare(getResourceName(b), "en", { sensitivity: "base" });
});
