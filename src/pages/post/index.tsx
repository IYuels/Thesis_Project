import Layout from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserAuth } from '@/context/userAuthContext';
import { createPost } from '@/repository/post.service';
import { checkToxicity, censorText } from '@/repository/toxicity.service';
import { Post, ToxicityData } from '@/types';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, Check, AlertCircle } from 'lucide-react';
import ToxicityWarningModal from '@/components/toxicityWarningModal';

interface ICreatePostProps {}

const CreatePost: React.FunctionComponent<ICreatePostProps> = () => {
    const navigate = useNavigate();
    const { user } = useUserAuth();
    
    // Add states for toxicity checking
    const [isCheckingToxicity, setIsCheckingToxicity] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [toxicityWarning, setToxicityWarning] = React.useState<ToxicityData | null>(null);
    const [showToxicityWarningModal, setShowToxicityWarningModal] = React.useState(false);
    const [hasBeenChecked, setHasBeenChecked] = React.useState(false);
    
    // References for toxicity checking
    const toxicityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const toxicityCache = React.useRef<Map<string, ToxicityData>>(new Map());
    
    const [post, setPost] = React.useState<Post>({
        id: "",
        caption: '',
        likes: 0,
        userlikes: [],
        userID: user?.uid || null,
        username: user?.displayName || '',
        photoURL: user?.photoURL || '',
        date: new Date(),
        toxicity: null,
        originalCaption: null
    });

    // Enhanced caption change handler with toxicity detection
    const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCaption = e.target.value;
        setPost({...post, caption: newCaption});
        
        // Clear previous timeout if exists
        if (toxicityTimeoutRef.current) {
            clearTimeout(toxicityTimeoutRef.current);
        }
        
        // Reset checked status on content change
        setHasBeenChecked(false);
        
        // Skip empty text check
        if (!newCaption.trim()) {
            setIsCheckingToxicity(false);
            setToxicityWarning(null);
            return;
        }
        
        // Debounced toxicity check with minimum text length
        if (newCaption.trim().length > 3) {
            toxicityTimeoutRef.current = setTimeout(async () => {
                // Use cache if available
                if (toxicityCache.current.has(newCaption)) {
                    const cachedResult = toxicityCache.current.get(newCaption);
                    if (cachedResult && cachedResult.summary.is_toxic) {
                        setToxicityWarning(cachedResult);
                    } else {
                        setToxicityWarning(null);
                    }
                    setHasBeenChecked(true);
                    return;
                }
                
                setIsCheckingToxicity(true);
                
                try {
                    const result = await checkToxicity(newCaption);
                    
                    // Store the ToxicityData result directly
                    toxicityCache.current.set(newCaption, result);
                    
                    if (result.summary.is_toxic) {
                        setToxicityWarning(result);
                    } else {
                        setToxicityWarning(null);
                    }
                    setHasBeenChecked(true);
                } catch (error) {
                    console.error("Error checking toxicity:", error);
                    setToxicityWarning(null);
                } finally {
                    setIsCheckingToxicity(false);
                }
            }, 500);
        }
    };

    // Updated submit handler with toxicity handling
    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!post.caption.trim() || !user) {
            if (!user) navigate('/login');
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            let toxicityData: ToxicityData;
            let isToxic = false;
            let censoredText = post.caption;
            let originalText = null;
            
            // Check for cached toxicity result
            if (toxicityCache.current.has(post.caption)) {
                toxicityData = toxicityCache.current.get(post.caption)!;
                isToxic = toxicityData.summary.is_toxic;
            } else {
                // Check toxicity if not cached
                setIsCheckingToxicity(true);
                toxicityData = await checkToxicity(post.caption);
                setIsCheckingToxicity(false);
                
                toxicityCache.current.set(post.caption, toxicityData);
                isToxic = toxicityData.summary.is_toxic;
            }
            
            // Handle censoring for toxic content
            if (isToxic) {
                originalText = post.caption;
                
                if (toxicityData.censored_text) {
                    censoredText = toxicityData.censored_text;
                } else {
                    // Get censored text
                    const censorResult = await censorText(post.caption);
                    censoredText = censorResult.censored_text;
                }
            }
            
            // Create the new post with toxicity data
            const newPost: Post = {
                ...post,
                caption: isToxic ? censoredText : post.caption,
                originalCaption: isToxic ? originalText : null,
                userID: user.uid,
                username: user.displayName!,
                photoURL: user.photoURL!,
                toxicity: toxicityData,
                date: new Date()
            };
            
            await createPost(newPost);
            navigate('/');
        } catch (error) {
            console.error("Error creating post:", error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Component to show toxicity status while typing
    const ToxicityStatusIndicator = () => {
        if (isCheckingToxicity) {
            return (
                <div className="flex items-center text-sm text-gray-500 mt-2">
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Checking content...
                </div>
            );
        }
        
        if (toxicityWarning) {
            // Different indicators based on toxicity level
            const getIndicator = () => {
                switch (toxicityWarning.summary.toxicity_level) {
                    case 'very toxic':
                        return (
                            <div className="flex items-center text-sm text-red-600 mt-2">
                                <ShieldAlert className="h-4 w-4 mr-2" />
                                <span>
                                    <strong>High toxicity detected:</strong> {toxicityWarning.summary.detected_categories.join(', ')}
                                </span>
                                <button 
                                    onClick={() => setShowToxicityWarningModal(true)}
                                    className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                    Details
                                </button>
                            </div>
                        );
                    case 'toxic':
                        return (
                            <div className="flex items-center text-sm text-amber-600 mt-2">
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                <span>
                                    <strong>Potentially inappropriate:</strong> {toxicityWarning.summary.detected_categories.join(', ')}
                                </span>
                                <button 
                                    onClick={() => setShowToxicityWarningModal(true)}
                                    className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                    Details
                                </button>
                            </div>
                        );
                    default:
                        return (
                            <div className="flex items-center text-sm text-yellow-600 mt-2">
                                <AlertCircle className="h-4 w-4 mr-2" />
                                <span>Content flagged - will be reviewed</span>
                                <button 
                                    onClick={() => setShowToxicityWarningModal(true)}
                                    className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                    Details
                                </button>
                            </div>
                        );
                }
            };
            
            return getIndicator();
        }
        
        // Show success indicator if content has been checked and is safe
        if (post.caption.trim().length > 3 && hasBeenChecked) {
            return (
                <div className="flex items-center text-sm text-green-600 mt-2">
                    <Check className="h-4 w-4 mr-2" />
                    <span>Content checked - no issues detected</span>
                </div>
            );
        }
        
        return null;
    };
    
    React.useEffect(() => {
        return () => {
            if (toxicityTimeoutRef.current) {
                clearTimeout(toxicityTimeoutRef.current);
            }
        };
    }, []);
    
    return (
        <Layout>
            <div className='flex justify-center'>
                <div className='border max-w-3xl w-full rounded-lg shadow-md'>
                    <h3 className='bg-slate-800 text-white text-center text-lg p-2 rounded-t-lg'>
                        Create Post
                    </h3>
                    <div className='p-8'>
                        <form onSubmit={handleSubmit}>
                            <div className="flex flex-col">
                                <Label className='mb-4' htmlFor='caption'>Caption</Label>
                                <Textarea 
                                    className='mb-4 min-h-[120px]'
                                    id='caption'
                                    placeholder="What's on your mind?"
                                    value={post.caption}
                                    onChange={handleCaptionChange}
                                />
                                
                                {/* Toxicity status indicator */}
                                <ToxicityStatusIndicator />
                            </div>
                            <Button 
                                className='mt-6 w-32' 
                                type='submit'
                                disabled={isSubmitting || isCheckingToxicity || (post.caption.trim().length > 0 && !hasBeenChecked)}
                            >
                                {isCheckingToxicity ? 'Checking...' : isSubmitting ? 'Posting...' : 'Post'}
                            </Button>
                            
                            {post.caption.trim().length > 0 && !hasBeenChecked && !isCheckingToxicity && (
                                <p className="text-xs text-gray-500 mt-2">Your content is being checked before posting</p>
                            )}
                        </form>
                    </div>
                </div>
            </div>
            
            {/* Toxicity warning modal */}
            <ToxicityWarningModal
                isOpen={showToxicityWarningModal}
                onClose={() => setShowToxicityWarningModal(false)}
                toxicityData={toxicityWarning}
            />
        </Layout>
    );
};

export default CreatePost;