import { LoaderShimmer } from '@/src/components/ui/loader';
import React from 'react';

export const Input = React.forwardRef(({
    className = '',
    error = '',
    disabled = false,
    isLoading = false,
    ...props
}, ref) => {
    const baseClass = 'w-full h-9 rounded-md border p-2 focus:outline-none focus:ring-0';
    const stateClass = error ? 'border-red-400' : 'border-gray-300';
    const bgClass = isLoading ? 'loading-shimmer' : '';

    return (
        <input
            ref={ref}
            {...props}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            aria-invalid={!!error}
            className={`bg-[var(--input)] ${baseClass} ${stateClass} ${bgClass} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`.trim()}
        />
    );
});

Input.displayName = 'Input';


export const Textarea = React.forwardRef(({
    className = '',
    error = '',
    disabled = false,
    isLoading = false,
    ...props
}, ref) => {
    const baseClass = 'w-full min-h-20 rounded-md border p-2 focus:outline-none focus:ring-0';
    const stateClass = error
        ? 'border-red-400'
        : 'border-gray-300';

    return (
        <textarea
            ref={ref}
            {...props}
            disabled={disabled || isLoading}
            className={`bg-[var(--input)] ${baseClass} ${stateClass} ${isLoading ? 'loading-shimmer' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`.trim()}
        />
    );
}); 