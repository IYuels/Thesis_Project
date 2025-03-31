import FileUploader from '@/components/fileUploader';
import Layout from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileEntry, UserProfile } from '@/types';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import avatar from '@/assets/images/avatar.png';
import { Input } from '@/components/ui/input';
import { createUserProfile, updateUserProfile, getUserProfile } from '@/repository/user.service';
import { toast } from "sonner";

interface IEditProfileProps {}

const EditProfile: React.FunctionComponent<IEditProfileProps> = () => {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = React.useState<boolean>(true);
    const [fileEntry, setFileEntry] = React.useState<FileEntry>({
        files: [],
    });
    const [data, setData] = React.useState<UserProfile>({
        userId: userId || '',
        userBio: '',
        displayName: '',
        photoURL: '',
    });
    const [profileId, setProfileId] = React.useState<string>('');

    // Fetch user profile when component mounts
    React.useEffect(() => {
        const fetchUserProfile = async () => {
            if (!userId) {
                navigate('/profile');
                return;
            }

            try {
                setLoading(true);
                const profileData = await getUserProfile(userId);
                
                if (profileData) {
                    setData({
                        userId: userId,
                        userBio: profileData.userBio || '',
                        displayName: profileData.displayName || '',
                        photoURL: profileData.photoURL || '',
                    });
                    
                    // Store the profile ID for update operations
                    if (profileData.id) {
                        setProfileId(profileData.id);
                    }
                }
            } catch (error) {
                console.error("Error fetching user profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [userId, navigate]);

    React.useEffect(() => {
        if (fileEntry.files.length > 0 && fileEntry.files[0].cdnUrl) {
            setData(prevData => ({
                ...prevData,
                photoURL: fileEntry.files[0].cdnUrl || ""
            }));
        }
    }, [fileEntry]);

    const updateProfile = async (e: React.MouseEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!userId) {
            console.error("User ID is missing");
            return;
        }
    
        try {
            if (profileId) {
                // Update existing profile
                await updateUserProfile(profileId, data);
            } else {
                // Create new profile
                await createUserProfile(data);
            }
            
            // Show success toast instead of alert
            toast.success("Profile updated successfully!");
            
            // Navigate back to profile
            navigate("/profile");
        } catch (err) {
            toast.error("Error updating profile");
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className='flex justify-center'>
                    <div className='border max-w-3xl w-full p-8 text-center'>
                        Loading profile data...
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className='flex justify-center'>
                <div className='border max-w-3xl w-full'>
                    <h3 className='bg-slate-800 text-white text-center text-lg p-2'>
                        Edit Profile
                    </h3>
                    <div className='p-8'>
                        <form onSubmit={updateProfile}>  
                            <div className="flex flex-col">
                                <Label className='mb-4' htmlFor='photo'>Profile Picture</Label>
                                <div className="mb-4">
                                    {fileEntry.files.length > 0 && fileEntry.files[0].cdnUrl ? 
                                        <img 
                                            src={fileEntry.files[0].cdnUrl} 
                                            alt='avatar' 
                                            className='w-35 h-35 rounded-full border-2 border-slate-800 object-center'
                                        /> : 
                                        <img 
                                            src={data.photoURL || avatar} 
                                            alt='avatar' 
                                            className='w-35 h-35 rounded-full border-2 border-slate-800 object-center'
                                        />
                                    }
                                </div>
                                <FileUploader fileEntry={fileEntry} onChange={setFileEntry}/>
                            </div>
                            <div className="flex flex-col">
                                <Label className='mb-4' htmlFor='displayName'>Display Name</Label>
                                <Input 
                                    className='mb-8'
                                    id='displayName'
                                    placeholder="Enter your username"
                                    value={data.displayName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                                        setData({...data, displayName: e.target.value})
                                    }
                                />
                            </div>
                            <div className="flex flex-col">
                                <Label className='mb-4' htmlFor='userBio'>Profile Bio</Label>
                                <Textarea 
                                    className='mb-8'
                                    id='userBio'
                                    placeholder="Make your bio"
                                    value={data.userBio}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                                        setData({...data, userBio: e.target.value})
                                    }
                                />
                            </div>
                            <Button className='mt-4 w-32 mr-8 cursor-pointer hover:bg-sky-300' type='submit'>
                                Update
                            </Button>
                            <Button 
                                variant="destructive" 
                                className='mt-4 w-32 mr-8 cursor-pointer hover:bg-sky-300' 
                                onClick={() => navigate("/profile")}
                                type="button"
                            >
                                Cancel
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default EditProfile;