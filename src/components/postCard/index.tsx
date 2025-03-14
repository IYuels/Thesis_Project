import { useUserAuth } from '@/context/userAuthContext';
import { Comment, DocumentResponse } from '@/types';
import * as React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { MessageCircleMore, ThumbsUpIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateLikesOnPost } from '@/repository/post.service';
import { createComment, getComment} from '@/repository/comment.service';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import avatar from "@/assets/images/avatar.png";
import CommentCard from '../comment';
import { checkToxicity } from '@/repository/toxicity.service'; // Import the toxicity service
import ToxicityWarningModal from '../toxicityWarningModal';

interface IPostCardProps {
    data: DocumentResponse;
}

const PostCard: React.FunctionComponent<IPostCardProps> = ({data}) => {
    
    const [showToxicityWarningModal, setShowToxicityWarningModal] = React.useState(false);
    const [isVisible, setIsVisible] = React.useState(false);
    const [showAllComments, setShowAllComments] = React.useState(false);
    const [showToxicityDetails, setShowToxicityDetails] = React.useState(false);
    const [postDisplayData, setPostDisplayData] = React.useState({
        username: data.username || "Guest_User",
        photoURL: data.photoURL || avatar
    });
    
    // Determine if post has toxicity data and is toxic
    const hasToxicityWarning = data.toxicity && data.toxicity.is_toxic;
    
    const toggleVisibility = () => {
        setIsVisible(!isVisible);
    };

    const {user, userProfile, registerProfileUpdateListener} = useUserAuth();
    const [likesInfo, setLikesInfo] = React.useState<{
        likes: number,
        isLike: boolean
    }>({
        likes: data.likes!,
        isLike: data.userlikes?.includes(user!.uid) ? true : false
    });

    // First, add this ref to prevent multiple registrations
const listenerRegistered = React.useRef(false);

// Replace the problematic useEffect with this optimized version
React.useEffect(() => {
  // Only register the listener once and only if this post belongs to the current user
  if (user && data.userID === user.uid && !listenerRegistered.current) {
    listenerRegistered.current = true;
    
    // Handle initial profile data
    if (userProfile) {
      setPostDisplayData({
        username: userProfile.displayName || "Guest_User",
        photoURL: userProfile.photoURL || avatar
      });
    }
    
    // Register listener only once
    const unsubscribe = registerProfileUpdateListener(() => {
      // Use functional state update to avoid dependency issues
      if (userProfile) {
        setPostDisplayData(prevData => {
          // Only update if values have actually changed
          if (prevData.username !== (userProfile.displayName || "Guest_User") || 
              prevData.photoURL !== (userProfile.photoURL || avatar)) {
            return {
              username: userProfile.displayName || "Guest_User",
              photoURL: userProfile.photoURL || avatar
            };
          }
          return prevData; // Return previous state if no changes needed
        });
      }
    });
    
    // Clean up function
    return () => {
      if (unsubscribe) {
        unsubscribe();
        listenerRegistered.current = false;
      }
    };
  }
  // Minimal dependency array - avoid including functions if possible
}, [user, data.userID]);


    const updateLike = async (isVal: boolean) => {
        setLikesInfo({
            likes: isVal ? likesInfo.likes + 1 : likesInfo.likes - 1,
            isLike: !likesInfo.isLike,
        });
        if(isVal){
            data.userlikes?.push(user!.uid);
        } else{
            data.userlikes?.splice(data.userlikes.indexOf(user!.uid), 1);
        }

        await updateLikesOnPost(data.id!, data.userlikes!, isVal ? likesInfo.likes + 1 : likesInfo.likes - 1);
    };

    const [comment, setComment] = React.useState<Comment>({
        postID: data.id!, // Initialize with the current post ID
        caption: '',
        likes: 0,
        userlikes: [],
        userID: null,
        date: new Date()
    });
    
    // State for comment toxicity check
    const [isCheckingToxicity, setIsCheckingToxicity] = React.useState(false);
    const [commentToxicity, setCommentToxicity] = React.useState<{
        is_toxic: boolean;
        detected_categories: string[];
        results: Record<string, { probability: number; is_detected: boolean }>;
    } | null>(null);
    const [showCommentToxicityWarning, setShowCommentToxicityWarning] = React.useState(false);
    
    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if(user != null && comment.caption?.trim() !== '') {
            // Check for toxicity before posting
            setIsCheckingToxicity(true);
            const toxicityResult = await checkToxicity(comment.caption!);
            setIsCheckingToxicity(false);
            
            // If toxic, show warning and store toxicity data
            if (toxicityResult.summary.is_toxic) {
                setCommentToxicity({
                    is_toxic: toxicityResult.summary.is_toxic,
                    detected_categories: toxicityResult.summary.detected_categories,
                    results: toxicityResult.results
                });
                setShowCommentToxicityWarning(true);
                return; // Don't post until user confirms
            }
            
            // If not toxic or user confirms to post anyway
            await postComment(toxicityResult);
        }
    };
    
    // Function to post comment after toxicity check
    const postComment = async (toxicityData: any = null) => {
        if(user != null) {
            // Create a properly structured toxicity object if toxicity data exists
            const toxicityObject = toxicityData ? {
                is_toxic: toxicityData.summary?.is_toxic || false,
                detected_categories: toxicityData.summary?.detected_categories || [],
                results: toxicityData.results || {}
            } : null;
            
            const newPost: Comment = {
                ...comment,
                postID: data.id!,
                userID: user?.uid,
                username: user.displayName!,
                photoURL: user.photoURL!,
                toxicity: toxicityObject
            };
            
            await createComment(newPost);
            // Instead of reloading the page, fetch comments again
            getAllComment();
            // Clear comment input and toxicity state
            setComment({...comment, caption: ''});
            setCommentToxicity(null);
            setShowCommentToxicityWarning(false);
        }
    };
    
    // Function to handle post anyway (when comment is toxic)
    const handlePostAnyway = () => {
        if (commentToxicity) {
            postComment({
                summary: {
                    is_toxic: commentToxicity.is_toxic,
                    detected_categories: commentToxicity.detected_categories
                },
                results: commentToxicity.results
            });
        }
    };
    
    const [commentData, setData] = React.useState<Comment[]>([]);
    
    const getAllComment = async() => {
        const response = await getComment() || [];
        setData(response);
    };
    
    React.useEffect(() => {
        if(user != null){
            getAllComment();
        }
    }, [])
    
    
    // Filter comments that belong to this post
    const postComments = commentData.filter((item) => item.postID === data.id);
    return(
        <div className="flex justify-center w-full px-2 sm:px-4">
            <div className="w-full max-w-3xl">
                <Card className="mb-6 border-2 bg-white border-white shadow-lg">
                    <CardHeader className="p-3 sm:p-6">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-sm flex items-center justify-start">
                                <span className="mr-2">
                                    <img 
                                        src={postDisplayData.photoURL}
                                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-transparent object-cover"
                                        alt={`${postDisplayData.username}'s profile`}
                                    />
                                </span>
                                <span className="text-xs sm:text-sm font-medium">{postDisplayData.username}</span>
                            </CardTitle>
                            
                            {/* Toxicity warning icon */}
                            {hasToxicityWarning && (
                            <button 
                                onClick={() => setShowToxicityWarningModal(true)}
                                className="text-yellow-500 hover:text-yellow-600 focus:outline-none"
                                title="Content warning"
                            >
                                <AlertTriangle className="h-5 w-5" />
                            </button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6 pb-3">
                        <div className="border border-sky-600 rounded p-3 sm:p-5 text-sm sm:text-base">
                            {data.caption}
                        </div>
                    </CardContent>
                    <div className="flex flex-row items-center px-3 sm:px-6 pb-2">
                        <ThumbsUpIcon 
                            className={cn(
                                "w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3",
                                "cursor-pointer", 
                                likesInfo.isLike ? "fill-blue-500" : "fill-none"
                            )}
                            onClick={() => updateLike(!likesInfo.isLike)}
                        />
                        <MessageCircleMore 
                            className="w-5 h-5 sm:w-6 sm:h-6 cursor-pointer" 
                            onClick={toggleVisibility}
                        />
                        <div className="text-xs sm:text-sm ml-3">{likesInfo.likes} likes</div>
                    </div>

                    <CardFooter className="px-3 sm:px-6 pt-0 pb-3 sm:pb-6 block">
                        {/* Display first comment always if it exists */}
                        {postComments.length > 0 && (
                            <div className="bg-gray-50 p-2 sm:p-3 rounded mb-2">
                                <CommentCard data={postComments[0]} key={postComments[0].id}/>
                                
                                {/* Show remaining comments conditionally */}
                                {postComments.length > 1 && showAllComments && (
                                    <div className="mt-2 space-y-2 pt-2 border-t border-gray-200">
                                        {postComments.slice(1).map((item) => (
                                            <CommentCard data={item} key={item.id}/>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Conditionally show the "See more" or "Show less" button */}
                                {postComments.length > 1 && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-xs sm:text-sm text-sky-700 hover:text-sky-800 w-full mt-2"
                                        onClick={() => setShowAllComments(!showAllComments)}
                                    >
                                        {showAllComments 
                                            ? "Show less" 
                                            : `See ${postComments.length - 1} more comment${postComments.length > 2 ? 's' : ''}`
                                        }
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Comment form - only visible when toggled */}
                        {isVisible && (
                            <div className="flex flex-col bg-gray-100 rounded w-full">
                                <div className="w-full">
                                    <div className="flex flex-col m-2 sm:m-3">
                                        <div className="border-radius rounded border border-gray-100 shadow-lg w-full bg-white">
                                            <div className="p-2 sm:p-3">
                                                <form onSubmit={handleSubmit}>
                                                    <div className="flex flex-col space-y-2">
                                                        <div className="flex items-center">
                                                        <img 
                                                            src={user?.photoURL ? user?.photoURL: avatar}
                                                            className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-slate-800 object-cover"
                                                            alt="Profile"
                                                        />
                                                        <span className="ml-2 text-xs sm:text-sm font-medium">{user?.displayName || "Guest_User"}</span>
                                                        </div>
                                                        <Textarea 
                                                            className="text-sm min-h-[60px] sm:min-h-[80px] resize-none"
                                                            id="caption"
                                                            placeholder="Write a comment"
                                                            value={comment.caption}
                                                            onChange={(e:React.ChangeEvent<HTMLTextAreaElement>) => 
                                                                setComment({...comment, caption: e.target.value})
                                                            }
                                                        />
                                                    </div>
                                                    
                                                    {/* Comment Toxicity Warning */}
                                                    {showCommentToxicityWarning && commentToxicity && (
                                                        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
                                                            <div className="flex items-start">
                                                                <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                                                                <div>
                                                                    <h5 className="font-semibold mb-1">Potential Content Warning</h5>
                                                                    <p className="text-sm mb-2">
                                                                        Your comment contains content that may be considered inappropriate:
                                                                    </p>
                                                                    <div className="mb-2">
                                                                        <span className="font-medium">Categories: </span>
                                                                        {commentToxicity.detected_categories.join(', ')}
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                                                        {Object.entries(commentToxicity.results)
                                                                            .filter(([_, values]) => values.probability > 0.2)
                                                                            .sort((a, b) => b[1].probability - a[1].probability)
                                                                            .map(([category, values]) => {
                                                                                // Check if category contains NOT_TOXIC (case insensitive)
                                                                                const isNotToxic = category.toUpperCase().includes("NOT_TOXIC");
                                                                                const textColorClass = isNotToxic 
                                                                                    ? "text-gray-600" 
                                                                                    : (values.is_detected ? "text-red-600" : "text-gray-600");
                                                                                
                                                                                return (
                                                                                    <div key={category} className="flex items-center justify-between">
                                                                                        <span>{category}:</span>
                                                                                        <span className={`font-medium ${textColorClass}`}>
                                                                                            {Math.round(values.probability * 100)}%
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                    </div>
                                                                    <div className="flex space-x-2">
                                                                        <Button 
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="text-xs"
                                                                            onClick={() => setShowCommentToxicityWarning(false)}
                                                                        >
                                                                            Edit Comment
                                                                        </Button>
                                                                        <Button 
                                                                            type="button"
                                                                            variant="destructive"
                                                                            size="sm"
                                                                            className="text-xs"
                                                                            onClick={handlePostAnyway}
                                                                        >
                                                                            Post Anyway
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex justify-end mt-2">
                                                        <Button 
                                                            className="text-xs sm:text-sm py-1 px-3 h-8 cursor-pointer hover:bg-sky-500" 
                                                            type="submit"
                                                            disabled={isCheckingToxicity || comment.caption?.trim() === ''}
                                                        >
                                                            {isCheckingToxicity ? 'Checking...' : 'Post'}
                                                        </Button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardFooter>
                </Card>

                <ToxicityWarningModal
                  isOpen={showToxicityWarningModal}
                  onClose={() => setShowToxicityWarningModal(false)}
                  toxicityData={data.toxicity}
                />

            </div>
        </div>
    );
    
};

export default PostCard;