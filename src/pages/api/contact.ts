import type { APIRoute } from "astro";

type ContactPayload = {
  name: string;
  email: string;
  company?: string;
  need?: string;
  message?: string;
};

const required = ["name", "email"] as const;

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

function hasConfiguredDestination() {
  return Boolean(
    (import.meta.env.RESEND_API_KEY && import.meta.env.CONTACT_TO) ||
      (import.meta.env.FEISHU_APP_ID &&
        import.meta.env.FEISHU_APP_SECRET &&
        import.meta.env.FEISHU_BITABLE_APP_TOKEN &&
        import.meta.env.FEISHU_BITABLE_TABLE_ID) ||
      import.meta.env.FEISHU_WEBHOOK_URL
  );
}

async function sendEmail(payload: ContactPayload) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const to = import.meta.env.CONTACT_TO;
  const from = import.meta.env.CONTACT_FROM || "KEEP Website <noreply@example.com>";

  if (!apiKey || !to) {
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: `KEEP website inquiry - ${payload.name}`,
      html: `
        <h2>New KEEP website inquiry</h2>
        <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
        <p><strong>Company:</strong> ${escapeHtml(payload.company || "-")}</p>
        <p><strong>Need:</strong> ${escapeHtml(payload.need || "-")}</p>
        <p><strong>Message:</strong><br />${escapeHtml(payload.message || "-").replace(/\n/g, "<br />")}</p>
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
          Need: payload.need || "",
          Message: payload.message || "",
          Source: "KEEP Website",
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
        text: `KEEP 官网新询盘\n姓名：${payload.name}\n邮箱：${payload.email}\n公司：${payload.company || "-"}\n需求：${payload.need || "-"}\n说明：${payload.message || "-"}`
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
