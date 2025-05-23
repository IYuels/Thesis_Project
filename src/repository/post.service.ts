import { db } from "@/firebaseConfig";
import { DocumentResponse, Post, ProfileInfo } from "@/types";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";

const COLLECTION_NAME = "posts";

export const createPost = (post: Post) => {
  // Include originalCaption along with toxicity data
  return addDoc(collection(db, COLLECTION_NAME), {
    ...post,
    date: serverTimestamp(),
    // Make sure toxicity is included if it exists
    toxicity: post.toxicity || null,
    // Include originalCaption if content was censored
    originalCaption: post.originalCaption || null
  });
};

export const getPosts = async () => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    const tempArr: DocumentResponse[] = [];
    
    if (querySnapshot.size > 0) {
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const responseObj: DocumentResponse = {
          id: doc.id,
          caption: data.caption || "",
          originalCaption: data.originalCaption || null, // Add this line
          likes: data.likes || 0,
          userlikes: data.userlikes || [],
          postID: data.postID || "",
          userID: data.userID || "",
          date: data.date || new Date(),
          username: data.username || "",
          photoURL: data.photoURL || "",
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
export const getPostByUserID = async (id: string) => {
  const q = query(collection(db, COLLECTION_NAME), where("userID", "==", id));
  return getDocs(q);
}

export const getPost = (id: string) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  return getDoc(docRef);
}

export const deletePost = async (postId: string) => {
  try {
    // Delete the post document
    await deleteDoc(doc(db, 'posts', postId));
    
    // Optional: Delete associated comments
    const commentsQuery = query(
      collection(db, 'comments'), 
      where('postID', '==', postId)
    );
    
    const commentsSnapshot = await getDocs(commentsQuery);
    
    const batch = writeBatch(db);
    commentsSnapshot.docs.forEach(document => {
      batch.delete(document.ref);
    });
    
    await batch.commit();
    
    return true;
  } catch (error) {
    console.error("Error deleting post:", error);
    throw error;
  }
};

export const updateLikesOnPost = async (id: string, userlikes: string[], likes: number) => {
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
    console.log("The user doesn't have any posts");
  }
};

// Add a new function to update toxicity data on a post
export const updatePostToxicity = async (id: string, toxicityData: any) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  return updateDoc(docRef, {
    toxicity: toxicityData
  });
};
