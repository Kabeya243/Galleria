import { redirect } from "next/navigation";
import ResetPasswordForm from "@/components/reset-password-form";
import { getCurrentUser } from "@/lib/auth";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ""} />;
}
