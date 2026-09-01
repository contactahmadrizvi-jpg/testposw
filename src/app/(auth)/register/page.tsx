"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { registerUser } from "@/services/auth.service";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await registerUser(form.email, form.password, form.name, form.phone, "customer");
      toast.success("Account created!");
      router.push("/login");
    } catch {
      toast.error("Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <Card className="w-full max-w-md border-2 border-primary/10 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-black bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Create Account
          </CardTitle>
          <p className="text-sm text-muted-foreground">Join SOMO today</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="font-semibold">Full Name</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                required 
                className="rounded-xl border-2"
              />
            </div>
            <div>
              <Label className="font-semibold">Email Address</Label>
              <Input 
                type="email" 
                value={form.email} 
                onChange={(e) => setForm({ ...form, email: e.target.value })} 
                required 
                className="rounded-xl border-2"
              />
            </div>
            <div>
              <Label className="font-semibold">Phone Number</Label>
              <Input 
                value={form.phone} 
                onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                required 
                className="rounded-xl border-2"
              />
            </div>
            <div>
              <Label className="font-semibold">Password</Label>
              <Input 
                type="password" 
                value={form.password} 
                onChange={(e) => setForm({ ...form, password: e.target.value })} 
                required 
                className="rounded-xl border-2"
                minLength={6}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-primary to-blue-600 hover:shadow-lg hover:scale-105 transition-all rounded-xl py-6 h-auto font-bold" 
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
