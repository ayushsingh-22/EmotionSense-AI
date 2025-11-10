"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Activity, Heart, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { EmergencyContactForm } from "@/components/EmergencyContactForm";
import { useEmergencyContact } from "@/hooks/useEmergencyContact";

type SignupStep = "account" | "emergency-contact" | "complete";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [step, setStep] = useState<SignupStep>("account");
  const [skipEmergencyContact, setSkipEmergencyContact] = useState(false);

  const { signUp, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { contact } = useEmergencyContact();

  // Redirect if already authenticated
  useEffect(() => {
    if (user && step === "account") {
      setStep("emergency-contact");
    }
  }, [user, step]);

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      setIsLoading(true);
      console.log("Starting signup process...", { email, fullName });

      const result = await signUp(email, password, fullName);

      console.log("Signup result:", result);

      if (!result.error) {
        console.log("Signup successful, moving to emergency contact step...");
        toast({
          title: "Account created successfully!",
          description: "Now let's set up your emergency contact.",
        });
        setStep("emergency-contact");
      } else {
        console.error("Signup error:", result.error);
        setError(
          result.error.message || "Failed to create account. Please try again.",
        );
      }
    } catch (error) {
      console.error("Unexpected error during signup:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmergencyContactSuccess = () => {
    toast({
      title: "Emergency contact saved!",
      description: "Your safety setup is complete.",
    });
    setStep("complete");
    setTimeout(() => {
      router.push("/");
    }, 1500);
  };

  const handleSkipEmergencyContact = () => {
    toast({
      title: "Skipped for now",
      description: "You can add an emergency contact later in your profile.",
    });
    setStep("complete");
    setTimeout(() => {
      router.push("/");
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-blue-950 dark:to-purple-950 px-4 py-8">
      {step === "account" && (
        <Card className="w-full max-w-md border-0 shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <CardHeader className="text-center pb-6">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-lg opacity-30"></div>
                <Activity className="relative h-10 w-10 text-transparent bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text mr-3" />
              </div>
              <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                MantrAI
              </span>
            </div>
            <CardTitle className="text-3xl font-bold mb-2">
              Create an account
            </CardTitle>
            <CardDescription className="text-lg">
              Start your emotional intelligence journey
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <form onSubmit={handleAccountSubmit} className="space-y-5">
              {error && (
                <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-12 rounded-xl border-2 focus:border-blue-500 transition-all duration-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-12 rounded-xl border-2 focus:border-blue-500 transition-all duration-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                    className="h-12 rounded-xl border-2 focus:border-blue-500 transition-all duration-300 pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium"
                >
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                    className="h-12 rounded-xl border-2 focus:border-blue-500 transition-all duration-300 pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                disabled={
                  isLoading ||
                  !fullName ||
                  !email ||
                  !password ||
                  !confirmPassword ||
                  password !== confirmPassword
                }
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating account...
                  </div>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "emergency-contact" && (
        <Card className="w-full max-w-md border-0 shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-md max-h-[90vh] overflow-y-auto">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-600 rounded-full blur-lg opacity-30"></div>
                <Heart className="relative h-10 w-10 text-red-500" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold mb-2">
              Safety Setup
            </CardTitle>
            <CardDescription className="text-lg">
              Step 2 of 2: Add an emergency contact
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                💡 <strong>Why this matters:</strong> If we detect signs of
                emotional distress, we'll notify your emergency contact so they
                can reach out and support you.
              </p>
            </div>

            <div className="mb-4">
              <EmergencyContactForm
                isModal={false}
                onSuccess={handleEmergencyContactSuccess}
                mode="create"
              />
            </div>

            <div className="border-t dark:border-gray-700 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkipEmergencyContact}
                className="w-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "complete" && (
        <Card className="w-full max-w-md border-0 shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <CardHeader className="text-center py-12">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full blur-lg opacity-30"></div>
                <div className="relative h-16 w-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                  <ArrowRight className="h-8 w-8 text-white rotate-45" />
                </div>
              </div>
            </div>
            <CardTitle className="text-3xl font-bold mb-2">
              Welcome to MantrAI! 🎉
            </CardTitle>
            <CardDescription className="text-lg">
              Your account is all set. Redirecting to dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
