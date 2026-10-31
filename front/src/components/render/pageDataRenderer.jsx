import { dataSamples } from "@/data/samples";
import { ExpandableModal, PopupModal } from "@/src/components/modals";
import { FilterComponent } from "@/src/components/render/filter";
import { DangerButton, PrimaryButton } from "@/src/components/ui/buttons";
import Card from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/inputs";
import { LoaderShimmer } from "@/src/components/ui/loader";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import _, { cloneDeep } from "lodash";
import { FunnelIcon, GhostIcon, Grid2x2Icon, ListIcon, MapPinHouseIcon, PencilIcon, PencilLine, PhoneIcon, PlusIcon, RotateCcwIcon, Rows4Icon, SearchIcon, SquareCheckBigIcon, SquareCheckIcon, SquareIcon, TimerResetIcon, Trash2, Trash2Icon } from "lucide-react";
import { use } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";



const DefaultEditComponent = ({
    columns = [],
    isOpen = false, data = null, editType = 'new',
    onClose = () => { }, onInputChange = () => { }, onSubmit = () => { }
}) => {

    const { t } = useTranslation();


    const handleFormSubmit = (e) => {
        e.preventDefault();
        onSubmit(e);
    }

    return (
        <ExpandableModal isOpen={isOpen} onClose={onClose}>
            <div className="w-full flex flex-col gap-3 p-5">
                <form className="flex flex-col gap-3" onSubmit={handleFormSubmit}>
                    {columns.map((key) => (
                        <div key={key} className="flex flex-col gap-1">
                            <label className="font-semibold">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                            <Input
                                type="text"
                                required={true}
                                name={key}
                                value={data?.[key] ?? ''}
                                onChange={(e) => onInputChange(key, e.target.value)}
                                className="border border-gray-300 rounded-md p-2"
                            />
                        </div>
                    ))}
                    <div className="flex justify-end gap-3 mt-5">
                        <PrimaryButton
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                        >
                            {t('Cancel')}
                        </PrimaryButton>
                        <PrimaryButton
                            type="submit"
                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                            {t('Save')}
                        </PrimaryButton>
                    </div>
                </form>
            </div>
        </ExpandableModal >
    );
};

const defaultCardViewer = ({ columns = [], data, children }) => {

    return (
        <Card className="w-full flex flex-col gap-3 p-5 overflow-hidden">
            {columns.map((key) => (
                <div key={key} className="flex flex-col gap-1">
                    <label className="font-semibold">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                    <p className="text-gray-700">{data?.[key] ?? ''}</p>
                </div>
            ))}
            {children}
        </Card>
    );
}

