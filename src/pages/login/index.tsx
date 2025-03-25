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
  const { googleSignIn, login, clearError } = useUserAuth();
  const navigate = useNavigate();
  const [userLogInInfo, setUserLogInInfo] = React.useState<UserLogIn>(initialValue);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  const handleGoogleSignIn = async (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    clearError();
    
    try {
      await googleSignIn();
      toast.success("Logged in successfully");
      navigate("/");
    } catch (error: any) {
      setError(error.message || "Failed to sign in with Google");
      toast.error("Login failed", {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    clearError();
    
    try {
      // Validate inputs
      if (!userLogInInfo.email || !userLogInInfo.password) {
        setError("Please enter both email and password");
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
      console.error("Error during login:", error);
      setError(error.message || "Login failed");
      toast.error("Login failed", {
        description: error.message
      });
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
                </CardHeader>
                <CardContent className="grid gap-4">
                  {error && (
                    <div className="p-3 text-sm bg-red-100 text-red-800 rounded">
                      {error}
                    </div>
                  )}
                  <div className="grid">
                    <Button 
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
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background bg-white px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>
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
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col">
                  <Button 
                    className="w-full" 
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
                  <p className="mt-3 text-sm text-center">
                    Don't have an account? <Link to="/signup">Sign Up</Link>
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