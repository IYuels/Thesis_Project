import * as React from 'react';
import { useUserAuth } from '@/context/userAuthContext';
import { Comment } from '@/types';
import { deleteComment, updateLikesOnComment } from '@/repository/comment.service';
import { cn } from '@/lib/utils';
import { CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  ThumbsUpIcon, 
  AlertTriangle, 
  EyeIcon, 
  EyeOffIcon, 
  ClockIcon, 
  MoreVertical,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import avatar from "@/assets/images/avatar.png";
import ToxicityWarningModal from '../toxicityWarningModal';
import { subscribeToUserProfile } from '@/repository/user.service';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { toast } from 'sonner';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ICommentCardProps {
    data: Comment;
    onDelete?: () => void;
    currentUserProfile?: {
        displayName: string;
        photoURL: string;
    };
}

const CommentCard: React.FunctionComponent<ICommentCardProps> = ({ data, onDelete, currentUserProfile }) => {
    const [showToxicityWarningModal, setShowToxicityWarningModal] = React.useState(false);
    const { user, userProfile } = useUserAuth();
    const [showOriginalContent, setShowOriginalContent] = React.useState(false);
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    
    // Store the full profile response from subscription
    const [commentDisplayData, setCommentDisplayData] = React.useState({
        username: data.username || "Guest_User",
        photoURL: data.photoURL || avatar
    });
    
    // Set up the real-time listener once when component mounts
    React.useEffect(() => {
        let unsubscribe = () => {};
        
        // Only set up listener if this comment belongs to a user
        if (data.userID) {
            // Set initial data from the comment
            setCommentDisplayData({
                username: data.username || "Guest_User",
                photoURL: data.photoURL || avatar
            });
            
            // Subscribe to real-time profile updates
            unsubscribe = subscribeToUserProfile(data.userID, (profileData) => {
                if (profileData && Object.keys(profileData).length > 0) {
                    setCommentDisplayData({
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
    }, [data.userID, data.username, data.photoURL]);

    // Enhanced toxicity detection using ToxicityData from types.ts
    const hasToxicity = React.useMemo(() => {
        return Boolean(data.toxicity && 
               typeof data.toxicity === 'object' && 
               data.toxicity.is_toxic === true);
    }, [data.toxicity]);
    
    // Get toxicity level using the standardized format from types.ts
    const getToxicityLevel = (): 'not toxic' | 'toxic' | 'very toxic' => {
        if (!data.toxicity || typeof data.toxicity !== 'object') {
            return 'not toxic';
        }
        
        const level = data.toxicity.toxicity_level;
        if (level === 'toxic' || level === 'very toxic') {
            return level;
        }
        
        return 'not toxic';
    };
    
    // Get detected categories from toxicity data
    const getDetectedCategories = (): string[] => {
        if (!data.toxicity) {
            return [];
        }
        
        if (typeof data.toxicity !== 'object') {
            return [];
        }
        
        if (!Array.isArray(data.toxicity.detected_categories)) {
            return [];
        }
        
        return data.toxicity.detected_categories;
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
    
    // Check if we actually have different original content
    const hasOriginalContent = React.useMemo(() => {
        return data.originalCaption !== undefined && 
              data.originalCaption !== null && 
              data.originalCaption !== data.caption;
    }, [data.originalCaption, data.caption]);
    
    // Enhanced debug info for toxicity
    React.useEffect(() => {
        if (hasToxicity) {
            console.log("Comment with toxicity:", {
                id: data.id,
                caption: data.caption,
                originalCaption: data.originalCaption,
                hasToxicity,
                hasOriginalContent,
                toxicityLevel: getToxicityLevel(),
                detectedCategories: getDetectedCategories(),
                toxicityInfo: data.toxicity
            });
        }
    }, [data, hasToxicity, hasOriginalContent]);
    
    const isCurrentUserComment = data.userID === user?.uid;
    
    // Prefer real-time data from context for current user, or subscription data for other users
    const displayName = isCurrentUserComment && currentUserProfile?.displayName 
    ? currentUserProfile.displayName 
    : (isCurrentUserComment && userProfile?.displayName 
        ? userProfile.displayName 
        : commentDisplayData.username);

    const photoURL = isCurrentUserComment && currentUserProfile?.photoURL 
        ? currentUserProfile.photoURL 
        : (isCurrentUserComment && userProfile?.photoURL 
            ? userProfile.photoURL 
            : commentDisplayData.photoURL);

    const [likesInfo, setLikesInfo] = React.useState<{
        likes: number,
        isLike: boolean
    }>({
        likes: data.likes || 0,
        isLike: data.userlikes?.includes(user!.uid) ? true : false
    });
    
    const updateLike = async (isVal: boolean) => {
        setLikesInfo({
            likes: isVal ? likesInfo.likes + 1 : likesInfo.likes - 1,
            isLike: !likesInfo.isLike,
        });
        if(isVal) {
            data.userlikes?.push(user!.uid);
        } else {
            data.userlikes?.splice(data.userlikes.indexOf(user!.uid), 1);
        }
        
        await updateLikesOnComment(data.id!, data.userlikes!, isVal ? likesInfo.likes + 1 : likesInfo.likes - 1);
    };

    // Function to toggle between original and censored content with improved debug logging
    const toggleContentView = () => {
        const newValue = !showOriginalContent;
        console.log(`Toggling content view to: ${newValue ? 'original' : 'censored'}`);
        console.log("Original content:", data.originalCaption);
        console.log("Censored content:", data.caption);
        setShowOriginalContent(newValue);
    };

    // Format date for display
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
          
          // Format the date in mm/dd/yyyy 00:00 format
          const formattedDate = dateObj.toLocaleString(undefined, { 
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).replace(',', ' ');
          
          return formattedDate;
        } catch (error) {
          console.error("Error formatting date:", error);
          return ''; // Return empty string if formatting fails
        }
    };

    // Determine which content to show
    const contentToShow = showOriginalContent && data.originalCaption 
        ? data.originalCaption
        : data.caption;
    
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

    // Updated to use the AlertDialog instead of window.confirm
    const handleDeleteComment = async () => {
        if (user?.uid === data.userID) {
            try {
                await deleteComment(data.id!);
                
                // Call optional parent component callback
                if (onDelete) {
                    onDelete();
                }
                
                // Show success toast
                toast.success("Comment deleted successfully");
                window.location.reload(); // Refresh the page after deletion
            } catch (error) {
                console.error("Failed to delete comment:", error);
                toast.error("Failed to delete comment");
            }
        }
    };
    
    return (
        <div className="bg-white rounded-lg p-3 sm:p-4 mb-2 shadow-sm">
            <CardHeader className="p-0 pb-2 flex flex-row justify-between items-center">
                <CardTitle className="text-xs sm:text-sm flex items-center flex-grow overflow-hidden">
                    <img 
                        src={photoURL} 
                        alt="User avatar" 
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full mr-2 flex-shrink-0" 
                    />
                    <span className="truncate max-w-[200px]">{displayName}</span>
                </CardTitle>
                
                <div className="flex items-center space-x-2">
                    {/* Date display */}
                    {data.date && (
                        <div className="text-xs text-gray-500 flex items-center">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            <span>{formatDate(data.date) || 'Unknown'}</span>
                        </div>
                    )}
                    
                    {/* Toxicity indicator */}
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

                    {/* Replace X icon with 3-dot menu button */}
                    {user?.uid === data.userID && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="focus:outline-none text-gray-500 hover:text-gray-700" 
                                    title="Comment options"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem 
                                    className="text-red-500 focus:text-red-500 cursor-pointer"
                                    onClick={() => setShowDeleteModal(true)}
                                >
                                    Delete comment
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-0 mt-2">
               
                {/* Mobile-friendly comment content */}
                <div className="break-words">
                    <p className="text-sm sm:text-base text-gray-700">
                        <span className={getContentHighlightClass()}>
                            {contentToShow}
                        </span>
                    </p>
                </div>
                
                {/* Responsive toggle button for original content */}
                {hasOriginalContent && (
                    <button 
                        onClick={toggleContentView}
                        className="mt-1 text-xs text-gray-500 hover:text-gray-700 flex items-center"
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
                
                {/* Likes section with improved touch target */}
                <div className="flex items-center mt-2 text-xs text-gray-500">
                    <button 
                        className={cn(
                            "flex items-center p-1 -m-1 rounded-full hover:bg-gray-100 transition-colors", 
                            likesInfo.isLike ? "text-blue-500" : ""
                        )}
                        onClick={() => updateLike(!likesInfo.isLike)}
                    >
                        <ThumbsUpIcon size={14} className="mr-1" />
                        <span>{likesInfo.likes} likes</span>
                    </button>
                </div>
            </CardContent>
            
            {/* Toxicity Warning Modal */}
            {data.toxicity && (
                <ToxicityWarningModal
                    isOpen={showToxicityWarningModal}
                    onClose={() => setShowToxicityWarningModal(false)}
                    toxicityData={data.toxicity}
                />
            )}

            {/* Delete Comment Confirmation Modal */}
            <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <AlertDialogContent className='bg-white'>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this comment? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            className="bg-red-500 hover:bg-red-600"
                            onClick={handleDeleteComment}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default CommentCard;