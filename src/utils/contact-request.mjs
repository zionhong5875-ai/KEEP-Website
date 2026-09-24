import { Buffer } from "node:buffer";
import { contactFields, attachmentError, MAX_REQUEST_BYTES } from "./contact-fields.mjs";

export class ContactError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}

export async function readContactRequest(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ContactError("origin", 403);
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) throw new ContactError("file_size", 413);
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("multipart/form-data") && !type.startsWith("application/json")) throw new ContactError("content_type", 415);
  // Bound bytes before parsing, including chunked requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new ContactError("invalid_request");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new ContactError("file_size", 413); }
    chunks.push(value);
  }
  let entries;
  let files = [];
  try {
    const body = new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } });
    if (type.startsWith("multipart/form-data")) {
      const data = await body.formData();
      entries = Object.fromEntries(data.entries());
      files = data.getAll("attachments");
    } else {
      entries = await body.json();
    }
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error();
  } catch { throw new ContactError("invalid_request"); }
  if (typeof entries.website === "string" && entries.website.trim()) return { spam: true };

  const payload = {};
  for (const field of contactFields) {
    const value = typeof entries[field.name] === "string" ? entries[field.name].trim() : "";
    if ((!field.optional && !value) || value.length > (field.limit || 80) ||
      (field.options && !field.options.some(item => item.value === value))) throw new ContactError("invalid_fields");
    if (field.type !== "textarea" && /[\r\n\x00-\x1f]/.test(value)) throw new ContactError("invalid_fields");
    payload[field.name] = value;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new ContactError("invalid_email");
  if (payload.companyWebsite) {
    try {
      const url = new URL(payload.companyWebsite);
      if (!["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password) throw new Error();
    } catch { throw new ContactError("invalid_website"); }
  }
  if (files.some(file => typeof file === "string")) throw new ContactError("file_type");
  const error = attachmentError(files);
  if (error) throw new ContactError(error, error === "file_size" ? 413 : 400);
  const attachments = [];
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new ContactError("file_type");
    const filename = file.name.replace(/[\/\\\x00-\x1f\x7f]/g, "_").slice(0, 160).replace(/\.pdf$/i, "") + ".pdf";
    attachments.push({ filename, content: bytes.toString("base64"), content_type: "application/pdf" });
  }
  return { payload, attachments, spam: false };
}
