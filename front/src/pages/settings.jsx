import { PrimaryButton } from "@/src/components/ui/buttons";
import Card from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/inputs";
import { LoaderShimmer } from "@/src/components/ui/loader";
import { CountriesSelect } from "@/src/components/ui/locale";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { useEffect, useState } from "react";

export default function Settings() {

    const [_data, _setData] = useState(null);
    const [_isLoading, _setIsLoading] = useState(true);

    setMetas({
        title: 'Settings',
        // description: '',
        // icon: GLOBALS.LOGO.MAIN,
    });


    useEffect(() => {
        const body = async () => {
            try {

                const response = await sendBackRequest({
                    action: 'get',
                    itsFor: 'settings',
                })
                if (response.success) {
                    _setData(response.data);
                } else {
                    notify({
                        type: 'error',
                        message: response.message || 'Error loading settings page',
                    });
                    logger.error("Settings error", response.message || 'Error loading settings page');
                }
            } catch (error) {
                notify({
                    type: 'error',
                    message: 'Error loading settings page',
                });
                logger.error("Settings error", error);
            }
            finally {
                _setIsLoading(false);
            }
        };
        body();
    }, []);


    // logger.info("Settings _data", _data);
    const handleInputChange = (key, value) => {
        _setData((prev) => ({
            ...prev,
            [key]: value,
        }));
    }
    const handleSave = async () => {
        try {
            const response = await sendBackRequest({
                action: 'update',
                itsFor: 'settings',
                data: _data,
            });
            if (response.success) {
                notify({
                    type: 'success',
                    message: 'Settings saved successfully',
                });
            } else {
                notify({
                    type: 'error',
                    message: response.message || 'Error saving settings',
                });
                logger.error("Settings save error", response.message || 'Error saving settings');
            }
        } catch (error) {
            notify({
                type: 'error',
                message: 'Error saving settings',
            });
            logger.error("Settings save error", error);
        }
    };

    logger.info("Settings _data", _data);

    return (
        <div className="w-full relative rounded-md">
            <LoaderShimmer isLoading={_isLoading} />
            <h1 className="text-2xl font-bold mb-4">
                Settings
            </h1>
            <Card>
                <div className="md:w-96 flex flex-col gap-5">
                    <div>
                        <label htmlFor="name">Name</label>
                        <Input
                            id="name"
                            className="w-full border border-gray-300 rounded-md p-2"
                            value={_data?.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="country">Country</label>
                        <CountriesSelect
                            id="country"
                            className="w-full "
                            value={_data?.country || ''}
                            onChange={(value) => handleInputChange('country', value)}
                        />
                    </div>
                </div>

                <div className="mt-10">
                    <PrimaryButton
                        size="lg"
                        onClick={handleSave}
                    >
                        Save
                    </PrimaryButton>
                </div>
            </Card>

        </div>
    );
}