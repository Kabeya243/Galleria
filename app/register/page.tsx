import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  // Referral link (?ref=CODE): prefill the referral code field in the
  // signup form (Nov 2026).
  const { ref } = await searchParams;
  const initialReferralCode =
    typeof ref === "string" && ref.trim() ? ref.trim().toUpperCase().slice(0, 20) : undefined;
  return <AuthForm mode="register" initialReferralCode={initialReferralCode} />;
}
