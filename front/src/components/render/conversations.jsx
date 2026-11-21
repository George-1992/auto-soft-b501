import { useEffect, useMemo, useState } from 'react';
import { CarFrontIcon, MessageSquareTextIcon, SearchIcon } from 'lucide-react';
import { sendBackRequest } from '@/src/services/backend';
import { logger } from '@/src/services/logger';

const formatDate = (value) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

const getPreview = (conversation) => {
    const latest = conversation?.messages?.[0];
    if (!latest) return 'No messages yet';

    if (latest.textContent) {
        try {
            const parsed = JSON.parse(latest.textContent);
            if (typeof parsed === 'string') return parsed;
        } catch {
            if (typeof latest.textContent === 'string') return latest.textContent;
        }
    }

    if (typeof latest.textContent === 'string' && latest.textContent.trim()) {
        return latest.textContent;
    }

    if (Array.isArray(latest.content)) {
        const text = latest.content
            .filter((part) => part?.type === 'text' && part?.text)
            .map((part) => part.text)
            .join(' ');
        if (text) return text;

        const prompt = latest.content.find((part) => part?.type === 'options')?.prompt;
        if (prompt) return prompt;
    }

    return 'Open conversation';
};

const getVehicleLabel = (vehicle) => {
    if (!vehicle || typeof vehicle !== 'object') return '';

    return [vehicle.yearFrom, vehicle.make, vehicle.model]
        .filter(Boolean)
        .join(' ');
};

export default function ConversationsHistory({
    activeConversationId = '',
    onSelect = null,
}) {
    const [conversations, setConversations] = useState([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const fetchConversations = async () => {
        setIsLoading(true);
        try {
            const result = await sendBackRequest({
                itsFor: 'conversations',
                action: 'get',
                limit: 100,
                offset: 0,
            });

            if (result?.success) {
                setConversations(Array.isArray(result.data) ? result.data : []);
            } else {
                logger.warn('Conversations history request failed:', result?.message);
                setConversations([]);
            }
        } catch (error) {
            logger.error('Error loading conversations:', error);
            setConversations([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    const filteredConversations = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return conversations;

        return conversations.filter((conversation) => {
            const vehicle = getVehicleLabel(conversation.vehicle);
            const preview = getPreview(conversation);
            return [conversation.title, vehicle, preview]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [conversations, search]);

    return (
        <div className="flex max-h-[70vh] min-h-64 w-full flex-col gap-3">
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search conversations"
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
            </div>

            {isLoading ? (
                <div className="grid gap-2">
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="h-24 animate-pulse rounded-xl border border-gray-100 bg-gray-100" />
                    ))}
                </div>
            ) : filteredConversations.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center">
                    <MessageSquareTextIcon className="mb-2 size-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">
                        {search ? 'No matching conversations' : 'No conversations yet'}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                        {search ? 'Try a different search.' : 'Start a new parts search.'}
                    </p>
                </div>
            ) : (
                <div className="grid max-h-[58vh] gap-2 overflow-y-auto pr-1">
                    {filteredConversations.map((conversation) => {
                        const vehicleLabel = getVehicleLabel(conversation.vehicle);
                        const isActive = activeConversationId === conversation.id;

                        return (
                            <button
                                key={conversation.id}
                                type="button"
                                onClick={() => onSelect?.(conversation)}
                                className={`group w-full rounded-xl border p-3 text-left transition duration-150 ${isActive
                                    ? 'border-blue-400 bg-blue-50 shadow-sm'
                                    : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                                        }`}>
                                        {vehicleLabel
                                            ? <CarFrontIcon className="size-5" />
                                            : <MessageSquareTextIcon className="size-5" />}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="truncate text-sm font-semibold text-gray-900">
                                                {conversation.title || 'Untitled conversation'}
                                            </h3>
                                            <span className="shrink-0 text-[11px] text-gray-400">
                                                {formatDate(conversation.updatedAt)}
                                            </span>
                                        </div>

                                        {vehicleLabel && (
                                            <p className="mt-1 truncate text-xs font-medium text-blue-700">
                                                {vehicleLabel}
                                            </p>
                                        )}

                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                                            {getPreview(conversation)}
                                        </p>

                                        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
                                            <span>{conversation._count?.messages ?? conversation.messages?.length ?? 0} messages</span>
                                            {isActive && <span className="rounded-full bg-blue-600 px-2 py-0.5 font-medium text-white">Active</span>}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}