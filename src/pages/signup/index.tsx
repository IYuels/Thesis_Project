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
import { Input } from "@/components/ui/input";
import { useUserAuth } from "@/context/userAuthContext";
import { UserSignIn } from "@/types";
import { Label } from "@radix-ui/react-label";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner"; // Using Sonner from shadcn/ui

const initialValue: UserSignIn = {
  email: "",
  password: "",
  confirmPassword: "",
};

interface ISignupProps {}

const Signup: React.FunctionComponent<ISignupProps> = () => {
  const { googleSignIn, signUp, sendVerificationEmail, error, clearError, loading } = useUserAuth();
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = React.useState<UserSignIn>(initialValue);
  
  // Clear context error when component unmounts
  React.useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);
  
  // Show toast when error changes
  React.useEffect(() => {
    if (error) {
      toast.error("Sign up failed", {
        description: error
      });
    }
  }, [error]);
  
  const handleGoogleSignIn = async (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    clearError(); // Clear any previous errors
    
    try {
      await googleSignIn();
      navigate("/");
    } catch (error: any) {
      // The error is already handled in the context
      console.error("Google Sign-in error:", error);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError(); // Clear any previous errors
    
    // Local validation
    if (userInfo.password !== userInfo.confirmPassword) {
      toast.error("Password mismatch", {
        description: "Passwords do not match"
      });
      return;
    }
    
    if (userInfo.password.length < 6) {
      toast.error("Password too short", {
        description: "Password should be at least 6 characters"
      });
      return;
    }
    
    try {
      const userCredential = await signUp(userInfo.email, userInfo.password);
      
      // Send verification email
      await sendVerificationEmail(userCredential.user);
      
      toast.success("Account created successfully", {
        description: "Please check your email to verify your account before logging in."
      });
      
      // Redirect to verification page instead of login
      navigate("/emailVerification", { 
        state: { email: userInfo.email } 
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      // No need to set error manually as it's handled by the context
    }
  };
  
  return (
    <div className="w-full h-screen flex flex-col justify-center bg-slate-800">
      <div className="container mx-auto p-6 flex h-full">
        <div className="flex justify-center items-center w-full">
          <div className="max-w-sm rounded-xl border bg-card text-card-foreground shadow-sm bg-white">
            <Card>
              <form onSubmit={handleSubmit}>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl text-center mb-4">
                    Thesis Project
                  </CardTitle>
                  <CardDescription>
                    Enter your email below to create your account
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {/* Removed the error display div from here */}
                  
                  {/* Added divider line after the credentials text */}
                  <div className="pt-3">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  
                  {/* Email and password forms first */}
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="dipesh@example.com"
                      value={userInfo.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setUserInfo({ ...userInfo, email: e.target.value })
                      }
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Password"
                      value={userInfo.password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setUserInfo({ ...userInfo, password: e.target.value })
                      }
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmpassword">Confirm password</Label>
                    <Input
                      id="confirmpassword"
                      type="password"
                      placeholder="Confirm password"
                      value={userInfo.confirmPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setUserInfo({
                          ...userInfo,
                          confirmPassword: e.target.value,
                        })
                      }
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button 
                    className="w-full  hover:bg-slate-200 border cursor-pointer" 
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                        Signing Up...
                      </>
                    ) : (
                      "Sign Up"
                    )}
                  </Button>
                  
                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background bg-white px-2 text-muted-foreground">
                        Or login with
                      </span>
                    </div>
                  </div>
                  
                  {/* Google button at the end */}
                  <div className="grid">
                    <Button 
                      className="w-full hover:bg-slate-200 cursor-pointer"
                      variant="outline" 
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      type="button"
                    >
                      {loading ? (
                        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Icons.google className="mr-2 h-4 w-4" />
                      )}
                      Google
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col">
                  <p className="mt-3 text-sm text-center">
                    Already have an account? <Link className="text-blue-500" to="/login">Login</Link>
                  </p>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;