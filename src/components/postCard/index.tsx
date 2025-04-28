import { useUserAuth } from '@/context/userAuthContext';
import { Comment, DocumentResponse, NotificationType, ToxicityData } from '@/types';
import * as React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { 
    MessageCircleMore, 
    ThumbsUpIcon, 
    AlertTriangle, 
    EyeOffIcon, 
    EyeIcon, 
    ClockIcon, 
    MoreVertical, 
    ShieldAlert,
    ShieldCheck 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { deletePost, updateLikesOnPost } from '@/repository/post.service';
import { createComment, getComment } from '@/repository/comment.service';
import { createNotification } from '@/repository/notification.service';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import avatar from "@/assets/images/avatar.png";
import CommentCard from '../comment';
import { checkToxicity, censorText } from '@/repository/toxicity.service';
import ToxicityWarningModal from '../toxicityWarningModal';
import { subscribeToUserProfile } from '@/repository/user.service';
import { toast } from 'sonner';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

// Define the toxicity level types using the standard types from ToxicityData
type ToxicityLevel = 'not toxic' | 'toxic' | 'very toxic';

// Map toxicity levels to colors for UI elements
const TOXICITY_COLORS: Record<ToxicityLevel, string> = {
    'not toxic': 'text-green-500',
    'toxic': 'text-orange-500',
    'very toxic': 'text-red-500'
};

interface IPostCardProps {
    data: DocumentResponse;
}

const PostCard: React.FunctionComponent<IPostCardProps> = ({data}) => {
    const [showOriginalContent, setShowOriginalContent] = React.useState(false);
    
    // Toxicity detection state and refs - using the standard ToxicityData from types
    const toxicityCache = React.useRef<Map<string, ToxicityData>>(new Map());
    const [isCheckingToxicity, setIsCheckingToxicity] = React.useState(false);
    const [showToxicityWarningModal, setShowToxicityWarningModal] = React.useState(false);
    const [isContentChecked, setIsContentChecked] = React.useState(false);
    
    // Comment state
    const [isVisible, setIsVisible] = React.useState(false);
    const [showAllComments, setShowAllComments] = React.useState(false);
    const [postDisplayData, setPostDisplayData] = React.useState({
        username: data.username || "Guest_User",
        photoURL: data.photoURL || avatar
    });
    
    // Toxicity state using the standard ToxicityData
    const [commentToxicity, setCommentToxicity] = React.useState<ToxicityData | null>(null);
    
    // Delete post modal state
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    
    // Determine if post has toxicity data and is toxic
    const hasToxicity = React.useMemo(() => {
        return Boolean(data.toxicity && 
               typeof data.toxicity === 'object' && 
               data.toxicity.summary?.is_toxic === true);
    }, [data.toxicity]);
    
    // Get toxicity level with improved error handling
    const getToxicityLevel = (): ToxicityLevel => {
        if (!data.toxicity || typeof data.toxicity !== 'object' || !data.toxicity.summary) {
            return 'not toxic';
        }
        
        const level = data.toxicity.summary.toxicity_level;
        if (level === 'toxic' || level === 'very toxic') {
            return level;
        }
        
        return 'not toxic';
    };
    
    // Get detected categories from toxicity data
    const getDetectedCategories = (): string[] => {
        if (!data.toxicity || typeof data.toxicity !== 'object' || !data.toxicity.summary) {
            return [];
        }
        
        return data.toxicity.summary.detected_categories || [];
    };
    
    // Get appropriate toxicity icon based on level
    const getToxicityIcon = () => {
        const level = getToxicityLevel();
        
        switch (level) {
            case 'very toxic':
                return <ShieldAlert className="h-5 w-5 text-red-500" />;
            case 'toxic':
                return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            default:
                return <ShieldCheck className="h-5 w-5 text-green-500" />;
        }
    };
    
    // Get appropriate background color for highlighted content
    const getContentHighlightClass = () => {
        if (!showOriginalContent) return "";
        
        const level = getToxicityLevel();
        
        switch (level) {
            case 'very toxic':
                return "bg-red-50 p-1 rounded";
            case 'toxic':
                return "bg-yellow-50 p-1 rounded";
            default:
                return "";
        }
    };
    
    // Get tooltip text based on toxicity level
    const getToxicityTooltip = () => {
        const level = getToxicityLevel();
        const categories = getDetectedCategories();
        const categoryText = categories.length > 0 
            ? `Detected: ${categories.join(', ')}`
            : '';
        
        switch (level) {
            case 'very toxic':
                return `Very Toxic Content ${categoryText ? '- ' + categoryText : ''} - Click for details`;
            case 'toxic':
                return `Potentially Toxic Content ${categoryText ? '- ' + categoryText : ''} - Click for details`;
            default:
                return "Content passed moderation checks";
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

    // Toxicity check function using the updated toxicity service
    const performToxicityCheck = async (text: string): Promise<ToxicityData | null> => {
        // Skip empty text check
        if (!text.trim()) {
            return null;
        }
        
        // Use cache when available
        if (toxicityCache.current.has(text)) {
            return toxicityCache.current.get(text)!;
        }
        
        try {
            setIsCheckingToxicity(true);
            
            // Use the toxicity service directly
            const result = await checkToxicity(text);
            
            // Store in cache for future use
            toxicityCache.current.set(text, result);
            return result;
        } catch (error) {
            console.warn("Toxicity check failed:", error);
            return null;
        } finally {
            setIsCheckingToxicity(false);
        }
    };
    
    // Modified handleCommentChange - only reset toxicity state when content changes
    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newComment = e.target.value;
        setComment({...comment, caption: newComment});
        
        // Reset the content checked state when the comment changes
        if (isContentChecked) {
            setIsContentChecked(false);
            setCommentToxicity(null);
        }
    };
    
    // Function to check toxicity when the button is clicked
    const handleCheckToxicity = async () => {
        if (!comment.caption.trim() || isCheckingToxicity) {
            return;
        }
        
        setIsCheckingToxicity(true);
        
        try {
            const result = await performToxicityCheck(comment.caption);
            setCommentToxicity(result);
            
            // If toxic content is detected, show a toast notification
            if (result && result.summary && result.summary.is_toxic) {
                toast.success(`Your comment contains ${result.summary.toxicity_level} content. It will be censored if posted.`)
            }
            
            // Mark content as checked
            setIsContentChecked(true);
        } catch (error) {
            console.error("Error checking toxicity:", error);
            setCommentToxicity(null);
            setIsContentChecked(true);
            toast.error("Failed to analyze content for toxicity");
        } finally {
            setIsCheckingToxicity(false);
        }
    };
    
    // Modified handleSubmit for two-step process
    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if(user == null || !comment.caption?.trim()) {
            return;
        }
        
        // If content hasn't been checked yet, check it first
        if (!isContentChecked) {
            await handleCheckToxicity();
            return;
        }
        
        // Content has been checked, proceed with posting
        try {
            // Get the toxicity result we already have
            let toxicityData = commentToxicity;
            
            // Create and post the comment
            const originalText = comment.caption;
            let postText = comment.caption;
            let isToxic = false;
            
            if (toxicityData && toxicityData.summary && toxicityData.summary.is_toxic === true) {
                isToxic = true;
                
                // Use cached censored text if available
                if (toxicityData.censored_text) {
                    postText = toxicityData.censored_text;
                } else {
                    // Get censored text if not available
                    const censorResult = await censorText(comment.caption);
                    postText = censorResult.censored_text || comment.caption;
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
                toxicity: toxicityData || null
            };
            
            await createComment(newPost);
            await handleComment(newPost.caption);
            getAllComment();
            
            // Reset states
            setComment({...comment, caption: ''});
            setCommentToxicity(null);
            setIsContentChecked(false);
            
            // Show success toast
            toast.success("Comment posted successfully");
            
        } catch (error) {
            console.error("Failed to post comment:", error);
            toast.error("Failed to post comment");
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
        
        // Clean up cache if it gets too large to prevent memory issues
        return () => {
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
            
            // Explicitly format to mm/dd/yyyy HH:MM AM/PM
            const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const day = dateObj.getDate().toString().padStart(2, '0');
            const year = dateObj.getFullYear();
            
            // Format time with 12-hour clock and AM/PM
            let hours = dateObj.getHours();
            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            
            // Convert to 12-hour format
            hours = hours % 12;
            hours = hours ? hours : 12; // handle midnight (0 hours)
            const formattedHours = hours.toString().padStart(2, '0');
            
            return `${month}/${day}/${year} ${formattedHours}:${minutes} ${ampm}`;
        } catch (error) {
            console.error("Error formatting date:", error);
            return ''; // Return empty string if formatting fails
        }
    };
    
    // Component to show toxicity status after checking
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
        
        if (isContentChecked && commentToxicity && commentToxicity.summary && commentToxicity.summary.is_toxic) {
            const level = commentToxicity.summary.toxicity_level || 'toxic';
            const colorClass = TOXICITY_COLORS[level as ToxicityLevel] || 'text-yellow-500';
            
            return (
                <div className={`text-xs ${colorClass} mt-1 flex items-center`}>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    This comment contains {level} content and will be censored.
                </div>
            );
        }
        
        if (isContentChecked) {
            return (
                <div className="text-xs text-green-500 mt-1 flex items-center">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Content checked - ready to post.
                </div>
            );
        }
        
        return null;
    };
    
    // Handle post deletion
    const handleDeletePost = async () => {
        try {
            await deletePost(data.id!);
            toast.success("Post deleted successfully");
            window.location.reload(); // Refresh the page after deletion
        } catch (error) {
            console.error("Failed to delete post:", error);
            toast.error("Failed to delete post");
        }
    };

    // Post action menu for options like delete
    const PostActionMenu = () => {
        // Only show if user is the owner of the post
        if (user?.uid !== data.userID) return null;
        
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="focus:outline-none">
                        <MoreVertical className="h-5 w-5 text-gray-500 hover:text-gray-700" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem 
                        className="text-red-500 focus:text-red-500 cursor-pointer"
                        onClick={() => setShowDeleteModal(true)}
                    >
                        Delete Post
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };
    
    // Determine button text based on state
    const getButtonText = () => {
        if (isCheckingToxicity) {
            return 'Checking...';
        }
        if (!isContentChecked) {
            return 'Check';
        }
        return 'Post';
    };
    
    return(
        <div className="flex justify-center w-full px-2 sm:px-4">
            <div className="w-full max-w-3xl">
                <Card className="mb-6 border-2 bg-white border-white shadow-lg">
                    <CardHeader className="p-3 sm:p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-center">
                            <div className="flex items-center w-full">
                                <span className="mr-2">
                                    <img 
                                        src={postDisplayData.photoURL}
                                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-transparent object-cover"
                                        alt={`${postDisplayData.username}'s profile`}
                                    />
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-xs sm:text-sm font-medium">{postDisplayData.username}</span>
                                    {data.date && (
                                        <div className="text-xs text-gray-500 flex items-center">
                                            <ClockIcon className="h-3 w-3 mr-1" />
                                            <span>
                                                {formatDate(data.date)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 ml-auto">
                                {/* Updated Toxicity indicator with tooltip */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button 
                                                onClick={() => hasToxicity ? setShowToxicityWarningModal(true) : undefined}
                                                className="focus:outline-none"
                                                title="Content moderation status"
                                            >
                                                {getToxicityIcon()}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{getToxicityTooltip()}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                
                                <PostActionMenu />
                            </div>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="px-3 sm:px-6 pb-3">
                        <div className="border border-sky-600 rounded p-3 sm:p-5 text-sm sm:text-base">
                            {hasToxicity ? (
                                <div>
                                    <div className="flex flex-wrap items-center mb-1 space-x-2">  
                                    {data.originalCaption && data.originalCaption !== data.caption && (
                                        <button 
                                            onClick={toggleContentView}
                                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                                            title={showOriginalContent ? "Show censored version" : "Show original content"}
                                        >
                                                {showOriginalContent ? (
                                                    <>
                                                        <EyeOffIcon className="h-3 w-3 mr-1" />
                                                        <span>Hide original</span>
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
                                    <div className={getContentHighlightClass()}>
                                        {contentToShow}
                                    </div>
                                </div>
                            ) : (
                                data.caption
                            )}
                        </div>
                    </CardContent>
                    
                    <div className="flex flex-row items-center justify-between px-3 sm:px-6 pb-2">
                        <div className="flex items-center space-x-2">
                            <ThumbsUpIcon 
                                className={cn(
                                    "w-5 h-5 sm:w-6 sm:h-6",
                                    "cursor-pointer", 
                                    likesInfo.isLike ? "fill-blue-500" : "fill-none"
                                )}
                                onClick={() => updateLike(!likesInfo.isLike)}
                            />
                            <MessageCircleMore 
                                className="w-5 h-5 sm:w-6 sm:h-6 cursor-pointer" 
                                onClick={toggleVisibility}
                            />
                            <div className="text-xs sm:text-sm">{likesInfo.likes} likes</div>
                        </div>
                    </div>

                    <CardFooter className="px-3 sm:px-6 pt-0 pb-3 sm:pb-6 block">
                        {isVisible && (
                            <div className="flex flex-col bg-gray-100 rounded w-full">
                                <div className="w-full">
                                    <div className="m-2 sm:m-3">
                                        <div className="rounded border border-gray-100 shadow-lg bg-white">
                                            <div className="p-2 sm:p-3">
                                                <form onSubmit={handleSubmit}>
                                                    <div className="space-y-2">
                                                        <Textarea 
                                                            className="text-sm min-h-[60px] sm:min-h-[80px] resize-none w-full"
                                                            maxLength={1800}
                                                            id="caption"
                                                            placeholder="Write a comment"
                                                            value={comment.caption}
                                                            onChange={handleCommentChange}
                                                        />
                                                        <CommentToxicityIndicator />
                                                        
                                                        <div className="flex justify-end">
                                                            <Button 
                                                                className={`text-xs sm:text-sm py-1 px-3 h-8 cursor-pointer ${
                                                                    !isContentChecked 
                                                                    ? 'bg-blue-500 hover:bg-blue-600' 
                                                                    : 'bg-green-500 hover:bg-green-600'
                                                                }`}
                                                                type="submit"
                                                                disabled={isCheckingToxicity || comment.caption?.trim() === ''}
                                                                onClick={() => isContentChecked ? undefined : handleCheckToxicity()}
                                                            >
                                                                {getButtonText()}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {postComments.length > 0 && (
                            <div className="bg-gray-50 p-2 sm:p-3 rounded mb-2">
                                <CommentCard data={postComments[0]} key={postComments[0].id}/>
                                
                                {postComments.length > 1 && showAllComments && (
                                    <div className="mt-2 space-y-2 pt-2 border-t border-gray-200">
                                        {postComments.slice(1).map((item) => (
                                            <CommentCard 
                                            data={item} 
                                            key={item.id}
                                            currentUserProfile={data && data.id === item.userID ? {
                                                displayName: data.username || "Guest_User",
                                                photoURL: data.photoURL || avatar
                                            } : undefined}
                                        />
                                        ))}
                                    </div>
                                )}
                                
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

                {/* Toxicity Warning Modal */}
                <ToxicityWarningModal
                    isOpen={showToxicityWarningModal}
                    onClose={() => setShowToxicityWarningModal(false)}
                    toxicityData={data.toxicity as ToxicityData}
                />

                {/* Delete Post Confirmation Modal */}
                <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                    <AlertDialogContent className='bg-white'>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Post</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this post? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                className="bg-red-500 hover:bg-red-600"
                                onClick={handleDeletePost}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default PostCard;