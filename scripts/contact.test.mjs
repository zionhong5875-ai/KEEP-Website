import test from "node:test";
import assert from "node:assert/strict";
import { contactFields, contactRows, attachmentError, MAX_REQUEST_BYTES } from "../src/utils/contact-fields.mjs";
import { readContactRequest } from "../src/utils/contact-request.mjs";

const values = { name: "Test Buyer", country: "China", marketCountry: "UK", company: "Test Company", email: "test@example.com", companyWebsite: "https://example.com", cooperation: "oem", regulation: "cosmetics", need: "carekeep", formula: "no", quantity: "30000-100000", message: "Tender sample, 20 x 30 cm, 8 wipes per pack." };
const pdf = new File(["%PDF-1.4\nTest fixture\n%%EOF"], "tender.pdf", { type: "application/pdf" });
const request = (data = values, files = []) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(data)) body.set(key, value);
  files.forEach(file => body.append("attachments", file));
  return new Request("https://example.com/api/contact", { method: "POST", body });
};

test("all 12 fields are shared; only website is optional", () => {
  assert.equal(contactFields.length, 12);
  assert.deepEqual(contactFields.filter(field => field.optional).map(field => field.name), ["companyWebsite"]);
  assert.equal(contactRows(values).length, 12);
  assert.match(contactRows(values).find(([label]) => label.startsWith("Cooperation"))[1], /OEM/);
});
test("multipart PDF becomes a byte-identical Resend attachment", async () => {
  const result = await readContactRequest(request(values, [pdf]));
  assert.deepEqual(result.payload, values);
  assert.equal(result.attachments[0].filename, "tender.pdf");
  assert.equal(Buffer.from(result.attachments[0].content, "base64").toString(), await pdf.text());
  assert.equal(result.attachments[0].content_type, "application/pdf");
});
test("optional website and attachments can be omitted", async () => {
  const result = await readContactRequest(request({ ...values, companyWebsite: "" }));
  assert.equal(result.attachments.length, 0);
});
test("every required field and enum is checked on the server", async () => {
  for (const field of contactFields.filter(field => !field.optional)) {
    await assert.rejects(readContactRequest(request({ ...values, [field.name]: "" })), /invalid_fields/);
    if (field.options) await assert.rejects(readContactRequest(request({ ...values, [field.name]: "invented" })), /invalid_fields/);
  }
  await assert.rejects(readContactRequest(request({ ...values, email: "bad-email" })), /invalid_email/);
  await assert.rejects(readContactRequest(request({ ...values, companyWebsite: "javascript:alert(1)" })), /invalid_website/);
  await assert.rejects(readContactRequest(request({ ...values, message: "a".repeat(5001) })), /invalid_fields/);
});
test("PDF type, signature, count and total byte limits are enforced", async () => {
  for (const file of [new File(["not PDF"], "fake.pdf", { type: "application/pdf" }), new File(["%PDF-1.4"], "bad.exe"), new File([], "empty.pdf")]) {
    await assert.rejects(readContactRequest(request(values, [file])), /file_type/);
  }
  await assert.rejects(readContactRequest(request(values, [pdf, pdf, pdf, pdf])), /file_count/);
  const large = new File(["%PDF-", new Uint8Array(4_000_000)], "large.pdf", { type: "application/pdf" });
  assert.equal(attachmentError([large]), "file_size");
  await assert.rejects(readContactRequest(request(values, [large])), /file_size/);
});
test("malformed and oversized requests fail before sending; honeypot remains separate", async () => {
  assert.equal((await readContactRequest(request({ ...values, website: "spam" }))).spam, true);
  await assert.rejects(readContactRequest(new Request("https://example.com/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })), /invalid_request/);
  await assert.rejects(readContactRequest(new Request("https://example.com/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(MAX_REQUEST_BYTES + 1) })), /file_size/);
  await assert.rejects(readContactRequest(new Request("https://example.com/api/contact", { method: "POST", headers: { Origin: "https://other.example" }, body: "x" })), /origin/);
});
