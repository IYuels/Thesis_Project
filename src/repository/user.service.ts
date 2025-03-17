import { db } from "@/firebaseConfig";
import { ProfileResponse, UserProfile } from "@/types";
import { addDoc, collection, doc, getDocs, query, updateDoc, where, onSnapshot  } from "firebase/firestore";

const COLLECTION_NAME = "users";

export const createUserProfile = (user: UserProfile) => {
  try {
    return addDoc(collection(db, COLLECTION_NAME), user);
  } catch (error) {
    console.log("Error creating user profile:", error);
  }
};

export const getUserProfile = async (userId: string) => {
    try {
        const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        let tempData:ProfileResponse = {};
        if (querySnapshot.size > 0) {
            querySnapshot.forEach((doc) => {
                const userData = doc.data() as UserProfile;
                tempData = {
                    id: doc.id,
                    ...userData,
                }
            });
            return tempData;
        } else {
            console.log("No such document!");
            return tempData;
        }
    } catch (error) {
        console.log("Error getting user profile:", error);
    }
};

export const subscribeToUserProfile = (userId: string, callback: (profileData: ProfileResponse) => void) => {
    try {
      const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId));
      
      // This creates a real-time listener that will call the callback whenever the data changes
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        let tempData: ProfileResponse = {};
        
        if (querySnapshot.size > 0) {
          querySnapshot.forEach((doc) => {
            const userData = doc.data() as UserProfile;
            tempData = {
              id: doc.id,
              ...userData,
            };
          });
          callback(tempData);
        } else {
          console.log("No such document!");
          callback(tempData);
        }
      });
      
      // Return the unsubscribe function to stop listening when needed
      return unsubscribe;
    } catch (error) {
      console.log("Error subscribing to user profile:", error);
      return () => {}; // Return empty function as fallback
    }
  };

export const updateUserProfile = async (id: string, user: UserProfile) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return updateDoc(docRef, {...user,});
}