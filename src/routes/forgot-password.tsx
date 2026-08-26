import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/forgot-password")({ component: Forgot });

function Forgot() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDone(true);
  }

  return (
    <AuthFrame
      title="Reset password"
      subtitle="Password reset email is prepared. On this environment we log the request and you can sign in again after creating a new account if needed."
    >
      {done ? (
        <p className="text-sm text-muted">
          If an account exists for {email}, a reset will be issued when mail is configured.{" "}
          <Link to="/login" className="font-medium text-ink underline">
            Back to sign in
          </Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Request reset
          </Button>
          <p className="text-center text-sm text-muted">
            <Link to="/login" className="underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthFrame>
  );
}
