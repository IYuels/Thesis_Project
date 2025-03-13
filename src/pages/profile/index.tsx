import Layout from "@/components/layout";
import { useUserAuth } from "@/context/userAuthContext";
import { Comment, DocumentResponse, Post, ProfileResponse } from "@/types";
import avatar from "@/assets/images/avatar.png";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { getPostByUserID, } from "@/repository/post.service";
import { useNavigate } from "react-router-dom";
import { getUserProfile } from "@/repository/user.service";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import CommentCard from "@/components/comment";
import { Edit2Icon} from "lucide-react";
import { getComment } from "@/repository/comment.service";

interface IProfileProps {
}

const Profile: React.FunctionComponent<IProfileProps> = () => {
    const { user } = useUserAuth();
    console.log("The logged in user profile info is : ", user);
    const navigate = useNavigate();
    const initialUserInfo: ProfileResponse = {
        id: "",
        userId: user?.uid,
        userBio: "Please update your bio...",
        photoURL: user?.photoURL ? user.photoURL : "",
        displayName: user?.displayName ? user.displayName : "Guest_user",
    };
    const [userInfo, setUserInfo] =
        React.useState<ProfileResponse>(initialUserInfo);
    const [data, setData] = React.useState<DocumentResponse[]>([]);
    const [commentData, setCommentData] = React.useState<Comment[]>([]);

    const getAllPost = async (id: string) => {
        try {
            const querySnapshot = await getPostByUserID(id);
            const tempArr: DocumentResponse[] = [];
            if (querySnapshot.size > 0) {
                querySnapshot.forEach((doc) => {
                    const data = doc.data() as Post;
                    // Create DocumentResponse object with all required fields
                    const responseObj: DocumentResponse = {
                        id: doc.id,
                        caption: data.caption || "",
                        likes: data.likes || 0,
                        userlikes: data.userlikes || [],
                        username: data.username || "",
                        photoURL: data.photoURL || "",
                        userID: data.userID || "",
                        date: data.date || new Date()
                        // Add any other required fields for DocumentResponse
                    };
                    console.log("The response object is : ", responseObj);
                    tempArr.push(responseObj);
                });
                setData(tempArr);
            } else {
                console.log("No such document");
            }
        } catch (error) {
            console.log(error);
        }
    }
    
    // Fetch comments for specific posts
    const fetchCommentsForPosts = async (postIds: string[]) => {
        try {
            const allComments = await getComment();
            if (allComments && allComments.length > 0) {
                // Filter comments that belong to the user's posts
                const relevantComments = allComments.filter(comment => 
                    postIds.includes(comment.postID!)
                );
                setCommentData(relevantComments);
                console.log("Filtered comments:", relevantComments);
            }
        } catch (error) {
            console.log("Error fetching comments:", error);
        }
    };

    const renderPosts = () => {
        return data.map((data) => {
            const postComments = commentData.filter((item) => item.postID === data.id);
            return ( 
                <div className="w-full" key={data.id}>
                    <Card className='mb-6'>
                        <CardHeader className='flex flex-col'>
                            <CardTitle className='text-sm flex justify-start items-center'>
                                <span>
                                    <img src={userInfo.photoURL ? userInfo.photoURL: avatar}
                                    className='w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-slate-800 object-cover'
                                    alt="User avatar"/>
                                </span>
                                <span className='ml-2'>{userInfo.displayName}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="border p-5 mr-5  ml-5 rounded-2xl">
                            <div>
                                {data.caption}
                            </div>
                        </CardContent>
                        <div className="flex flex-row items-center px-3 sm:px-6 pb-2">
                        
                        </div>
                        <CardFooter className="px-3 sm:px-6 pt-0 pb-3 sm:pb-6 block">
                            <div className="flex flex-col bg-gray-100 rounded w-full mt-2">
                                <div className="m-2">Comments</div>
                                {/* Render comments for this post */}
                                {postComments.length > 0 ? (
                                    <div className=" border p-5 mr-5  ml-5 rounded-2xl space-y-2 px-2 sm:px-3 pb-2 sm:pb-3">
                                        {postComments.map((item) => (
                                            <CommentCard data={item} key={item.id}/>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-3 text-sm text-gray-500">No comments yet</div>
                                )}
                            </div>  
                        </CardFooter>
                    </Card>
                </div>
            );
        });
    };

    const getUserProfileInfo = async (userId: string) => {
        const data: ProfileResponse = (await getUserProfile(userId)) || {};
        if (data.displayName) {
            setUserInfo(data);
        }
    };
    
    // First effect to fetch posts when user is available
    React.useEffect(() => {
        if (user != null) {
            getAllPost(user.uid);
            getUserProfileInfo(user.uid);
        }
    }, [user]);
    
    // Second effect to fetch comments when posts are loaded
    React.useEffect(() => {
        if (data.length > 0) {
            const postIds = data.map(post => post.id);
            fetchCommentsForPosts(postIds);
        }
    }, [data]);
    
    const editProfile = () => {
        navigate("/editprofile", { state: userInfo });
    };

    return (
        <Layout>
            <div className="flex justify-center px-4 sm:px-6">
                <div className="border w-full max-w-3xl">
                    <h3 className='bg-slate-800 text-white text-center text-lg p-2'>
                        Profile
                    </h3>
                    <div className="p-4 sm:p-8 pb-4 border-b">
                        {/* Profile header - made responsive for small screens */}
                        <div className="flex flex-col sm:flex-row items-center pb-2 mb-3">
                            <div className="mb-4 sm:mb-0 sm:mr-4">
                                <img 
                                    src={userInfo.photoURL ? userInfo.photoURL: avatar} 
                                    alt="Avatar" 
                                    className='w-20 h-20 sm:w-28 sm:h-28 rounded-full border-2 border-slate-800 object-cover' 
                                />
                            </div>
                            <div className='flex-col justify-start text-center sm:text-left'>
                                <div className="text-lg sm:text-xl">{userInfo.displayName}</div>
                                <div className="text-sm sm:text-base overflow-hidden text-ellipsis">{user?.email ? user.email :""}</div>
                            </div>
                        </div>
                        <div className="mb-4 text-sm sm:text-base">{userInfo.userBio}</div>
                        <div className="flex justify-center sm:justify-start">
                            <Button onClick={editProfile} size="sm" className="w-full sm:w-auto">
                                <Edit2Icon className='mr-2 h-4 w-4'/> Edit Profile
                            </Button>
                        </div>
                    </div>
                    <div className="p-4 sm:p-8">
                        <h2 className="mb-4 sm:mb-5 text-lg sm:text-xl font-medium">My Posts</h2>
                        {/* Single column layout for all screen sizes */}
                        <div className="grid grid-cols-1 gap-4 sm:gap-6">
                            {data.length > 0 ? renderPosts() : <div className="text-center text-gray-500">No posts yet</div>}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Profile;