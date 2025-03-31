import Layout from "@/components/layout";
import { useUserAuth } from "@/context/userAuthContext";
import { Comment, DocumentResponse, Post, ProfileResponse } from "@/types";
import avatar from "@/assets/images/avatar.png";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { getPostByUserID } from "@/repository/post.service";
import { useNavigate } from "react-router-dom";
import { getUserProfile, subscribeToUserProfile } from "@/repository/user.service";
import { Edit2Icon } from "lucide-react";
import { getComment } from "@/repository/comment.service";
import PostCard from "@/components/postCard"; // Import the PostCard component

interface IProfileProps {}

const Profile: React.FunctionComponent<IProfileProps> = () => {
    const { user } = useUserAuth();
    const navigate = useNavigate();
    const initialUserInfo: ProfileResponse = {
        id: "",
        userId: user?.uid || "",
        userBio: "Please update your bio...",
        photoURL: user?.photoURL || "",
        displayName: user?.displayName || "Guest_user",
    };
    
    const [userInfo, setUserInfo] = React.useState<ProfileResponse>(initialUserInfo);
    const [data, setData] = React.useState<DocumentResponse[]>([]);
    const [, setCommentData] = React.useState<Comment[]>([]);
    const [loading, setLoading] = React.useState<boolean>(true);

    const getAllPost = React.useCallback(async (id: string) => {
        try {
            setLoading(true);
            const querySnapshot = await getPostByUserID(id);
            const tempArr: DocumentResponse[] = [];
            
            if (querySnapshot.size > 0) {
                querySnapshot.forEach((doc) => {
                    const data = doc.data() as Post;
                    const responseObj: DocumentResponse = {
                        id: doc.id,
                        postID: data.id,
                        caption: data.caption || "",
                        likes: data.likes || 0,
                        userlikes: data.userlikes || [],
                        username: data.username || "",
                        photoURL: data.photoURL || "",
                        userID: data.userID || "",
                        date: data.date || new Date(),
                        // Include toxicity data if it exists
                        toxicity: data.toxicity || null,
                        originalCaption: data.originalCaption || null,
                    };
                    tempArr.push(responseObj);
                });
                setData(tempArr);
            }
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setLoading(false);
        }
    }, []);
    
    const fetchCommentsForPosts = React.useCallback(async (postIds: string[]) => {
        if (!postIds.length) return;
        
        try {
            const allComments = await getComment();
            if (allComments && allComments.length > 0) {
                const relevantComments = allComments.filter(comment => 
                    postIds.includes(comment.postID || "")
                );
                setCommentData(relevantComments);
            }
        } catch (error) {
            console.error("Error fetching comments:", error);
        }
    }, []);

    const getUserProfileInfo = React.useCallback(async (userId: string) => {
        try {
            const profileData = await getUserProfile(userId);
            if (profileData) {
                setUserInfo(prev => ({
                    ...prev,
                    ...profileData,
                    userId: userId,
                }));
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    }, []);
    
    React.useEffect(() => {
        let unsubscribe: () => void = () => {};
        
        if (user?.uid) {
            // First, get initial data
            getUserProfileInfo(user.uid);
            
            // Then subscribe to real-time updates
            unsubscribe = subscribeToUserProfile(user.uid, (profileData) => {
                if (profileData && Object.keys(profileData).length > 0) {
                    setUserInfo(prev => ({
                        ...prev,
                        ...profileData,
                        userId: user.uid,
                    }));
                }
            });
        }
        
        // Cleanup subscription when component unmounts
        return () => {
            unsubscribe();
        };
    }, [user, getUserProfileInfo]);
    
    React.useEffect(() => {
        // Only run if user exists and has a uid
        if (user?.uid) {
            getAllPost(user.uid);
        }
    }, [user, getAllPost]);
    
    React.useEffect(() => {
        if (data.length > 0) {
            const postIds = data.map(post => post.id);
            fetchCommentsForPosts(postIds);
        }
    }, [data, fetchCommentsForPosts]);
    
    const editProfile = () => {
        navigate(`/editprofile/${user?.uid}`);
    };

    const renderPosts = () => {
        // Sort posts by date (newest first)
        const sortedPosts = [...data].sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date : new Date(a.date);
            const dateB = b.date instanceof Date ? b.date : new Date(b.date);
            return dateB.getTime() - dateA.getTime();
        });
        
        return sortedPosts.map((post) => (
            <PostCard key={post.id} data={post} />
        ));
    };

    if (!user) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-64">
                    <p>Please log in to view your profile</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="flex justify-center px-4 sm:px-6">
                <div className="w-full max-w-3xl">
                    <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-t-lg shadow-md">
                        <h3 className='text-center text-lg font-medium p-3'>
                            Profile
                        </h3>
                    </div>
                    <div className="bg-white p-6 rounded-b-lg shadow-md mb-6">
                        {/* Profile header */}
                        <div className="flex flex-col sm:flex-row items-center pb-5 mb-5 border-b">
                            <div className="mb-4 sm:mb-0 sm:mr-6">
                                <div className="relative">
                                    <img 
                                        src={userInfo.photoURL || avatar} 
                                        alt="Avatar" 
                                        className='w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-slate-200 object-cover shadow-md' 
                                    />
                                </div>
                            </div>
                            <div className='flex-grow flex flex-col justify-start text-center sm:text-left'>
                                <div className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">{userInfo.displayName}</div>
                                <div className="text-sm sm:text-base text-gray-500 mb-3">{user?.email || ""}</div>
                                <div className="text-sm sm:text-base text-gray-700 mb-4 italic">"{userInfo.userBio}"</div>
                                <div className="flex justify-center sm:justify-start">
                                    <Button 
                                        onClick={editProfile} 
                                        size="sm" 
                                        variant="outline" 
                                        className="transition-all duration-200 hover:bg-slate-100"
                                    >
                                        <Edit2Icon className='mr-2 h-4 w-4'/> Edit Profile
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h2 className="mb-5 text-xl font-semibold text-slate-800 flex items-center">
                                <span className="mr-2">My Posts</span>
                                {data.length > 0 && (
                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                                        {data.length}
                                    </span>
                                )}
                            </h2>
                            {loading ? (
                                <div className="text-center p-8 bg-gray-50 rounded-lg">
                                    <div className="inline-block animate-pulse bg-gray-200 h-5 w-32 rounded mb-2"></div>
                                    <div className="inline-block animate-pulse bg-gray-200 h-5 w-24 rounded"></div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-6">
                                    {data.length > 0 ? renderPosts() : 
                                        <div className="text-center p-8 bg-gray-50 rounded-lg text-gray-500">No posts yet</div>
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Profile;