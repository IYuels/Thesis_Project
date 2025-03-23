import Layout from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserAuth } from '@/context/userAuthContext';
import { createPost } from '@/repository/post.service';
import { checkToxicity, censorText } from '@/repository/toxicity.service';
import { Post, ToxicityData, CensorLevel } from '@/types';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ToxicityWarningModal from '@/components/toxicityWarningModal';

interface ICreatePostProps {}

const CreatePost: React.FunctionComponent<ICreatePostProps> = () => {
    const navigate = useNavigate();
    const { user } = useUserAuth();
    
    // Add states for toxicity checking
    const [isCheckingToxicity, setIsCheckingToxicity] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [toxicityWarning, setToxicityWarning] = React.useState<ToxicityData | null>(null);
    const [censorLevel, setCensorLevel] = React.useState<CensorLevel>(CensorLevel.AUTO);
    const [showToxicityWarningModal, setShowToxicityWarningModal] = React.useState(false);
    
    // References for toxicity checking
    const toxicityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const toxicityCache = React.useRef<Map<string, any>>(new Map());
    
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
        
        // Skip empty text check
        if (!newCaption.trim()) {
            setIsCheckingToxicity(false);
            setToxicityWarning(null);
            return;
        }
        
        // Debounced toxicity check
        toxicityTimeoutRef.current = setTimeout(async () => {
            // Use cache if available
            if (toxicityCache.current.has(newCaption)) {
                const cachedResult = toxicityCache.current.get(newCaption);
                if (cachedResult.summary.is_toxic) {
                    setToxicityWarning({
                        is_toxic: cachedResult.summary.is_toxic,
                        toxicity_level: cachedResult.summary.toxicity_level || 'toxic',
                        detected_categories: cachedResult.summary.detected_categories || [],
                        results: cachedResult.results || {},
                        censored_text: cachedResult.censored_text
                    });
                } else {
                    setToxicityWarning(null);
                }
                return;
            }
            
            setIsCheckingToxicity(true);
            
            try {
                const result = await checkToxicity(newCaption);
                toxicityCache.current.set(newCaption, result);
                
                if (result.summary.is_toxic) {
                    setToxicityWarning({
                        is_toxic: result.summary.is_toxic,
                        toxicity_level: result.summary.toxicity_level || 'toxic',
                        detected_categories: result.summary.detected_categories || [],
                        results: result.results || {},
                        censored_text: result.censored_text
                    });
                } else {
                    setToxicityWarning(null);
                }
            } catch (error) {
                console.error("Error checking toxicity:", error);
                setToxicityWarning(null);
            } finally {
                setIsCheckingToxicity(false);
            }
        }, 500);
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
            let toxicityResult;
            let isToxic = false;
            let censoredText = post.caption;
            let originalText = null;
            
            // Check for cached toxicity result
            if (toxicityCache.current.has(post.caption)) {
                toxicityResult = toxicityCache.current.get(post.caption);
                isToxic = toxicityResult.summary.is_toxic;
            } else {
                // Check toxicity if not cached
                setIsCheckingToxicity(true);
                toxicityResult = await checkToxicity(post.caption);
                setIsCheckingToxicity(false);
                toxicityCache.current.set(post.caption, toxicityResult);
                isToxic = toxicityResult.summary.is_toxic;
            }
            
            // Create toxicity data for the post
            const toxicityData: ToxicityData = {
                is_toxic: isToxic,
                toxicity_level: toxicityResult.summary.toxicity_level || 'not toxic',
                detected_categories: toxicityResult.summary.detected_categories || [],
                results: toxicityResult.results || {},
                censored_text: toxicityResult.censored_text
            };
            
            // Handle censoring for toxic content
            if (isToxic) {
                originalText = post.caption;
                
                if (toxicityResult.censored_text) {
                    censoredText = toxicityResult.censored_text;
                } else {
                    // Get censored text with selected level
                    const censorResult = await censorText(post.caption, censorLevel);
                    censoredText = censorResult.censored_text;
                }
            }
            
            // Create the new post with toxicity data
            const newPost: Post = {
                ...post,
                caption: censoredText,
                originalCaption: isToxic ? originalText : null,
                userID: user.uid,
                username: user.displayName!,
                photoURL: user.photoURL!,
                toxicity: toxicityData
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
                switch (toxicityWarning.toxicity_level) {
                    case 'very toxic':
                        return (
                            <div className="flex items-center text-sm text-red-500 mt-2">
                                <ShieldAlert className="h-4 w-4 mr-2" />
                                <span>Very toxic content detected - will be censored when posted</span>
                                <button 
                                    onClick={() => setShowToxicityWarningModal(true)}
                                    className="ml-2 text-xs text-blue-500 hover:text-blue-700 underline"
                                >
                                    View details
                                </button>
                            </div>
                        );
                    case 'toxic':
                    default:
                        return (
                            <div className="flex items-center text-sm text-yellow-500 mt-2">
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                <span>Potentially inappropriate content - will be censored when posted</span>
                                <button 
                                    onClick={() => setShowToxicityWarningModal(true)}
                                    className="ml-2 text-xs text-blue-500 hover:text-blue-700 underline"
                                >
                                    View details
                                </button>
                            </div>
                        );
                }
            };
            
            return getIndicator();
        }
        
        // Show success indicator if content has been checked and is safe
        if (post.caption.trim().length > 10 && toxicityCache.current.has(post.caption)) {
            const result = toxicityCache.current.get(post.caption);
            if (!result.summary.is_toxic) {
                return (
                    <div className="flex items-center text-sm text-green-500 mt-2">
                        <Check className="h-4 w-4 mr-2" />
                        <span>Content checked - no issues detected</span>
                    </div>
                );
            }
        }
        
        return null;
    };
    
    // Censor level selector component
    const CensorLevelSelector = () => {
        if (!toxicityWarning) return null;
        
        return (
            <div className="mt-4">
                <Label className="text-sm mb-2 block">Censoring level:</Label>
                <Select
                    value={censorLevel}
                    onValueChange={(value) => setCensorLevel(value as CensorLevel)}
                >
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select censoring level" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={CensorLevel.AUTO}>Auto (Based on detection)</SelectItem>
                        <SelectItem value={CensorLevel.LIGHT}>Light (Severe terms only)</SelectItem>
                        <SelectItem value={CensorLevel.MEDIUM}>Medium (Most inappropriate content)</SelectItem>
                        <SelectItem value={CensorLevel.HEAVY}>Heavy (All potentially inappropriate content)</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                    Select how strictly you want inappropriate content to be censored
                </p>
            </div>
        );
    };
    
    // Cleanup on unmount
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
                                
                                {/* Censor level selector */}
                                <CensorLevelSelector />
                            </div>
                            <Button 
                                className='mt-6 w-32' 
                                type='submit'
                                disabled={isSubmitting || isCheckingToxicity}
                            >
                                {isCheckingToxicity ? 'Checking...' : isSubmitting ? 'Posting...' : 'Post'}
                            </Button>
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