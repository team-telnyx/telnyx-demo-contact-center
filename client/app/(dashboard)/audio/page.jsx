'use client';

import { useState, useRef, useCallback } from 'react';
import { useGetAudioFilesQuery, useUploadAudioFileMutation, useDeleteAudioFileMutation } from '../../../src/store/api';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

export default function AudioFilesPage() {
  const { data, isLoading, error } = useGetAudioFilesQuery();
  const [uploadFile, { isLoading: uploading }] = useUploadAudioFileMutation();
  const [deleteFile] = useDeleteAudioFileMutation();

  const [dragOver, setDragOver] = useState(false);
  const [playingFile, setPlayingFile] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  const files = data?.files || [];

  const handleUpload = useCallback(async (fileList) => {
    setUploadError(null);
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp3', 'audio/x-wav'];

    for (const file of fileList) {
      if (!allowedTypes.includes(file.type)) {
        setUploadError(`"${file.name}" is not a supported audio format (mp3, wav, ogg, webm)`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the 10MB size limit`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        await uploadFile(formData).unwrap();
      } catch (err) {
        setUploadError(err?.data?.error || err?.message || 'Upload failed');
      }
    }
  }, [uploadFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      handleUpload(Array.from(e.dataTransfer.files));
    }
  }, [handleUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e) => {
    if (e.target.files?.length) {
      handleUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  }, [handleUpload]);

  const handleDelete = useCallback(async (fileName) => {
    try {
      await deleteFile(fileName).unwrap();
      setDeleteConfirm(null);
      if (playingFile === fileName) {
        setPlayingFile(null);
      }
    } catch (err) {
      setUploadError(err?.data?.error || 'Delete failed');
    }
  }, [deleteFile, playingFile]);

  const handlePlay = useCallback((file) => {
    if (playingFile === file.fileName) {
      setPlayingFile(null);
    } else {
      setPlayingFile(file.fileName);
    }
  }, [playingFile]);

  const handleCopyUrl = useCallback(async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(url);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopySuccess(url);
      setTimeout(() => setCopySuccess(null), 2000);
    }
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audio Files</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Upload and manage audio files for IVR prompts, hold music, and greetings.
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
          dragOver
            ? 'border-telnyx-green bg-telnyx-green/5'
            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
        }`}
      >
        <svg className="mb-3 h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H14.25M12 15V3m0 0l-3 3m3-3l3 3" />
        </svg>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {uploading ? 'Uploading...' : 'Drag & drop audio files here'}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          MP3, WAV, OGG, or WebM - Max 10MB
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-3 rounded-lg bg-telnyx-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-telnyx-green/90 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Choose Files'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.ogg,.webm,audio/mpeg,audio/wav,audio/ogg,audio/webm"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Error Message */}
      {(uploadError || error) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {uploadError || error?.data?.error || 'Failed to load audio files'}
          <button onClick={() => setUploadError(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {/* File List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-telnyx-green" />
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            No audio files uploaded yet. Upload your first file above.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 hidden sm:table-cell">Uploaded</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {files.map((file) => (
                <tr key={file.fileName} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 flex-shrink-0 text-telnyx-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900 dark:text-white" title={file.originalName}>
                          {file.originalName}
                        </p>
                        <p className="truncate text-xs text-gray-400" title={file.fileName}>
                          {file.fileName}
                        </p>
                      </div>
                    </div>
                    {/* Inline audio player */}
                    {playingFile === file.fileName && (
                      <div className="mt-2">
                        <audio
                          ref={audioRef}
                          src={file.url}
                          controls
                          autoPlay
                          className="h-8 w-full"
                          onEnded={() => setPlayingFile(null)}
                        />
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                    {formatDate(file.uploadedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Play/Stop */}
                      <button
                        onClick={() => handlePlay(file)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-telnyx-green dark:hover:bg-gray-700"
                        title={playingFile === file.fileName ? 'Stop' : 'Play'}
                      >
                        {playingFile === file.fileName ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h4v16H6zM14 4h4v16h-4z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>

                      {/* Copy URL */}
                      <button
                        onClick={() => handleCopyUrl(file.url)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-500 dark:hover:bg-gray-700"
                        title="Copy URL"
                      >
                        {copySuccess === file.url ? (
                          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>

                      {/* Delete */}
                      {deleteConfirm === file.fileName ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(file.fileName)}
                            className="rounded-lg bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(file.fileName)}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                          title="Delete"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
