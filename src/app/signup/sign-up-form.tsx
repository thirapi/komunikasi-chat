"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { useMemo, useState, Suspense } from "react";
import { signInUser, signUpUser } from "@/app/auth.action";
import { useSearchParams } from "next/navigation";
import { ServerResponse } from "@/lib/entities/models/response.model";
import { XCircle, Eye, EyeSlash, Key, CircleNotch, User } from "@phosphor-icons/react/dist/ssr";

const formSchema = z.object({
  username: z.string().min(3).regex(/^[a-z0-9_]+$/, "Username hanya boleh huruf kecil, angka, dan underscore"),
  password: z.string().min(4),
  confirm_password: z.string().min(4),
});

interface SignUpFormProps extends React.ComponentPropsWithoutRef<"div"> {
  onToggleMode?: () => void;
  isEmbedded?: boolean;
}

export function SignUpForm({
  className,
  onToggleMode,
  isEmbedded,
  ...props
}: SignUpFormProps) {
  const [formStatus, setFormStatus] = useState<"idle" | "pending" | "error">(
    "idle"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      confirm_password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (values.password !== values.confirm_password) {
      form.setError("confirm_password", {
        type: "manual",
        message: "Password tidak sama",
      });
      return;
    }

    setFormStatus("pending");

    const response = await signUpUser(
      values.username,
      values.password,
      values.confirm_password,
      callbackUrl ?? undefined
    );

    if (response?.status === "error") {
      if (response.error) {
        toast.error(response.error.message, {
          description:
            response.error.type === "InputParsedError"
              ? JSON.stringify(response.error.meta)
              : undefined,
        });
      }
      setFormStatus("error");
    } else {
      toast.success("Sign up berhasil");
      if (onToggleMode) {
        onToggleMode();
      }
      form.reset();
      setFormStatus("idle");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {/* No shadow override: Card already carries shadow-sm, and layering a
          larger one on top only muddied the edge on the landing page where the
          form sits flat against the background. */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Register</CardTitle>
          <CardDescription>
            Register your username and password below to make your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input
                              placeholder="Choose a username"
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-2">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Key className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Create a password"
                              className="pl-10 pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowPassword(!showPassword)}
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeSlash weight="duotone" className="h-5 w-5" />
                              ) : (
                                <Eye weight="duotone" className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-2">
                  <FormField
                    control={form.control}
                    name="confirm_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Key className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              className="pl-10 pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              tabIndex={-1}
                            >
                              {showConfirmPassword ? (
                                <EyeSlash weight="duotone" className="h-5 w-5" />
                              ) : (
                                <Eye weight="duotone" className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={formStatus === "pending"}
                >
                  {formStatus === "pending" ? (
                    <>
                      <span>Sign Up</span>
                      <CircleNotch weight="duotone" className="h-4 w-4 animate-spin" />
                    </>
                  ) : (
                    "Sign Up"
                  )}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                {onToggleMode ? (
                  <button
                    type="button"
                    onClick={onToggleMode}
                    className="underline underline-offset-4 hover:text-primary"
                  >
                    Sign in
                  </button>
                ) : (
                  <a 
                    href={callbackUrl ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signin"} 
                    className="underline underline-offset-4"
                  >
                    Sign in
                  </a>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
