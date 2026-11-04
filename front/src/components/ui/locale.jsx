import Select from "@/src/components/ui/select";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { logger } from "@/src/services/logger";
import { languages, countries } from "@/i18n";
import Image from "@/src/components/wraps/image";

export default function LanguageSwitch({ onChange = () => { }, className }) {

    const { t, i18n } = useTranslation()
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'en');

    const getImageCodeFromLanguageCode = (code) => {
        if (code === 'en') {
            return 'us';
        } else {
            return code;
        }
    };

    const handleLanguageChange = (e) => {
        const selectedLanguage = e.target.value;
        setCurrentLanguage(selectedLanguage);
        i18n.changeLanguage(selectedLanguage);
        onChange(selectedLanguage);
    };

    return (
        <div className={className || "w-40"}>
            <Select
                className="w-full"
                value={currentLanguage}
                options={languages.map((lang) => ({
                    value: lang.code,
                    label: lang.label,
                    flag: lang.flag,
                }))}
                defaultValue="en"
                onChange={handleLanguageChange}
                renderOption={(option) => (
                    <div className="flex items-center gap-2">
                        <Image
                            src={'/images/flags/' + getImageCodeFromLanguageCode(option.value) + '.svg'}
                            alt={option.label}
                            className="rounded-sm w-4 h-auto"
                        />
                        <span>{option.label}</span>
                    </div>
                )}
                renderValue={(option) => (
                    <div className="flex items-center gap-2 min-w-0">
                        <Image
                            src={'/images/flags/' + getImageCodeFromLanguageCode(option.value) + '.svg'}
                            alt={option.label}
                            className="rounded-sm w-4 h-auto"
                        />
                        <span className="truncate">{option.label}</span>
                    </div>
                )}
            />
        </div>
    );
}

export const CountriesSelect = ({ value, onChange, className }) => {
    // const { t } = useTranslation();
    const [currentCountry, setCurrentCountry] = useState(value || 'us');

    const handleCountryChange = (e) => {
        const selectedCountry = e.target.value;
        setCurrentCountry(selectedCountry);
        if (onChange) {
            onChange(selectedCountry);
        }
    };

    useEffect(() => {
        setCurrentCountry(value || 'us');
    }, [value]);


    return (
        <Select
            className={className || "w-40"}
            value={currentCountry}
            options={countries.map((country) => ({
                value: country.code,
                label: country.label || country.code.toUpperCase(),
                flag: country.flag,
            }))}
            defaultValue="us"
            onChange={handleCountryChange}
            renderOption={(option) => (
                <div className="flex items-center gap-2">
                    <Image
                        src={'/images/flags/' + option.value + '.svg'}
                        alt={option.label}
                        className="rounded-sm w-4 h-auto"
                    />
                    <span>{option.label}</span>
                </div>
            )}
            renderValue={(option) => (
                <div className="flex items-center gap-2 min-w-0">
                    <Image
                        src={'/images/flags/' + option.value + '.svg'}
                        alt={option.label}
                        className="rounded-sm w-4 h-auto"
                    />
                    <span className="truncate">{option.label}</span>
                </div>
            )}
        />
    );
};

