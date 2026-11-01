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
import { signInUser } from "@/app/auth.action";
import { useSearchParams } from "next/navigation";
import { ServerResponse } from "@/lib/entities/models/response.model";
import { XCircle, Eye, EyeSlash, Key, Link, CircleNotch, User } from "@phosphor-icons/react/dist/ssr";

const formSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(4),
});

interface SignInFormProps extends React.ComponentPropsWithoutRef<"div"> {
  onToggleMode?: () => void;
  isEmbedded?: boolean;
}

export function SignInForm({
  className,
  onToggleMode,
  isEmbedded,
  ...props
}: SignInFormProps) {
  const [formStatus, setFormStatus] = useState<"idle" | "pending" | "error">(
    "idle"
  );
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setFormStatus("pending");
    const response = await signInUser(values.username, values.password, callbackUrl ?? undefined);

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
          <CardTitle className="text-2xl font-bold">Login</CardTitle>
          <CardDescription>
            Enter your username below to login to your account
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
                              placeholder="Enter your username"
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
                              placeholder="••••••••"
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

                <Button
                  type="submit"
                  className="w-full"
                  disabled={formStatus === "pending"}
                >
                  {formStatus === "pending" ? (
                    <>
                      <span>Sign In</span>
                      <CircleNotch weight="duotone" className="h-4 w-4 animate-spin" />
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Don&apos;t have an account?{" "}
                {onToggleMode ? (
                  <button
                    type="button"
                    onClick={onToggleMode}
                    className="underline underline-offset-4 hover:text-primary"
                  >
                    Sign up
                  </button>
                ) : (
                  <a 
                    href={callbackUrl ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signup"} 
                    className="underline underline-offset-4"
                  >
                    Sign up
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
