import { useEffect, useState } from 'react';
import { OutlineButton, PrimaryButton } from '@/src/components/ui/buttons';
import { notify } from '@/src/components/ui/sonnar/sonnar';
import { BellRingIcon } from 'lucide-react';
import { sendBackRequest } from '@/src/services/backend';
import { logger } from '@/src/services/logger';
import { set } from 'lodash';

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

export default function WebpushButton() {
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
            logger.info('WebpushButton: webpush config response:', response);

            if (response.success && response.data) {
                setPermission('granted');
            }else{
                setPermission('default');
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

                // send the subscription to the backend
                const response = await sendBackRequest({
                    itsFor: 'webpush',
                    action: 'update',
                    method: 'POST',
                    data: sub.toJSON(),
                });
                console.log('push subscription:response', response);


                if (response.success) {
                    notify({ type: 'success', message: 'Push subscription saved successfully.' });
                } else {
                    notify({ type: 'error', message: response.message || 'Failed to save push subscription.' });
                }
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

    const sendTest = async () => {
        try {
            sendBackRequest({
                itsFor: 'webpush',
                action: 'notify',
                method: 'POST',
                data: {
                    title: 'Test Notification',
                    body: 'This is a test notification from the app.',
                },
            });
        } catch (error) {
            notify({ type: 'error', message: error?.message || 'Failed to show notification.' });
        }
    };


    // logger.info('WebpushButton: permission:', permission, 'isRequesting:', isRequesting);

    return (
        <div>
            {permission !== 'granted' &&
                <button
                    type="button"
                    className="flex items-center gap-2 p-2 px-4 rounded-full shadow-md hover:bg-gray-100 transition-all duration-200 ease-in-out border border-gray-300"
                    onClick={requestPermission}
                >
                    {/* <Notificat className="size-5 opacity-75" /> */}

                    {permission === 'granted' && null}
                    {['denied', 'default'].includes(permission) && (
                        <div className="flex items-center gap-2 text-sm">
                            <BellRingIcon className="size-5 opacity-75" />
                            Enable Push Notifications
                        </div>
                    )}
                </button>
            }
        </div>
    )


}