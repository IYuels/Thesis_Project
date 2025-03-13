import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  UserCredential,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "@/firebaseConfig";
import { Navigate } from 'react-router-dom';

interface UserAuthContextProps {
  user: User | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string) => Promise<UserCredential>;
  login: (email: string, password: string) => Promise<UserCredential>;
  googleSignIn: () => Promise<UserCredential>;
  logout: () => Promise<void>;
  sendVerificationEmail: (user: User) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  isEmailVerified: boolean;
  clearError: () => void;
}

const userAuthContext = createContext<UserAuthContextProps | undefined>(undefined);

export function UserAuthContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);

  function clearError() {
    setError(null);
  }

  async function signUp(email: string, password: string): Promise<UserCredential> {
    try {
      setLoading(true);
      clearError();
      return await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      let errorMessage = "Failed to create account";
      
      // Handle specific Firebase error codes
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = "Email is already in use";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "Invalid email format";
      } else if (err.code === 'auth/weak-password') {
        errorMessage = "Password is too weak";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<UserCredential> {
    try {
      setLoading(true);
      clearError();
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      let errorMessage = "Failed to sign in";
      
      // Handle specific Firebase error codes
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errorMessage = "Invalid email or password";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "Invalid email format";
      } else if (err.code === 'auth/user-disabled') {
        errorMessage = "This account has been disabled";
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed login attempts. Please try again later";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn(): Promise<UserCredential> {
    try {
      setLoading(true);
      clearError();
      const googleAuthProvider = new GoogleAuthProvider();
      return await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      let errorMessage = "Failed to sign in with Google";
      
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = "Google sign-in was cancelled";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout(): Promise<void> {
    try {
      setLoading(true);
      clearError();
      await signOut(auth);
    } catch (err: any) {
      setError(err.message || "Failed to log out");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function sendVerificationEmail(user: User): Promise<void> {
    try {
      setLoading(true);
      clearError();
      await sendEmailVerification(user);
    } catch (err: any) {
      setError(err.message || "Failed to send verification email");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword(email: string): Promise<void> {
    try {
      setLoading(true);
      clearError();
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      let errorMessage = "Failed to send password reset email";
      
      if (err.code === 'auth/invalid-email') {
        errorMessage = "Invalid email format";
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = "No account exists with this email";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsEmailVerified(currentUser?.emailVerified || false);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading,
    error,
    signUp,
    login,
    googleSignIn,
    logout,
    sendVerificationEmail,
    forgotPassword,
    isEmailVerified,
    clearError
  };

  return (
    <userAuthContext.Provider value={value}>
      {children}
    </userAuthContext.Provider>
  );
}

export function useUserAuth(): UserAuthContextProps {
  const context = useContext(userAuthContext);
  if (context === undefined) {
    throw new Error("useUserAuth must be used within a UserAuthContextProvider");
  }
  return context;
}

// Protected Route component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isEmailVerified, loading } = useUserAuth();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (!isEmailVerified && !user.emailVerified) {
    return <Navigate to="/verify-email" state={{ email: user.email }} />;
  }
  
  return <>{children}</>;
};