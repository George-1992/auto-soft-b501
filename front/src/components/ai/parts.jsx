import Image from "@/src/components/wraps/image";
import { logger } from "@/src/services/logger";
import { CameraIcon, ChevronRightIcon, ImageUpIcon, PaperclipIcon, SendIcon, XIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useState, useRef, useEffect } from "react";
import { LoaderShimmer } from "@/src/components/ui/loader";
import imageCompression from 'browser-image-compression';

export const streamToData = async (stream, onData, signal) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const handleFrame = (frame) => {
        let event = null;
        const dataLines = [];

        for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }

        if (!dataLines.length) return;

        let payload;
        try {
            payload = JSON.parse(dataLines.join('\n'));
        } catch (error) {
            logger.error('Bad stream frame:', frame, error);
            return;
        }

        if (event === 'delta') {
            const incoming = Array.isArray(payload) ? payload : [payload];
            onData(incoming.filter(Boolean));
        } else if (event === 'error') {
            throw new Error(payload?.message || 'Stream error');
        } else if (event === 'done') {
            return 'done';
        }
    };

    try {
        signal?.addEventListener('abort', () => reader.cancel(), { once: true });

        while (true) {
            const { value, done } = await reader.read();

            if (value) {
                buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
            }

            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
                const frame = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                boundary = buffer.indexOf('\n\n');

                if (handleFrame(frame) === 'done') {
                    await reader.cancel();
                    return true;
                }
            }

            if (done) {
                if (buffer.trim()) handleFrame(buffer);
                break;
            }
        }

        return true;
    } catch (error) {
        if (signal?.aborted) return false;
        logger.error('Error processing stream:', error);
        throw error;
    } finally {
        reader.releaseLock?.();
    }
};



