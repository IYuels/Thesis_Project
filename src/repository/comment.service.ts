import { db } from "@/firebaseConfig";
import { Comment, DocumentResponse, ProfileInfo } from "@/types";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";

const COLLECTION_NAME = "comments";

export const createComment = (post: Comment) => {
  return addDoc(collection(db, COLLECTION_NAME), post);
};

export const getComment = async () => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    const tempArr: DocumentResponse[] = [];
    if (querySnapshot.size > 0) {
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Comment;
        // Make sure all required fields for DocumentResponse are present
        const responseObj: DocumentResponse = {
          id: doc.id,
          caption: data.caption || "",
          originalCaption: data.originalCaption || null, // Add this line
          likes: data.likes || 0,
          userlikes: data.userlikes || [],
          username: data.username || "",
          photoURL: data.photoURL || "",
          userID: data.userID || "",
          date: data.date || new Date(),
          postID: data.postID || "",
          toxicity: data.toxicity || null
        };
        tempArr.push(responseObj);
      });
      return tempArr;
    } else {
      console.log("No such document!");
      return []; // Return empty array instead of undefined
    }
  } catch (error) {
    console.log("Error getting document:", error);
    return []; // Return empty array on error
  }
};

export const getCommentByUserID = (id: string) => {
  const q = query(collection(db, COLLECTION_NAME), where("userID", "==", id));
  return getDocs(q);
}

export const getPost = (id: string) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  return getDoc(docRef);
}

export const deletePost = (id: string) => {
  return deleteDoc(doc(db, COLLECTION_NAME, id));
}

// Renamed from updateLikesOnPost to updateLikesOnComment for clarity
export const updateLikesOnComment = async (id: string, userlikes: string[], likes: number) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  return updateDoc(docRef, {
    likes: likes,
    userlikes: userlikes,
  });
};

export const updateUserInfoOnPosts = async (profileInfo: ProfileInfo) => {
  const q = query(collection(db, COLLECTION_NAME), where("userID", "==", profileInfo.user?.uid));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.size > 0) {
    querySnapshot.forEach((document) => {
      const docRef = doc(db, COLLECTION_NAME, document.id);
      updateDoc(docRef, {
        username: profileInfo.displayName,
        photoURL: profileInfo.photoURL,
      });
    });
  } else {
    console.log("The user doesn't have any comments");
  }
};