import { LoginPage } from "@/components/login-form";

export default async function LoginRoute({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return <LoginPage error={Array.isArray(error) ? error[0] : error} />;
}
