import Layout from '@/components/layout';
import PostCard from '@/components/postCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUserAuth } from '@/context/userAuthContext';
import { createPost, getPosts } from '@/repository/post.service';
import { checkToxicity, censorText } from '@/repository/toxicity.service';
import { DocumentResponse, Post } from '@/types';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import avatar from "@/assets/images/avatar.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    const [allPosts, setAllPosts] = React.useState<DocumentResponse[]>([]); // Store all unfiltered posts
    const postsPerPage = 5;
    
    // Observer for infinite scrolling
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

    const [toxicityWarning, setToxicityWarning] = React.useState<{
        is_toxic: boolean;
        detected_categories: string[];
        results: Record<string, {probability: number, is_detected: boolean}>;
        censored_text?: string | null;
    } | null>(null);

    // Debounce timeout for toxicity checking
    const toxicityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    
    // Cache for toxicity results to avoid redundant API calls
    const toxicityCache = React.useRef<Map<string, any>>(new Map());

    const getAllPost = async() => {
        setIsLoading(true);
        try {
            const response: DocumentResponse[] = await getPosts() || [];
            // Store all posts for reference
            setAllPosts(response);
            // Apply the current filter (this ensures consistency with the current UI state)
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
        
        // Clean up any pending timeouts on component unmount
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
        caption: '',
        likes: 0,
        userlikes: [],
        username: "",
        photoURL:"",
        userID: null,
        date: new Date()
    });

    // Function to handle filter/sort changes
    const handleSortFilterChange = (value: string) => {
        setSortFilter(value);
        setPage(1);
        
        // Apply filter to the complete dataset (allPosts)
        applyFilterAndSort(allPosts, value);
    };
    
    // Convert any date format to timestamp for consistent comparison
    const getTimestamp = (date: any): number => {
        if (date instanceof Date) return date.getTime();
        if (date && typeof date === 'object' && 'toDate' in date) {
            // Handle Firestore Timestamp
            return date.toDate().getTime();
        }
        if (date && typeof date.seconds === 'number') {
            // Handle Firestore Timestamp format {seconds: number, nanoseconds: number}
            return date.seconds * 1000;
        }
        // Try to parse as string date
        return new Date(date).getTime();
    };
    
    // Apply filtering and sorting based on the selected option
    const applyFilterAndSort = (posts: DocumentResponse[], filter: string) => {
        if (!posts || posts.length === 0) {
            setDisplayedData([]);
            setData([]);
            return;
        }
        
        // Create a new array to avoid mutation issues
        let filteredPosts = [...posts];
        
        // Apply filters
        if (filter === "own" && user) {
            filteredPosts = filteredPosts.filter(post => post.userID === user.uid);
        }
        // All other filters show all posts, so no additional filtering needed
        
        // Apply sorting
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
                // Ensure likes is treated as a number
                filteredPosts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
                break;
            default:
                break;
        }
        
        // Apply pagination for initial load
        const initialPosts = filteredPosts.slice(0, postsPerPage);
        setDisplayedData(initialPosts);
        setHasMore(filteredPosts.length > postsPerPage);
        
        // Store full filtered dataset for pagination
        setData(filteredPosts);
    };
    
    // Load more posts for infinite scrolling
    const loadMorePosts = () => {
        if (!hasMore || isLoading) return;
        
        setIsLoading(true);
        const nextPage = page + 1;
        const startIndex = (nextPage - 1) * postsPerPage;
        const endIndex = startIndex + postsPerPage;
        
        // Get the next batch of posts
        const nextPosts = data.slice(startIndex, endIndex);
        
        // Update state
        setTimeout(() => {
            setDisplayedData(prev => [...prev, ...nextPosts]);
            setPage(nextPage);
            setHasMore(endIndex < data.length);
            setIsLoading(false);
        }, 500); // Small timeout to prevent rapid loading
    };

    // Function to check toxicity with debouncing, caching, and basic client-side pre-screening
    const performToxicityCheck = async (text: string) => {
        // Skip toxicity check for very short text
        if (text.trim().length < 5) {
            return {
                summary: { is_toxic: false, detected_categories: [] },
                results: {},
                censored_text: text
            };
        }
        
        // Simple client-side pre-check to avoid unnecessary API calls
        const commonOffensiveTerms = ['fuck', 'shit', 'ass', 'damn']; // Basic example
        const lowerText = text.toLowerCase();
        const probablyOffensive = commonOffensiveTerms.some(term => lowerText.includes(term));
        
        // If text is already in cache, return cached result
        if (toxicityCache.current.has(text)) {
            return toxicityCache.current.get(text);
        }
        
        // If text likely contains offensive content, prioritize checking
        if (probablyOffensive) {
            try {
                const result = await checkToxicity(text);
                toxicityCache.current.set(text, result);
                return result;
            } catch (error) {
                console.error("Error checking toxicity:", error);
                return {
                    summary: { is_toxic: false, detected_categories: [] },
                    results: {},
                    censored_text: text
                };
            }
        }
        
        // Otherwise, standard API call
        try {
            const result = await checkToxicity(text);
            toxicityCache.current.set(text, result);
            return result;
        } catch (error) {
            console.error("Error checking toxicity:", error);
            return {
                summary: { is_toxic: false, detected_categories: [] },
                results: {},
                censored_text: text
            };
        }
    };

    // Efficient handling of caption changes with debounced toxicity checks
    const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setPost({...post, caption: newText});
        
        // Clear any existing timeout
        if (toxicityTimeoutRef.current) {
            clearTimeout(toxicityTimeoutRef.current);
        }
        
        // Only perform toxicity checks on substantial text to avoid unnecessary API calls
        if (newText.trim().length > 20) {
            // Set a debounced toxicity check
            toxicityTimeoutRef.current = setTimeout(async () => {
                // Check cache first
                if (!toxicityCache.current.has(newText)) {
                    setIsCheckingToxicity(true);
                    const result = await performToxicityCheck(newText);
                    
                    // Only update UI if toxic content is detected
                    if (result.summary.is_toxic) {
                        const toxicityData = {
                            is_toxic: result.summary.is_toxic,
                            detected_categories: result.summary.detected_categories || [],
                            results: result.results || {},
                            censored_text: result.censored_text
                        };
                        setToxicityWarning(toxicityData);
                    } else {
                        setToxicityWarning(null);
                    }
                    setIsCheckingToxicity(false);
                }
            }, 500); // 500ms debounce
        }
    };

    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!post.caption.trim()) {
            return; // Don't submit empty posts
        }
        
        setIsSubmitting(true);
        
        try {
            // Check if this text has already been checked
            let toxicityResult;
            
            if (toxicityCache.current.has(post.caption)) {
                toxicityResult = toxicityCache.current.get(post.caption);
            } else {
                setIsCheckingToxicity(true);
                toxicityResult = await performToxicityCheck(post.caption);
                setIsCheckingToxicity(false);
            }
            
            // Store toxicity results
            const toxicityData = {
                is_toxic: toxicityResult.summary.is_toxic,
                detected_categories: toxicityResult.summary.detected_categories || [],
                results: toxicityResult.results || {},
                censored_text: toxicityResult.censored_text
            };
            
            // If toxic content is detected, show warning but don't post yet
            if (toxicityResult.summary.is_toxic) {
                setToxicityWarning(toxicityData);
                setIsSubmitting(false);
                return; // Don't post yet, user needs to confirm
            }
            
            // If not toxic, create the post (with original uncensored text)
            await createPostWithToxicityData(toxicityData, false);
            
        } catch (error) {
            console.error("Error creating post:", error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Function for user to proceed with posting despite toxicity warning
    const handlePostAnyway = async () => {
        if (user != null && toxicityWarning) {
            setIsSubmitting(true);
            try {
                // When posting anyway with toxic content, always use censored version
                await createPostWithToxicityData(toxicityWarning, true);
            } catch (error) {
                console.error("Error posting anyway:", error);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // Helper function to efficiently get censored text
    const getCensoredText = async (text: string): Promise<string> => {
        // Check cache first
        const cachedResult = toxicityCache.current.get(text);
        if (cachedResult && cachedResult.censored_text) {
            return cachedResult.censored_text;
        }
        
        try {
            const result = await censorText(text);
            return result.censored_text;
        } catch (error) {
            console.error("Error censoring text:", error);
            return text; // Return original if censoring fails
        }
    };

    // Helper function to create post with toxicity data
    const createPostWithToxicityData = async (toxicityData: any, forceCensor: boolean = false) => {
        if (user == null) {
            navigate('/login');
            return;
        }
        
        try {
            let postText = post.caption;
            
            // Determine if we need to censor the text
            if (toxicityData.is_toxic || forceCensor) {
                // If censored_text is not available from toxicity check or is null, 
                // explicitly call censorText service
                if (!toxicityData.censored_text) {
                    postText = await getCensoredText(post.caption);
                } else {
                    postText = toxicityData.censored_text;
                }
            }
            
            const newPost: Post = {
                ...post,
                caption: postText, // Use censored text when appropriate
                userID: user.uid,
                username: user.displayName || '',
                photoURL: user.photoURL || '',
                likes: 0,
                userlikes: [],
                date: new Date(),
                toxicity: {
                    is_toxic: toxicityData.is_toxic,
                    detected_categories: toxicityData.detected_categories,
                    results: toxicityData.results
                }
            };
            
            await createPost(newPost);
            
            // Reset form state
            setPost({
                caption: '',
                likes: 0,
                userlikes: [],
                username: "",
                photoURL:"",
                userID: null,
                date: new Date()
            });
            setToxicityWarning(null);
            
            // Clear the cache to avoid memory bloat
            if (toxicityCache.current.size > 50) {
                toxicityCache.current.clear();
            }
            
            // Refresh posts
            await getAllPost();
        } catch (error) {
            console.error("Error in createPostWithToxicityData:", error);
            throw error;
        }
    };

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
            // Add ref to last post for infinite scrolling
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
    
    return (
        <Layout>
            {/* Post creation card with responsive padding and width */}
            <div className='flex justify-center mb-6 md:mb-10 px-4 sm:px-6'>
                <div className='rounded-2xl sm:rounded-3xl border border-gray-100 shadow-md sm:shadow-lg w-full max-w-3xl bg-white'>
                    <div className='p-4 sm:p-6 md:p-8'>
                        <form onSubmit={handleSubmit}>
                            <div className="flex flex-col">
                                <div className='flex flex-row min-h-[60px] w-full rounded-md bg-transparent px-2 sm:px-3 py-2 text-sm md:text-base'>
                                    <img 
                                        src={user?.photoURL ? user?.photoURL: avatar} 
                                        className='w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-slate-800 object-center mr-2'
                                        alt="User avatar"
                                    />
                                    <Textarea 
                                        className='mb-4 sm:mb-8 text-sm sm:text-base'
                                        id='caption'
                                        placeholder="Share thoughts, idea, or updates"
                                        value={post.caption}
                                        onChange={handleCaptionChange}
                                    />
                                </div>
                            </div>
                            
                            {/* Toxicity warning dialog */}
                            {toxicityWarning && toxicityWarning.is_toxic && (
                                <div className="mb-4 p-4 border border-yellow-400 bg-yellow-50 rounded-lg">
                                    <h4 className="font-bold text-red-600 flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Content Warning
                                    </h4>
                                    <p className="mt-2">Your post may contain inappropriate content:</p>
                                    <ul className="list-disc list-inside mt-1 ml-2">
                                        {toxicityWarning.detected_categories.map(category => (
                                            <li key={category}>{category.replace('_', ' ')}</li>
                                        ))}
                                    </ul>
                                    
                                    {/* Show preview of censored text if available */}
                                    {toxicityWarning.censored_text && (
                                        <div className="mt-3 p-2 bg-white border border-gray-200 rounded">
                                            <p className="text-sm font-medium text-gray-700">If you proceed, your post will be censored as:</p>
                                            <p className="text-sm mt-1 italic">{toxicityWarning.censored_text}</p>
                                        </div>
                                    )}
                                    
                                    <div className="mt-3 flex gap-2">
                                        <Button 
                                            variant="outline" 
                                            onClick={() => setToxicityWarning(null)}
                                            className="border-gray-300"
                                        >
                                            Edit Post
                                        </Button>
                                        <Button 
                                            onClick={handlePostAnyway}
                                            className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? "Posting..." : "Post Anyway"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                            
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

            {/* News feed section with responsive layout */}
            <div className='flex flex-col px-4 sm:px-6'>
                <div className="mb-5 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3 sm:mb-5">
                        <h5 className='text-xl sm:text-2xl md:text-3xl font-bold'>News Feed</h5>
                        
                        {/* Filter/Sort Dropdown - Fixed styling to remove black background */}
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