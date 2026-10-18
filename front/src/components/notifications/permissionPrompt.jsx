import { useEffect, useState } from 'react';
import Card from '@/src/components/ui/card';
import { DangerButton, OutlineButton, PrimaryButton } from '@/src/components/ui/buttons';
import { notify } from '@/src/components/ui/sonnar/sonnar';
import { sendBackRequest } from '@/src/services/backend';
import { logger } from '@/src/services/logger';


const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const base64ToUint8 = (b64) => {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const showLocalNotification = async (title, body) => {
    const registration = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null;

    if (registration) {
        return registration.showNotification(title, { body, icon: '/icon-192.png' });
    }

    new Notification(title, { body });
};

export default function NotificationPermissionPrompt() {
    const [permission, setPermission] = useState(null);
    const [isRequesting, setIsRequesting] = useState(false);

    useEffect(() => {
        const body = async () => {
            setPermission('Notification' in window ? Notification.permission : 'unsupported');

            // fetch the current webpush config from backend
            const response = await sendBackRequest({
                itsFor: 'webpush',
                action: 'get',
                method: 'POST',
            })
            // logger.info('WebpushButton: webpush config response:', response);

            if (response.success && response.data) {
                setPermission('granted');
            }
        };
        body();
    }, []);

    if (permission === null) {
        return null;
    }

    const supported = permission !== 'unsupported';

    const requestPermission = async () => {
        if (isRequesting) {
            return;
        }

        setIsRequesting(true);

        try {
            const next = await Notification.requestPermission();
            setPermission(next);
            console.log('Notification.requestPermission:', next);

            if (next === 'granted') {
                if (!('serviceWorker' in navigator)) {
                    notify({ type: 'warning', message: 'Service Worker is not supported in this browser.' });
                    return;
                }

                if (!('PushManager' in window)) {
                    notify({ type: 'warning', message: 'PushManager is not supported in this browser.' });
                    return;
                }

                const reg = await navigator.serviceWorker.getRegistration();

                if (!reg) {
                    notify({
                        type: 'warning',
                        message: 'No active service worker yet. Reload once after SW is registered, then retry.',
                    });
                    return;
                }

                let sub = await reg.pushManager.getSubscription();
                if (!sub) {
                    if (!VAPID_PUBLIC_KEY) {
                        notify({ type: 'warning', message: 'Missing VITE_VAPID_PUBLIC_KEY in frontend env.' });
                        return;
                    }

                    sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: base64ToUint8(VAPID_PUBLIC_KEY),
                    });
                }
                console.log('push subscription:', sub.toJSON());
            }

            if (next === 'granted') {
                notify({ type: 'success', message: 'Notifications are enabled for this app.' });
                await showLocalNotification('Notifications enabled', 'Local permission test.');
            } else if (next === 'denied') {
                notify({ type: 'warning', message: 'Permission denied. Enable it in browser or system settings.' });
            } else {
                notify({ type: 'info', message: 'Permission request was dismissed.' });
            }
        } catch (error) {
            notify({ type: 'error', message: error?.message || 'Failed to request permission.' });
        } finally {
            setIsRequesting(false);
        }
    };

    const revokePermission = async () => {
        if (isRequesting) {
            return;
        }

        setIsRequesting(true);

        try {
            let isUnsubscribed = false;

            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) {
                    const sub = await reg.pushManager.getSubscription();
                    if (sub) {
                        isUnsubscribed = await sub.unsubscribe();
                    }
                }
            }

            const response = await sendBackRequest({
                itsFor: 'webpush',
                action: 'delete',
                method: 'POST',
            });

            if (response.success) {
                notify({ type: 'success', message: 'Notification permission revoked successfully on our server. You can also revoke it in your browser settings.' });
            } else {
                notify({ type: 'error', message: response.message || 'Failed to revoke notification permission on our server.' });
            }



        } catch (error) {
            notify({ type: 'error', message: error?.message || 'Failed to revoke notification permission.' });
        } finally {
            // setIsRequesting(false);
        }
    };

    const sendTest = async () => {
        try {
            const response = await sendBackRequest({
                itsFor: 'webpush',
                action: 'notify',
                method: 'POST',
                data: {
                    title: 'Test Notification',
                    body: 'This is a test notification from the app.',
                },
            });

            logger.info('sendTest: response:', response);
        } catch (error) {
            notify({ type: 'error', message: error?.message || 'Failed to show notification.' });
        }
    };

    const statusTone = permission === 'granted'
        ? 'text-green-700'
        : permission === 'denied'
            ? 'text-red-600'
            : 'text-amber-700';

    return (
        <Card>
            <div className="mb-4">
                <h2 className="text-lg font-semibold">Notifications</h2>
                <p className="text-sm opacity-65">
                    Ask for notification permission and verify it with a local test.
                </p>
            </div>

            {!supported ? (
                <p className="text-sm text-red-600">This browser does not support notifications.</p>
            ) : (
                <div className="space-y-4">
                    <div>
                        <p className="text-sm opacity-70">Current permission</p>
                        <p className={`text-sm font-medium capitalize ${statusTone}`}>{permission}</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {/* <PrimaryButton
                            type="button"
                            onClick={requestPermission}
                            isLoading={isRequesting}
                            disabled={permission === 'granted'}
                        >
                            {permission === 'granted' ? 'Permission Granted' : 'Enable Notifications'}
                        </PrimaryButton> */}

                        <DangerButton
                            type="button"
                            onClick={revokePermission}
                            disabled={permission !== 'granted'}
                            isLoading={isRequesting}
                        >
                            Revoke Permission
                        </DangerButton>

                        <OutlineButton
                            type="button"
                            onClick={sendTest}
                            disabled={permission !== 'granted'}
                        >
                            Send Test Notification
                        </OutlineButton>
                    </div>

                    <p className="text-xs opacity-60">
                        This tests local notifications only. Background notifications need push plus a backend trigger.
                    </p>
                </div>
            )}
        </Card>
    );
}