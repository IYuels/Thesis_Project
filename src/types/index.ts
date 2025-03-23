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

// Enhanced toxicity interface based on appv3 model
export interface ToxicityData {
    is_toxic: boolean;
    toxicity_level: 'not toxic' | 'toxic' | 'very toxic'; 
    detected_categories: string[];
    results: Record<string, {
        probability: number;
        is_detected: boolean;
    }>;
    raw_probabilities?: Record<string, number>;
    // Add the censored_text property that was missing
    censored_text?: string | null;
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
    toxicity?: ToxicityData | null;
    originalCaption?: string | null;
}

export interface PhotoMeta {
    cdnUrl: string;
    uuid: string;
}

// Update DocumentResponse interface with enhanced toxicity data
export interface DocumentResponse {
    id: string;
    caption: string;
    likes: number;
    userlikes: string[];
    userID: string;
    postID: string;
    date: Date | any; // Using any to accommodate Firestore Timestamp
    username?: string;
    photoURL?: string;
    toxicity?: ToxicityData | null;
    originalCaption?: string | null;
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
    originalCaption?: string | null;
    likes: number;
    userlikes: string[];
    userID: string | null;
    username?: string;
    photoURL?: string;
    date: Date;
    toxicity?: ToxicityData | null;
}

export interface Notification {
    id?: string;
    type: NotificationType;
    senderId: string;
    senderName: string;
    senderPhoto: string;
    recipientId: string;
    postId: string;
    postContent?: string;
    commentContent?: string;
    createdAt?: Date | { toDate: () => Date };
    read: boolean;
}

export enum NotificationType {
    LIKE = 'LIKE',
    COMMENT = 'COMMENT',
}

// New enums for censoring levels
export enum CensorLevel {
    AUTO = 'auto',
    LIGHT = 'light',
    MEDIUM = 'medium',
    HEAVY = 'heavy'
}

// Categories that match the backend model
export enum ToxicityCategory {
    OBSCENITY = 'obscenity/profanity',
    INSULTS = 'insults',
    THREATENING = 'threatening',
    IDENTITY_BASED = 'identity-based negativity'
}