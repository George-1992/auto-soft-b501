import { HomeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Home() {

    const { t } = useTranslation();

    return (
        <div className="w-full">
            <div className="p-10 rounded-lg shadow-md border border-gray-200 flex flex-col items-center justify-center bg-gradient-to-r from-green-50 to-blue-100">
                <HomeIcon className="size-10 text-sky-600 mb-5" />
                <h1 className="text-2xl font-bold">{t('Welcome back')} !</h1>
                <p className="mt-4 text-gray-600">{t('This is the home page of the application.')}</p>
            </div>
        </div>
    );
} 