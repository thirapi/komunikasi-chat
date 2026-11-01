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
import { signInUser } from "@/app/auth.action";
import { useSearchParams } from "next/navigation";
import { Eye, EyeSlash, CircleNotch } from "@phosphor-icons/react/dist/ssr";

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
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Masuk</h1>
        <p className="text-sm text-muted-foreground">
          Gunakan username dan password akunmu untuk melanjutkan.
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
                {/* FormControl wraps the <input> itself, not the wrapper div:
                    it forwards the id the <label> points at, and on a div the
                    label was not associated with the field at all. */}
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="pr-10"
                      {...field}
                    />
                  </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {showPassword ? (
                        <EyeSlash aria-hidden className="size-4" />
                      ) : (
                        <Eye aria-hidden className="size-4" />
                      )}
                    </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <p role="alert" aria-live="polite" className={cn("text-sm text-destructive", !error && "sr-only")}>
            {error}
          </p>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <CircleNotch aria-hidden className="size-4 animate-spin" />}
            {pending ? "Memproses…" : "Masuk"}
          </Button>
        </form>
      </Form>

      <p className="text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <a href={signUpHref} className="text-foreground underline underline-offset-4 hover:text-primary">
          Daftar
        </a>
      </p>
    </div>
  );
}
