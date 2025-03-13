import React, { useCallback, useRef, useState } from 'react';
import { OutputFileEntry, UploadCtxProvider } from '@uploadcare/file-uploader';
import { FileUploaderRegular } from '@uploadcare/react-uploader/next';
import '@uploadcare/react-uploader/core.css';
import { FileEntry } from '@/types';

interface IProfilePictureUploaderProps {
  fileEntry: FileEntry;
  onChange: (fileEntry: FileEntry) => void;
  preview?: boolean;
}

const ProfilePictureUploader: React.FunctionComponent<IProfilePictureUploaderProps> = ({ 
  fileEntry, 
  onChange, 
  preview = true 
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<OutputFileEntry<'success'>[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const ctxProviderRef = useRef<InstanceType<UploadCtxProvider>>(null);

  const handleRemoveClick = useCallback(
    (uuid: OutputFileEntry["uuid"]) =>
      onChange({ files: fileEntry.files.filter((f) => f.uuid !== uuid) }),
    [fileEntry.files, onChange]
  );

  const resetUploaderState = () => ctxProviderRef.current?.uploadCollection.clearAll();

  const handleModalCloseEvent = () => {
    resetUploaderState();
    // For profile picture, we only want the most recent upload
    if (uploadedFiles.length > 0) {
      onChange({ files: [uploadedFiles[uploadedFiles.length - 1]] });
    }
    setUploadedFiles([]);
    setIsUploading(false);
  };

  const handleChangeEvent = (files: any) => {
    setIsUploading(files.allEntries.some((f: any) => f.status === 'uploading'));
    setUploadedFiles([...files.allEntries.filter((f: any) => f.status === 'success')] as OutputFileEntry<'success'>[]);
  };

  // Custom styles for the uploader
  const customUploaderStyles = {
    '--darkest-color': 'var(--primary, #3a56e4)',
    '--primary-color': 'var(--primary-light, #5a76ff)',
    '--primary-color-light': 'var(--primary-lighter, #8a9aff)',
    '--uploader-bg': '#f8fafc',
    '--uploader-border': '2px dashed #e2e8f0',
  } as React.CSSProperties;

  // Define uploader props explicitly to avoid TypeScript errors
  const uploaderProps = {
    sourceList: "local, camera, url",
    classNameUploader: "uc-light",
    pubkey: "3423ae7df08aa50be07c",
    multiple: false,
    onModalClose: handleModalCloseEvent,
    onChange: handleChangeEvent,
    accept: "image/*",
    cropPreset: "1:1", // Ensures square cropping for profile pictures
    imageShrink: "512x512", // Optimizes image size
    previewStep: preview,
    effects: "enhance, sharp", // Basic image enhancement
    ctxProviderRef: ctxProviderRef
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">Upload Profile Picture</h3>
        <p className="text-sm text-gray-500">Choose a square image for best results</p>
      </div>

      {fileEntry.files.length === 0 ? (
        <div 
          className="relative rounded-lg transition-all hover:shadow-md"
          style={customUploaderStyles}
        >
          <FileUploaderRegular {...uploaderProps} />
        </div>
      ) : (
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <p className="text-blue-700 text-sm">
            Profile picture uploaded. You can remove it and upload a new one.
          </p>
        </div>
      )}

      {isUploading && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-blue-700 text-sm flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Uploading profile picture...
          </p>
        </div>
      )}
      
      {fileEntry.files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-center">
            <div className="relative group">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-lg">
                <img
                  src={`${fileEntry.files[0].cdnUrl}/-/format/webp/-/quality/smart/-/scale_crop/512x512/center/`}
                  alt="Profile picture"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <button
                className="absolute -right-2 -top-2 bg-white shadow-md border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-500 transition-all"
                type="button"
                onClick={() => handleRemoveClick(fileEntry.files[0].uuid)}
                aria-label="Remove profile picture"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="mt-4 flex justify-center">
                <button
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  type="button"
                  onClick={() => onChange({ files: [] })}
                >
                  Change Photo
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 max-w-md mx-auto">
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Original</h4>
              <div className="aspect-square overflow-hidden rounded-md">
                <img
                  src={`${fileEntry.files[0].cdnUrl}`}
                  alt="Original"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Enhanced</h4>
              <div className="aspect-square overflow-hidden rounded-md">
                <img
                  src={`${fileEntry.files[0].cdnUrl}/-/enhance/50/`}
                  alt="Enhanced"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Apply effects (preview)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="overflow-hidden rounded-md aspect-square">
                <img
                  src={`${fileEntry.files[0].cdnUrl}/-/filter/grayscale/`}
                  alt="Grayscale"
                  className="w-full h-full object-cover"
                />
                <p className="text-xs text-center mt-1">Grayscale</p>
              </div>
              <div className="overflow-hidden rounded-md aspect-square">
                <img
                  src={`${fileEntry.files[0].cdnUrl}/-/filter/invert/`}
                  alt="Invert"
                  className="w-full h-full object-cover"
                />
                <p className="text-xs text-center mt-1">Invert</p>
              </div>
              <div className="overflow-hidden rounded-md aspect-square">
                <img
                  src={`${fileEntry.files[0].cdnUrl}/-/sharp/10/`}
                  alt="Sharpen"
                  className="w-full h-full object-cover"
                />
                <p className="text-xs text-center mt-1">Sharpen</p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Image ID: {fileEntry.files[0].uuid?.substring(0, 8)}... • 
              Size: {Math.round(fileEntry.files[0].size / 1024)} KB • 
              Format: {fileEntry.files[0].mimeType?.split('/')[1] || 'unknown'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePictureUploader;