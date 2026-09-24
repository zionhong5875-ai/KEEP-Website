import { attachmentError } from "../utils/contact-fields.mjs";

document.querySelectorAll("[data-contact-form]").forEach(form => {
  const status = form.querySelector("[data-contact-status]");
  const submit = form.querySelector("button[type=submit]");
  const upload = form.querySelector("[data-contact-upload]");
  const input = form.querySelector("[data-contact-file-input]");
  const list = form.querySelector("[data-contact-files]");
  const zone = form.querySelector("[data-contact-dropzone]");
  const english = () => document.documentElement.lang === "en";
  let files = [];
  let pending = false;
  let dragDepth = 0;
  let submissionId = crypto.randomUUID();
  const errors = {
    file_count: ["最多上传 3 个 PDF 文件。", "Attach up to 3 PDF files."],
    file_type: ["仅支持非空 PDF 文件。", "Only non-empty PDF files are accepted."],
    file_size: ["附件合计不可超过 4 MB；大文件请发至 hongzihao@vinnercare.cn。", "Attachments must total 4 MB or less. Email larger files to hongzihao@vinnercare.cn."],
    invalid_email: ["请填写有效的公司邮箱。", "Enter a valid company email."],
    invalid_website: ["请填写完整的 http:// 或 https:// 官网地址。", "Enter a complete http:// or https:// website URL."],
    invalid_fields: ["请填写所有必填项并检查选项。", "Complete all required fields and check your selections."],
    unavailable: ["邮件服务暂不可用，请直接发邮件联系我们。", "Email service is unavailable. Please email us directly."]
  };
  const show = (message, state = "error") => { status.textContent = message; status.dataset.state = state; };
  const showError = code => show((errors[code] || ["发送失败，内容已保留，请稍后重试或直接发邮件。", "Could not send. Your details are preserved; retry or email us directly."])[english() ? 1 : 0]);
  const renderFiles = () => {
    list.replaceChildren();
    files.forEach((file, index) => {
      const item = document.createElement("span");
      item.className = "contact-file-item";
      const label = document.createElement("span");
      label.textContent = file.name;
      label.title = `${file.name} (${Math.ceil(file.size / 1000)} KB)`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.disabled = pending;
      remove.title = remove.ariaLabel = `${english() ? "Remove" : "移除"} ${file.name}`;
      remove.addEventListener("click", () => { files.splice(index, 1); submissionId = crypto.randomUUID(); renderFiles(); });
      item.append(label, remove);
      list.append(item);
    });
  };
  const addFiles = incoming => {
    if (pending) return;
    const merged = [...files];
    for (const file of incoming) if (!merged.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) merged.push(file);
    const error = attachmentError(merged);
    if (error) { showError(error); return; }
    files = merged;
    submissionId = crypto.randomUUID();
    show("", "");
    renderFiles();
  };
  upload.addEventListener("click", () => input.click());
  input.addEventListener("change", () => { addFiles(Array.from(input.files || [])); input.value = ""; });
  zone.addEventListener("dragenter", event => { event.preventDefault(); dragDepth++; if (!pending) zone.classList.add("is-dragging"); });
  zone.addEventListener("dragover", event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = pending ? "none" : "copy"; });
  zone.addEventListener("dragleave", event => { event.preventDefault(); if (--dragDepth <= 0) zone.classList.remove("is-dragging"); });
  zone.addEventListener("drop", event => {
    event.preventDefault(); dragDepth = 0; zone.classList.remove("is-dragging");
    addFiles(Array.from(event.dataTransfer?.files || []));
  });
  form.addEventListener("input", () => { submissionId = crypto.randomUUID(); });
  form.querySelectorAll("select").forEach(select => select.addEventListener("change", () => { select.title = select.selectedOptions[0]?.textContent || ""; }));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    const error = attachmentError(files);
    if (error) { showError(error); return; }
    const body = new FormData(form);
    files.forEach(file => body.append("attachments", file));
    pending = true;
    const controls = Array.from(form.querySelectorAll("input,select,textarea,button"));
    controls.forEach(control => { control.disabled = true; });
    show(english() ? "Sending..." : "正在发送...", "pending");
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "X-Submission-Id": submissionId }, body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) { showError(result.code || (response.status === 413 ? "file_size" : "failed")); return; }
      form.reset(); files = []; submissionId = crypto.randomUUID();
      form.querySelectorAll("select").forEach(select => select.removeAttribute("title"));
      renderFiles();
      show(english() ? "Sent. We will contact you soon." : "已发送，我们会尽快联系您。", "success");
    } catch { showError("failed"); }
    finally { pending = false; controls.forEach(control => { control.disabled = false; }); renderFiles(); }
  });
});
