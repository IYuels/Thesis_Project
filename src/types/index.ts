import { User } from "firebase/auth";
import { OutputFileEntry } from '@uploadcare/file-uploader';

export interface UserLogIn {
    email: string;
    password: string;
}

export interface UserSignIn {
    email: string;
    password: string;
    confirmPassword:string;
}

export interface FileEntry {
    files: OutputFileEntry[];
}

export interface Post {
    id: string;
    caption: string;
    likes: number;
    userlikes: string[];
    userID: string | null;
    username: string;
    photoURL: string;
    date: Date;
    toxicity?: {
      is_toxic: boolean;
      detected_categories: string[];
      results: Record<string, {probability: number, is_detected: boolean}>;
    };
    // Optional field to store original caption if needed
    originalCaption?: string | null;
}

export interface PhotoMeta {
    cdnUrl: string;
    uuid: string;
}

// Update DocumentResponse interface in @/types
export interface DocumentResponse {
    id: string;
    caption: string;
    likes: number;
    userlikes: string[];
    userID: string;
    postID:string;
    date: Date | any; // Using any to accommodate Firestore Timestamp
    username?: string;
    photoURL?: string;
    toxicity?: {
      is_toxic: boolean;
      detected_categories: string[];
      results: Record<string, {probability: number, is_detected: boolean}>;
    } | null;
    originalCaption?: string | null; // Added field to store original text when censored
}

export interface ProfileInfo {
    user: User;
    displayName: string;
    photoURL: string;
}

export interface UserInfoForPosts {
    user?: string;
    displayName?: string;
    photoURL?: string;
    userId?: string;  // Using userId instead of user for clarity
}

export interface UserProfile {
    userId?: string;
    displayName?: string;
    photoURL?: string;
    userBio?: string;
}

export interface ProfileResponse {
    id?: string;
    userId?: string;
    displayName?: string;
    photoURL?: string;
    userBio?: string;
}

export interface Comment {
    id?: string;
    postID: string;
    caption: string;
    originalCaption?: string | null; // Added field to store original text when censored
    likes: number;
    userlikes: string[];
    userID: string | null;
    username?: string;
    photoURL?: string;
    date: Date;
    toxicity?: {
        is_toxic: boolean;
        detected_categories: string[];
        results: Record<string, { probability: number; is_detected: boolean }>;
    } | null;
}

export enum NotificationType {
    LIKE = 'like',
    COMMENT = 'comment'
  }
  
  export interface Notification {
    id?: string;
    type: NotificationType;
    senderId: string;
    senderName: string;
    senderPhoto?: string;
    recipientId: string;
    postId: string;
    postContent?: string;
    commentId?: string;
    commentContent?: string;
    createdAt?: any;
    read: boolean;
  }
