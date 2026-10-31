import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { DangerButton, OutlineButton, PrimaryButton, SecondaryButton } from "@/src/components/ui/buttons";
import { BarcodeIcon, PencilIcon, PlusIcon, SaveIcon, TrashIcon } from "lucide-react";
import Image from "@/src/components/wraps/image";
import { randomString } from "@/src/services/other";
import { Input } from "@/src/components/ui/inputs";
import Select from "@/src/components/ui/select";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { LoaderShimmer } from "@/src/components/ui/loader";
import _, { cloneDeep } from "lodash";
import { PopupModal } from "@/src/components/modals";
import ColorPicker from "@/src/components/colorPicker";


const vehicleYears = Array.from({ length: 80 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return { value: year.toString(), label: year.toString() };
});
export default function VehiclesManage({
    allowFetch = true,
    customerId = null,
    sampleItem = false,
    items = [], allowedActions = ['add', 'edit', 'delete'],
    onSave = () => { }, onDelete = () => { }, onChange = () => { }
}) {

    const base = {
        tempId: Date.now() + randomString(10),
        vin: '',
        licensePlate: '',
        year: 0,
        make: '',
        model: '',
        trim: '',
        engine: '',
        color: '',
        odometer: 0,
        notes: '',
    }

    const preItems = [...items];
    if (sampleItem && preItems.length === 0) {
        preItems.push({ ...cloneDeep(base), tempId: Date.now() + randomString(10) });
    }
    const preEditingItem = sampleItem && preItems.length > 0 ? { ...preItems[0] } : null;
    // logger.log('VehiclesManage preItems:', preItems);
    // logger.log('VehiclesManage preEditingItem:', preEditingItem);

    const [_isLoading, _setIsLoading] = useState(false);
    const [_items, _setItems] = useState(preItems);
    const [_editingItem, _setEditingItem] = useState(preEditingItem);
    const [_editingType, _setEditingType] = useState('new');
    const [_vehicleMakes, _setVehicleMakes] = useState([]);
    const [_deleteItem, _setDeleteItem] = useState(null);


    const { t } = useTranslation();


    const fetchVehicleMakes = async () => {
        try {
            _setIsLoading(true);
            const response = await sendBackRequest({
                itsFor: 'vehiclesMakes',
            });

            if (response.success) {
                // _setVehicleMakes(response.data);
            } else {
                logger.error('Failed to fetch vehicle makes:', response.message);
                notify({
                    type: 'error',
                    message: 'Failed to fetch vehicle makes. Please try again later.',
                })
            }

            return response.data || [];
        } catch (error) {
            logger.error('Error fetching vehicle makes:', error);
            notify({
                type: 'error',
                message: 'Failed to fetch vehicle makes. Please try again later.',
            })
            return [];
        } finally {
            _setIsLoading(false);
        }
    };
    const fetchVehicleModels = async (make) => {
        try {
            _setIsLoading(true);
            const response = await sendBackRequest({
                itsFor: 'vehiclesModels',
                data: { make },
            });
            logger.log('fetchVehicleModels response:', response);

            if (response.success) {
                // const newVehicleMakes = _vehicleMakes.map(m => {
                //     if (m.id === make.id) {
                //         return { ...m, models: response.data };
                //     }
                //     return m;
                // });
                // _setVehicleMakes(newVehicleMakes);
            } else {
                logger.error('Failed to fetch vehicle models:', response.message);
                notify({
                    type: 'error',
                    message: 'Failed to fetch vehicle models. Please try again later.',
                })
            }

            return response.data || [];
        } catch (error) {
            logger.error('Error fetching vehicle models:', error);
            notify({
                type: 'error',
                message: 'Failed to fetch vehicle models. Please try again later.',
            })
            return [];
        } finally {
            _setIsLoading(false);
        }
    };
    const getVehicleModels = (makeId) => {
        // logger.log('getVehicleModels called with makeId:', makeId);
        const make = _vehicleMakes.find(m => m.id === makeId);
        return make?.models || [];
    };
    const handleInputChange = (id, field, value) => {
        let ei = { ..._editingItem, [field]: value };
        _setEditingItem(ei);
    };
    const handleCancelEdit = () => {
        //if new item with only tempId, remove it from the list
        if (_editingType === 'new') {
            const newItems = _items.filter(item => item.tempId !== _editingItem.tempId);
            _setItems(newItems);
            _setEditingItem(null);
        } else {
            _setEditingItem(null);
        }
    };
    const handleItemEditClick = (item) => {
        // logger.log('handleItemEditClick called with item:', item);
        _setEditingType('edit');
        _setEditingItem(item);
    };
    const handleItemDeleteClick = (item) => {
        _setDeleteItem(item);
        // onDelete(item);
    };
    const handleConfirmDelete = () => {
        if (_deleteItem) {
            const newItems = _items.filter(item => item.tempId !== _deleteItem.tempId);
            _setItems(newItems);
            _setDeleteItem(null);
        }

        //if its a new item with only tempId, just remove it from the list
        if (_editingType === 'edit') {
            onDelete(_deleteItem);
        }
    };
    const handleAddVehicle = (e) => {
        e.preventDefault();

        const newVehicle = { ...cloneDeep(base), tempId: Date.now() + randomString(10) };
        const newItems = [..._items, newVehicle];
        // logger.log(' newItems:', newItems);

        _setItems(newItems);
        _setEditingType('new');
        _setEditingItem(newVehicle);
    };
    const handleFormSubmit = (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        // logger.log('Form submitted with items:', _items);
        const newItems = _items.map(item => {
            if (_editingItem && _editingItem.tempId === item.tempId) {
                return _editingItem;
            }
            return item;
        });
        // logger.log('Updated items after form submission:', newItems);
        // logger.log('_editingItem:', _editingItem);
        _setEditingItem(null);
        _setItems(newItems);
        onSave([_editingItem]);
    }


    const getThisVehicleMakeName = (makeId) => {
        const make = _vehicleMakes.find(m => m.id === makeId);
        return make ? (make.name || make.makeName) : '';
    }
    const getThisVehicleModelName = (makeId, modelId) => {
        const make = _vehicleMakes.find(m => m.id === makeId);
        if (make && make.models) {
            const model = make.models.find(m => m.id === modelId);
            return model ? (model.name || model.modelName) : '';
        }
        return '';
    }

    // fetch vehicle makes and models
    //  when component mounts or when _items or _editingItem changes
    useEffect(() => {
        async function body() {
            try {
                const thisMakes = _vehicleMakes.length
                    ? _vehicleMakes : await fetchVehicleMakes();

                if (thisMakes.length === 0) {
                    logger.log('No vehicle makes found. Please add vehicle makes first.');
                    notify({
                        type: 'error',
                        message: 'No vehicle makes found. Please add vehicle makes first.',
                    })
                    return;
                }

                if (_vehicleMakes.length === 0) {
                    _setVehicleMakes(thisMakes);
                }

                const makeIds = _items.map(item => item.make).filter(make => make);
                if (_editingItem && _editingItem.make) {
                    makeIds.push(_editingItem.make);
                }
                // logger.log('makeIds:', makeIds);
                if (makeIds) {
                    const newMakesData = {}
                    for (const makeId of makeIds) {
                        const make = thisMakes.find(m => m.id === makeId);
                        const modelsAlreadyExist = thisMakes.find(m => m.id === makeId)?.models?.length > 0;
                        if (modelsAlreadyExist) {
                            logger.log(`Models for makeId ${makeId} already exist. Skipping fetch.`);
                            continue;
                        }
                        // logger.log('make:', make);
                        if (make) {
                            const modelData = await fetchVehicleModels(make);
                            newMakesData[makeId] = modelData;
                        } else {
                            logger.log(`Make with id ${makeId} not found in vehicle makes.`);
                            notify({
                                type: 'error',
                                message: `Make with id ${makeId} not found in vehicle makes.`,
                            })
                        }
                    }


                    if (Object.keys(newMakesData).length > 0) {
                        const updatedMakes = thisMakes.map(make => {
                            if (newMakesData[make.id]) {
                                return { ...make, models: newMakesData[make.id] };
                            }
                            return make;
                        });
                        _setVehicleMakes(updatedMakes);
                    }
                }
            } catch (error) {
                logger.error('Error in useEffect for fetching vehicle makes and models:', error);
                notify({
                    type: 'error',
                    message: 'Error fetching vehicle makes and models. Please try again later.',
                })
            }

        }
        body();
    }, [_items.length, _editingItem?.make]);


    // fetch customers vehicles when customerId defined or changed
    useEffect(() => {
        if (customerId && allowFetch) {
            // fetch vehicles for the given customerId
            const fetchCustomerVehicles = async () => {
                try {
                    _setIsLoading(true);
                    const response = await sendBackRequest({
                        itsFor: 'vehicles',
                        action: 'get',
                        data: { customerId },
                    });
                    // logger.log('fetchCustomerVehicles response:', response);

                    if (response.success) {
                        _setItems(response.data);
                    }
                } catch (error) {
                    logger.error('Error fetching customer vehicles:', error);
                }
                finally {
                    _setIsLoading(false);
                }

            }
            fetchCustomerVehicles();
        }
    }, [customerId]);


    // logger.log('_items:', _items);
    // logger.log('_editingItem:', _editingItem);
    // logger.log('_vehicleMakes:', _vehicleMakes);

    return (
        <div className="w-full">
            <div className="w-full min-h-40 rounded-md flex flex-col gap-2 bg-white">
                {
                    _items && _items.length > 0 && (
                        <div className="w-full flex gap-3 flex-col">
                            {
                                _items.map((item, index) => {
                                    const id = item?.tempId || item?.id || index;
                                    const editingId = _editingItem?.tempId || _editingItem?.id;
                                    const isEditing = _editingItem && (editingId === id);
                                    let thisItem = isEditing ? _editingItem : item;

                                    // logger.log('thisItem:',thisItem);
                                    return (
                                        (
                                            <form key={id} onSubmit={handleFormSubmit} className={`w-full flex flex-col md:flex-row gap-3 p-3 border border-gray-200 rounded-md shadow-sm ${isEditing ? 'bg-amber-50' : 'bg-white'}`}>
                                                <div className="w-full md:w-40 gap-2 flex flex-col justify-center items-center">
                                                    <div className="w-40 h-40 shrink-0 shadow-sm bg-gray-100 rounded-md flex items-center justify-center">
                                                        <Image
                                                            src="/images/other/car.png"
                                                            alt="Vehicle"
                                                            className="size-35 object-cover rounded-md opacity-60"
                                                        />

                                                    </div>
                                                    <LicensePlateEl
                                                        className="text-lg font-semibold"
                                                        disabled={!isEditing}
                                                        value={thisItem?.licensePlate ?? ''}
                                                        onChange={(v) => handleInputChange(item.tempId, 'licensePlate', v)}
                                                    />
                                                </div>
                                                <div className="w-full flex flex-col gap-3">
                                                    <div>
                                                        <div className="w-full relative flex flex-row gap-2 items-center">
                                                            <LoaderShimmer isLoading={_isLoading} />
                                                            {isEditing ?
                                                                <Input
                                                                    type="text"
                                                                    name="vin"
                                                                    disabled={!isEditing}
                                                                    value={thisItem?.vin ?? ''}
                                                                    onChange={(e) => handleInputChange(item.tempId, 'vin', e.target.value)}
                                                                    placeholder={t('VIN')}
                                                                />
                                                                : <span className="w-full h-9 rounded-md p-2 flex items-center">
                                                                    {thisItem?.vin || 'n/a'}
                                                                </span>
                                                            }
                                                            <BarcodeIcon className="w-5 h-5 text-gray-500" />
                                                        </div>
                                                        <div className="w-full flex flex-col md:flex-row gap-2">
                                                            <div className="relative w-52 flex flex-col gap-1">
                                                                <LoaderShimmer isLoading={_isLoading} />
                                                                <label htmlFor="make">
                                                                    {t('Make')}
                                                                </label>
                                                                {isEditing ?
                                                                    <Select
                                                                        name="make"
                                                                        required={true}
                                                                        searchable={true}
                                                                        disabled={!isEditing}
                                                                        value={thisItem?.make ?? ''}
                                                                        onChange={(e) => handleInputChange(item.tempId, 'make', e.target.value)}
                                                                        className="w-full"
                                                                        options={_vehicleMakes.map(make => ({ value: make.id, label: make.makeName }))}
                                                                    />
                                                                    : <span className="w-full h-9 rounded-md p-2 flex items-center">
                                                                        {getThisVehicleMakeName(thisItem?.make ?? '')}
                                                                    </span>
                                                                }
                                                            </div>
                                                            <div className="relative w-52 flex flex-col gap-1">
                                                                <LoaderShimmer isLoading={_isLoading} />
                                                                <label htmlFor="model">
                                                                    {t('Model')}
                                                                </label>
                                                                {isEditing ?
                                                                    <Select
                                                                        name="model"
                                                                        required={true}
                                                                        searchable={true}
                                                                        disabled={!isEditing}
                                                                        value={thisItem?.model ?? ''}
                                                                        onChange={(e) => handleInputChange(item.tempId, 'model', e.target.value)}
                                                                        className="w-full"
                                                                        options={getVehicleModels(thisItem?.make ?? '').map(model => ({ value: model.id, label: model.modelName }))}
                                                                    />
                                                                    : <span className="w-full h-9 rounded-md p-2 flex items-center">
                                                                        {getThisVehicleModelName(thisItem?.make ?? '', thisItem?.model ?? '')}
                                                                    </span>
                                                                }
                                                            </div>
                                                            <div className="relative w-30 flex flex-col gap-1">
                                                                <LoaderShimmer isLoading={_isLoading} />
                                                                <label htmlFor="year">
                                                                    {t('Year')}
                                                                </label>
                                                                {isEditing ?
                                                                    <Select
                                                                        name="year"
                                                                        placeholder={t('Select Year')}
                                                                        required={true}
                                                                        searchable={true}
                                                                        disabled={!isEditing}
                                                                        value={thisItem?.year ?? ''}
                                                                        onChange={(e) => handleInputChange(item.tempId, 'year', e.target.value)}
                                                                        className="w-full"
                                                                        options={vehicleYears}
                                                                    />
                                                                    : <span className="w-full h-9 rounded-md p-2 flex items-center">
                                                                        {thisItem?.year ?? ''}
                                                                    </span>
                                                                }
                                                            </div>
                                                            <div className="relative w-40 flex flex-col gap-1">
                                                                <LoaderShimmer isLoading={_isLoading} />
                                                                <label htmlFor="engine">
                                                                    {t('Engine')}
                                                                </label>
                                                                {isEditing ?
                                                                    <Input
                                                                        type="text"
                                                                        name="engine"
                                                                        disabled={!isEditing}
                                                                        value={thisItem?.engine ?? ''}
                                                                        onChange={(e) => handleInputChange(item.tempId, 'engine', e.target.value)}
                                                                        placeholder={t('Engine')}
                                                                    />
                                                                    : <span className="w-full h-9 rounded-md p-2 flex items-center">
                                                                        {thisItem?.engine ?? ''}
                                                                    </span>
                                                                }
                                                            </div>
                                                            <div className="relative w-14 flex flex-col gap-1">
                                                                <LoaderShimmer isLoading={_isLoading} />
                                                                <label htmlFor="color">
                                                                    {t('Color')}
                                                                </label>
                                                                <ColorPicker
                                                                    color={thisItem?.color ?? ''}
                                                                    onChange={(e) => handleInputChange(item.tempId, 'color', e.target.value)}
                                                                    name="color"
                                                                    label={t('Color')}
                                                                    disabled={!isEditing}
                                                                    className="w-full"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="w-full flex flex-col md:flex-row gap-2">
                                                            <div className="relative w-40 flex flex-col gap-1">
                                                                <LoaderShimmer isLoading={_isLoading} />
                                                                <label htmlFor="odometer">
                                                                    {t('Odometer')}
                                                                </label>
                                                                {isEditing ?
                                                                    <Input
                                                                        type="text"
                                                                        name="odometer"
                                                                        disabled={!isEditing}
                                                                        value={thisItem?.odometer ?? ''}
                                                                        onChange={(e) => handleInputChange(item.tempId, 'odometer', e.target.value)}
                                                                        placeholder={t('Odometer')}
                                                                    />
                                                                    : <span className="w-full h-9 rounded-md p-2 flex items-center">
                                                                        {thisItem?.odometer ?? ''}
                                                                    </span>
                                                                }
                                                            </div>
                                                            <div className="relative w-full flex flex-col gap-1">
                                                                <LoaderShimmer isLoading={_isLoading} />
                                                                <label htmlFor="notes">
                                                                    {t('Notes')}
                                                                </label>
                                                                {isEditing ?
                                                                    <Input
                                                                        type="text"
                                                                        name="notes"
                                                                        disabled={!isEditing}
                                                                        value={thisItem?.notes ?? ''}
                                                                        onChange={(e) => handleInputChange(item.tempId, 'notes', e.target.value)}
                                                                        placeholder={t('Notes')}
                                                                    />
                                                                    : <span className="w-full h-9 rounded-md p-2 flex items-center">
                                                                        {thisItem?.notes ?? ''}
                                                                    </span>
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="h-14">
                                                        {isEditing && _editingItem &&
                                                            <div className="w-full flex justify-end gap-2 mt-3">
                                                                <SecondaryButton
                                                                    type="button"
                                                                    onClick={handleCancelEdit}
                                                                    disabled={!isEditing}
                                                                >
                                                                    {t('Cancel')}
                                                                </SecondaryButton>
                                                                <SecondaryButton
                                                                    type="button"
                                                                    onClick={handleFormSubmit}
                                                                    disabled={!isEditing}
                                                                >
                                                                    <SaveIcon className="size-4" />
                                                                    {t('Save')}
                                                                </SecondaryButton>
                                                            </div>
                                                        }
                                                        {!isEditing && !_editingItem &&
                                                            <div className="flex gap-3">
                                                                <div className="w-full flex justify-end gap-2 mt-3">
                                                                    {allowedActions.includes('delete') &&
                                                                        <DangerButton
                                                                            type="button"
                                                                            onClick={() => handleItemDeleteClick(item)}
                                                                        >
                                                                            <TrashIcon className="size-4" />
                                                                            {t('Delete')}
                                                                        </DangerButton>
                                                                    }
                                                                    {allowedActions.includes('edit') &&
                                                                        <SecondaryButton
                                                                            type="button"
                                                                            onClick={() => handleItemEditClick(item)}
                                                                        >
                                                                            <PencilIcon className="size-4" />
                                                                            {t('Edit')}
                                                                        </SecondaryButton>
                                                                    }
                                                                </div>
                                                            </div>
                                                        }
                                                    </div>
                                                </div>

                                            </form>
                                        )
                                    )
                                })
                            }
                        </div>
                    )
                }
                {
                    _items && _items.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center ">
                            <Image
                                src="/images/other/car-wash.png"
                                alt="No data"
                                className="w-14 h-14 opacity-60"
                            />
                            <p>
                                {t('No vehicles added yet.')}
                            </p>
                        </div>
                    )
                }

                {allowedActions.includes('add') &&
                    <div className="w-full">
                        <PrimaryButton className="w-full" onClick={handleAddVehicle} disabled={_editingItem ? true : false}>
                            <PlusIcon className="size-4" />
                            {t('Add Vehicle')}
                        </PrimaryButton>
                    </div>
                }

                {
                    _deleteItem && (
                        <PopupModal isOpen={true} onClose={() => _setDeleteItem(null)}>
                            <div className="w-full flex flex-col gap-3 p-2">
                                <h2 className="text-lg font-semibold mb-4">{t('Confirm Delete')}</h2>
                                <p className="mb-4">{t('Are you sure you want to delete this vehicle?')}</p>
                                <div className="flex justify-end gap-2">
                                    <SecondaryButton onClick={() => _setDeleteItem(null)}>
                                        {t('Cancel')}
                                    </SecondaryButton>
                                    <DangerButton onClick={handleConfirmDelete}>
                                        {t('Delete')}
                                    </DangerButton>
                                </div>
                            </div>
                        </PopupModal>
                    )
                }
            </div>
        </div>
    );
}



const LicensePlateEl = ({ className = '', value = '', disabled = false, onChange = () => { } }) => {

    return (
        <div className={`max-w-96 h-12 p-1 gap-1 rounded-md shrink-0 bg-white border overflow-hidden font-mono flex items-center ${className} `}>
            <div className="w-3/12 h-full flex flex-col items-center justify-center border-r-3 border-olive-400">
                <Image
                    src="/images/flags/am.svg"
                    alt="License Plate"
                    className="h-2/5 w-auto"
                />
                <span className="h-3/5">AM</span>
            </div>
            <div className="w-9/12 flex justify-center">
                <Input
                    type="text"
                    name="licensePlate"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    placeholder="123456"
                    className="w-full h-full border-none rounded-none focus:ring-0 focus:border-none"
                />
            </div>
        </div>
    )
}