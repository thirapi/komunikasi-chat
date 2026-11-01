"use client";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { signInUser } from "@/app/auth.action";
import { useSearchParams } from "next/navigation";
import { AuthError, AuthHeading, AuthSubmit, PasswordField, authInputClass } from "@/components/landingpage/auth-form-parts";

const formSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  password: z.string().min(4, "Password minimal 4 karakter"),
});

export function SignInForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", password: "" },
  });

  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const signUpHref = callbackUrl
    ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/signup";

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setPending(true);
    setError(null);
    const response = await signInUser(values.username, values.password, callbackUrl ?? undefined);
    // On success the action redirects and the router swaps the page, so the
    // button stays in its pending state until then instead of flashing back
    // to "Masuk" while the app loads.
    if (response?.status === "error") {
      setError(response.error?.message ?? "Gagal masuk. Coba lagi.");
      setPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-8", className)} {...props}>
      <AuthHeading
        eyebrow="Masuk"
        title="Selamat datang kembali"
        description="Masuk dengan username dan password akunmu."
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem className="auth-rise" style={{ ["--i" as string]: 3 }}>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="namakamu"
                    className={authInputClass}
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="auth-rise" style={{ ["--i" as string]: 4 }}>
                <FormLabel>Password</FormLabel>
                <PasswordField autoComplete="current-password" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />

          <AuthError message={error} />

          <div className="auth-rise pt-1" style={{ ["--i" as string]: 5 }}>
            <AuthSubmit pending={pending} label="Masuk" pendingLabel="Memproses…" />
          </div>
        </form>
      </Form>

      <p className="auth-rise text-sm text-muted-foreground lg:hidden" style={{ ["--i" as string]: 6 }}>
        Belum punya akun?{" "}
        <a href={signUpHref} className="font-medium text-foreground underline-offset-4 hover:underline">
          Daftar sekarang
        </a>
      </p>
    </div>
  );
}
