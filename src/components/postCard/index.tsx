import { useUserAuth } from '@/context/userAuthContext';
import { Comment, DocumentResponse, NotificationType } from '@/types';
import * as React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { MessageCircleMore, ThumbsUpIcon, AlertTriangle, EyeOffIcon, EyeIcon } from 'lucide-react';
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
    const [showCommentToxicityWarning, setShowCommentToxicityWarning] = React.useState(false);
    
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

    // Profile listener management
    const listenerRegistered = React.useRef(false);

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
      }, [user, data.userID]);

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
        // Skip toxicity check for very short text
        if (text.trim().length < 5) {
            return {
                summary: { is_toxic: false, detected_categories: [] },
                results: {},
                censored_text: text
            };
        }
        
        // Simple client-side pre-check to avoid unnecessary API calls
        const commonOffensiveTerms = ['fuck', 'shit', 'ass', 'damn']; // Basic example
        const lowerText = text.toLowerCase();
        const probablyOffensive = commonOffensiveTerms.some(term => lowerText.includes(term));
        
        // If text is already in cache, return cached result
        if (toxicityCache.current.has(text)) {
            return toxicityCache.current.get(text);
        }
        
        // If text likely contains offensive content, prioritize checking
        if (probablyOffensive) {
            try {
                const result = await checkToxicity(text);
                toxicityCache.current.set(text, result);
                return result;
            } catch (error) {
                console.error("Error checking toxicity:", error);
                return {
                    summary: { is_toxic: false, detected_categories: [] },
                    results: {},
                    censored_text: text
                };
            }
        }
        
        // Otherwise, standard API call
        try {
            const result = await checkToxicity(text);
            toxicityCache.current.set(text, result);
            return result;
        } catch (error) {
            console.error("Error checking toxicity:", error);
            return {
                summary: { is_toxic: false, detected_categories: [] },
                results: {},
                censored_text: text
            };
        }
    };

    // Helper function to efficiently get censored text
    const getCensoredText = async (text: string): Promise<string> => {
        // Check cache first
        const cachedResult = toxicityCache.current.get(text);
        if (cachedResult && cachedResult.censored_text) {
            return cachedResult.censored_text;
        }
        
        try {
            const result = await censorText(text);
            return result.censored_text;
        } catch (error) {
            console.error("Error censoring text:", error);
            return text; // Return original if censoring fails
        }
    };

    // Handle comment change with efficient toxicity checking
    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newComment = e.target.value;
        setComment({...comment, caption: newComment});
        
        // Clear previous timer
        if (toxicityTimeoutRef.current) {
            clearTimeout(toxicityTimeoutRef.current);
        }
        
        // Reset toxicity state when input changes
        setShowCommentToxicityWarning(false);
        
        // Skip toxicity check for short comments
        if (!newComment.trim() || newComment.length < 20) {
            setCommentToxicity(null);
            setIsCheckingToxicity(false);
            return;
        }
        
        // Set debounced toxicity check
        setIsCheckingToxicity(true);
        toxicityTimeoutRef.current = setTimeout(async () => {
            try {
                // Use the cached/optimized toxicity check function
                const toxicityResult = await performToxicityCheck(newComment);
                
                // Format the toxicity data for the state
                const toxicityData = {
                    is_toxic: toxicityResult.summary.is_toxic,
                    detected_categories: toxicityResult.summary.detected_categories || [],
                    results: toxicityResult.results || {},
                    censored_text: toxicityResult.censored_text
                };
                
                setCommentToxicity(toxicityData);
                
                // Show warning only if toxic
                if (toxicityResult.summary.is_toxic) {
                    setShowCommentToxicityWarning(true);
                }
            } catch (error) {
                console.error("Toxicity check failed:", error);
                setCommentToxicity(null);
            } finally {
                setIsCheckingToxicity(false);
            }
        }, 800);
    };
    
    // Optimized comment submission handler
    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if(user == null || comment.caption?.trim() === '') {
            return;
        }
        
        // Cancel any pending toxicity check
        if (toxicityTimeoutRef.current) {
            clearTimeout(toxicityTimeoutRef.current);
            toxicityTimeoutRef.current = null;
        }
        
        // Check if we already have a cached result for this text
        if (toxicityCache.current.has(comment.caption)) {
            const cachedResult = toxicityCache.current.get(comment.caption);
            const toxicityData = {
                is_toxic: cachedResult.summary.is_toxic,
                detected_categories: cachedResult.summary.detected_categories || [],
                results: cachedResult.results || {},
                censored_text: cachedResult.censored_text
            };
            
            setCommentToxicity(toxicityData);
            
            // If toxic, show warning and don't post yet
            if (cachedResult.summary.is_toxic) {
                setShowCommentToxicityWarning(true);
                return;
            }
            
            // If not toxic, post the comment
            await postComment(toxicityData);
            return;
        }
        
        // If toxicity check is in progress or not yet done, run it now
        if (isCheckingToxicity || commentToxicity === null) {
            try {
                setIsCheckingToxicity(true);
                const toxicityResult = await performToxicityCheck(comment.caption);
                const toxicityData = {
                    is_toxic: toxicityResult.summary.is_toxic,
                    detected_categories: toxicityResult.summary.detected_categories || [],
                    results: toxicityResult.results || {},
                    censored_text: toxicityResult.censored_text
                };
                
                setCommentToxicity(toxicityData);
                
                if (toxicityResult.summary.is_toxic) {
                    setShowCommentToxicityWarning(true);
                    setIsCheckingToxicity(false);
                    return; // Stop here if toxic
                }
                
                // If not toxic, post the comment
                await postComment(toxicityData);
            } catch (error) {
                console.error("Toxicity check failed:", error);
                // Allow posting without toxicity data if check fails
                await postComment(null);
            } finally {
                setIsCheckingToxicity(false);
            }
            return;
        }
        
        // If comment was already checked and is toxic, prevent posting
        if (commentToxicity && commentToxicity.is_toxic) {
            setShowCommentToxicityWarning(true);
            return;
        }
        
        // Otherwise, post the comment with existing toxicity data
        await postComment(commentToxicity);
    };

   // This is the updated version of the postComment function in the PostCard component
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
            
            // Debug log
            console.log("Toxic comment detected:", {
                original: originalText,
                censored: postText,
                toxicity: toxicityData,
                is_toxic: isToxic
            });
        }
        
        // Create comment with toxicity data - FIXED HERE
        const newPost: Comment = {
            ...comment,
            caption: postText, // Use censored text when appropriate
            originalCaption: (toxicityData && toxicityData.is_toxic) ? originalText : null,
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
        
        // Add this debug log to verify originalCaption is being set properly
        console.log("Comment to be posted:", {
            caption: newPost.caption,
            originalCaption: newPost.originalCaption,
            isToxic: newPost.toxicity?.is_toxic,
            hasOriginalContent: newPost.originalCaption !== null && newPost.originalCaption !== newPost.caption
        });
        
        try {
            await createComment(newPost);
            getAllComment();
            setComment({...comment, caption: ''});
            setCommentToxicity(null);
            setShowCommentToxicityWarning(false);
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
    
    // Function to handle post anyway (when comment is toxic)
    const handlePostAnyway = async () => {
        if (commentToxicity) {
            await postComment(commentToxicity);
            setShowCommentToxicityWarning(false);
        }
    };
    
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
                                                            id="caption"
                                                            placeholder="Write a comment"
                                                            value={comment.caption}
                                                            onChange={handleCommentChange}
                                                        />
                                                        {isCheckingToxicity && (
                                                            <div className="text-xs text-gray-500">Checking content...</div>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Comment Toxicity Warning - Enhanced with censored preview */}
                                                    {showCommentToxicityWarning && commentToxicity && (
                                                        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
                                                            <div className="flex items-start">
                                                                <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                                                                <div>
                                                                    <h5 className="font-bold mb-1">Content Warning</h5>
                                                                    <p className="text-sm mb-2">
                                                                        Your comment may contain inappropriate content:
                                                                    </p>
                                                                    <div className="mb-2">
                                                                        <span className="font-medium">Categories: </span>
                                                                        {commentToxicity.detected_categories.join(', ')}
                                                                    </div>
                                                                    
                                                                    {/* Show preview of censored text if available */}
                                                                    {commentToxicity.censored_text && (
                                                                        <div className="mt-3 p-2 bg-white border border-gray-200 rounded mb-3">
                                                                            <p className="text-xs font-medium text-gray-700">If you proceed, your comment will be censored as:</p>
                                                                            <p className="text-sm mt-1 italic">{commentToxicity.censored_text}</p>
                                                                        </div>
                                                                    )}
                                                                    
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