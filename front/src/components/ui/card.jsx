import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';

export default function Card({ children, className = '', isLoading = false, ...props }) {
    return (
        <div className={`rounded-md border-[1px] border-gray-400/60 bg-white p-4 ${className} ${isLoading ? 'loading-shimmer' : ''}`} {...props}>
            {children}
        </div>
    );
}

export function ExpandableCard({
    title,
    header,
    children,
    className = '',
    headerClassName = '',
    bodyClassName = '',
    defaultExpanded = true,
    expanded,
    onExpandedChange,
    disabled = false,
    keepMounted = false,
    icon = null,
    isLoading = false,
    ...props
}) {
    const isControlled = typeof expanded === 'boolean';
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
    const isExpanded = isControlled ? expanded : internalExpanded;

    const handleToggle = () => {
        if (disabled) return;
        const next = !isExpanded;
        if (!isControlled) {
            setInternalExpanded(next);
        }
        if (onExpandedChange) {
            onExpandedChange(next);
        }
    };

    return (
        <div className={`rounded-md border-[1px] border-gray-400/60 bg-white ${className} ${isLoading ? 'loading-shimmer' : ''}`} {...props}>
            <button
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                aria-expanded={isExpanded}
                className={`w-full flex items-center justify-between gap-3 p-2 text-left border-b border-gray-200 disabled:opacity-60 disabled:cursor-not-allowed rounded-t-md ${headerClassName}`}
            >
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                    {icon && icon}
                    <span> {header || title}</span>
                </div>
                <ChevronDownIcon
                    className={`size-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                />
            </button>

            {(isExpanded || keepMounted) && (
                <div className={`${isExpanded ? 'block' : 'hidden'} p-3 ${bodyClassName}`}>
                    {children}
                </div>
            )}
        </div>
    );
}

export const CollapsibleCard = ExpandableCard;