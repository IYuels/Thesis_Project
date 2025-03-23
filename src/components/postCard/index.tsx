import { useUserAuth } from '@/context/userAuthContext';
import { Comment, DocumentResponse, NotificationType, ToxicityData, CensorLevel } from '@/types';
import * as React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { MessageCircleMore, ThumbsUpIcon, AlertTriangle, EyeOffIcon, EyeIcon, ClockIcon, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateLikesOnPost } from '@/repository/post.service';
import { createComment, getComment } from '@/repository/comment.service';
import { createNotification } from '@/repository/notification.service';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import avatar from "@/assets/images/avatar.png";
import CommentCard from '../comment';
import { checkToxicity, censorText } from '@/repository/toxicity.service';
import ToxicityWarningModal from '../toxicityWarningModal';
import { subscribeToUserProfile } from '@/repository/user.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    const [censorLevel, setCensorLevel] = React.useState<CensorLevel>(CensorLevel.AUTO);
    
    // Comment state
    const [isVisible, setIsVisible] = React.useState(false);
    const [showAllComments, setShowAllComments] = React.useState(false);
    const [postDisplayData, setPostDisplayData] = React.useState({
        username: data.username || "Guest_User",
        photoURL: data.photoURL || avatar
    });
    
    // Enhanced toxicity state with improved data structure
    const [commentToxicity, setCommentToxicity] = React.useState<ToxicityData | null>(null);
    
    // Determine if post has toxicity data and is toxic
    const hasToxicityWarning = data.toxicity && data.toxicity.is_toxic;
    
    // Get toxicity level
    const getToxicityLevel = (): 'not toxic' | 'toxic' | 'very toxic' => {
        if (!data.toxicity || !data.toxicity.is_toxic) {
            return 'not toxic';
        }
        return data.toxicity.toxicity_level || 'toxic';
    };
    
    // Get appropriate icon based on toxicity level
    const getToxicityIcon = () => {
        const level = getToxicityLevel();
        switch (level) {
            case 'very toxic':
                return <ShieldAlert className="h-5 w-5 text-red-500" />;
            case 'toxic':
            default:
                return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
        }
    };
    
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

    // Enhanced toxicity check function with improved error handling and caching
    const performToxicityCheck = async (text: string) => {
        // Skip empty text check
        if (!text.trim()) {
            return null;
        }
        
        // Use cache when available
        if (toxicityCache.current.has(text)) {
            return toxicityCache.current.get(text);
        }
        
        try {
            setIsCheckingToxicity(true);
            
            // Add timeout to prevent hanging API calls
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const result = await Promise.race([
                checkToxicity(text),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Toxicity check timed out")), 5000)
                )
            ]);
            
            clearTimeout(timeoutId);
            toxicityCache.current.set(text, result);
            return result;
        } catch (error) {
            console.warn("Toxicity check failed or timed out, returning safe default");
            return {
                summary: { 
                    is_toxic: false, 
                    toxicity_level: 'not toxic',
                    detected_categories: [] 
                },
                results: {},
                censored_text: text
            };
        } finally {
            setIsCheckingToxicity(false);
        }
    };
    
    // Enhanced censorText function with configurable censoring level
    const getCensoredText = async (text: string): Promise<string> => {
        const cachedResult = toxicityCache.current.get(text);
        if (cachedResult && cachedResult.censored_text) {
            return cachedResult.censored_text;
        }
        
        try {
            // Add a timeout for the censor call and use selected censor level
            const result = await Promise.race([
                censorText(text, censorLevel),
                new Promise<{censored_text: string}>((resolve) => 
                    setTimeout(() => resolve({censored_text: text}), 3000)
                )
            ]);
            return result.censored_text;
        } catch (error) {
            return text;
        }
    };
    
    // Enhanced handleCommentChange with improved toxicity detection
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
            setCommentToxicity(null);
            return;
        }
        
        // Use debouncing to avoid excessive API calls
        toxicityTimeoutRef.current = setTimeout(async () => {
            setIsCheckingToxicity(true);
            try {
                const result = await performToxicityCheck(newComment);
                
                if (result && result.summary.is_toxic) {
                    // Convert to our standardized ToxicityData format
                    setCommentToxicity({
                        is_toxic: result.summary.is_toxic,
                        toxicity_level: result.summary.toxicity_level || 'toxic',
                        detected_categories: result.summary.detected_categories || [],
                        results: result.results || {}
                    });
                } else {
                    setCommentToxicity(null);
                }
            } catch (err) {
                // Silent error handling
                setCommentToxicity(null);
            } finally {
                setIsCheckingToxicity(false);
            }
        }, 500);
    };
    
    // Enhanced handleSubmit with improved toxicity handling
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
            
            // If no toxicity result, try simple censoring as fallback
            if (!toxicityResult) {
                const censorResult = await censorText(comment.caption, censorLevel);
                
                toxicityResult = {
                    summary: {
                        is_toxic: censorResult.is_toxic,
                        toxicity_level: censorResult.is_toxic ? 'toxic' : 'not toxic',
                        detected_categories: []
                    },
                    results: {},
                    censored_text: censorResult.censored_text
                };
            }
            
            // Create toxicity data in standardized format
            const toxicityData: ToxicityData = {
                is_toxic: toxicityResult.summary.is_toxic,
                toxicity_level: toxicityResult.summary.toxicity_level || 'toxic',
                detected_categories: toxicityResult.summary.detected_categories || [],
                results: toxicityResult.results || {}
            };
            
            // Post the comment with toxicity data
            await postComment(toxicityData);
            
        } catch (error) {
            console.error("Error checking toxicity:", error);
            // Post without toxicity data if check fails
            await postComment(null);
        } finally {
            setIsCheckingToxicity(false);
        }
    };
    
    // Enhanced postComment with improved toxicity handling
    const postComment = async (toxicityData: ToxicityData | null = null) => {
        if(user != null) {
            const originalText = comment.caption; // Always store the original text
            let postText = comment.caption;
            let isToxic = false;
            
            // First, determine if content is toxic
            if (toxicityData && toxicityData.is_toxic === true) {
                isToxic = true;
                
                // If toxic, use censored text if available in toxicityData
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
                toxicity: toxicityData
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
    
    // Logging toxicity data for debugging
    React.useEffect(() => {
        console.log("Post processing:", {
            caption: data.caption,
            originalCaption: data.originalCaption,
            isToxic: data.toxicity?.is_toxic,
            toxicityLevel: data.toxicity?.toxicity_level,
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
    
    // Helper function to format date
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
      
    // Debug logging for date information
    React.useEffect(() => {
        console.log("Post date data:", {
          rawDate: data.date,
          hasDate: !!data.date,
          typeOfDate: data.date ? typeof data.date : 'undefined'
        });
    }, [data]);
    
    // UI for selecting censor level
    const CensorLevelSelector = () => {
        if (!commentToxicity) return null;
        
        return (
            <div className="mt-1 mb-2">
                <Select
                    value={censorLevel}
                    onValueChange={(value) => setCensorLevel(value as CensorLevel)}
                >
                    <SelectTrigger className="h-8 text-xs bg-white w-40">
                        <SelectValue placeholder="Censoring level" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={CensorLevel.AUTO}>Auto</SelectItem>
                        <SelectItem value={CensorLevel.LIGHT}>Light</SelectItem>
                        <SelectItem value={CensorLevel.MEDIUM}>Medium</SelectItem>
                        <SelectItem value={CensorLevel.HEAVY}>Heavy</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        );
    };
    
    // Component to show toxicity status while typing
    const CommentToxicityIndicator = () => {
        if (isCheckingToxicity) {
            return (
                <div className="text-xs text-gray-500 mt-1 flex items-center">
                    <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Checking content...
                </div>
            );
        }
        
        if (commentToxicity) {
            const getIndicatorByLevel = () => {
                switch (commentToxicity.toxicity_level) {
                    case 'very toxic':
                        return (
                            <div className="text-xs text-red-500 mt-1 flex items-center">
                                <ShieldAlert className="h-3 w-3 mr-1" />
                                Very toxic content - will be censored
                            </div>
                        );
                    case 'toxic':
                    default:
                        return (
                            <div className="text-xs text-yellow-500 mt-1 flex items-center">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Potentially inappropriate content - will be censored
                            </div>
                        );
                }
            };
            
            return getIndicatorByLevel();
        }
        
        return null;
    };
    
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
                        
                        {/* Enhanced toxicity warning icon based on toxicity level */}
                        {hasToxicityWarning && (
                        <button 
                            onClick={() => setShowToxicityWarningModal(true)}
                            className="focus:outline-none"
                            title={`Content warning: ${getToxicityLevel()}`}
                        >
                            {getToxicityIcon()}
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
                                                        {/* Add toxicity indicator here */}
                                                        <CommentToxicityIndicator />
                                                        
                                                        {/* Add censor level selector here */}
                                                        {commentToxicity && <CensorLevelSelector />}
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

                {/* Updated toxicity warning modal with enhanced toxicity data */}
                <ToxicityWarningModal
                  isOpen={showToxicityWarningModal}
                  onClose={() => setShowToxicityWarningModal(false)}
                  toxicityData={data.toxicity as ToxicityData}
                />
            </div>
        </div>
    );
};

export default PostCard;