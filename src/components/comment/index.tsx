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

const CommentCard: React.FunctionComponent<ICommentCardProps> = ({data}) => {
    const {user} = useUserAuth();
    const [showToxicity, setShowToxicity] = React.useState(false);
    const hasToxicity = data.toxicity && data.toxicity.is_toxic;
    
    const [likesInfo, setLikesInfo] = React.useState<{
        likes: number,
        isLike: boolean
    }>({
        likes: data.likes!,
        isLike: data.userlikes?.includes(user!.uid) ? true : false
    });

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

        await updateLikesOnComment(data.id!, data.userlikes!, isVal ? likesInfo.likes + 1 : likesInfo.likes - 1);
    };
    
    return (
        <div className="flex flex-col bg-white rounded-lg shadow-sm w-full border">
            <CardHeader className='flex flex-row p-2 sm:p-3 items-center justify-between'>
                <CardTitle className='text-xs sm:text-sm flex items-center overflow-hidden'>
                    <span className='flex-shrink-0'>
                        <img 
                            src={data.photoURL || avatar}
                            alt={`${data.username || "Guest"}'s avatar`}
                            className='w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-transparent object-cover'
                        />
                    </span>
                    <span className='ml-2 sm:ml-3 font-medium truncate'>{data.username || "Guest"}</span>
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
            
            {showToxicity && hasToxicity && (
                <div className="mx-3 mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <p className="font-medium">Content Warning</p>
                    <p>Categories: {data.toxicity?.detected_categories.join(', ')}</p>
                </div>
            )}
            
            <CardContent className="px-2 sm:px-4 pb-0">
                <div className='bg-gray-50 rounded p-3 sm:p-4 w-full text-sm sm:text-base break-words'>
                    {data.caption}
                </div>
            </CardContent>
            
            <div className="flex items-center px-3 sm:px-5 py-2 sm:py-3 mt-1">
                <ThumbsUpIcon 
                    className={cn(
                        "w-5 h-5 sm:w-6 sm:h-6 cursor-pointer", 
                        likesInfo.isLike ? "fill-blue-500 text-blue-500" : "fill-none text-gray-500", 
                    )}
                    onClick={() => updateLike(!likesInfo.isLike)}
                />
                <div className="text-xs sm:text-sm ml-2 text-gray-600">{likesInfo.likes} likes</div>
            </div>
        </div>
    );
};

export default CommentCard;