export const MessagesRenderer = ({ messages = [], onOptionClick, isLoading = false, mediaFiles = [] }) => {

    const scrollContainerRef = useRef(null);

    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
            scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages.length]);

    if (!messages || messages.length === 0) {
        return null;
    };

    return (
        <div ref={scrollContainerRef} className="w-full flex-1 flex-col items-center justify-center overflow-y-auto scrollbar-thumb-gray-500 scrollbar-track-transparent scrollbar-thin">
            <div className="w-full flex flex-col md:space-y-4 md:p-4">


                {messages.map((msg, index) => {
                    const isUser = msg.role === 'user';
                    const hasRenderItems = Array.isArray(msg.render) && msg.render.length > 0;

                    return (
                        <div
                            key={msg.id || index}
                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                        >
                            {/* Sender Label */}
                            {/* <span className=" text-gray-400 mb-1 px-1 capitalize">
                            {msg.role || 'assistant'}
                        </span> */}

                            {/* Message Bubble */}
                            <div
                                style={
                                    isUser ? { backgroundColor: 'var(--primary, #2563eb)' } : {}
                                }
                                className={`max-w-[85%] md:max-w-[75%] px-4 py-2.5 rounded-2xl leading-relaxed ${isUser
                                    ? 'text-white rounded-br-none shadow-sm break-words'
                                    : 'text-gray-900 bg-transparent px-0 py-0'
                                    }`}
                            >
                                {typeof msg.content === 'string' ? (
                                    isUser ? (
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    ) : (
                                        <div className="prose prose-sm max-w-none dark:prose-invert">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[rehypeHighlight]}
                                                components={{
                                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                    ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                                                    ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                                                    li: ({ children }) => <li className="mb-1">{children}</li>,
                                                    blockquote: ({ children }) => (
                                                        <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2">
                                                            {children}
                                                        </blockquote>
                                                    ),
                                                    code: ({ inline, className, children, ...props }) => {
                                                        if (inline) {
                                                            return (
                                                                <code className="bg-gray-200 px-1 py-0.5 rounded text-sm" {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        }

                                                        return (
                                                            <pre className="bg-gray-800 text-gray-100 p-3 rounded-md overflow-x-auto">
                                                                <code className={className} {...props}>
                                                                    {children}
                                                                </code>
                                                            </pre>
                                                        );
                                                    },
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    )
                                ) : (
                                    JSON.stringify(msg.content ?? msg)
                                )}

                                {/* Rendered Dynamic Widgets (Options, Buttons, etc.) */}
                                {hasRenderItems && (
                                    <div className="mt-3 flex flex-col space-y-2">
                                        {msg.render.map((renderItem, rIdx) => {
                                            if (renderItem.type === 'options') {
                                                return (
                                                    <div
                                                        key={rIdx}
                                                        className="flex flex-col space-y-2 pt-1"
                                                    >
                                                        {renderItem.title && (
                                                            <span className="font-semibold text-gray-500">
                                                                {renderItem.title}
                                                            </span>
                                                        )}
                                                        <div className="flex flex-wrap gap-2">
                                                            {renderItem.options?.map((option) => (
                                                                <button
                                                                    key={option.id || option.value}
                                                                    onClick={() => onOptionClick?.(option)}
                                                                    style={{
                                                                        borderColor: 'var(--primary, #2563eb)',
                                                                        color: 'var(--primary, #2563eb)',
                                                                    }}
                                                                    className="px-3 py-1.5 font-medium rounded-xl border bg-white hover:bg-gray-50 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                                                                >
                                                                    {option.image && (
                                                                        <Image
                                                                            src={option.image}
                                                                            alt={option.value}
                                                                            className="w-4 h-4 rounded-full object-cover"
                                                                        />
                                                                    )}
                                                                    <span>{option.value}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="typing-dots">
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                )}

                {messages.length > 0 && <div className="w-full h-10"></div>}
            </div>
        </div>
    );
};



export const AiInput = ({
    value: controlledValue,
    defaultValue = '',
    onChange,
    onSend,
    disabled = false,
    placeholder = 'Write a message...',
    maxLength,
    className = '',
    isLoading = false,
    isCamera = false,
    isUpload = false,
}) => {
    // Support both uncontrolled (default) and controlled usage
    const [internalValue, setInternalValue] = useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const textValue = isControlled ? controlledValue : internalValue;

    // Store attachments as { id, file, previewUrl }
    const [attachments, setAttachments] = useState([]);

    const textareaRef = useRef(null);
    const cameraInputRef = useRef(null);
    const cameraVideoRef = useRef(null);
    const cameraStreamRef = useRef(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState('');

    // Keep track of attachments for cleanup on unmount
    const attachmentsRef = useRef(attachments);
    attachmentsRef.current = attachments;

    const stopCameraStream = () => {
        if (cameraStreamRef.current) {
            for (const track of cameraStreamRef.current.getTracks()) {
                track.stop();
            }
            cameraStreamRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            stopCameraStream();
            // Revoke all remaining object URLs on unmount to prevent memory leaks
            attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        };
    }, []);

    // Auto-resize textarea height based on content up to max-h-48 (~8 lines)
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 192)}px`;
    }, [textValue]);

    const handleTextChange = (newValue) => {
        if (!isControlled) {
            setInternalValue(newValue);
        }
        onChange?.(newValue);
    };

    const handleAddMedia = (file) => {
        if (!file) return;
        const newAttachment = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            previewUrl: URL.createObjectURL(file),
        };
        setAttachments((prev) => [...prev, newAttachment]);
    };

    const handleRemoveMedia = (id) => {
        setAttachments((prev) => {
            const target = prev.find((item) => item.id === id);
            if (target) URL.revokeObjectURL(target.previewUrl);
            return prev.filter((item) => item.id !== id);
        });
    };

    const triggerSend = () => {
        const trimmedText = textValue.trim();
        const hasContent = Boolean(trimmedText) || attachments.length > 0;

        if (disabled || !hasContent) return;

        onSend?.({
            text: trimmedText,
            files: attachments.map((item) => item.file),
        });

        // Reset text & clean up previews
        if (!isControlled) {
            setInternalValue('');
        }
        onChange?.('');

        attachments.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        setAttachments([]);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            triggerSend();
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        triggerSend();
    };

    const startWebcam = async () => {
        const constraintsList = [
            { video: { facingMode: { ideal: 'environment' } }, audio: false },
            { video: true, audio: false },
        ];

        let lastError = null;

        for (const constraints of constraintsList) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                cameraStreamRef.current = stream;
                setCameraError('');
                setIsCameraOpen(true);

                requestAnimationFrame(() => {
                    const video = cameraVideoRef.current;
                    if (video) {
                        video.srcObject = stream;
                        video.play?.().catch(() => { });
                    }
                });

                return true;
            } catch (error) {
                lastError = error;
            }
        }

        console.warn('Webcam access failed:', lastError);
        return false;
    };

    const handleCameraClick = async () => {
        if (disabled) return false;

        if (!window.isSecureContext) {
            setCameraError('Camera requires a secure context (localhost or https).');
            setIsCameraOpen(true);
            return false;
        }

        if (!navigator?.mediaDevices?.getUserMedia) {
            setCameraError('Your browser does not expose webcam APIs for this page.');
            setIsCameraOpen(true);
            return false;
        }

        const started = await startWebcam();
        if (!started) {
            setCameraError('Webcam could not be started. Check permissions or close other apps using the camera.');
            setIsCameraOpen(true);
            return false;
        }

        return true;
    };

    const closeCameraModal = () => {
        setIsCameraOpen(false);
        setCameraError('');
        stopCameraStream();
    };

    const openFilePicker = () => {
        cameraInputRef.current?.click();
    };

    const captureFromWebcam = async () => {
        const video = cameraVideoRef.current;
        if (!video) return;

        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) return;

        context.drawImage(video, 0, 0, width, height);

        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.92);
        });

        if (!blob) return;

        const file = new File([blob], `camera-${Date.now()}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
        });

        handleAddMedia(file);
        closeCameraModal();
    };

    const handleCameraChange = (e) => {
        const file = e?.target?.files?.[0] || null;
        if (file) {
            handleAddMedia(file);
        }
        if (e?.target) {
            e.target.value = '';
        }
    };

    const isSubmitDisabled = disabled || (!textValue.trim() && attachments.length === 0);

    return (
        <form
            onSubmit={handleSubmit}
            className={`relative flex flex-col w-full rounded-2xl bg-white p-2 shadow-sm transition-all focus-within:border-gray-200 focus-within:ring-1 focus-within:ring-gray-200 ${disabled ? 'opacity-60 bg-gray-50 cursor-not-allowed' : ''
                } ${className}`}
        >
            {attachments.length > 0 && <div className="flex flex-col w-full">
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-2 pt-1 pb-2 mb-1">
                        {attachments.map((item) => (
                            <div
                                key={item.id}
                                className="group relative h-20 w-20 md:h-30 md:w-30 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                            >
                                <Image
                                    src={item.previewUrl}
                                    alt={item.file.name}
                                    className="h-full w-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveMedia(item.id)}
                                    disabled={disabled}
                                    aria-label={`Remove ${item.file.name}`}
                                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white transition-opacity hover:bg-black"
                                >
                                    <XIcon className="size-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>}

            {/* Input Row */}
            <div className="flex items-end w-full">
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraChange}
                    className="hidden"
                    tabIndex={-1}
                    aria-hidden="true"
                />
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={textValue}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    maxLength={maxLength}
                    className="w-full resize-none bg-transparent px-3 py-1.5 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed max-h-48 overflow-y-auto"
                />
                <div className="md:flex items-center gap-2 ">
                    <div className="flex items-center gap-2 md:static absolute right-1 bottom-[106%]">
                        {isUpload && (
                            <UploadButton
                                disabled={disabled}
                                onFilesSelected={(files) => {
                                    files.forEach((file) => handleAddMedia(file));
                                }}
                            />
                        )}

                        {isCamera && (
                            <CameraCaptureButton
                                disabled={disabled}
                                onImageCaptured={handleAddMedia}
                                onOpenDesktopWebcam={handleCameraClick}
                            />
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitDisabled}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all bg-(--primary) ${isSubmitDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
                            }`}
                        aria-label="Send message"
                    >
                        <SendIcon className="size-5 text-(--primary-foreground)" />
                    </button>
                </div>
            </div>

            <LoaderShimmer isLoading={isLoading} />

            {/* Webcam Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
                    <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                            <h3 className="text-sm font-semibold text-gray-800">Camera</h3>
                            <button
                                type="button"
                                onClick={closeCameraModal}
                                className="rounded-full px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 border border-gray-300 transition-all"
                                aria-label="Close camera"
                            >
                                <XIcon className="size-6" />
                            </button>
                        </div>

                        <div className="bg-black">
                            {!cameraError ? (
                                <video
                                    ref={cameraVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="h-80 w-full bg-black object-contain md:h-105"
                                />
                            ) : (
                                <div className="flex h-80 w-full items-center justify-center px-6 text-center text-sm text-white md:h-105">
                                    {cameraError}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 p-3">
                            {/* <button
                                type="button"
                                onClick={closeCameraModal}
                                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button> */}
                            {cameraError && (
                                <button
                                    type="button"
                                    onClick={openFilePicker}
                                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    <ImageUpIcon className="size-6 inline" /> Choose Photo
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={captureFromWebcam}
                                disabled={Boolean(cameraError)}
                                className="rounded-md bg-(--primary) px-3 py-1.5 text-sm text-(--primary-foreground)"
                            >
                                <CameraIcon className="size-6 inline" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};



export function CameraCaptureButton({
    className = '',
    disabled,
    onImageCaptured,
    onOpenDesktopWebcam,
}) {
    const fileInputRef = useRef(null);

    // Detect mobile/tablet devices where native camera input is vastly more reliable
    const isMobileOrTouch = () => {
        if (typeof window === 'undefined') return false;
        return (
            /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 1 && window.innerWidth < 1024)
        );
    };

    const handleCameraClick = async () => {
        if (disabled) return;

        // 1. On mobile or non-HTTPS/unsupported browsers, go straight to native camera
        const canUseWebRTC =
            window.isSecureContext && Boolean(navigator?.mediaDevices?.getUserMedia);

        if (isMobileOrTouch() || !canUseWebRTC) {
            fileInputRef.current?.click();
            return;
        }

        // 2. On desktop, delegate to the parent webcam flow.
        // Parent handles webcam errors and optional "choose photo" fallback in modal.
        if (typeof onOpenDesktopWebcam === 'function') {
            await onOpenDesktopWebcam();
            return;
        }

        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            onImageCaptured(file);
        }
        // Reset input so the user can take another photo of the same name/slot
        e.target.value = '';
    };

    return (
        <>
            {/* Hidden native camera trigger */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment" // Opens rear camera on mobile; remove if you want gallery + camera choice
                onChange={handleFileChange}
                className="hidden"
            />

            <button
                type="button"
                disabled={disabled}
                onClick={handleCameraClick}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all bg-(--primary) ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
                    } ${className}`}
                aria-label="Open camera"
            >
                <CameraIcon className="size-5 text-(--primary-foreground)" />
            </button>
        </>
    );
}

export function UploadButton({
    className = '',
    disabled,
    onFilesSelected,
}) {
    const fileInputRef = useRef(null);

    const handleUploadClick = () => {
        if (disabled) return;
        fileInputRef.current?.click();
    };

    const filesLogTxt = (files) => {
        try {
            const arr = [];
            // log file names and sizes (MB) to console
            for (const file of files) {
                arr.push({
                    name: file.name,
                    sizeMB: (file.size / (1024 * 1024)).toFixed(2),
                    type: file.type,
                });
            }

            return arr;

        } catch (error) {
            logger.error('Error logging files:', error);
        }
    };


    const compressFiles = async (files) => {
        const options = {
            maxSizeMB: 1,              // Target max file size (1MB is standard for web/chat)
            maxWidthOrHeight: 1920,    // Cap longest edge (1920px or 2048px is standard)
            useWebWorker: true,        // Runs off main thread so UI doesn't freeze
            fileType: 'image/webp',    // Modern format: ~30% smaller than JPEG with transparency support
            initialQuality: 0.8,       // Sweet spot between visual fidelity and size
        };

        const compressibleTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const minCompressBytes = 64 * 1024;

        return Promise.all(
            files.map(async (file) => {
                // Skip GIFs, SVGs, PDFs, etc.
                if (!compressibleTypes.includes(file.type)) {
                    logger.info('UploadButton compression skipped (unsupported type):', {
                        name: file.name,
                        type: file.type,
                    });
                    return file;
                }

                // Skip tiny files where recompression gains are usually negligible.
                if (file.size <= minCompressBytes) {
                    logger.info('UploadButton compression skipped (small file):', {
                        name: file.name,
                        sizeKB: (file.size / 1024).toFixed(1),
                    });
                    return file;
                }

                try {
                    const compressedBlob = await imageCompression(file, options);

                    // Safety check: only use compressed version if it's actually smaller
                    if (compressedBlob.size >= file.size) {
                        logger.info('UploadButton compression kept original (no gain):', {
                            name: file.name,
                            beforeKB: (file.size / 1024).toFixed(1),
                            afterKB: (compressedBlob.size / 1024).toFixed(1),
                        });
                        return file;
                    }

                    // Update extension to .webp if converted
                    const newName = file.name.replace(/\.[^/.]+$/, '.webp');
                    const outFile = new File([compressedBlob], newName, {
                        type: compressedBlob.type,
                        lastModified: Date.now(),
                    });

                    logger.info('UploadButton compression success:', {
                        name: file.name,
                        output: outFile.name,
                        beforeKB: (file.size / 1024).toFixed(1),
                        afterKB: (outFile.size / 1024).toFixed(1),
                        savedPercent: (((file.size - outFile.size) / file.size) * 100).toFixed(1),
                    });

                    return outFile;
                } catch (error) {
                    logger.error('Compression failed, falling back to original:', error);
                    return file;
                }
            })
        );
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            // logger.info('UploadButton selected files:', filesLogTxt(files));
            const compressedFiles = await compressFiles(files);
            // logger.info('UploadButton compressed files:', filesLogTxt(compressedFiles));
            onFilesSelected?.(compressedFiles);

        }
        e.target.value = '';
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
            />

            <button
                type="button"
                disabled={disabled}
                onClick={handleUploadClick}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all bg-(--primary) ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
                    } ${className}`}
                aria-label="Upload files"
            >
                <PaperclipIcon className="size-5 text-(--primary-foreground)" />
            </button>
        </>
    );
}