import { useUserAuth } from '@/context/userAuthContext';
import { Comment, DocumentResponse, NotificationType } from '@/types';
import * as React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { MessageCircleMore, ThumbsUpIcon, AlertTriangle, EyeOffIcon, EyeIcon, ClockIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateLikesOnPost } from '@/repository/post.service';
import { createComment, getComment } from '@/repository/comment.service';
import { createNotification } from '@/repository/notification.service'; // Import the notification service
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import avatar from "@/assets/images/avatar.png";
import CommentCard from '../comment';
import { checkToxicity, censorText } from '@/repository/toxicity.service';
import ToxicityWarningModal from '../toxicityWarningModal';
import { subscribeToUserProfile } from '@/repository/user.service';
interface IPostCardProps {
    data: DocumentResponse;
}

const PostCard: React.FunctionComponent<IPostCardProps> = ({data}) => {
    const [showOriginalContent, setShowOriginalContent] = React.useState(false);
    // Toxicity detection state and refs
    const toxicityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const toxicityCache = React.useRef<Map<string, any>>(new Map());
    const [isCheckingToxicity, setIsCheckingToxicity] = React.useState(false);
    const [showToxicityWarningModal, setShowToxicityWarningModal] = React.useState(false);
    
    // Comment state
    const [isVisible, setIsVisible] = React.useState(false);
    const [showAllComments, setShowAllComments] = React.useState(false);
    const [postDisplayData, setPostDisplayData] = React.useState({
        username: data.username || "Guest_User",
        photoURL: data.photoURL || avatar
    });
    
    // Comment toxicity state
    const [commentToxicity, setCommentToxicity] = React.useState<{
        is_toxic: boolean;
        detected_categories: string[];
        results: Record<string, { probability: number; is_detected: boolean }>;
        censored_text?: string | null;
    } | null>(null);
        
    // Determine if post has toxicity data and is toxic
    const hasToxicityWarning = data.toxicity && data.toxicity.is_toxic;
    
    const toggleVisibility = () => {
        setIsVisible(!isVisible);
    };

    const {user} = useUserAuth();
    const [likesInfo, setLikesInfo] = React.useState<{
        likes: number,
        isLike: boolean
    }>({
        likes: data.likes!,
        isLike: data.userlikes?.includes(user!.uid) ? true : false
    });


    React.useEffect(() => {
        let unsubscribe = () => {};
        
        // Only set up listener if this post belongs to a user
        if (data.userID) {
          // Set initial data from the post
          setPostDisplayData({
            username: data.username || "Guest_User",
            photoURL: data.photoURL || avatar
          });
          
          // Subscribe to real-time profile updates
          unsubscribe = subscribeToUserProfile(data.userID, (profileData) => {
            if (profileData && Object.keys(profileData).length > 0) {
              setPostDisplayData({
                username: profileData.displayName || "Guest_User",
                photoURL: profileData.photoURL || avatar
              });
            }
          });
        }
        
        // Clean up subscription when component unmounts
        return () => {
          unsubscribe();
        };
      }, [data.userID]);

      const toggleContentView = () => {
        const newValue = !showOriginalContent;
        console.log(`Toggling content view to: ${newValue ? 'original' : 'censored'}`);
        console.log("Original content:", data.originalCaption);
        console.log("Censored content:", data.caption);
        setShowOriginalContent(newValue);
    };

    const contentToShow = showOriginalContent && data.originalCaption 
    ? data.originalCaption
    : data.caption;

    const updateLike = async (isVal: boolean) => {
        setLikesInfo({
            likes: isVal ? likesInfo.likes + 1 : likesInfo.likes - 1,
            isLike: !likesInfo.isLike,
        });
        if(isVal){
            data.userlikes?.push(user!.uid);
            
            // Create a notification when a user likes a post (only if the post is not the user's own)
            if (data.userID !== user!.uid) {
                try {
                    await createNotification({
                        type: NotificationType.LIKE,
                        senderId: user!.uid,
                        senderName: user!.displayName || 'Anonymous',
                        senderPhoto: user!.photoURL || avatar,
                        recipientId: data.userID!, // Post owner's ID
                        postId: data.id!,
                        postContent: data.caption?.substring(0, 50) + (data.caption?.length > 50 ? '...' : ''),
                        read: false
                    });
                } catch (error) {
                    console.error('Error creating like notification:', error);
                }
            }
        } else {
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

    // Function to check toxicity with debouncing, caching, and basic client-side pre-screening
    const performToxicityCheck = async (text: string) => {
        // Use cache when available
        if (toxicityCache.current.has(text)) {
            return toxicityCache.current.get(text);
        }
        
        // Add timeout to prevent hanging API calls
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const result = await Promise.race([
                checkToxicity(text),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Toxicity check timed out")), 3000)
                )
            ]);
            
            clearTimeout(timeoutId);
            toxicityCache.current.set(text, result);
            return result;
        } catch (error) {
            console.warn("Toxicity check failed or timed out, returning safe default");
            return {
                summary: { is_toxic: false, detected_categories: [] },
                results: {},
                censored_text: text
            };
        }
    };
    
    // Improved censorText function with timeout
    const getCensoredText = async (text: string): Promise<string> => {
        const cachedResult = toxicityCache.current.get(text);
        if (cachedResult && cachedResult.censored_text) {
            return cachedResult.censored_text;
        }
        
        try {
            // Add a timeout for the censor call as well
            const result = await Promise.race([
                censorText(text),
                new Promise<{censored_text: string}>((resolve) => 
                    setTimeout(() => resolve({censored_text: text}), 3000)
                )
            ]);
            return result.censored_text;
        } catch (error) {
            return text;
        }
    };
    
    // Updated handleCommentChange function that just checks toxicity
    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newComment = e.target.value;
        setComment({...comment, caption: newComment});
        
        if (toxicityTimeoutRef.current) {
            clearTimeout(toxicityTimeoutRef.current);
        }
        
        // Clear toxicity warning when text changes significantly
        if (commentToxicity && Math.abs(newComment.length - comment.caption.length) > 5) {
            setCommentToxicity(null);
        }
        
        // Skip toxicity check for empty text
        if (!newComment.trim()) {
            setIsCheckingToxicity(false);
            return;
        }
        
        // Only perform debounced toxicity check, no longer showing warning UI
        toxicityTimeoutRef.current = setTimeout(async () => {
            // Only check if not already in cache
            if (!toxicityCache.current.has(newComment)) {
                setIsCheckingToxicity(true);
                try {
                    const result = await performToxicityCheck(newComment);
                    // Just cache the result, don't show any warnings
                    toxicityCache.current.set(newComment, result);
                } catch (err) {
                    // Silent error handling
                } finally {
                    setIsCheckingToxicity(false);
                }
            }
        }, 500);
    };
    
    // Updated handleSubmit function that posts with toxicity handling
    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if(user == null || !comment.caption?.trim()) {
            return;
        }
        
        setIsCheckingToxicity(true);
        
        try {
            let toxicityResult;
            
            if (toxicityCache.current.has(comment.caption)) {
                toxicityResult = toxicityCache.current.get(comment.caption);
            } else {
                toxicityResult = await performToxicityCheck(comment.caption);
            }
            
            const toxicityData = {
                is_toxic: toxicityResult.summary.is_toxic,
                detected_categories: toxicityResult.summary.detected_categories || [],
                results: toxicityResult.results || {},
                censored_text: toxicityResult.censored_text
            };
            
            // Always post the comment, regardless of toxicity
            await postComment(toxicityData);
            
        } catch (error) {
            // Silent error handling
            await postComment(null); // Post without toxicity data if check fails
        } finally {
            setIsCheckingToxicity(false);
        }
    };
    
    // Updated postComment function that handles toxicity internally
    const postComment = async (toxicityData: any = null) => {
        if(user != null) {
            const originalText = comment.caption; // Always store the original text
            let postText = comment.caption;
            let isToxic = false;
            
            // First, determine if content is toxic
            if (toxicityData && toxicityData.is_toxic === true) {
                isToxic = true;
                
                // If toxic, use censored text if available
                if (toxicityData.censored_text) {
                    postText = toxicityData.censored_text;
                } else {
                    // Get censored text if not available
                    postText = await getCensoredText(comment.caption);
                }
            }
            
            // Create comment with toxicity data
            const newPost: Comment = {
                ...comment,
                caption: postText, // Use censored text when appropriate
                originalCaption: isToxic ? originalText : null,
                postID: data.id!,
                userID: user?.uid,
                username: user.displayName!,
                photoURL: user.photoURL!,
                toxicity: toxicityData ? {
                    is_toxic: toxicityData.is_toxic,
                    detected_categories: toxicityData.detected_categories || [],
                    results: toxicityData.results || {}
                } : null
            };
            
            try {
                await createComment(newPost);
                await handleComment(newPost.caption);
                getAllComment();
                setComment({...comment, caption: ''});
                setCommentToxicity(null);
            } catch (error) {
                console.error("Failed to post comment:", error);
            }
        }
    };
        React.useEffect(() => {
            console.log("Comment processing:", {
                caption: data.caption,
                originalCaption: data.originalCaption,
                isToxic: data.toxicity?.is_toxic,
                hasDifferentContent: data.caption !== data.originalCaption,
                toxicityData: data.toxicity
            });
        }, [data]);
          
    const [commentData, setData] = React.useState<Comment[]>([]);
    
    const getAllComment = React.useCallback(async() => {
        const response = await getComment() || [];
        setData(response);
    }, []);
    
    React.useEffect(() => {
        if(user != null){
            getAllComment();
        }
        
        // Clean up toxicity check timer
        return () => {
            if (toxicityTimeoutRef.current) {
                clearTimeout(toxicityTimeoutRef.current);
            }
            
            // Clear cache if it gets too large to prevent memory issues
            if (toxicityCache.current.size > 50) {
                toxicityCache.current.clear();
            }
        };
    }, [user, getAllComment]);
    
    // Filter comments that belong to this post
    const postComments = commentData.filter((item) => item.postID === data.id);

    const handleComment = async (commentText: string) => {
        if (user && data.userID && data.userID !== user.uid) {
            try {
                if (!user) return;
                // Use the actual comment text passed as parameter
                await createNotification({
                    type: NotificationType.COMMENT,
                    senderId: user.uid,
                    senderName: user.displayName || 'Anonymous',
                    senderPhoto: user.photoURL || avatar,
                    recipientId: data.userID!,
                    postId: data.id!,
                    postContent: data.caption?.substring(0, 50) + (data.caption?.length > 50 ? '...' : ''),
                    commentContent: commentText.substring(0, 50) + (commentText.length > 50 ? '...' : ''),
                    read: false
                });
            } catch (error) {
                console.error('Error creating comment notification:', error);
            }
        }
    }
    
    const formatDate = (date: Date | string | { toDate: () => Date } | undefined | null) => {
        try {
          if (!date) return '';
          
          let dateObj: Date;
          
          // Handle Firestore timestamp objects
          if (typeof date === 'object' && date !== null && 'toDate' in date) {
            dateObj = date.toDate();
          }
          // Handle string dates
          else if (typeof date === 'string') {
            dateObj = new Date(date);
          }
          // Handle Date objects
          else if (date instanceof Date) {
            dateObj = date;
          }
          else {
            return '';
          }
          
          // Check if valid date
          if (isNaN(dateObj.getTime())) return '';
          
          // Format the date - can customize as needed
          return dateObj.toLocaleString(undefined, { 
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (error) {
          console.error("Error formatting date:", error);
          return ''; // Return empty string if formatting fails
        }
      };
      
      React.useEffect(() => {
        console.log("Comment date data:", {
          rawDate: data.date,
          hasDate: !!data.date,
          typeOfDate: data.date ? typeof data.date : 'undefined'
        });
      }, [data]);
    
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
                        <div className="flex flex-col">
                            <span className="text-xs sm:text-sm font-medium">{postDisplayData.username}</span>
                            {/* Add date display with safer conditional rendering */}
                            {data.date && (
                            <div className="text-xs text-gray-500 flex items-center mr-2">
                                <ClockIcon className="h-3 w-3 mr-1" />
                                <span>{formatDate(data.date) || 'Unknown'}</span>
                            </div>
                            )}
                        </div>
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
                            {/* Update this section to handle toxicity and original content */}
                            {hasToxicityWarning ? (
                                <div>
                                    <div className="flex items-center mb-1">  
                                        {/* Add toggle button if we have original content */}
                                        {data.originalCaption && (
                                            <button 
                                                onClick={toggleContentView}
                                                className="ml-2 text-xs text-gray-500 hover:text-gray-700 flex items-center"
                                                title={showOriginalContent ? "Show censored version" : "Show original content"}
                                            >
                                                {showOriginalContent ? (
                                                    <>
                                                        <EyeOffIcon className="h-3 w-3 mr-1" />
                                                        <span>Hide</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <EyeIcon className="h-3 w-3 mr-1" />
                                                        <span>Show original</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <div className={showOriginalContent ? "bg-yellow-50 p-1 rounded" : ""}>
                                        {contentToShow}
                                    </div>
                                </div>
                            ) : (
                                data.caption
                            )}
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
                        {/* Comment form - only visible when toggled */}
                        {isVisible && (
                            <div className="flex flex-col bg-gray-100 rounded w-full">
                                <div className="w-full">
                                    <div className="flex flex-col m-2 sm:m-3">
                                        <div className="border-radius rounded border border-gray-100 shadow-lg w-full bg-white">
                                            <div className="p-2 sm:p-3">
                                            <form onSubmit={handleSubmit}>
                                                    <div className="flex flex-col space-y-2">
                                                        <Textarea 
                                                            className="text-sm min-h-[60px] sm:min-h-[80px] resize-none"
                                                            maxLength={1800}
                                                            id="caption"
                                                            placeholder="Write a comment"
                                                            value={comment.caption}
                                                            onChange={handleCommentChange}
                                                        />
                                                        {isCheckingToxicity && (
                                                            <div className="text-xs text-gray-500">Checking content...</div>
                                                        )}
                                                    </div>
                                                    
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