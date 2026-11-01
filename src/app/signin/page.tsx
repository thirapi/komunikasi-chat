import { redirect } from "next/navigation";
import { getUserSession } from "@/app/auth.action";
import { AuthShell } from "@/components/landingpage/auth-shell";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  // Already signed in: skip the form. Cheap when there is no cookie, since
  // getUserSession returns before touching the database.
  if (await getUserSession()) redirect("/channels/default");

  return (
    <AuthShell switchTo={{ href: "/signup", label: "Daftar" }}>
      <SignInForm />
    </AuthShell>
  );
}
