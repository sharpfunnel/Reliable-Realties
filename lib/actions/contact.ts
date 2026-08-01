"use server";

import { prisma } from "@/lib/db";

export type ContactFormResult = { ok: true } | { ok: false; error: string };

export async function submitContactForm(
  formData: FormData,
): Promise<ContactFormResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const budget = String(formData.get("budget") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const consent = formData.get("consent");

  if (!name || !phone || !email || !consent) {
    return { ok: false, error: "Please fill in all required fields." };
  }

  try {
    await prisma.lead.create({
      data: {
        formId: "contact",
        source: "website",
        name,
        phone,
        email,
        budget: budget || null,
        message: message || null,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error("Failed to save contact form lead:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
