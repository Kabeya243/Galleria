import { redirect } from "next/navigation";
import ForgotPasswordForm from "@/components/forgot-password-form";
import { getCurrentUser } from "@/lib/auth";

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/");
  return <ForgotPasswordForm />;
}
