"use server";

import { redirect } from "next/navigation";

import { createAdminSession, deleteAdminSession } from "@/lib/auth/session";

export type LoginState = {
  error?: string;
};

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");

  if (typeof password !== "string" || password.length === 0) {
    return { error: "Password is required." };
  }

  if (!process.env.ADMIN_PASSWORD) {
    return { error: "Admin password is not configured on the server." };
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return { error: "Incorrect password." };
  }

  await createAdminSession();
  redirect("/admin");
}

export async function logout() {
  await deleteAdminSession();
  redirect("/admin/login");
}
