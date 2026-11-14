import { CheckIcon, ClipboardCheckIcon, ClipboardIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function CopyEl({ text = '', className = '' }) {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef(null);

    const handleCopy = async () => {
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
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
        <div className={`w-fit flex items-center gap-2 border border-gray-300/80 rounded-md p-1 ${className}`}>
            <span>{text}</span>
            <button type="button" onClick={handleCopy} disabled={!text} className='mx-0.5'>
                {copied && <CheckIcon className='size-4 text-green-800' />}
                {!copied && <ClipboardIcon className='size-4 ' />}
            </button>
        </div>
    );
}