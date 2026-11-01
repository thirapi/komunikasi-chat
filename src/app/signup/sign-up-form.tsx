"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { signUpUser } from "@/app/auth.action";
import { useSearchParams } from "next/navigation";
import { Eye, EyeSlash, CircleNotch } from "@phosphor-icons/react/dist/ssr";

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

function PasswordInput({
  autoComplete,
  ...props
}: React.ComponentProps<typeof Input> & { autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      {/* FormControl on the <input>, so the <label> is associated with it. */}
      <FormControl>
        <Input type={visible ? "text" : "password"} autoComplete={autoComplete} className="pr-10" {...props} />
      </FormControl>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {visible ? <EyeSlash aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

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

  return (
    <div className={cn("flex flex-col gap-8", className)} {...props}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Daftar</h1>
        <p className="text-sm text-muted-foreground">
          Buat akun, lalu kamu langsung masuk ke Komunikasi.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input autoComplete="username" autoCapitalize="none" spellCheck={false} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <PasswordInput autoComplete="new-password" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirm_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ulangi password</FormLabel>
                <PasswordInput autoComplete="new-password" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />

          <p role="alert" aria-live="polite" className={cn("text-sm text-destructive", !error && "sr-only")}>
            {error}
          </p>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <CircleNotch aria-hidden className="size-4 animate-spin" />}
            {pending ? "Membuat akun…" : "Daftar"}
          </Button>
        </form>
      </Form>

      <p className="text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <a href={signInHref} className="text-foreground underline underline-offset-4 hover:text-primary">
          Masuk
        </a>
      </p>
    </div>
  );
}
