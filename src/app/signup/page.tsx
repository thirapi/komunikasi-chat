import { redirect } from "next/navigation";
import { getUserSession } from "@/app/auth.action";
import { AuthShell } from "@/components/landingpage/auth-shell";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
  if (await getUserSession()) redirect("/channels/default");

  return (
    <AuthShell switchTo={{ href: "/", label: "Masuk", hint: "Sudah punya akun?" }}>
      <SignUpForm />
    </AuthShell>
  );
}
