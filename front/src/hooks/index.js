import { internetConnection } from '@/src/services/validation';
import { useEffect, useState } from 'react';

export const useOnline = () => {
    const [online, setOnline] = useState(navigator.onLine);

    useEffect(() => {
        const check = async () => setOnline(await internetConnection());
        const goOffline = () => setOnline(false);

        window.addEventListener('online', check);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', check);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return online;
};