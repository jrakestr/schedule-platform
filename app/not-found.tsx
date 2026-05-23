import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-2">
        <h2 className="text-lg font-semibold">Page not found</h2>
        <p className="text-sm text-muted-foreground">
          This page does not exist.
        </p>
        <Link href="/" className="text-primary text-sm underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
