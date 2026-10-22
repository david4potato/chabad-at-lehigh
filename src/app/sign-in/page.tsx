import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That link expired or was already used. Enter your email for a new link, or use the code from the email.",
  device: "That link was opened on a different device or browser. Use the 6-digit code from the email, or get a new link here.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, "/");
  const error =
    typeof params.error === "string" && Object.hasOwn(ERRORS, params.error) ? ERRORS[params.error] : undefined;

  if (await getViewer()) redirect(next);

  return (
    <div className="mx-auto max-w-md py-4 sm:py-12">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-[2.5rem] lg:leading-tight">Welcome</h1>
        <p className="mt-2 text-muted">Sign in to RSVP, save your dietary needs and see your events.</p>
      </div>
      {error ? (
        <Alert tone="warning" className="mb-4">
          {error}
        </Alert>
      ) : null}
      <Card>
        <SignInForm next={next} />
      </Card>
    </div>
  );
}
