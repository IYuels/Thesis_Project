import Layout from "@/components/layout";
import { useUserAuth } from "@/context/userAuthContext";
import { Comment, DocumentResponse, Post, ProfileResponse } from "@/types";
import avatar from "@/assets/images/avatar.png";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { getPostByUserID } from "@/repository/post.service";
import { useNavigate } from "react-router-dom";
import { getUserProfile } from "@/repository/user.service";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import CommentCard from "@/components/comment";
import { ChevronDownIcon, Edit2Icon, MessageCircleIcon, ThumbsUpIcon } from "lucide-react";
import { getComment } from "@/repository/comment.service";

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
    const [commentData, setCommentData] = React.useState<Comment[]>([]);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [expandedComments, setExpandedComments] = React.useState<Record<string, boolean>>({});

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
                        date: data.date || new Date()
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
                    userId: userId, // Ensure userId is always set
                }));
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    }, []);
    
    React.useEffect(() => {
        // Only run if user exists and has a uid
        if (user?.uid) {
            getUserProfileInfo(user.uid);
            getAllPost(user.uid);
        }
    }, [user, getUserProfileInfo, getAllPost]);
    
    React.useEffect(() => {
        if (data.length > 0) {
            const postIds = data.map(post => post.id);
            fetchCommentsForPosts(postIds);
        }
    }, [data, fetchCommentsForPosts]);
    
    const editProfile = () => {
        // Use URL parameters instead of state to avoid issues with refresh
        navigate(`/editprofile/${user?.uid}`);
    };

    const toggleComments = (postId: string) => {
        setExpandedComments(prev => ({
            ...prev,
            [postId]: !prev[postId]
        }));
    };

    const getPostComments = (postId: string) => {
        return commentData.filter(comment => comment.postID === postId);
    };

    const renderPosts = () => {
        return data.map((post) => {
            const postComments = getPostComments(post.id);
            const commentCount = postComments.length;
            const showAllComments = expandedComments[post.id] || false;
            const displayedComments = showAllComments ? postComments : postComments.slice(0, 1);
            
            return ( 
                <div className="w-full" key={post.id}>
                    <Card className="mb-6 overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200">
                        <CardHeader className="flex flex-col pb-3">
                            <CardTitle className="text-sm flex justify-start items-center">
                                <span className="relative">
                                    <img 
                                        src={userInfo.photoURL || avatar}
                                        className="w-10 h-10 rounded-full border-2 border-slate-800 object-cover"
                                        alt="User avatar"
                                    />
                                </span>
                                <span className="ml-3 font-semibold text-base">{userInfo.displayName}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="border p-4 rounded-xl bg-white shadow-sm">
                                <p className="text-gray-800 whitespace-pre-wrap">{post.caption}</p>
                            </div>
                            <div className="flex items-center justify-between mt-4 px-2">
                                <div className="flex items-center space-x-6">
                                    <div className="flex items-center space-x-1">
                                        <ThumbsUpIcon className="h-4 w-4 text-blue-500" />
                                        <span className="text-sm text-gray-700">{post.likes || 0}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <MessageCircleIcon className="h-4 w-4 text-green-500" />
                                        <span className="text-sm text-gray-700">{commentCount}</span>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                    {}
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-0 pb-4 px-4 block">
                            <div className="flex flex-col bg-gray-50 rounded-lg w-full mt-2 overflow-hidden">
                                <div className="py-2 px-3 bg-gray-100 font-medium text-sm flex justify-between items-center">
                                    <span>Comments</span>
                                    {commentCount > 0 && (
                                        <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">{commentCount}</span>
                                    )}
                                </div>
                                
                                {commentCount > 0 ? (
                                    <div className="p-3 space-y-3">
                                        {displayedComments.map((item) => (
                                            <CommentCard data={item} key={item.id}/>
                                        ))}
                                        
                                        {commentCount > 1 && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="w-full mt-2 text-xs border-gray-300 hover:bg-gray-100"
                                                onClick={() => toggleComments(post.id)}
                                            >
                                                {showAllComments ? 'Show less' : `See ${commentCount - 1} more comments`}
                                                <ChevronDownIcon className={`ml-1 h-4 w-4 transition-transform ${showAllComments ? 'rotate-180' : ''}`} />
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center p-4 text-sm text-gray-500">No comments yet</div>
                                )}
                            </div>  
                        </CardFooter>
                    </Card>
                </div>
            );
        });
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