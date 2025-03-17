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
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";
import { auth } from "@/firebaseConfig";
import { Navigate } from 'react-router-dom';
import { ProfileResponse, UserProfile } from "@/types";
import { getUserProfile, updateUserProfile as updateUserProfileInDB, createUserProfile } from "@/repository/user.service";
import avatar from "@/assets/images/avatar.png";

// Profile info interface
export interface ProfileInfo {
  user: User;
  displayName: string;
  photoURL: string;
}

interface UserAuthContextProps {
  user: User | null;
  userProfile: ProfileResponse | null;
  loading: boolean;
  profileLoading: boolean;
  error: string | null;
  signUp: (email: string, password: string) => Promise<UserCredential>;
  login: (email: string, password: string) => Promise<UserCredential>;
  googleSignIn: () => Promise<UserCredential>;
  logout: () => Promise<void>;
  sendVerificationEmail: (user: User) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updateProfileInfo: (profileInfo: ProfileInfo) => Promise<void>;
  updateUserProfile: (profileData: ProfileResponse) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  isEmailVerified: boolean;
  clearError: () => void;
  registerProfileUpdateListener: (callback: () => void) => () => void;
}
const userAuthContext = createContext<UserAuthContextProps | undefined>(undefined);

export function UserAuthContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [profileUpdateListeners, setProfileUpdateListeners] = useState<(() => void)[]>([]);
  


  function clearError() {
    setError(null);
  }

  async function signUp(email: string, password: string): Promise<UserCredential> {
    try {
      setLoading(true);
      clearError();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create initial user profile
      if (userCredential.user) {
        const initialProfile: UserProfile = {
          userId: userCredential.user.uid,
          displayName: userCredential.user.displayName || email.split('@')[0],
          photoURL: userCredential.user.photoURL || "",
          userBio: "Please update your bio..."
        };
        await createUserProfile(initialProfile);
      }
      
      return userCredential;
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
      const userCredential = await signInWithPopup(auth, googleAuthProvider);
      
      // Check if profile exists, if not create it
      if (userCredential.user) {
        const existingProfile = await getUserProfile(userCredential.user.uid);
        if (!existingProfile || !existingProfile.id) {
          const initialProfile: UserProfile = {
            userId: userCredential.user.uid,
            displayName: userCredential.user.displayName || "Guest_user",
            photoURL: userCredential.user.photoURL || "",
            userBio: "Please update your bio..."
          };
          await createUserProfile(initialProfile);
        }
      }
      
      return userCredential;
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
      setUserProfile(null); // Clear user profile on logout
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

  async function updateProfileInfo(profileInfo: ProfileInfo): Promise<void> {
    try {
      setLoading(true);
      clearError();
      
      // Update the Firebase Auth profile
      await updateProfile(profileInfo.user, {
        displayName: profileInfo.displayName,
        photoURL: profileInfo.photoURL
      });

      // Refresh the user state to reflect the changes
      setUser({ ...profileInfo.user, displayName: profileInfo.displayName, photoURL: profileInfo.photoURL });
      
      // Also update the userProfile state if it exists
      if (userProfile?.id) {
        const updatedProfile: UserProfile = {
          userId: profileInfo.user.uid,
          displayName: profileInfo.displayName,
          photoURL: profileInfo.photoURL,
          userBio: userProfile.userBio || "Please update your bio..."
        };
        
        // Update in database
        await updateUserProfileInDB(userProfile.id, updatedProfile);
        
        // Update the local state
        setUserProfile({
          ...userProfile,
          displayName: profileInfo.displayName,
          photoURL: profileInfo.photoURL
        });
      } else {
        // Profile doesn't exist yet, create it
        const newProfile: UserProfile = {
          userId: profileInfo.user.uid,
          displayName: profileInfo.displayName,
          photoURL: profileInfo.photoURL,
          userBio: "Please update your bio..."
        };
        const docRef = await createUserProfile(newProfile);
        if (docRef) {
          setUserProfile({
            id: docRef.id,
            ...newProfile
          });
        }
      }
      
    } catch (err: any) {
      let errorMessage = "Failed to update profile";
      
      if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  // New function to update user profile
  async function updateUserProfile(profileData: ProfileResponse): Promise<void> {
    try {
      setProfileLoading(true);
      clearError();
      
      if (!profileData.id) {
        throw new Error("Profile ID is required for update");
      }
      
      // Prepare update data
      const updateData: UserProfile = {
        userId: profileData.userId || user?.uid || "",
        displayName: profileData.displayName || "Guest_user",
        photoURL: profileData.photoURL || "",
        userBio: profileData.userBio || "Please update your bio..."
      };
       
      // Update profile in database
      await updateUserProfileInDB(profileData.id, updateData);
      
      // Update local state
      setUserProfile(profileData);
      
      // If Firebase auth fields need updating too
      if (user && (profileData.displayName !== user.displayName || profileData.photoURL !== user.photoURL)) {
        await updateProfile(user, {
          displayName: profileData.displayName,
          photoURL: profileData.photoURL
        });
        
        // Refresh the user state with updated values
        setUser({ ...user, displayName: profileData.displayName || null, photoURL: profileData.photoURL || avatar });
      }
      notifyProfileUpdated();
    } catch (err: any) {
      let errorMessage = "Failed to update profile";
      if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      throw err;
    } finally {
      setProfileLoading(false);
    }
  }

  // New function to manually refresh the user profile
  async function refreshUserProfile(): Promise<void> {
    if (!user?.uid) return;
    
    try {
      setProfileLoading(true);
      clearError();
      const profileData = await getUserProfile(user.uid);
      if (profileData) {
        setUserProfile(profileData);
      } else {
        // Profile doesn't exist yet, create a default one
        const newProfile: UserProfile = {
          userId: user.uid,
          displayName: user.displayName || "Guest_user",
          photoURL: user.photoURL || "",
          userBio: "Please update your bio..."
        };
        const docRef = await createUserProfile(newProfile);
        if (docRef) {
          setUserProfile({
            id: docRef.id,
            ...newProfile
          });
        }
      }
    } catch (err: any) {
      let errorMessage = "Failed to refresh profile";
      if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      // We don't throw here to prevent cascading errors
      console.error("Error refreshing profile:", err);
    } finally {
      setProfileLoading(false);
    }
  }

  

  // Load user profile when user changes
  useEffect(() => {
    if (user?.uid) {
      refreshUserProfile();
    }
  }, [user?.uid]);

  function registerProfileUpdateListener(callback: () => void) {
    setProfileUpdateListeners(prev => [...prev, callback]);
    // Return an unsubscribe function
    return () => {
      setProfileUpdateListeners(prev => prev.filter(cb => cb !== callback));
    };
  }

    // Add this function to notify listeners
  function notifyProfileUpdated() {
    profileUpdateListeners.forEach(callback => callback());
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
    userProfile,
    loading,
    profileLoading,
    error,
    signUp,
    login,
    googleSignIn,
    logout,
    sendVerificationEmail,
    forgotPassword,
    updateProfileInfo,
    updateUserProfile,
    refreshUserProfile,
    isEmailVerified,
    clearError,
    registerProfileUpdateListener
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