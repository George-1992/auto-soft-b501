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
import { BuildingComplexIcon, GhostIcon, MapPinHouseIcon, PhoneIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";




export default function DataRenderer({
    itsFor,
    editComponent: EditComponent = null,
}) {

    setMetas({
        title: itsFor.charAt(0).toUpperCase() + itsFor.slice(1),
        description: `Manage your ${itsFor}`,
    });


    // const itsFor = 'locations';
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
        if (e && e?.preventDefault) {
            e.preventDefault();
        }

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
                    <PlusIcon className="size-4" /> {t('Add New')}
                </PrimaryButton>
            </div>



            <div className="flex flex-wrap gap-5 md:gap-10">
                {/* {data here} */}
            </div>

            {EditComponent && _editItem !== null && (
                <EditComponent
                    isOpen={_editItem !== null}
                    onClose={dismissEditModal}
                    data={_editItem}

                    editType={_editType}
                    onInputChange={handleInputChange}
                    onSubmit={handleFormSubmit}
                />
            )}


        </div>
    );
}