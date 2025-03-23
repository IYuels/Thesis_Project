import Layout from '@/components/layout';
import PostCard from '@/components/postCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUserAuth } from '@/context/userAuthContext';
import { createPost, getPosts } from '@/repository/post.service';
import { checkToxicity, censorText} from '@/repository/toxicity.service';
import { DocumentResponse, Post, ToxicityData, CensorLevel } from '@/types';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ShieldAlert, Check, AlertCircle } from 'lucide-react';

interface IHomeProps {}

const Home: React.FunctionComponent<IHomeProps> = () => {
    const {user} = useUserAuth();
    const navigate = useNavigate();
    const [data, setData] = React.useState<DocumentResponse[]>([]);
    const [displayedData, setDisplayedData] = React.useState<DocumentResponse[]>([]);
    const [isCheckingToxicity, setIsCheckingToxicity] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(true);
    const [page, setPage] = React.useState(1);
    const [sortFilter, setSortFilter] = React.useState("latest");
    const [allPosts, setAllPosts] = React.useState<DocumentResponse[]>([]);
    const [censorLevel, setCensorLevel] = React.useState<CensorLevel>(CensorLevel.AUTO);
    const postsPerPage = 5;
    
    const observer = React.useRef<IntersectionObserver | null>(null);
    const lastPostRef = React.useCallback((node: HTMLDivElement | null) => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMorePosts();
            }
        });
        
        if (node) observer.current.observe(node);
    }, [isLoading, hasMore]);

    // Enhanced toxicity warning state with toxicity levels
    const [toxicityWarning, setToxicityWarning] = React.useState<ToxicityData | null>(null);

    const toxicityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const toxicityCache = React.useRef<Map<string, any>>(new Map());
    const toxicityCheckInProgress = React.useRef(false);
    const lastCheckedText = React.useRef('');

    const getAllPost = async() => {
        setIsLoading(true);
        try {
            const response: DocumentResponse[] = await getPosts() || [];
            setAllPosts(response);
            applyFilterAndSort(response, sortFilter);
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    React.useEffect(() => {
        if(user != null){
            getAllPost();
        }
        
        return () => {
            if (toxicityTimeoutRef.current) {
                clearTimeout(toxicityTimeoutRef.current);
            }
            if (observer.current) {
                observer.current.disconnect();
            }
        };
    }, [user]);

    const [post, setPost] = React.useState<Post>({
        id:"",
        caption: '',
        originalCaption: null,
        likes: 0,
        userlikes: [],
        username: "",
        photoURL:"",
        userID: null,
        date: new Date()
    });

    const handleSortFilterChange = (value: string) => {
        setSortFilter(value);
        setPage(1);
        applyFilterAndSort(allPosts, value);
    };
    
    const getTimestamp = (date: any): number => {
        if (date instanceof Date) return date.getTime();
        if (date && typeof date === 'object' && 'toDate' in date) {
            return date.toDate().getTime();
        }
        if (date && typeof date.seconds === 'number') {
            return date.seconds * 1000;
        }
        return new Date(date).getTime();
    };
    
    const applyFilterAndSort = (posts: DocumentResponse[], filter: string) => {
        if (!posts || posts.length === 0) {
            setDisplayedData([]);
            setData([]);
            return;
        }
        
        let filteredPosts = [...posts];
        
        if (filter === "own" && user) {
            filteredPosts = filteredPosts.filter(post => post.userID === user.uid);
        }
        
        switch (filter) {
            case "latest":
                filteredPosts.sort((a, b) => {
                    return getTimestamp(b.date) - getTimestamp(a.date);
                });
                break;
            case "oldest":
                filteredPosts.sort((a, b) => {
                    return getTimestamp(a.date) - getTimestamp(b.date);
                });
                break;
            case "mostLiked":
                filteredPosts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
                break;
            default:
                break;
        }
        
        const initialPosts = filteredPosts.slice(0, postsPerPage);
        setDisplayedData(initialPosts);
        setHasMore(filteredPosts.length > postsPerPage);
        setData(filteredPosts);
    };
    
    const loadMorePosts = () => {
        if (!hasMore || isLoading) return;
        
        setIsLoading(true);
        const nextPage = page + 1;
        const startIndex = (nextPage - 1) * postsPerPage;
        const endIndex = startIndex + postsPerPage;
        
        const nextPosts = data.slice(startIndex, endIndex);
        
        setTimeout(() => {
            setDisplayedData(prev => [...prev, ...nextPosts]);
            setPage(nextPage);
            setHasMore(endIndex < data.length);
            setIsLoading(false);
        }, 500);
    };

    // Enhanced toxicity check function based on appv3 improved detection
    const performToxicityCheck = async (text: string) => {
        if (!text.trim()) {
            return null;
        }
        
        // Use cache when available
        if (toxicityCache.current.has(text)) {
            return toxicityCache.current.get(text);
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // Extended timeout to 5 seconds
            
            const result = await checkToxicity(text);
            
            clearTimeout(timeoutId);
            toxicityCache.current.set(text, result);
            return result;
        } catch (error) {
            console.warn("Toxicity check failed:", error);
            return {
                results: {},
                summary: { 
                    is_toxic: false, 
                    toxicity_level: 'not toxic',
                    detected_categories: [] 
                },
                censored_text: text
            };
        }
    };

    // Enhanced caption change handler with improved toxicity detection
    const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setPost({...post, caption: newText});
        
        if (toxicityTimeoutRef.current) {
            clearTimeout(toxicityTimeoutRef.current);
        }
        
        // Clear toxicity warning when text changes significantly
        if (toxicityWarning && Math.abs(newText.length - post.caption.length) > 5) {
            setToxicityWarning(null);
        }
        
        // Skip empty text check
        if (!newText.trim()) {
            setIsCheckingToxicity(false);
            setToxicityWarning(null);
            return;
        }
        
        // Use debouncing to prevent excessive API calls
        toxicityTimeoutRef.current = setTimeout(async () => {
            if (toxicityCache.current.has(newText) || toxicityCheckInProgress.current) {
                // Check cached result if available
                if (toxicityCache.current.has(newText)) {
                    const cachedResult = toxicityCache.current.get(newText);
                    if (cachedResult.summary.is_toxic) {
                        setToxicityWarning({
                            is_toxic: cachedResult.summary.is_toxic,
                            toxicity_level: cachedResult.summary.toxicity_level || 'toxic',
                            detected_categories: cachedResult.summary.detected_categories || [],
                            results: cachedResult.results || {}
                        });
                    } else {
                        setToxicityWarning(null);
                    }
                }
                return;
            }
            
            toxicityCheckInProgress.current = true;
            lastCheckedText.current = newText;
            setIsCheckingToxicity(true);
            
            try {
                const result = await performToxicityCheck(newText);
                
                // Only update UI if text hasn't changed while checking
                if (post.caption === newText && result) {
                    if (result.summary.is_toxic) {
                        setToxicityWarning({
                            is_toxic: result.summary.is_toxic,
                            toxicity_level: result.summary.toxicity_level || 'toxic',
                            detected_categories: result.summary.detected_categories || [],
                            results: result.results || {}
                        });
                    } else {
                        setToxicityWarning(null);
                    }
                }
            } catch (err) {
                console.error("Error checking toxicity:", err);
                setToxicityWarning(null);
            } finally {
                setIsCheckingToxicity(false);
                toxicityCheckInProgress.current = false;
            }
        }, 500);
    };

    // Updated submit handler with enhanced toxicity handling
    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!post.caption.trim()) {
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            let toxicityResult;
            
            if (toxicityCache.current.has(post.caption)) {
                toxicityResult = toxicityCache.current.get(post.caption);
            } else {
                setIsCheckingToxicity(true);
                toxicityResult = await performToxicityCheck(post.caption);
                setIsCheckingToxicity(false);
            }
            
            // Extract all required data from the toxicity result
            const isToxic = toxicityResult?.summary?.is_toxic || false;
            const toxicityLevel = toxicityResult?.summary?.toxicity_level || 'not toxic';
            
            const toxicityData: ToxicityData = {
                is_toxic: isToxic,
                toxicity_level: toxicityLevel,
                detected_categories: toxicityResult?.summary?.detected_categories || [],
                results: toxicityResult?.results || {},
                raw_probabilities: toxicityResult?.raw_probabilities
            };
            
            // Create post with enhanced toxicity data
            await createPostWithToxicityData(toxicityData, isToxic);
            
        } catch (error) {
            console.error("Error during post submission:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Enhanced censor text function with configurable censoring level
    const getCensoredText = async (text: string): Promise<string> => {
        const cachedResult = toxicityCache.current.get(text);
        if (cachedResult && cachedResult.censored_text) {
            return cachedResult.censored_text;
        }
        
        try {
            // Use the censor level setting
            const result = await censorText(text, censorLevel);
            return result.censored_text;
        } catch (error) {
            console.error("Error censoring text:", error);
            return text;
        }
    };

    const sanitizeToxicityData = (data: ToxicityData): ToxicityData => {
        // Create a deep copy of the data
        const sanitized = { ...data };
        
        // Ensure raw_probabilities exists and has no undefined values
        if (!sanitized.raw_probabilities || Object.values(sanitized.raw_probabilities).some(v => v === undefined)) {
          // If raw_probabilities has undefined values or is undefined itself, remove it
          delete sanitized.raw_probabilities;
        }
        
        // Ensure results has no undefined values
        if (sanitized.results) {
          Object.keys(sanitized.results).forEach(key => {
            const result = sanitized.results[key];
            // Remove any undefined properties
            if (result && (result.probability === undefined || result.is_detected === undefined)) {
              delete sanitized.results[key];
            }
          });
        }
        
        // Make sure no other undefined values exist
        if (sanitized.detected_categories === undefined) sanitized.detected_categories = [];
        if (sanitized.toxicity_level === undefined) sanitized.toxicity_level = 'not toxic';
        
        return sanitized;
      };
      
      // Then use it before creating posts in Firebase
      const createPostWithToxicityData = async (toxicityData: ToxicityData, isToxic: boolean = false) => {
        if (user == null) {
          navigate('/login');
          return;
        }
        
        try {
          let postText = post.caption;
          let originalText = null;
          
          // If toxic content is detected, handle censoring
          if (isToxic) {
            originalText = post.caption;
            
            // Get censored text
            if (toxicityData.censored_text) {
              postText = toxicityData.censored_text;
            } else {
              postText = await getCensoredText(post.caption);
            }
          }
          
          // Sanitize toxicity data before sending to Firebase
          const sanitizedToxicityData = sanitizeToxicityData(toxicityData);
          
          // Create new post object
          const newPost: Post = {
            ...post,
            caption: postText,
            originalCaption: isToxic ? originalText : null,
            userID: user.uid,
            username: user.displayName || '',
            photoURL: user.photoURL || '',
            likes: 0,
            userlikes: [],
            date: new Date(),
            toxicity: sanitizedToxicityData
          };
          
          // Create the post
          await createPost(newPost);
          
          // Reset form
          setPost({
            id:"",
            caption: '',
            originalCaption: null,
            likes: 0,
            userlikes: [],
            username: "",
            photoURL:"",
            userID: null,
            date: new Date()
          });
          
          setToxicityWarning(null);
          
          // Refresh posts
          await getAllPost();
        } catch (error) {
          console.error("Error creating post:", error);
          throw error;
        }
      };

    // Enhanced function to render posts
    const renderPosts = () => {
        if (displayedData.length === 0 && !isLoading) {
            return (
                <div className="text-center py-8 px-4 bg-gray-50 rounded-lg border border-gray-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-gray-600 font-medium">No posts found</p>
                    {sortFilter === "own" && (
                        <p className="mt-2 text-sm text-gray-500">
                            You haven't created any posts yet.
                        </p>
                    )}
                    <Button 
                        className='mt-4 cursor-pointer hover:bg-sky-500' 
                        onClick={() => handleSortFilterChange("latest")}
                    >
                        View All Posts
                    </Button>
                </div>
            );
        }
        
        return displayedData.map((item, index) => {
            if (index === displayedData.length - 1) {
                return (
                    <div ref={lastPostRef} key={item.id}>
                        <PostCard data={item} />
                    </div>
                );
            } else {
                return <PostCard data={item} key={item.id} />;
            }
        });
    };
    
    // Enhanced toxicity status indicator with improved visual feedback
    const ToxicityStatusIndicator = () => {
        if (!post.caption || post.caption.trim().length < 3) {
            return null;
        }
        
        if (isCheckingToxicity) {
            return (
                <div className="flex items-center text-xs text-gray-500 mt-1">
                    <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Checking content...
                </div>
            );
        }
        
        if (toxicityWarning) {
            // Show different indicators based on toxicity level
            const getIndicator = () => {
                switch (toxicityWarning.toxicity_level) {
                    case 'very toxic':
                        return (
                            <div className="flex items-center text-xs text-red-500 mt-1">
                                <ShieldAlert className="h-3 w-3 mr-1" />
                                <span>Very toxic content detected - will be censored when posted</span>
                            </div>
                        );
                    case 'toxic':
                    default:
                        return (
                            <div className="flex items-center text-xs text-yellow-500 mt-1">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                <span>Potentially inappropriate content - will be censored when posted</span>
                            </div>
                        );
                }
            };
            
            return getIndicator();
        }
        
        // Show success indicator if content has been checked and is safe
        if (toxicityCache.current.has(post.caption)) {
            const result = toxicityCache.current.get(post.caption);
            if (!result.summary.is_toxic) {
                return (
                    <div className="flex items-center text-xs text-green-500 mt-1">
                        <Check className="h-3 w-3 mr-1" />
                        <span>Content checked</span>
                    </div>
                );
            }
        }
        
        return null;
    };
    
    // Enhanced censor level selector component
    const CensorLevelSelector = () => {
        if (!toxicityWarning) return null;
        
        return (
            <div className="mt-2">
                <div className="flex items-center mb-1">
                    <AlertCircle className="h-4 w-4 text-sky-500 mr-1" />
                    <span className="text-xs text-sky-500">Content will be automatically censored based on detection</span>
                </div>
                <div className="mt-2">
                    <Select 
                        value={censorLevel} 
                        onValueChange={(value) => setCensorLevel(value as CensorLevel)}
                    >
                        <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue placeholder="Censoring level" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            <SelectItem value={CensorLevel.AUTO}>Auto (Based on detection)</SelectItem>
                            <SelectItem value={CensorLevel.LIGHT}>Light (Severe terms only)</SelectItem>
                            <SelectItem value={CensorLevel.MEDIUM}>Medium (Most inappropriate content)</SelectItem>
                            <SelectItem value={CensorLevel.HEAVY}>Heavy (All potentially inappropriate content)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        );
    };
    
    return (
        <Layout>
            <div className='flex justify-center mb-6 md:mb-10 px-4 sm:px-6'>
                <div className='rounded-2xl sm:rounded-3xl border border-gray-100 shadow-md sm:shadow-lg w-full max-w-3xl bg-white'>
                    <div className='p-4 sm:p-6 md:p-8'>
                    <form onSubmit={handleSubmit}>
                            <div className="flex flex-col">
                                <div className='flex flex-row min-h-[60px] w-full rounded-md bg-transparent px-2 sm:px-3 py-2 text-sm md:text-base'>
                                    <Textarea 
                                        className='mb-4 sm:mb-8 text-sm sm:text-base'
                                        maxLength={1800}
                                        id='caption'
                                        placeholder="Share thoughts, idea, or updates"
                                        value={post.caption}
                                        onChange={handleCaptionChange}
                                    />
                                </div>
                                
                                {/* Enhanced status indicators */}
                                <ToxicityStatusIndicator />
                                <CensorLevelSelector />
                            </div>
                            
                            <Button 
                                className='mt-4 sm:mt-8 w-full sm:w-32 cursor-pointer hover:bg-sky-500' 
                                type='submit'
                                disabled={isSubmitting || isCheckingToxicity}
                            >
                                {isCheckingToxicity ? 'Checking...' : isSubmitting ? 'Posting...' : 'Post'}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
    
            <div className='flex flex-col px-4 sm:px-6'>
                <div className="mb-5 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3 sm:mb-5">
                        <h5 className='text-xl sm:text-2xl md:text-3xl font-bold'>News Feed</h5>
                        
                        <div className="w-40">
                            <Select value={sortFilter} onValueChange={handleSortFilterChange}>
                                <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="latest">Latest</SelectItem>
                                    <SelectItem value="oldest">Oldest</SelectItem>
                                    <SelectItem value="mostLiked">Most Liked</SelectItem>
                                    <SelectItem value="own">My Posts</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className='w-full flex justify-center'>
                        <div className="p-2 sm:p-4 md:p-8 w-full max-w-3xl">
                            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:gap-10">
                                {renderPosts()}
                                {isLoading && <div className="text-center py-4">Loading more posts...</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};
    
export default Home;