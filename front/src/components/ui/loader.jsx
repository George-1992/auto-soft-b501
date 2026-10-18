import { Loader2, LoaderIcon } from "lucide-react";

export const LoaderEl = ({ className, content = '' }) => {
    const _className = 'w-full h-full absolute inset-0 flex gap-5 items-center justify-center bg-white ' + (className || '');

    return (
        <div className={_className}>
            <LoaderIcon className="size-8 animate-spin text-primary" />
            {content}
        </div>
    );
}

export const LoaderShimmer = ({ className, content = '', isLoading = true }) => {

    if (!isLoading) return null;

    return (
        <div className={"animate-shimmer " + (className || '')}>
            {content}
        </div>
    );
}