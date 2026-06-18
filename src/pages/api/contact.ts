import type { APIRoute } from "astro";

type ContactPayload = {
  name: string;
  email: string;
  company?: string;
  need?: string;
  message?: string;
};

const required = ["name", "email"] as const;
const defaultContactTo = "hongzihao@vinnercare.cn";
const needLabels: Record<string, string> = {
  medikeep: "MEDIKEEP",
  carekeep: "CAREKEEP",
  indukeep: "INDUKEEP",
  oem: "OEM / Custom"
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getContactTo() {
  return import.meta.env.CONTACT_TO || defaultContactTo;
}

function getNeedLabel(value = "") {
  return needLabels[value] || value || "-";
}

function hasConfiguredDestination() {
  return Boolean(
    (import.meta.env.RESEND_API_KEY && getContactTo()) ||
      (import.meta.env.FEISHU_APP_ID &&
        import.meta.env.FEISHU_APP_SECRET &&
        import.meta.env.FEISHU_BITABLE_APP_TOKEN &&
        import.meta.env.FEISHU_BITABLE_TABLE_ID) ||
      import.meta.env.FEISHU_WEBHOOK_URL
  );
}

async function sendEmail(payload: ContactPayload) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const to = getContactTo();
  const from = import.meta.env.CONTACT_FROM || "VINNER Website <noreply@vinnercare.cn>";

  if (!apiKey || !to) {
    return { skipped: true };
  }

  const fields = [
    ["Name", payload.name],
    ["Email", payload.email],
    ["Company", payload.company || "-"],
    ["Request type", getNeedLabel(payload.need)],
    ["Project brief", payload.message || "-"]
  ];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: payload.email,
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
    throw new Error(`Email delivery failed: ${response.status}`);
  }

  return response.json();
}

async function getFeishuTenantToken() {
  const appId = import.meta.env.FEISHU_APP_ID;
  const appSecret = import.meta.env.FEISHU_APP_SECRET;

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
  const appToken = import.meta.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = import.meta.env.FEISHU_BITABLE_TABLE_ID;

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
          Message: payload.message || "",
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
  const webhook = import.meta.env.FEISHU_WEBHOOK_URL;
  if (!webhook) {
    return { skipped: true };
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msg_type: "text",
      content: {
        text: `VINNER 官网新询盘\n姓名：${payload.name}\n邮箱：${payload.email}\n公司：${payload.company || "-"}\n需求：${getNeedLabel(payload.need)}\n说明：${payload.message || "-"}`
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
    const raw = await request.json();
    const payload: ContactPayload = {
      name: asString(raw.name),
      email: asString(raw.email),
      company: asString(raw.company),
      need: asString(raw.need),
      message: asString(raw.message)
    };

    const missing = required.filter((key) => !payload[key]);
    if (missing.length) {
      return Response.json({ ok: false, error: `Missing ${missing.join(", ")}` }, { status: 400 });
    }

    if (!isEmail(payload.email)) {
      return Response.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    if (!hasConfiguredDestination() && !import.meta.env.DEV) {
      return Response.json({ ok: false, error: "Contact backend is not configured" }, { status: 503 });
    }

    await Promise.all([sendEmail(payload), saveToFeishuBitable(payload), notifyFeishu(payload)]);

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "Contact form submission failed" }, { status: 500 });
  }
};