export default function DataRenderer({
    itsFor,
    defaultDataViewType = 'table', // 'table' or 'card'
    dataViewOptions = ['table', 'card'],
    editComponent: EditComponent = DefaultEditComponent,
    cardViewer: CardViewer = defaultCardViewer,
    columns = [],
}) {


    // const itsFor = 'locations';
    const sampleData = cloneDeep(dataSamples[itsFor] || {});
    const [_data, _setData] = useState(null);
    const [_loading, _setLoading] = useState(true);
    const [_editItem, _setEditItem] = useState(null);
    const [_editType, _setEditType] = useState('new');
    const [_deletingItems, _setDeletingItems] = useState([]);
    const [_selectedItems, _setSelectedItems] = useState([]);
    const [_dataViewType, _setDataViewType] = useState(defaultDataViewType); // 'table' or 'card'

    const [_isFiltersOpen, _setIsFiltersOpen] = useState(false);
    const [_filters, _setFilters] = useState([]);
    const [_filterOptions, _setFilterOptions] = useState([]);
    const [_searchQuery, _setSearchQuery] = useState('');

    const [_totalCount, _setTotalCount] = useState(0);
    const [_itemsPerPage, _setItemsPerPage] = useState(20);
    const [_offset, _setOffset] = useState(0);
    const [_limit, _setLimit] = useState(_itemsPerPage);

    const [_vehicleMakes, _setVehicleMakes] = useState([]);
    const [_vehicleModels, _setVehicleModels] = useState([]);

    const { t } = useTranslation();
    const defaultColWidth = 180;




    const fetchData = async (d) => {
        try {
            if (!d) {
                logger.error("fetchData error", "Missing request data");
                return {
                    success: false,
                    message: 'Missing request data',
                };
            };
            _setLoading(true);

            if (typeof d.offset === 'undefined') {
                d.offset = _offset;
            }
            if (typeof d.limit === 'undefined') {
                d.limit = _limit;
            }

            if (_searchQuery && !d.searchQuery) {
                d.searchQuery = _searchQuery;
            }
            if (!d.itsFor) {
                d.itsFor = itsFor;
            }
            if (!d.action) {
                d.action = 'get';
            }
            // logger.info("fetchData d", d);

            // await new Promise((resolve) => setTimeout(resolve, 1000000)); // Wait for state to update
            const response = await sendBackRequest(d);
            if (response.totalCount !== undefined) {
                _setTotalCount(response.totalCount);
            }
            return response;
        } catch (error) {
            logger.error("fetchData error", error);
            return {
                success: false,
                message: 'Error fetching data',
            }
        } finally {
            _setLoading(false);
        }
    };

    useEffect(() => {
        const body = async () => {
            try {
                const response = await fetchData({
                    action: 'get',
                    itsFor: itsFor,
                    offset: _offset,
                    limit: _limit,
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


    const handleFormSubmit = async (e) => {
        if (e && e?.preventDefault) {
            e.preventDefault();
        }

        // logger.info("handleFormSubmit _editItem", e);
        // return

        try {
            const toSaveItem = e && typeof e === 'object' && e.target
                ? Object.fromEntries(new FormData(e.target))
                : _editItem;
            _setLoading(true);
            const action = _editType === 'new' ? 'create' : 'update';
            // logger.info("handleFormSubmit toSaveItem", toSaveItem);

            const response = await sendBackRequest({
                itsFor: itsFor,
                action: action,
                data: toSaveItem,
            });
            logger.info("handleFormSubmit response", response);


            if (response.success) {
                notify({
                    type: 'success',
                    message: _editType === 'new' ? t('Added successfully') : t('Updated successfully'),
                });

                // merage data
                const newData = [..._data];
                newData.push(Array.isArray(response.data) ? response.data[0] : response.data);

                _setData(newData);
                dismissEditModal();
            } else {
                logger.error("handleFormSubmit error", response.message || 'Error saving item');
                notify({
                    type: 'error',
                    message: response.message || 'Error saving item',
                });
            }

        } catch (error) {
            logger.error("handleFormSubmit error", error);
            notify({
                type: 'error',
                message: 'Error saving item',
            });
        } finally {
            _setLoading(false);
        }
    };

    const handleInputChange = (field, value) => {
        _setEditItem((prev) => ({
            ...prev,
            [field]: value,
        }));
    };
    const handleEditRow = (row) => {
        _setEditType('update');
        _setEditItem(row);
    };
    const handleDeleteRows = async (row) => {
        try {
            const arr = Array.isArray(row) ? row : [row];
            // console.log('arr: ', arr);

            _setLoading(true);
            const response = await sendBackRequest({
                action: 'delete',
                itsFor: itsFor,
                data: arr,
            });

            if (response.success) {

                const newData = _data.filter((item) => {
                    // Extract the ID from the item (support object with .id, .ID, or primitive value)
                    const itemId = item?.id ?? item?.ID ?? item;
                    if (itemId == null) return true; // Keep items with missing IDs
                    // Check if any element in arr matches this itemId
                    return !arr.some((r) => {
                        const rId = r?.id ?? r?.ID ?? r;
                        return rId != null && String(rId) === String(itemId);
                    });
                });
                _setData(newData);

                notify({
                    type: 'success',
                    message: t('Item deleted successfully'),
                });
                if (_deletingItems.length > 0) {
                    _setDeletingItems([]);
                }
                if (_selectedItems.length > 0) {
                    _setSelectedItems([]);
                }
                return;
            }

            logger.error("handleDeleteRows error", response.message || 'Error deleting item');
            notify({
                type: 'error',
                message: response.message || 'Error deleting item',
            });


        } catch (error) {
            logger.error("handleDeleteRows error", error);
            notify({
                type: 'error',
                message: 'Error deleting item',
            });
        } finally {
            _setLoading(false);
        }
    };
    const initDeleteRow = async (rows) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        _setDeletingItems(arr);
    };
    const cancelDeleteRow = () => {
        _setDeletingItems([]);
    };
    const handleAddNew = async () => {
        try {
            // const nd = clearObjectValues(cloneDeep(sampleData));
            // logger.info("handleAddNew nd", nd);
            _setEditType('new');
            _setEditItem({});

        } catch (error) {
            logger.error("handleAddNew error", error);
            notify({
                type: 'error',
                message: 'Error adding new location',
            });
        }
    };

    const handleSelectItem = (itemId) => {
        if (_selectedItems.includes(itemId)) {
            _setSelectedItems(_selectedItems.filter((id) => id !== itemId));
        } else {
            _setSelectedItems([..._selectedItems, itemId]);
        }
    };
    const clearSelectedItems = () => {
        _setSelectedItems([]);
    };

    const dismissEditModal = () => {
        _setEditItem(null);
        _setEditType('new');
    }

    const handleFilterChange = (filterKey, value) => {
        _setFilters((prev) => ({
            ...prev,
            [filterKey]: value,
        }));
    };
    const handleApplyFilters = () => {
        logger.info("handleApplyFilters _filters", _filters);
    };
    const handleClearFilters = () => {
        _setFilters([]);
    };
    const handleItemsPerPageChange = async (value) => {
        try {
            const v = parseInt(value);

            if (isNaN(v) || v <= 0) {
                logger.error("handleItemsPerPageChange error", "Invalid items per page value:", value);
                return;
            }

            _setItemsPerPage(v);
            _setOffset(0);
            _setLimit(v);

            const response = await fetchData({
                itsFor: itsFor,
                action: 'get',
                offset: 0,
                limit: v,
            });
            // logger.info("handleItemsPerPageChange response", response);

            if (response.success) {
                _setData(response.data);
            } else {
                logger.error("handleItemsPerPageChange error", response.message || 'Error fetching data');
                notify({
                    type: 'error',
                    message: response.message || 'Error fetching data',
                });
            }

        } catch (error) {
            logger.error("handleItemsPerPageChange error", error);
        }
    };



    // pages, pagination
    const getTotalPages = () => {
        return Math.max(1, Math.ceil(_totalCount / _itemsPerPage) || 1);
    };
    const getCurrentPageNumber = () => {
        const totalPages = getTotalPages();
        const current = Math.floor(_offset / _itemsPerPage) + 1;
        return Math.min(totalPages, Math.max(1, current));
    };
    const getPageByNumber = (pageNumber) => {
        return {
            pageNumber,
            offset: (pageNumber - 1) * _itemsPerPage,
            limit: _itemsPerPage,
        };
    };
    const getPages = () => {
        const pages = [];
        const totalPages = getTotalPages();
        for (let i = 1; i <= totalPages; i++) {
            pages.push(getPageByNumber(i));
        }
        // logger.info("getPages pages", pages);
        return pages;
    };
    const getVisiblePages = () => {
        const totalPages = getTotalPages();
        const currentPage = getCurrentPageNumber();

        let startPage = Math.max(1, currentPage - 3);
        let endPage = Math.min(totalPages, currentPage + 3);

        const pageNumbers = new Set([1]);
        for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
            pageNumbers.add(pageNumber);
        }

        const visiblePages = Array.from(pageNumbers)
            .sort((a, b) => a - b)
            .map((pageNumber) => getPageByNumber(pageNumber));

        return visiblePages;
    };
    const handlePageChange = async (newPage) => {
        try {
            _setOffset(newPage.offset);
            _setLimit(newPage.limit);
            const response = await fetchData({
                itsFor: itsFor,
                action: 'get',
                offset: newPage.offset,
                limit: newPage.limit,
            });
            // logger.info("handlePageChange response", response);

            if (response.success) {
                _setData(response.data);
            } else {
                logger.error("handlePageChange error", response.message || 'Error fetching data');
                notify({
                    type: 'error',
                    message: response.message || 'Error fetching data',
                });
            }
        } catch (error) {
            logger.error("handlePageChange error", error);
        }
    };
    const nextPage = () => {
        const currentPage = getCurrentPageNumber();
        const totalPages = getTotalPages();
        if (currentPage < totalPages) {
            handlePageChange(getPageByNumber(currentPage + 1));
        }
    };
    const prevPage = () => {
        const currentPage = getCurrentPageNumber();
        if (currentPage > 1) {
            handlePageChange(getPageByNumber(currentPage - 1));
        }
    };



    // filters
    const handleOpenFilter = async () => {
        _setIsFiltersOpen(true);
        try {
            // logger.info("handleOpenFilter columns", itsFor, columns);
            // const response = await sendBackRequest({
            //     itsFor: itsFor,
            //     action: 'uniques',
            //     data: columns.map(c => ({ name: c.name })),
            // });
            // logger.info("handleOpenFilter response", response);

        } catch (error) {
            logger.error("handleOpenFilter error", error);
        }

    };
    const applyFilters = (filters) => {
        // logger.info("applyFilters filters", filters);
        _setFilters(filters);
        _setIsFiltersOpen(false);
    };
    // logger.info("applyFilters filters", _filters);

    const getCellValue = (row, col) => {
        try {
            if (!row || !col) return '';

            // logger.info("getCellValue row, col", row, col);
            let v = row[col.name];

            if (col.name === 'make') {
                const makeObj = _vehicleMakes.find(m => m.id === v);
                v = makeObj?.makeName || makeObj?.name || v;
            }
            if (col.name === 'model') {
                const modelObj = _vehicleModels.find(m => m.id === v);
                v = modelObj?.modelName || modelObj?.name || v;
            }
            // if (v === 0) {
            //     return 'n/a';
            // }
            return v !== undefined && v !== null ? String(v) : '';
        } catch (error) {
            logger.error("getCellValue error", error);
            return 'err';
        }
    };


    // inital fetch data
    useEffect(() => {
        const handleFetchData = async (term) => {
            try {
                // logger.info('handleFetchData _searchQuery', term);
                const response = await fetchData({
                    searchQuery: term,
                });
                // logger.info('handleFetchData response', response);

                if (response.success) {
                    _setData(response.data);
                } else {
                    logger.error("handleFetchData error", response.message || 'Error fetching data');
                    notify({
                        type: 'error',
                        message: response.message || 'Error fetching data',
                    });
                }
            } catch (error) {
                logger.error('handleFetchData error', error);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Enter') {
                const focusedElement = document.activeElement;
                if (focusedElement?.tagName === 'INPUT' && focusedElement.id === 'search') {
                    console.log('Search input is focused, applying search...');
                    // Execute search logic here
                    const t = _searchQuery.trim() || focusedElement.value.trim();
                    handleFetchData(t);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Properly return cleanup function directly to useEffect
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);


    //vehicle makes and models
    const dataVehicleMakes = (() => {
        let v = _data?.map(item => item.make).filter(Boolean);
        return Array.from(new Set(v));
    })();
    const dataVehicleModels = (() => {
        let v = _data?.map(item => item.model).filter(Boolean);
        return Array.from(new Set(v));
    })();
    useEffect(() => {
        // logger.info("useEffect _data", _data);
        const body = async () => {
            try {
                if (dataVehicleMakes.length > 0) {
                    const makeResponse = await sendBackRequest({
                        itsFor: 'vehiclesMakes',
                        action: 'get',
                        data: { ids: dataVehicleMakes },
                    });
                    // logger.info("useEffect makeResponse", makeResponse);

                    if (makeResponse.success) {
                        _setVehicleMakes(makeResponse.data);
                    } else {
                        logger.error("useEffect makeResponse error", makeResponse.message || 'Error fetching vehicle makes');
                        notify({
                            type: 'error',
                            message: makeResponse.message || 'Error fetching vehicle makes',
                        });
                    }
                }

                if (dataVehicleModels.length > 0) {
                    const modelResponse = await sendBackRequest({
                        itsFor: 'vehiclesModels',
                        action: 'get',
                        data: { ids: dataVehicleModels },
                    });
                    // logger.info("useEffect modelResponse", modelResponse);

                    if (modelResponse.success) {
                        _setVehicleModels(modelResponse.data);
                    } else {
                        logger.error("useEffect modelResponse error", modelResponse.message || 'Error fetching vehicle models');
                        notify({
                            type: 'error',
                            message: modelResponse.message || 'Error fetching vehicle models',
                        });
                    }
                }


            } catch (error) {
                logger.error("useEffect error", error);
                notify({
                    type: 'error',
                    message: 'Error fetching vehicle makes or models',
                });
            }
        };
        body();
    }, [dataVehicleMakes.length, dataVehicleModels.length]);




    // logger.info('_data', _data);
    // logger.info('_deletingItems', _deletingItems);

    return (
        <div className="w-full relative rounded-md">

            {/* tooltip */}
            <div className="w-full py-3 gap-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-full md:w-60 relative rounded-md">
                        <Input
                            type="text"
                            id="search"
                            value={_searchQuery}
                            onChange={(e) => _setSearchQuery(e.target.value)}
                            placeholder={t('🔍Search...')}
                            className="bg-white"
                        />
                        <LoaderShimmer isLoading={_loading} />
                    </div>
                    {dataViewOptions && dataViewOptions.length > 0 &&
                        <div className="relative bg-white rounded-md flex items-center justify-between border border-gray-200 text-gray-400 shadow-sm">
                            <LoaderShimmer isLoading={_loading} />

                            {dataViewOptions.includes('table') &&
                                <button onClick={() => _setDataViewType('table')} className={"p-1.5 w-10 flex justify-center rounded-l-md" + (_dataViewType === 'table' ? ' bg-[var(--primary)] text-[var(--primary-foreground)]' : '')}>
                                    <ListIcon className="size-5" />
                                </button>
                            }
                            {dataViewOptions.includes('card') &&
                                <button onClick={() => _setDataViewType('grid')} className={"p-1.5 w-10 flex justify-center rounded-r-md" + (_dataViewType === 'grid' ? ' bg-[var(--primary)] text-[var(--primary-foreground)]' : '')}>
                                    <Grid2x2Icon className="size-5" />
                                </button>
                            }
                        </div>
                    }

                    <div className="">
                        <PrimaryButton onClick={() => handleOpenFilter()} className="relative" >
                            <FunnelIcon className="size-4" />
                            {t('Filters')}
                            {
                                _filters && _filters.length > 0 && (
                                    <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-mist-400 text-white text-xs font-bold">
                                        {_filters.length}
                                    </span>
                                )
                            }
                        </PrimaryButton>
                    </div>
                </div>
                <div className="flex items-center gap-3 relative rounded-md">
                    <LoaderShimmer isLoading={_loading} />
                    {
                        _selectedItems.length > 0 && (
                            <div className="flex items-center gap-1"    >
                                <DangerButton onClick={() => initDeleteRow(_selectedItems)}>
                                    <Trash2Icon className="size-4" /> {t('Delete Selected')} ({_selectedItems.length})
                                </DangerButton>
                                <PrimaryButton onClick={() => clearSelectedItems()}>
                                    <RotateCcwIcon className="size-4" />    {t('Clear')}
                                </PrimaryButton>
                            </div>
                        )
                    }
                    <select className="border bg-white border-gray-300 rounded-md px-2 py-1.5" value={_itemsPerPage} onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}>
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>


                    <PrimaryButton onClick={handleAddNew} >
                        <PlusIcon className="size-4" /> {t('Add New')}
                    </PrimaryButton>

                </div>
            </div>

            <div className="w-full relative rounded-md">
                <LoaderShimmer isLoading={_loading} />
                {/* empty card */}
                {_data && _data.length === 0 && (
                    <Card className="w-full flex flex-col items-center justify-center gap-3 py-10">
                        <LoaderShimmer isLoading={_loading} />
                        <GhostIcon className="size-10 text-gray-400" />
                        <p className="text-gray-500">{t('No data found')}</p>
                    </Card>
                )}

                {/* data table */}
                {_data && _data.length > 0 && _dataViewType === 'table' && (
                    <div className="w-full overflow-hidden">
                        <div className="w-full max-h-[calc(100vh-225px)] overflow-auto bg-gray-50 rounded-t-md border border-gray-200">
                            {/* header */}
                            {columns.length > 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 min-w-max border-b border-gray-200">
                                    <div
                                        className="font-semibold text-gray-700 flex-shrink-0 text-center"
                                        style={{ width: '120px' }}
                                    >
                                        {t('Actions')}
                                    </div>
                                    {columns.map((col, index) => {
                                        const colWidth = col.width || defaultColWidth;

                                        return (
                                            <div
                                                key={index}
                                                className="font-semibold text-gray-700 flex-shrink-0"
                                                style={{ width: `${colWidth}px` }}
                                            >
                                                {col.label || col.name}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {/* body */}
                            <div className="w-full divide-y divide-gray-200 bg-white min-w-max">

                                {_data.map((row, rowIndex) => {
                                    const isSelected = _selectedItems.includes(row?.id);
                                    return (
                                        <div key={rowIndex} className={"flex items-center gap-2 px-3 py-2" + (isSelected ? ' bg-blue-50' : '')}>
                                            <div className="flex items-center justify-center gap-2 flex-shrink-0" style={{ width: '120px' }}>
                                                {!isSelected
                                                    ? <button onClick={() => handleSelectItem(row?.id)}>
                                                        <SquareIcon className="size-5" />
                                                    </button>
                                                    : <button onClick={() => handleSelectItem(row?.id)}>
                                                        <SquareCheckIcon className="size-5" />
                                                    </button>
                                                }


                                                <button
                                                    type="button"
                                                    title={t('Edit')}
                                                    aria-label={t('Edit')}
                                                    onClick={() => handleEditRow(row)}
                                                    className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                                                >
                                                    <PencilIcon className="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    title={t('Delete')}
                                                    aria-label={t('Delete')}
                                                    onClick={() => initDeleteRow(row)}
                                                    className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                            {columns.map((col, colIndex) => {
                                                const colWidth = col.width || defaultColWidth;

                                                return (
                                                    <div
                                                        key={colIndex}
                                                        className="text-gray-600 flex-shrink-0 truncate overflow-hidden"
                                                        style={{ width: `${colWidth}px` }}
                                                    >
                                                        {getCellValue(row, col)}
                                                    </div>
                                                );
                                            })}

                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
                {/* card viewer */}
                {_data && _data.length > 0 && _dataViewType === 'grid' && (
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {_data.map((row, rowIndex) => (
                            <div key={rowIndex} className="w-full">
                                <CardViewer columns={columns.map(c => c.name)} data={row} >
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button
                                            type="button"
                                            title={t('Edit')}
                                            aria-label={t('Edit')}
                                            onClick={() => handleEditRow(row)}
                                            className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                                        >
                                            <PencilIcon className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            title={t('Delete')}
                                            aria-label={t('Delete')}
                                            onClick={() => initDeleteRow(row)}
                                            className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                </CardViewer>
                            </div>
                        ))}
                    </div>
                )}

                {/* pagination */}
                {_data && _data.length > 0 && (
                    <div className={"w-full flex items-center rounded-b-md justify-between gap-3 px-3 py-2 bg-gray-50 border-t border-gray-200"}>
                        <div className="text-gray-600">
                            {t('Total')}: {_totalCount}
                        </div>
                        <div className="flex items-center gap-2">
                            {(() => {
                                const currentPage = getCurrentPageNumber();
                                const totalPages = getTotalPages();
                                const hasPrev = currentPage > 1;
                                const hasNext = currentPage < totalPages;

                                return (
                                    <>
                                        <button
                                            disabled={!hasPrev}
                                            onClick={() => prevPage()}
                                            className="px-3 py-1 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {t('Prev')}
                                        </button>
                                        {
                                            getVisiblePages().map((page) => (
                                                <button
                                                    key={page.pageNumber}
                                                    onClick={() => {
                                                        handlePageChange(page);
                                                    }}
                                                    className={"px-3 py-1 rounded-md border border-gray-300" + (_offset === page.offset ? ' bg-[var(--primary)] text-[var(--primary-foreground)]' : '')}
                                                >
                                                    {page.pageNumber}
                                                </button>
                                            ))
                                        }
                                        <button
                                            disabled={!hasNext}
                                            onClick={() => nextPage()}
                                            className="px-3 py-1 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {t('Next')}
                                        </button>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}
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

            {_deletingItems.length > 0 && (
                <PopupModal
                    isOpen={_deletingItems.length > 0}
                    onClose={() => _setDeletingItems([])}
                    title={t('Confirm Deletion')}
                    message={t('Are you sure you want to delete this item?')}
                >
                    <div className="w-96 flex flex-col gap-2">
                        <p>
                            {t('Items')} {':'} {_deletingItems.length}
                        </p>
                        <p>
                            {t('Are you sure you want to delete ?')}
                        </p>
                        <p className=" text-red-500">
                            {t('This action cannot be undone.')}
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 mt-5">
                        <PrimaryButton
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                cancelDeleteRow()
                            }}
                        >
                            {t('Cancel')}
                        </PrimaryButton>
                        <DangerButton
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteRows(_deletingItems);
                            }}
                        >
                            {t('Delete')}
                        </DangerButton>
                    </div>
                </PopupModal>
            )}

            {_isFiltersOpen && (
                <PopupModal
                    isOpen={_isFiltersOpen}
                    onClose={() => _setIsFiltersOpen(false)}
                    title={t('Filters')}
                    className="w-4/5 md:w-[700px]"
                >
                    <div className="w-full">
                        <FilterComponent
                            itsFor={itsFor}
                            columns={columns}
                            filters={_filters}
                            onSave={(filters) => {
                                applyFilters(filters);
                            }}
                        />
                    </div>
                </PopupModal>
            )}

        </div>
    );
}

