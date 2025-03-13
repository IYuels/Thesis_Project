import * as React from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { useUserAuth } from "@/context/userAuthContext";
import { toast } from "sonner";
import { onAuthStateChanged} from "firebase/auth";
import { auth } from "@/firebaseConfig";

interface IVerifyEmailProps {}

const VerifyEmail: React.FunctionComponent<IVerifyEmailProps> = () => {
  const { user, sendVerificationEmail, isEmailVerified, loading: authLoading } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");
  const [emailSent, setEmailSent] = React.useState<boolean>(false);
  const [countdown, setCountdown] = React.useState<number>(60);
  const [checking, setChecking] = React.useState<boolean>(false);
  
  // Get email from location state or use current user's email
  const email = location.state?.email || user?.email || "";

  // Setup polling for email verification
  React.useEffect(() => {
    if (!user) return;
    
    // Don't poll if already verified
    if (user.emailVerified || isEmailVerified) {
      navigate("/");
      return;
    }

    // Set up polling to check verification status
    const checkVerification = async () => {
      if (user) {
        try {
          await user.reload();
          if (user.emailVerified) {
            toast.success("Email verified successfully", {
              description: "Your account is now active."
            });
            navigate("/");
          }
        } catch (error) {
          console.error("Error checking verification status:", error);
        }
      }
    };

    // Initial check
    checkVerification();
    
    // Poll every 5 seconds
    const interval = setInterval(checkVerification, 5000);
    
    // Clean up on unmount
    return () => clearInterval(interval);
  }, [user, isEmailVerified, navigate]);
  
  // Countdown timer for resending email
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (emailSent && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [emailSent, countdown]);

  // Listen for auth state changes to handle direct link verification
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser?.emailVerified) {
        toast.success("Email verified successfully", {
          description: "Your account is now active."
        });
        navigate("/");
      }
    });
    
    return () => unsubscribe();
  }, [navigate]);

  const handleResendEmail = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      if (user) {
        await sendVerificationEmail(user);
        setEmailSent(true);
        setCountdown(60);
        toast.success("Verification email sent", {
          description: "Please check your inbox and spam folder."
        });
      } else {
        setError("No user found. Please sign in again.");
        toast.error("Authentication error", {
          description: "Please sign in again to verify your email."
        });
      }
    } catch (error: any) {
      console.error("Error sending verification email:", error);
      setError(error.message || "Failed to send verification email");
      toast.error("Failed to send verification email", {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setChecking(true);
    setError("");
    
    try {
      if (user) {
        // Reload the user to get the latest emailVerified status
        await user.reload();
        
        if (user.emailVerified) {
          toast.success("Email verified successfully", {
            description: "You can now access your account."
          });
          navigate("/");
        } else {
          setError("Email not verified yet. Please check your inbox and click the verification link.");
          toast.error("Email not verified", {
            description: "Please check your inbox and click the verification link."
          });
        }
      } else {
        setError("No user found. Please sign in again.");
        toast.error("Authentication error", {
          description: "Please sign in again to verify your email."
        });
      }
    } catch (error: any) {
      console.error("Error checking verification:", error);
      setError(error.message || "Failed to check verification status");
      toast.error("Verification check failed", {
        description: error.message
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col justify-center bg-slate-800">
      <div className="container mx-auto p-6 flex h-full">
        <div className="flex justify-center items-center w-full">
          <div className="max-w-sm rounded-xl border bg-card text-card-foreground shadow-sm bg-amber-50">
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl text-center mb-4">
                  Thesis
                </CardTitle>
                <CardDescription className="text-center">
                  Verify your email address
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {error && (
                  <div className="p-3 text-sm bg-red-100 text-red-800 rounded">
                    {error}
                  </div>
                )}
                
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 flex items-center justify-center bg-amber-100 rounded-full mb-2">
                    <span className="text-amber-500 text-lg">✉️</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    We've sent a verification email to:
                  </p>
                  <p className="font-medium">{email}</p>
                </div>
                
                <div className="text-sm text-center">
                  <p>Please check your inbox and click the verification link to activate your account.</p>
                  <p className="mt-2">If you don't see the email, check your spam folder.</p>
                </div>
                
                <div className="text-xs text-center text-muted-foreground">
                  {emailSent && countdown > 0 ? (
                    <p>You can resend the email in {countdown} seconds</p>
                  ) : (
                    <p>Checking verification status automatically...</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button
                  className="w-full"
                  onClick={handleCheckVerification}
                  disabled={checking || authLoading}
                >
                  {checking ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Check verification status"
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendEmail}
                  disabled={isLoading || authLoading || (emailSent && countdown > 0)}
                >
                  {isLoading ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : emailSent && countdown > 0 ? (
                    `Resend email (${countdown}s)`
                  ) : (
                    "Resend verification email"
                  )}
                </Button>
                
                <p className="mt-3 text-sm text-center">
                  Back to <Link to="/login">Login</Link>
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;