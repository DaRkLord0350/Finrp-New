import { Button } from "@/components/ui/Button";
import Link from "next/link";

export const metadata = {
  title: "Access Denied — FinRP",
  description: "You don't have permission to access this page.",
};

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="mb-6">
          <div className="text-6xl font-bold text-destructive mb-2">403</div>
          <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page. Please contact your
            administrator if you believe you should have access.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Link href="/dashboard">
            <Button className="w-full">Back to Dashboard</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="w-full">
              Go Home
            </Button>
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
          <p>
            If you believe this is an error, please{" "}
            <a href="mailto:support@finrp.com" className="underline">
              contact support
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
