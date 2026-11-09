import { redirect } from "next/navigation";
import VerifyEmailForm from "@/components/verify-email-form";
import { getCurrentUser } from "@/lib/auth";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { token } = await searchParams;
  return <VerifyEmailForm token={token ?? ""} />;
}
