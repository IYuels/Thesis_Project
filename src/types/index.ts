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
    originalCaption?: string;
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
    originalCaption?: string; // Optional field for original caption
}

export interface ProfileInfo{
    user?: User;
    displayName?: string;
    photoURL?: string;
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
    likes: number;
    userlikes: string[];
    userID: string | null;
    date: Date;
    username?: string;
    photoURL?: string;
    toxicity?: {
      is_toxic: boolean;
      detected_categories: string[];
      results: Record<string, { probability: number; is_detected: boolean }>;
    } | null;
  }