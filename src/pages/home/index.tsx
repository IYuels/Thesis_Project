import Layout from '@/components/layout';
import PostCard from '@/components/postCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUserAuth } from '@/context/userAuthContext';
import { createPost, getPosts } from '@/repository/post.service';
import { checkToxicity, censorText, ToxicityResult } from '@/repository/toxicity.service';
import { DocumentResponse, Post } from '@/types';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface IHomeProps {}

const Home: React.FunctionComponent<IHomeProps> = () => {
    const {user} = useUserAuth();
    const navigate = useNavigate();
    const [data, setData] = React.useState<DocumentResponse[]>([]);
    const [displayedData, setDisplayedData] = React.useState<DocumentResponse[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(true);
    const [page, setPage] = React.useState(1);
    const [sortFilter, setSortFilter] = React.useState("latest");
    const [allPosts, setAllPosts] = React.useState<DocumentResponse[]>([]);
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

    const toxicityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const toxicityCache = React.useRef<Map<string, ToxicityResult>>(new Map());

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

    // Simplified toxicity check that directly uses the service function
    const performToxicityCheck = async (text: string): Promise<ToxicityResult> => {
        if (!text.trim()) {
            return {
                results: {},
                summary: {
                    is_toxic: false, 
                    toxicity_level: 'not toxic',
                    detected_categories: []
                },
                raw_probabilities: null,
                censored_text: null,
                censored_words: []
            };
        }
        
        // Use cache when available
        if (toxicityCache.current.has(text)) {
            return toxicityCache.current.get(text)!;
        }
        
        try {
            // Directly use the service function
            const result = await checkToxicity(text);
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
                raw_probabilities: null,
                censored_text: null,
                censored_words: []
            };
        }
    };

    // Modified caption change handler - simpler now without toxicity check
    const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setPost({...post, caption: newText});
        
        // Clear any scheduled check
        if (toxicityTimeoutRef.current) {
            clearTimeout(toxicityTimeoutRef.current);
        }
    };

    // Use the service's censorText function directly
    const getCensoredText = async (text: string): Promise<string> => {
        // Check if we already have a cached result
        const cachedResult = toxicityCache.current.get(text);
        if (cachedResult && cachedResult.censored_text) {
            return cachedResult.censored_text;
        }
        
        try {
            // Use the service function
            const result = await censorText(text);
            return result.censored_text;
        } catch (error) {
            console.error("Error censoring text:", error);
            return text;
        }
    };

    // Updated submit handler that directly checks toxicity on post
    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!post.caption.trim()) {
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            // Check for toxicity when post is submitted
            let toxicityResult: ToxicityResult;
            
            if (toxicityCache.current.has(post.caption)) {
                toxicityResult = toxicityCache.current.get(post.caption)!;
            } else {
                toxicityResult = await performToxicityCheck(post.caption);
            }
            
            // Create post with toxicity data
            await createPostWithToxicityData(toxicityResult);
            
        } catch (error) {
            console.error("Error during post submission:", error);
        } finally {
            setIsSubmitting(false);
            // Reset form after posting
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
    
    // Create post with toxicity data
    const createPostWithToxicityData = async (toxicityResult: ToxicityResult) => {
        if (user == null) {
            navigate('/login');
            return;
        }
        
        try {
            let postText = post.caption;
            let originalText = null;
            
            // If toxic content is detected, handle censoring
            if (toxicityResult.summary.is_toxic) {
                originalText = post.caption;
                
                // Get censored text
                if (toxicityResult.censored_text) {
                    postText = toxicityResult.censored_text;
                } else {
                    postText = await getCensoredText(post.caption);
                }
            }
            
            // Create new post object with toxicity data directly from the ToxicityResult
            const newPost: Post = {
                ...post,
                caption: postText,
                originalCaption: toxicityResult.summary.is_toxic ? originalText : null,
                userID: user.uid,
                username: user.displayName || '',
                photoURL: user.photoURL || '',
                likes: 0,
                userlikes: [],
                date: new Date(),
                toxicity: toxicityResult
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
                            </div>
                            
                            <Button 
                                className='mt-4 sm:mt-8 w-full sm:w-32 cursor-pointer hover:bg-sky-500' 
                                type='submit'
                                disabled={isSubmitting || post.caption.trim().length === 0}
                            >
                                {isSubmitting ? 'Posting...' : 'Post'}
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