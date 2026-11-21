import { useEffect, useMemo, useState } from "react";
import { PopupModal } from "@/src/components/modals";
import { DangerButton, SecondaryButton } from "@/src/components/ui/buttons";




const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
};

export default function Sessions({ sessions = [], onDeleteSession = null }) {
    const [_sessions, _setSessions] = useState(Array.isArray(sessions) ? sessions : []);
    const [_deleteItem, _setDeleteItem] = useState(null);
    const [_isDeleting, _setIsDeleting] = useState(false);

    useEffect(() => {
        _setSessions(Array.isArray(sessions) ? sessions : []);
    }, [sessions]);

    const sortedSessions = useMemo(() => {
        return [..._sessions].sort((a, b) => {
            const aTs = new Date(a?.lastActiveAt || a?.updatedAt || a?.createdAt || 0).getTime();
            const bTs = new Date(b?.lastActiveAt || b?.updatedAt || b?.createdAt || 0).getTime();
            return bTs - aTs;
        });
    }, [_sessions]);

    const handleConfirmDelete = async () => {
        if (!_deleteItem?.id) return;

        const itemId = _deleteItem.id;
        _setIsDeleting(true);

        try {
            if (typeof onDeleteSession === "function") {
                await onDeleteSession(_deleteItem);
            }

            _setSessions((prev) => prev.filter((item) => item.id !== itemId));
            _setDeleteItem(null);
        } finally {
            _setIsDeleting(false);
        }
    };

    return (
        <div className="rounded-md border border-gray-300 bg-white p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
                <span className="text-sm text-gray-500">{sortedSessions.length}</span>
            </div>

            {sortedSessions.length === 0 && (
                <p className="text-sm text-gray-500">No active sessions found.</p>
            )}

            <div className="flex flex-col gap-3">
                {sortedSessions.map((item) => {
                    const isRevoked = Boolean(item?.revokedAt);
                    const lastActive = item?.lastActiveAt || item?.updatedAt || item?.createdAt;
                    const expiresAt = item?.expires || item?.expiresAt;

                    return (
                        <div
                            key={item.id}
                            className="rounded-md border border-gray-200 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                        >
                            <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate flex flex-col md:flex-row md:items-center gap-2">
                                    <span>
                                        {item?.deviceName || "Unknown Device"}
                                    </span>
                                    <span className="rounded-md bg-gray-100 text-gray-600 px-2 py-0.5 text-xs">
                                        {item?.ip || 'Unknown IP'}
                                    </span>
                                    <span className="rounded-md bg-gray-100 text-gray-600 px-2 py-0.5 text-xs">
                                        {item?.country || 'Unknown Country'}
                                    </span>
                                </p>
                                <p className="text-sm text-gray-600">
                                    {[item?.deviceType, item?.deviceOS, item?.deviceBrowser].filter(Boolean).join(" | ") || "Unknown platform"}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Last active: {formatDateTime(lastActive)}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Expires: {formatDateTime(expiresAt)}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {isRevoked && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">Revoked</span>
                                )}
                                <DangerButton
                                    size="sm"
                                    onClick={() => _setDeleteItem(item)}
                                    disabled={_isDeleting}
                                >
                                    Delete
                                </DangerButton>
                            </div>
                        </div>
                    );
                })}
            </div>

            {_deleteItem && (
                <PopupModal
                    isOpen={true}
                    onClose={() => (_isDeleting ? null : _setDeleteItem(null))}
                    title="Confirm Delete"
                    size="md"
                >
                    <div className="p-2 flex flex-col gap-4">
                        <p className="text-sm text-gray-700">
                            Are you sure you want to delete this session?
                        </p>
                        <p className="text-xs text-gray-500">
                            {_deleteItem?.deviceName || "Unknown Device"} - {formatDateTime(_deleteItem?.lastActiveAt || _deleteItem?.updatedAt || _deleteItem?.createdAt)}
                        </p>

                        <div className="flex justify-end gap-2">
                            <SecondaryButton
                                onClick={() => _setDeleteItem(null)}
                                disabled={_isDeleting}
                            >
                                Cancel
                            </SecondaryButton>
                            <DangerButton
                                onClick={handleConfirmDelete}
                                isLoading={_isDeleting}
                                disabled={_isDeleting}
                            >
                                Delete
                            </DangerButton>
                        </div>
                    </div>
                </PopupModal>
            )}
        </div>
    );
}