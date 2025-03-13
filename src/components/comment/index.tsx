import * as React from 'react';
import { useUserAuth } from '@/context/userAuthContext';
import { Comment } from '@/types';
import { updateLikesOnComment } from '@/repository/comment.service';
import { cn } from '@/lib/utils';
import { CardContent, CardHeader, CardTitle } from '../ui/card';
import { ThumbsUpIcon, AlertTriangle } from 'lucide-react';
import avatar from "@/assets/images/avatar.png";

interface ICommentCardProps {
    data: Comment;
}

const CommentCard: React.FunctionComponent<ICommentCardProps> = ({ data }) => {
    const { user, userProfile } = useUserAuth();
    const [showToxicity, setShowToxicity] = React.useState(false);
    const hasToxicity = data.toxicity && data.toxicity.is_toxic;
    
    // Use userProfile data if this comment belongs to the current user
    const isCurrentUserComment = data.userID === user?.uid;
    const displayName = isCurrentUserComment && userProfile ? 
        userProfile.displayName : 
        data.username || "Guest";
    
    // Use profile photo if this comment belongs to the current user
    const photoURL = isCurrentUserComment && userProfile?.photoURL ? 
        userProfile.photoURL : 
        (data.photoURL || avatar);
    
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
                {hasToxicity && (
                    <button 
                        onClick={() => setShowToxicity(!showToxicity)}
                        className="text-yellow-500 focus:outline-none"
                        title="Content warning"
                    >
                        <AlertTriangle size={16} />
                    </button>
                )}
            </CardHeader>
            <CardContent className="p-0">
                {showToxicity && hasToxicity && (
                    <div className="bg-yellow-50 text-yellow-800 text-xs p-2 rounded mb-2">
                        <p className="font-semibold">Content Warning</p>
                        <p>Categories: {data.toxicity?.detected_categories.join(', ')}</p>
                    </div>
                )}
                <p className="text-gray-700">{data.caption}</p>
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
        </div>
    );
};

export default CommentCard;