import Layout from '@/components/layout';
import PostCard from '@/components/postCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUserAuth } from '@/context/userAuthContext';
import { createPost, getPosts } from '@/repository/post.service';
import { checkToxicity, censorText } from '@/repository/toxicity.service';
import { DocumentResponse, Post, ToxicityData } from '@/types';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, AlertTriangle, ShieldAlert } from 'lucide-react';

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
    const [isContentChecked, setIsContentChecked] = React.useState(false);
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

    // Enhanced toxicity warning state
    const [toxicityWarning, setToxicityWarning] = React.useState<ToxicityData | null>(null);

    const toxicityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const toxicityCache = React.useRef<Map<string, ToxicityData>>(new Map());

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
        date: new Date(),
        toxicity: null
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

    // Improved toxicity check function with better error handling
    const performToxicityCheck = async (text: string): Promise<ToxicityData> => {
        if (!text.trim()) {
            return {
                is_toxic: false, 
                toxicity_level: 'not toxic',
                detected_categories: [],
                results: {},
                censored_text: null
            };
        }
        
        // Use cache when available
        if (toxicityCache.current.has(text)) {
            return toxicityCache.current.get(text)!;
        }
        
        try {
            const result = await checkToxicity(text);
            
            // Convert to ToxicityData format
            const toxicityData: ToxicityData = {
                is_toxic: result.summary.is_toxic,
                toxicity_level: result.summary.toxicity_level,
                detected_categories: result.summary.detected_categories || [],
                results: result.results || {},
                censored_text: result.censored_text
                // Explicitly omit raw_probabilities to avoid type issues
            };
            
            toxicityCache.current.set(text, toxicityData);
            return toxicityData;
        } catch (error) {
            console.warn("Toxicity check failed:", error);
            return {
                is_toxic: false, 
                toxicity_level: 'not toxic',
                detected_categories: [],
                results: {},
                censored_text: null
            };
        }
    };

    // Modified caption change handler - reset toxicity check status
    const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setPost({...post, caption: newText});
        
        // Reset content checked status when text changes
        if (isContentChecked) {
            setIsContentChecked(false);
            setToxicityWarning(null);
        }
        
        // Clear any scheduled check
        if (toxicityTimeoutRef.current) {
            clearTimeout(toxicityTimeoutRef.current);
        }
    };

    // Enhanced function to handle the check button click
    const handleCheckContent = async () => {
        if (!post.caption.trim()) {
            return;
        }
        
        setIsCheckingToxicity(true);
        
        try {
            const result = await performToxicityCheck(post.caption);
            
            if (result) {
                setToxicityWarning(result.is_toxic ? result : null);
            } else {
                setToxicityWarning(null);
            }
            
            // Mark content as checked
            setIsContentChecked(true);
        } catch (err) {
            console.error("Error checking toxicity:", err);
            setToxicityWarning(null);
        } finally {
            setIsCheckingToxicity(false);
        }
    };

    // Updated submit handler with better error handling
    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!post.caption.trim()) {
            return;
        }
        
        // If content hasn't been checked yet, check it first
        if (!isContentChecked) {
            await handleCheckContent();
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            let toxicityData: ToxicityData;
            
            if (toxicityCache.current.has(post.caption)) {
                toxicityData = toxicityCache.current.get(post.caption)!;
            } else {
                // Should not reach here as content should already be checked
                toxicityData = await performToxicityCheck(post.caption);
            }
            
            // Create post with toxicity data
            await createPostWithToxicityData(toxicityData);
            
        } catch (error) {
            console.error("Error during post submission:", error);
        } finally {
            setIsSubmitting(false);
            // Reset checked state and form after posting
            setIsContentChecked(false);
            setToxicityWarning(null);
            setPost({
                id:"",
                caption: '',
                originalCaption: null,
                likes: 0,
                userlikes: [],
                username: "",
                photoURL:"",
                userID: null,
                date: new Date(),
                toxicity: null
            });
        }
    };

    // Enhanced censor text function
    const getCensoredText = async (text: string): Promise<string> => {
        // Check if we already have a cached censored version
        const cachedResult = toxicityCache.current.get(text);
        if (cachedResult && cachedResult.censored_text) {
            return cachedResult.censored_text;
        }
        
        try {
            // Use the censor level setting
            const result = await censorText(text);
            
            // Cache the result if not already cached
            if (!toxicityCache.current.has(text)) {
                const toxicityData = await performToxicityCheck(text);
                if (toxicityData) {
                    toxicityData.censored_text = result.censored_text;
                    toxicityCache.current.set(text, toxicityData);
                }
            } else {
                // Update the cached entry with the censored text
                const cachedData = toxicityCache.current.get(text);
                if (cachedData) {
                    cachedData.censored_text = result.censored_text;
                    toxicityCache.current.set(text, cachedData);
                }
            }
            
            return result.censored_text;
        } catch (error) {
            console.error("Error censoring text:", error);
            return text;
        }
    };

    // Sanitize toxicity data to ensure no undefined values
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
    
    // Create post with sanitized toxicity data
    const createPostWithToxicityData = async (toxicityData: ToxicityData) => {
        if (user == null) {
            navigate('/login');
            return;
        }
        
        try {
            let postText = post.caption;
            let originalText = null;
            
            // If toxic content is detected, handle censoring
            if (toxicityData.is_toxic) {
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
                originalCaption: toxicityData.is_toxic ? originalText : null,
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
                date: new Date(),
                toxicity: null
            });
            
            setToxicityWarning(null);
            setIsContentChecked(false);
            
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
    
    // Enhanced toxicity status indicator with warning levels
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
        
        if (isContentChecked) {
            if (toxicityWarning && toxicityWarning.is_toxic) {
                // Display warning based on toxicity level
                if (toxicityWarning.toxicity_level === 'very toxic') {
                    return (
                        <div className="flex items-center text-xs text-red-600 mt-1">
                            <ShieldAlert className="h-3 w-3 mr-1" />
                            <span>
                                <strong>High toxicity detected</strong> - Will be censored when posted
                            </span>
                        </div>
                    );
                } else {
                    return (
                        <div className="flex items-center text-xs text-amber-600 mt-1">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            <span>
                                <strong>Content flagged</strong> - Will be censored when posted
                            </span>
                        </div>
                    );
                }
            }
            
            // Show success indicator if content has been checked and is safe
            return (
                <div className="flex items-center text-xs text-green-600 mt-1">
                    <Check className="h-3 w-3 mr-1" />
                    <span>Content checked - no issues detected</span>
                </div>
            );
        }
        
        return null;
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
                                <ToxicityStatusIndicator />
                            </div>
                            
                            <Button 
                                className='mt-4 sm:mt-8 w-full sm:w-32 cursor-pointer hover:bg-sky-500' 
                                type='submit'
                                disabled={isSubmitting || isCheckingToxicity || post.caption.trim().length === 0}
                            >
                                {isCheckingToxicity ? 'Checking...' : isContentChecked ? 'Post' : 'Check'}
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