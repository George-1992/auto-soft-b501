import { dataSamples } from "@/data/samples";
import { PopupModal } from "@/src/components/modals";
import { PrimaryButton } from "@/src/components/ui/buttons";
import Card from "@/src/components/ui/card";
import { Input, Textarea } from "@/src/components/ui/inputs";
import { LoaderEl, LoaderShimmer } from "@/src/components/ui/loader";
import { CountriesSelect } from "@/src/components/ui/locale";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import Image from "@/src/components/wraps/image";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { clearObjectValues } from "@/src/services/other";
import { cloneDeep, cloneDeepWith } from "lodash";
import { BuildingComplexIcon, GhostIcon, MapPinHouseIcon, PhoneIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";




export default function LocationsPage({ }) {
    
    setMetas({
        title: 'Locations',
        description: 'Manage your locations',
    });


    const itsFor = 'locations';
    const sampleData = cloneDeep(dataSamples[itsFor] || {});
    const [_data, _setData] = useState(null);
    const [_loading, _setLoading] = useState(true);
    const [_editItem, _setEditItem] = useState(null);
    const [_editType, _setEditType] = useState('new');
    const { t } = useTranslation();


    useEffect(() => {
        const body = async () => {
            try {
                const response = await sendBackRequest({
                    action: 'get',
                    itsFor: itsFor,
                });

                // logger.info("LocationsPage response", response);

                if (response.success) {
                    _setData(response.data);
                } else {
                    logger.error("LocationsPage error", response.message || 'Error loading locations page');
                    notify({
                        type: 'error',
                        message: response.message || 'Error loading locations page',
                    });
                }

            } catch (error) {
                logger.error("LocationsPage error", error);
                notify({
                    type: 'error',
                    message: 'Error loading locations page',
                });
            } finally {
                _setLoading(false);
            }
        };
        body();
    }, []);

    const handleInputChange = (field, value) => {
        _setEditItem((prev) => ({
            ...prev,
            [field]: value,
        }));
    };
    const handleAddNew = async () => {
        try {
            // const nd = clearObjectValues(cloneDeep(sampleData));
            // logger.info("handleAddNew nd", nd);
            _setEditItem({});

        } catch (error) {
            logger.error("handleAddNew error", error);
            notify({
                type: 'error',
                message: 'Error adding new location',
            });
        }
    };
    const handleFormSubmit = async (e) => {
        e.preventDefault();

        try {
            _setLoading(true);
            const action = _editType === 'new' ? 'create' : 'update';
            const response = await sendBackRequest({
                action: action,
                itsFor: itsFor,
                data: _editItem,
            });

            if (response.success) {
                notify({
                    type: 'success',
                    message: _editType === 'new' ? t('Location added successfully') : t('Location updated successfully'),
                });
                _setData(response.data);
                dismissEditModal();
            } else {
                logger.error("handleFormSubmit error", response.message || 'Error saving location');
                notify({
                    type: 'error',
                    message: response.message || 'Error saving location',
                });
            }

        } catch (error) {
            logger.error("handleFormSubmit error", error);
            notify({
                type: 'error',
                message: 'Error saving location',
            });
        } finally {
            _setLoading(false);
        }
    };

    const dismissEditModal = () => {
        _setEditItem(null);
        _setEditType('new');
    }


    // logger.info(_data)

    return (
        <div className="w-full relative rounded-md">
            <LoaderShimmer isLoading={_loading} />
            <h1 className="text-2xl font-bold mb-4">
                {t('Locations')}
            </h1>
            <div className="w-full py-3 flex items-center justify-end">
                <PrimaryButton onClick={handleAddNew} >
                    {t('Add New ' + itsFor)}
                </PrimaryButton>
            </div>
            <div className="flex flex-wrap gap-5 md:gap-10">
                {_data?.length > 0 ? _data.map((item, index) => (
                    <Card key={index} className="w-80 h-60 flex flex-col p-4 relative overflow-hidden">
                        <Image src="/images/other/5742761_2981188.svg" alt="Location" className="absolute inset-0 w-full h-10 object-cover" />
                        <div className="flex-1 flex flex-col gap-3">
                            <div className="bg-slate-100 p-2  rounded-md relative overflow-hidden">
                                <h2 className="text-lg font-semibold z-10">{item.name}</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPinHouseIcon className="size-4" />
                                <p>{item.address} {item.city ? `, ${item.city}` : ''} {item.country ? `, ${item.country}` : ''}</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <PhoneIcon className="size-4" />
                                <p>{item.phone}</p>
                            </div>
                            {item.description && <div className="flex items-center gap-2 overflow-hidden">
                                <GhostIcon className="size-4" />
                                <p>{item.description}</p>
                            </div>}
                        </div>
                        <div className="w-full flex items-center justify-end gap-2 mt-4">
                            <PrimaryButton onClick={() => {
                                _setEditItem(item);
                                _setEditType('edit');
                            }
                            }>
                                {t('Edit')}
                            </PrimaryButton>
                        </div>
                    </Card>
                )) : (
                    <div className="w-full flex items-center justify-center">
                        <p>{t('No locations found')}</p>
                    </div>
                )}
            </div>


            <PopupModal isOpen={_editItem} onClose={dismissEditModal} title={_editType === 'new' ? t('Add New Location') : t('Edit Location')}>
                <LoaderShimmer isLoading={_loading} />
                <form onSubmit={handleFormSubmit} className="w-full flex flex-col gap-3 p-4">
                    <div>
                        <label htmlFor="name">{t('Name')}</label>
                        <Input
                            id="name"
                            value={_editItem?.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="country">{t('Country')}</label>
                        <CountriesSelect
                            id="country"
                            className="w-full"
                            value={_editItem?.country || ''}
                            onChange={(value) => handleInputChange('country', value)}
                        />
                    </div>
                    <div className="relative ">
                        <div className="flex items-center gap-2 ">
                            <BuildingComplexIcon className="size-4" />
                            <label htmlFor="city">{t('City')}</label>
                        </div>
                        <Input
                            id="city"
                            className="w-full"
                            value={_editItem?.city || ''}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                        />
                    </div>
                    <div className="relative ">
                        <div className="flex items-center gap-2 ">
                            <MapPinHouseIcon className="size-4" />
                            <label htmlFor="address">{t('Address')}</label>
                        </div>
                        <Input
                            id="address"
                            className="w-full"
                            value={_editItem?.address || ''}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                        />
                    </div>
                    <div className="relative ">
                        <div className="flex items-center gap-2 ">
                            <PhoneIcon className="size-4" />
                            <label htmlFor="phone">{t('Phone')}</label>
                        </div>
                        <Input
                            id="phone"
                            className="w-full"
                            value={_editItem?.phone || ''}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="description">{t('Description')}</label>
                        <Textarea
                            id="description"
                            value={_editItem?.description || ''}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                        />
                    </div>

                    <div className="w-full flex items-center justify-end gap-2 mt-4">
                        <PrimaryButton type="submit">
                            {_editType === 'new' ? t('Add Location') : t('Save Changes')}
                        </PrimaryButton>
                    </div>
                </form>
            </PopupModal>
        </div>
    );
}