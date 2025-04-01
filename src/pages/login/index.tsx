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
import { UserLogIn } from "@/types";
import { Label } from "@radix-ui/react-label";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner"; // Using Sonner for toast notifications

interface ILoginProps {}

const initialValue: UserLogIn = {
  email: "",
  password: "",
};

const Login: React.FunctionComponent<ILoginProps> = () => {
  const { googleSignIn, login, clearError, error } = useUserAuth();
  const navigate = useNavigate();
  const [userLogInInfo, setUserLogInInfo] = React.useState<UserLogIn>(initialValue);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  // Clear context error when component unmounts
  React.useEffect(() => {
    return () => clearError();
  }, [clearError]);

  // Show error toast whenever the error in context changes
  React.useEffect(() => {
    if (error) {
      toast.error("Login failed", {
        description: error
      });
    }
  }, [error]);

  const handleGoogleSignIn = async (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();
    
    try {
      await googleSignIn();
      toast.success("Logged in successfully");
      navigate("/");
    } catch (error: any) {
      // Error is already set in the context and will be shown via useEffect
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();
    
    try {
      // Validate inputs
      if (!userLogInInfo.email || !userLogInInfo.password) {
        toast.error("Missing information", {
          description: "Please enter both email and password"
        });
        setIsLoading(false);
        return;
      }
      
      const userCredential = await login(userLogInInfo.email, userLogInInfo.password);
      
      // Check if email is verified
      if (!userCredential.user.emailVerified) {
        toast.error("Email not verified", {
          description: "Please verify your email before logging in."
        });
        navigate("/verify-email", { 
          state: { email: userLogInInfo.email } 
        });
        return;
      }
      
      toast.success("Logged in successfully");
      navigate("/");
    } catch (error: any) {
      // Error is already set in the context and will be shown via useEffect
    } finally {
      setIsLoading(false);
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
                    Enter your credentials to access your account
                  </CardDescription>
                  
                  {/* Added divider line after the credentials text */}
                  <div className="pt-3">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {/* We can keep the error display for reference, but the toast will show it too */}
                  {error && (
                    <div className="p-3 text-sm bg-red-100 text-red-800 rounded">
                      {error}
                    </div>
                  )}
                  
                  {/* Email and Password form fields now come first */}
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="dipesh@example.com"
                      value={userLogInInfo.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setUserLogInInfo({ ...userLogInInfo, email: e.target.value })
                      }
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Password"
                      value={userLogInInfo.password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setUserLogInInfo({ ...userLogInInfo, password: e.target.value })
                      }
                      required
                      disabled={isLoading}
                    />
                  </div>
                  
                  <Button 
                    className="w-full hover:bg-slate-200 cursor-pointer border" 
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                  
                  {/* Divider now comes after the form */}
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
                  
                  {/* Google button now comes last */}
                  <div className="grid">
                    <Button
                      className="hover:bg-slate-200 cursor-pointer" 
                      variant="outline" 
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                      type="button"
                    >
                      {isLoading ? (
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
                    Don't have an account? <Link className="text-blue-500" to="/signup">Sign Up</Link>
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

export default Login;