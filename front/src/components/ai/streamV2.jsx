import Image from "@/src/components/wraps/image";
import { logger } from "@/src/services/logger";
import { CameraIcon, ChevronRightIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useState, useRef, useEffect } from "react";
import { LoaderShimmer } from "@/src/components/ui/loader";


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



export const MessagesRenderer = ({ messages = [], onOptionClick, isLoading = false, }) => {

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
    value = '',
    onChange,
    onSubmit,
    onCameraCapture,
    disabled = false,
    placeholder = 'Message AI...',
    maxLength,
    className = '',
    isLoading = false,
    isCamera = false,
}) => {
    const textareaRef = useRef(null);
    const cameraInputRef = useRef(null);
    const cameraVideoRef = useRef(null);
    const cameraStreamRef = useRef(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState('');

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
        };
    }, []);

    // Auto-resize textarea height based on content up to max-h-48 (~8 lines)
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 192)}px`;
    }, [value]);

    const handleKeyDown = (e) => {
        // Submit on Enter without Shift
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!disabled && value.trim()) {
                onSubmit?.(value.trim());
            }
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!disabled && value.trim()) {
            onSubmit?.(value.trim());
        }
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

        logger.warn('Webcam access failed:', lastError);
        return false;
    };

    const handleCameraClick = async () => {
        if (disabled) return;

        if (!window.isSecureContext) {
            setCameraError('Camera requires a secure context (localhost or https). Open this app on localhost or enable https.');
            setIsCameraOpen(true);
            return;
        }

        if (!navigator?.mediaDevices?.getUserMedia) {
            setCameraError('Your browser does not expose webcam APIs for this page.');
            setIsCameraOpen(true);
            return;
        }

        const started = await startWebcam();
        if (!started) {
            setCameraError('Webcam could not be started. Check browser camera permissions and make sure no other app is using the camera.');
            setIsCameraOpen(true);
        }
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

        onCameraCapture?.(file);
        closeCameraModal();
    };

    const handleCameraChange = (e) => {
        const file = e?.target?.files?.[0] || null;
        if (file) {
            onCameraCapture?.(file);
        }

        // Reset value so selecting the same image again still fires change.
        if (e?.target) {
            e.target.value = '';
        }
    };

    const isSubmitDisabled = disabled || !value.trim();

    return (
        <form
            onSubmit={handleSubmit}
            className={`relative flex items-end w-full rounded-2xl border border-gray-300 bg-white p-2 shadow-sm transition-all focus-within:border-gray-200 focus-within:ring-1 focus-within:ring-gray-200 ${disabled ? 'opacity-60 bg-gray-50 cursor-not-allowed' : ''
                } ${className}`}
        >
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
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                maxLength={maxLength}
                className="w-full resize-none bg-transparent px-3 py-1.5 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed max-h-48 overflow-y-auto"
            />
            <div className="flex items-center">
                {isCamera && (
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={handleCameraClick}
                        className={`ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all bg-(--primary) ${disabled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'active:scale-95'
                            }`}
                        aria-label="Open camera"
                    >
                        <CameraIcon className="h-4 w-4 text-(--primary-foreground)" />
                    </button>
                )}
                <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className={`ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all bg-(--primary) ${isSubmitDisabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'active:scale-95'
                        }`}
                    aria-label="Send message"
                >
                    <ChevronRightIcon className="h-4 w-4 text-(--primary-foreground)" />
                </button>
            </div>

            <LoaderShimmer isLoading={isLoading} />

            {isCameraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
                    <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                            <h3 className="text-sm font-semibold text-gray-800">Camera</h3>
                            <button
                                type="button"
                                onClick={closeCameraModal}
                                className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
                                aria-label="Close camera"
                            >
                                Close
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
                            <button
                                type="button"
                                onClick={closeCameraModal}
                                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            {cameraError && (
                                <button
                                    type="button"
                                    onClick={openFilePicker}
                                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    Choose photo instead
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={captureFromWebcam}
                                disabled={Boolean(cameraError)}
                                className="rounded-md bg-(--primary) px-3 py-1.5 text-sm text-(--primary-foreground)"
                            >
                                Capture
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};