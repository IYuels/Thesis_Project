import FileUploader from '@/components/fileUploader';
import Layout from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileEntry, ProfileInfo, UserProfile } from '@/types';
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import avatar from '@/assets/images/avatar.png';
import { Input } from '@/components/ui/input';
import { createUserProfile, updateUserProfile } from '@/repository/user.service';
import { useUserAuth } from '@/context/userAuthContext';
import { updateUserInfoOnPosts } from '@/repository/post.service';

interface IEditProfileProps {}

const EditProfile: React.FunctionComponent<IEditProfileProps> = () => {
    const {user, updateProfileInfo} = useUserAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { id, userId, userBio, displayName, photoURL } = location.state;
    const [fileEntry, setFileEntry] = React.useState<FileEntry>({
        files: [],
    });
    const [data, setData] = React.useState<UserProfile>({
        userId,
        userBio,
        displayName,
        photoURL,
    });
    const updateProfile = async (e: React.MouseEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            if (id) {
                const response = await updateUserProfile(id, data);
                console.log("The updated profile is : ", response);
            } else {
                const response = await createUserProfile(data);
                console.log("The created profile is : ", response);
            }
            const profileInfo: ProfileInfo = {
                user: user!,
                displayName: data.displayName,
                photoURL: data.photoURL,
            };
            updateProfileInfo(profileInfo);

            updateUserInfoOnPosts(profileInfo);

            navigate("/profile");
        } catch (err) {
            console.log(err);
        }
    };
    React.useEffect(() => {
        if (fileEntry.files.length > 0) {
            setData({...data, photoURL: fileEntry.files[0].cdnUrl || ""});
        }
    }, [fileEntry]);
    return (
        <Layout>
            <div className='flex justify-center'>
                <div className='border max-w-3xl w-full'>
                    <h3 className='bg-slate-800 text-white text-center text-lg p-2'>
                        EditProfile
                    </h3>
                    <div className='p-8'>
                        <form onSubmit={updateProfile}>  
                        <div className="flex flex-col">
                                <Label className='mb-4' htmlFor='photo'>Profile Picture</Label>
                                <div className="mb-4">
                                    {fileEntry.files.length > 0 ? 
                                    <img src={fileEntry.files[0].cdnUrl!} alt='avatar' 
                                    className='w-35 h-35 rounded-full border-2 border-slate-800 object-center'/> : 
                                    <img src={data.photoURL ? data.photoURL : avatar} alt='avatar' 
                                    className='w-35 h-35 rounded-full border-2 border-slate-800 object-center'/>}
                                </div>
                                <FileUploader fileEntry={fileEntry} onChange={setFileEntry} preview ={false}/>
                            </div>
                            <div className="flex flex-col">
                                <Label className='mb-4' htmlFor='displayName'>Display Name</Label>
                                <Input className='mb-8'
                                id='displayName'
                                placeholder="Enter your username"
                                value={data.displayName}
                                    onChange={(e:React.ChangeEvent<HTMLInputElement>) => 
                                        setData({...data, displayName: e.target.value})
                                }/>
                            </div>
                            <div className="flex flex-col">
                                <Label className='mb-4' htmlFor='userBio'>Profile Bio</Label>
                                <Textarea className='mb-8'
                                id='userBio'
                                placeholder="Make your bio"
                                value={data.userBio}
                                    onChange={(e:React.ChangeEvent<HTMLTextAreaElement>) => 
                                        setData({...data, userBio: e.target.value})
                                }/>
                            </div>
                            <Button className='mt-4 w-32 mr-8 cursor-pointer hover:bg-sky-300 ' type='submit'>Update</Button>
                            <Button variant="destructive" className='mt-4 w-32 mr-8 cursor-pointer hover:bg-sky-300' onClick={()=> navigate("/profile")}>Cancel</Button>
                        </form>
                    </div>
                </div>
            </div>
        </Layout>);
};

export default EditProfile;