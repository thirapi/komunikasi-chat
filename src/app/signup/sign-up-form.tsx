"use client";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormDescription,
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
import { signUpUser } from "@/app/auth.action";
import { useSearchParams } from "next/navigation";
import { AuthError, AuthHeading, AuthSubmit, PasswordField, PasswordStrength, authInputClass } from "@/components/landingpage/auth-form-parts";

const formSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username minimal 3 karakter")
      .regex(/^[a-z0-9_]+$/, "Hanya huruf kecil, angka, dan underscore"),
    password: z.string().min(4, "Password minimal 4 karakter"),
    confirm_password: z.string().min(1, "Ulangi password"),
  })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Password tidak sama",
  });

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const signInHref = callbackUrl ? `/?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", password: "", confirm_password: "" },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setPending(true);
    setError(null);
    const response = await signUpUser(
      values.username,
      values.password,
      values.confirm_password,
      callbackUrl ?? undefined
    );
    // On success the new account is signed in and the action redirects into
    // the app, so only the error path returns here.
    if (response?.status === "error") {
      setError(response.error?.message ?? "Gagal mendaftar. Coba lagi.");
      setPending(false);
    }
  };

  const password = form.watch("password");

  return (
    <div className={cn("flex flex-col gap-6 sm:gap-8", className)} {...props}>
      <AuthHeading
        eyebrow="Daftar"
        title="Buat akun baru"
        description="Cuma perlu username dan password. Setelah itu kamu langsung masuk."
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
                    placeholder="budi_santoso"
                    className={authInputClass}
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-xs">Huruf kecil, angka, dan garis bawah.</FormDescription>
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
                <PasswordField autoComplete="new-password" placeholder="Minimal 4 karakter" {...field} />
                <PasswordStrength value={password} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirm_password"
            render={({ field }) => (
              <FormItem className="auth-rise" style={{ ["--i" as string]: 5 }}>
                <FormLabel>Ulangi password</FormLabel>
                <PasswordField autoComplete="new-password" placeholder="Ketik password yang sama" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />

          <AuthError message={error} />

          <div className="auth-rise pt-1" style={{ ["--i" as string]: 6 }}>
            <AuthSubmit pending={pending} label="Buat akun" pendingLabel="Membuat akun…" />
          </div>
        </form>
      </Form>

      <p className="auth-rise text-sm text-muted-foreground lg:hidden" style={{ ["--i" as string]: 7 }}>
        Sudah punya akun?{" "}
        <a href={signInHref} className="font-medium text-foreground underline-offset-4 hover:underline">
          Masuk
        </a>
      </p>
    </div>
  );
}
