import { CheckIcon, ClipboardCheckIcon, ClipboardIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
// Make sure your icons are imported here

export default function CopyEl({ text = '', className = '', children = null }) {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef(null);

    const handleCopy = async () => {
        if (!text) return;

        try {
            // 1. Modern Clipboard API (works on HTTPS and localhost)
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // 2. Fallback for non-HTTPS environments (e.g., local network IPs)
                const textArea = document.createElement('textarea');
                textArea.value = text;

                // Prevent scrolling to bottom of page on focus
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                textArea.style.top = '0';

                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (!successful) throw new Error('Fallback copy failed');
            }

            setCopied(true);

            // Clear existing timeout if clicked multiple times rapidly
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            timeoutRef.current = setTimeout(() => {
                setCopied(false);
            }, 1000);
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <button type="button" onClick={handleCopy} disabled={!text} className={`w-fit flex items-center gap-1 border border-gray-300/80 rounded-md p-1 ${className}`}>
            {children}
            {text && <span>{text}</span>}
            <span className='mx-0.5 cursor-pointer'>
                {copied ? <CheckIcon className='size-4 text-green-800' /> : <ClipboardIcon className='size-4' />}
            </span>
        </button>
    );
}