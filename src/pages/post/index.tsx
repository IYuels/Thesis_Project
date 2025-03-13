import Layout from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserAuth } from '@/context/userAuthContext';
import { createPost } from '@/repository/post.service';
import { Post } from '@/types';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';

interface ICreatePostProps {}

const CreatePost: React.FunctionComponent<ICreatePostProps> = () => {
    const navigate = useNavigate();
    const { user } = useUserAuth();
    const [post, setPost] = React.useState<Post>({
        id: "",
        caption: '',
        likes: 0,
        userlikes: [],
        userID: user?.uid || null,
        username: user?.displayName || '',
        photoURL: user?.photoURL || '',
        date: new Date(),
        toxicity: {
            is_toxic: false,
            detected_categories: [],
            results: {}
        },
        originalCaption: ''
    });

    const handleReload = () => {
        window.location.reload();
    }

    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        console.log("The create post is: ", post);

        if(user != null) {
            const newPost: Post ={
                ...post,
                userID: user?.uid,
                username: user.displayName!,
                photoURL: user.photoURL!,
            };
            console.log("The new post is: ", newPost);
            await createPost(newPost);
            navigate('/');
        } else {
            navigate('/login');
        }
    };
    return (
        <Layout>
            <div className='flex justify-center'>
                <div className='border max-w-3xl w-full'>
                    <h3 className='bg-slate-800 text-white text-center text-lg p-2'>
                        Create Post
                    </h3>
                    <div className='p-8'>
                        <form onSubmit={handleSubmit}>
                            <div className="flex flex-col">
                                <Label className='mb-4' htmlFor='caption'>Caption</Label>
                                <Textarea className='mb-8'
                                id='caption'
                                placeholder="What's on your mind?"
                                value={post.caption}
                                    onChange={(e:React.ChangeEvent<HTMLTextAreaElement>) => 
                                        setPost({...post, caption: e.target.value})
                                }/>
                            </div>
                            <Button className='mt-8 w-32' type='submit' onClick={handleReload}>Post</Button>
                        </form>
                    </div>
                </div>
            </div>
        </Layout>);
};

<script src="/lib/script.js"></script>

export default CreatePost;