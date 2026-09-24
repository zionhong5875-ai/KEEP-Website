import type { APIRoute } from "astro";
import { contactRows } from "../../utils/contact-fields.mjs";
import { ContactError, readContactRequest } from "../../utils/contact-request.mjs";
type ContactPayload = Record<string, string>;
type Attachment = { filename: string; content: string; content_type: string };
const defaultContactTo = "hongzihao@vinnercare.cn";
const defaultContactFrom = "VINNER Website <onboarding@resend.dev>";
const serverEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY || import.meta.env.RESEND_API_KEY,
  CONTACT_TO: process.env.CONTACT_TO || import.meta.env.CONTACT_TO,
  CONTACT_FROM: process.env.CONTACT_FROM || import.meta.env.CONTACT_FROM,
  FEISHU_APP_ID: process.env.FEISHU_APP_ID || import.meta.env.FEISHU_APP_ID,
  FEISHU_APP_SECRET: process.env.FEISHU_APP_SECRET || import.meta.env.FEISHU_APP_SECRET,
  FEISHU_BITABLE_APP_TOKEN: process.env.FEISHU_BITABLE_APP_TOKEN || import.meta.env.FEISHU_BITABLE_APP_TOKEN,
  FEISHU_BITABLE_TABLE_ID: process.env.FEISHU_BITABLE_TABLE_ID || import.meta.env.FEISHU_BITABLE_TABLE_ID,
  FEISHU_WEBHOOK_URL: process.env.FEISHU_WEBHOOK_URL || import.meta.env.FEISHU_WEBHOOK_URL
};
const needLabels: Record<string, string> = {
  medikeep: "INFECTION CONTROL / 感染控制",
  carekeep: "CLEANSING & CARE / 清洁护理",
  indukeep: "INDUSTRIAL WIPING / 工业擦拭",
  oem: "OEM/ODM / 定制开发"
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getContactTo() {
  return serverEnv.CONTACT_TO || defaultContactTo;
}

function getContactFrom() {
  return serverEnv.CONTACT_FROM || defaultContactFrom;
}

function getNeedLabel(value = "") {
  return needLabels[value] || value || "-";
}

function hasResendConfig() {
  return Boolean(serverEnv.RESEND_API_KEY && getContactFrom() && getContactTo());
}

async function sendEmail(payload: ContactPayload, attachments: Attachment[], submissionId: string) {
  const apiKey = serverEnv.RESEND_API_KEY;
  const to = getContactTo();
  const from = getContactFrom();

  if (!apiKey || !to) {
    throw new Error("Resend is not configured");
  }

  const fields = contactRows(payload);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(submissionId ? { "Idempotency-Key": `contact-${submissionId}` } : {})
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: payload.email,
      attachments,
      subject: `VINNER website inquiry - ${payload.name}`,
      text: fields.map(([label, value]) => `${label}: ${value}`).join("\n\n"),
      html: `
        <h2>New VINNER website inquiry</h2>
        <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:720px;">
          ${fields
            .map(
              ([label, value]) => `
                <tr>
                  <th align="left" style="border:1px solid #d9dde3;background:#f5f7f8;width:180px;">${escapeHtml(label)}</th>
                  <td style="border:1px solid #d9dde3;">${escapeHtml(value).replace(/\n/g, "<br />")}</td>
                </tr>
              `
            )
            .join("")}
        </table>
      `
    })
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`Email delivery failed: ${response.status} ${detail}`);
  }

  return response.json();
}

async function getFeishuTenantToken() {
  const appId = serverEnv.FEISHU_APP_ID;
  const appSecret = serverEnv.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    return "";
  }

  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`Feishu token failed: ${data.msg || response.status}`);
  }

  return data.tenant_access_token as string;
}

async function saveToFeishuBitable(payload: ContactPayload) {
  const appToken = serverEnv.FEISHU_BITABLE_APP_TOKEN;
  const tableId = serverEnv.FEISHU_BITABLE_TABLE_ID;

  if (!appToken || !tableId) {
    return { skipped: true };
  }

  const token = await getFeishuTenantToken();
  if (!token) {
    return { skipped: true };
  }

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          Name: payload.name,
          Email: payload.email,
          Company: payload.company || "",
          Need: getNeedLabel(payload.need),
          Message: contactRows(payload).map(([label, value]) => `${label}: ${value}`).join("\n"),
          Source: "VINNER Website",
          CreatedAt: new Date().toISOString()
        }
      })
    }
  );

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`Feishu Bitable save failed: ${data.msg || response.status}`);
  }

  return data;
}

async function notifyFeishu(payload: ContactPayload) {
  const webhook = serverEnv.FEISHU_WEBHOOK_URL;
  if (!webhook) {
    return { skipped: true };
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msg_type: "text",
      content: {
        text: `VINNER 官网新询盘\n${contactRows(payload).map(([label, value]) => `${label}: ${value}`).join("\n")}`
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Feishu webhook failed: ${response.status}`);
  }

  return response.json();
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { payload, attachments, spam } = await readContactRequest(request);
    if (spam) {
      return Response.json({ ok: true });
    }

    if (!hasResendConfig()) {
      return Response.json({ ok: false, code: "unavailable" }, { status: 503 });
    }

    const id = request.headers.get("x-submission-id") || "";
    const submissionId = /^[a-f0-9-]{36}$/i.test(id) ? id : "";
    await sendEmail(payload, attachments, submissionId);
    // A secondary CRM failure must not tell customers to resend an accepted email.
    const secondary = await Promise.allSettled([saveToFeishuBitable(payload), notifyFeishu(payload)]);
    secondary.forEach(result => { if (result.status === "rejected") console.error("Contact CRM delivery failed"); });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ContactError) return Response.json({ ok: false, code: error.code }, { status: error.status });
    console.error(
      "Contact email submission failed",
      error instanceof Error ? error.message : String(error)
    );
    return Response.json({ ok: false, code: "failed" }, { status: 500 });
  }
};
