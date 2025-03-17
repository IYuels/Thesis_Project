import * as React from 'react';
import { useUserAuth } from '@/context/userAuthContext';
import { Comment } from '@/types';
import { updateLikesOnComment } from '@/repository/comment.service';
import { cn } from '@/lib/utils';
import { CardContent, CardHeader, CardTitle } from '../ui/card';
import { ThumbsUpIcon, AlertTriangle, EyeIcon, EyeOffIcon, ClockIcon } from 'lucide-react';
import avatar from "@/assets/images/avatar.png";
import ToxicityWarningModal from '../toxicityWarningModal';
import { subscribeToUserProfile } from '@/repository/user.service';


interface ICommentCardProps {
    data: Comment;
}

const CommentCard: React.FunctionComponent<ICommentCardProps> = ({ data }) => {
    const [showToxicityWarningModal, setShowToxicityWarningModal] = React.useState(false);
    const { user, userProfile } = useUserAuth();
    const [showOriginalContent, setShowOriginalContent] = React.useState(false);
    const [commentDisplayData, setCommentDisplayData] = React.useState({
        username: data.username || "Guest_User",
        photoURL: data.photoURL || avatar
    });
    
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
    }, [data.userID]);

    // Ensure toxicity check is more robust
    const hasToxicity = data.toxicity && data.toxicity.is_toxic === true;
    
    // Check if we actually have different original content
    const hasOriginalContent = data.originalCaption !== undefined && 
                          data.originalCaption !== null && 
                          data.originalCaption !== data.caption;
    
    // Enhanced debug info
    React.useEffect(() => {
        if (hasToxicity) {
            console.log("Comment with toxicity:", {
                id: data.id,
                caption: data.caption,
                originalCaption: data.originalCaption,
                hasToxicity,
                hasOriginalContent,
                toxicityInfo: data.toxicity
            });
        }
    }, [data, hasToxicity, hasOriginalContent]);
    
    // Use userProfile data if this comment belongs to the current user
    const isCurrentUserComment = data.userID === user?.uid;
    const displayName = isCurrentUserComment && userProfile ? 
        userProfile.displayName : 
        commentDisplayData.username;

    // Use profile photo if this comment belongs to the current user
    const photoURL = isCurrentUserComment && userProfile?.photoURL ? 
        userProfile.photoURL : 
        commentDisplayData.photoURL;

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
    
    React.useEffect(() => {
        console.log("Comment data loaded:", {
            id: data.id,
            caption: data.caption,
            originalCaption: data.originalCaption,
            hasToxicity,
            hasOriginalContent,
            showOriginalContent,
            toxicityInfo: data.toxicity
        });
    }, []);

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
        console.log("Post date data:", {
          rawDate: data.date,
          hasDate: !!data.date,
          typeOfDate: data.date ? typeof data.date : 'undefined'
        });
      }, [data]);

    // Determine which content to show
    const contentToShow = showOriginalContent && data.originalCaption 
        ? data.originalCaption
        : data.caption;
    
    return (
        <div className="bg-white rounded-lg p-4 mb-2 shadow-sm">
            <CardHeader className="p-0 pb-2 flex flex-row justify-between">
                <CardTitle className="text-sm flex items-center">
                    <img 
                        src={photoURL} 
                        alt="User avatar" 
                        className="w-6 h-6 rounded-full mr-2" 
                    />
                    <span>{displayName}</span>
                </CardTitle>
                
                <div className="flex items-center">
                    {/* Add date display */}
                    {data.date && (
                        <div className="text-xs text-gray-500 flex items-center mr-2">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            <span>{formatDate(data.date) || 'Unknown'}</span>
                        </div>
                        )}
                    
                    {hasToxicity && (
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
            <CardContent className="p-0">
                {/* Comment content with toxicity indicator */}
                {hasToxicity ? (
                    <div>
                        <div className="flex items-center mb-1">
                        </div>
                        <p className="text-gray-700">
                            {/* Show either the censored or original content */}
                            <span className={showOriginalContent ? "bg-yellow-50 p-1 rounded" : ""}>
                                {contentToShow}
                            </span>
                        </p>
                        <div className="flex flex-row">
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-700">{data.caption}</p>
                )}
                {/* Show toggle button if we have original content or forced display for debugging */}
                    {hasOriginalContent && (
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
                <div className="flex items-center mt-2 text-xs text-gray-500">
                    <button 
                        className={cn("flex items-center mr-2", likesInfo.isLike ? "text-blue-500" : "")}
                        onClick={() => updateLike(!likesInfo.isLike)}
                    >
                        <ThumbsUpIcon size={14} className="mr-1" />
                        <span>{likesInfo.likes} likes</span>
                    </button>
                </div>
            </CardContent>
            <ToxicityWarningModal
                isOpen={showToxicityWarningModal}
                onClose={() => setShowToxicityWarningModal(false)}
                toxicityData={data.toxicity}
            />
        </div>
    );
};

export default CommentCard;